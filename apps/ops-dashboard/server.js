'use strict';
/**
 * Morning-Quiz · Ops Console — a small, read-only web service that surfaces
 * LIVE aggregate operations metrics for the morning-quiz platform.
 *
 * Design constraints (deliberate):
 *   - READ-ONLY. Runs SELECTs only; never writes.
 *   - AGGREGATE / NO PII. No student names, no individual scores — only counts,
 *     rates and content-bank identifiers. Safe to expose.
 *   - ISOLATED. A separate Railway service; does not touch the main API.
 *
 * Env:
 *   DATABASE_URL   Postgres connection (internal Railway URL in prod)
 *   CLASS_ID       morning-quiz class to report on (default: G11 IELTS Test)
 *   ACCESS_KEY     optional — if set, require ?k=<key> to view
 *   PORT           provided by Railway
 */
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const CLASS_ID = process.env.CLASS_ID || 'cmoux0jj900m9oc28r4sptjj0';
const ACCESS_KEY = process.env.ACCESS_KEY || '';
const PORT = process.env.PORT || 8080;

const url = process.env.DATABASE_URL || '';
const ssl = /railway\.internal|localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false };
const pool = new Pool({ connectionString: url, ssl, max: 4, idleTimeoutMillis: 30000 });

const q = (text, params) => pool.query(text, params).then((r) => r.rows);

// ── SGT (UTC+8) date helpers ────────────────────────────────────────────────
function sgtToday() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
function sgtWeekMonday() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const dow = d.getUTCDay() || 7; // Sun=7
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

// ── metrics ─────────────────────────────────────────────────────────────────
async function buildMetrics() {
  const today = sgtToday();
  const weekStart = sgtWeekMonday();
  const weekEnd = new Date(new Date(weekStart + 'T00:00:00Z').getTime() + 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  const [bankTiers] = [
    await q(
      `select case
         when "provenanceTag" like '%simplified%' then 'simplifiedB'
         when "provenanceTag" like '%1184_summary%' then 'sectionC'
         else 'olevelB' end tier,
         count(distinct regexp_replace(split_part("sourceRef",'/',2),'_v[0-9]+','','g')) stories
       from "Question"
       where status='active' and "provenanceTag" like 'ai_authored_olevel%'
       group by tier`,
    ),
  ];
  const bankMap = {};
  bankTiers.forEach((r) => (bankMap[r.tier] = Number(r.stories)));

  const ielts = await q(
    `select count(distinct regexp_replace("sourceRef", '/Q[0-9]+$','')) as n
       from "Question" where status='active' and "sourceRef" like 'IELTS/%'`,
  );
  const ieltsPassages = Number(ielts[0] ? ielts[0].n : 0);

  // simplified runway for THIS class = bank stories - stories this class ever did
  const servedSimplified = await q(
    `select count(distinct regexp_replace(split_part(p.config->>'paperKey','/',2),'_v[0-9]+','','g')) as n
       from "MorningQuizSession" s
       join "PaperAssignment" pa on pa.id=s."paperAssignmentId"
       join "Paper" p on p.id=pa."paperId"
       where s."classId"=$1 and s.status<>'cancelled' and s.level='ielts_simplified'`,
    [CLASS_ID],
  );
  const simplifiedServed = Number(servedSimplified[0] ? servedSimplified[0].n : 0);

  const sessions = await q(
    `select s.date::date::text d, s.level, s.status,
        regexp_replace(coalesce(p.config->>'paperKey', p.config->>'passageRef',''),'_v[0-9]+','','g') story
       from "MorningQuizSession" s
       join "PaperAssignment" pa on pa.id=s."paperAssignmentId"
       join "Paper" p on p.id=pa."paperId"
       where s."classId"=$1 and s.date>=$2 and s.date<$3 and s.status<>'cancelled'
       order by s.date, s.level`,
    [CLASS_ID, weekStart, weekEnd],
  );

  const repeatRows = await q(
    `with hist as (
        select s.date::date d, s.level,
          regexp_replace(coalesce(p.config->>'paperKey', p.config->>'passageRef',''),'_v[0-9]+','','g') story
        from "MorningQuizSession" s
        join "PaperAssignment" pa on pa.id=s."paperAssignmentId"
        join "Paper" p on p.id=pa."paperId"
        where s."classId"=$1 and s.status<>'cancelled'
      )
      select coalesce(sum((select count(*) from hist h
        where h.level=tw.level and h.story=tw.story and h.d < tw.d)),0)::int as collisions
      from hist tw where tw.d>=$2 and tw.d<$3`,
    [CLASS_ID, weekStart, weekEnd],
  );
  const repeats = Number(repeatRows[0] ? repeatRows[0].collisions : 0);

  // latest quiz day with any submission (<= today) → grading + attendance panel
  const latestRow = await q(
    `select max(s.date)::date::text d
       from "MorningQuizSession" s
       where s."classId"=$1 and s.date<= $2::date
         and exists (select 1 from "StudentSubmission" ss where ss."assignmentId"=s."paperAssignmentId")`,
    [CLASS_ID, today],
  );
  const latestDate = latestRow[0] && latestRow[0].d ? latestRow[0].d : today;

  const g = (
    await q(
      `with sess as (
          select id, "paperAssignmentId" from "MorningQuizSession"
          where "classId"=$1 and date=$2::date
        )
        select
          (select count(*) from "StudentSubmission" ss join sess on sess."paperAssignmentId"=ss."assignmentId" where ss.status in ('submitted','marked')) submissions,
          (select count(*) from "StudentSubmission" ss join sess on sess."paperAssignmentId"=ss."assignmentId" where ss.status='marked') marked,
          (select count(*) from "AnswerScript" a
             join "StudentSubmission" ss on ss.id=a."submissionId" and ss.status<>'practice'
             join sess on sess."paperAssignmentId"=ss."assignmentId"
             join "PaperQuestion" pq on pq.id=a."paperQuestionId"
             join "Question" qq on qq.id=pq."questionId"
             where qq."questionType" in ('short_answer','structured','essay') and a."awardedMarks" is null) marker_queue,
          (select count(*) from "AnswerScript" a
             join "StudentSubmission" ss on ss.id=a."submissionId" and ss.status<>'practice'
             join sess on sess."paperAssignmentId"=ss."assignmentId"
             where a."markedById" is not null) human_graded,
          (select count(*) from "AnswerScript" a
             join "StudentSubmission" ss on ss.id=a."submissionId" and ss.status<>'practice'
             join sess on sess."paperAssignmentId"=ss."assignmentId"
             where a."markedById" is null and a."awardedMarks" is not null) auto_graded`,
      [CLASS_ID, latestDate],
    )
  )[0];

  const att = (
    await q(
      `select
         (select count(*) from "Attendance" a join "MorningQuizSession" s on s.id=a."sessionId"
            where s."classId"=$1 and s.date=$2::date and a.status='on_time') on_time,
         (select count(*) from "Attendance" a join "MorningQuizSession" s on s.id=a."sessionId"
            where s."classId"=$1 and s.date=$2::date and a.status='late') late,
         (select count(*) from "ClassEnrollment" ce join "User" u on u.id=ce."userId"
            where ce."classId"=$1 and ce.role='student' and u."isActive"=true) roster`,
      [CLASS_ID, latestDate],
    )
  )[0];

  const perLevel = await q(
    `select s.level,
        count(distinct ss.id) filter (where ss.status in ('submitted','marked')) subs,
        count(a.*) filter (where a."markedById" is null and a."awardedMarks" is not null and ss.status<>'practice') auto,
        count(a.*) filter (where a."markedById" is not null and ss.status<>'practice') human,
        count(a.*) filter (where a."awardedMarks" is null and ss.status<>'practice'
           and qq."questionType" in ('short_answer','structured','essay')) queue
       from "MorningQuizSession" s
       join "StudentSubmission" ss on ss."assignmentId"=s."paperAssignmentId"
       join "AnswerScript" a on a."submissionId"=ss.id
       join "PaperQuestion" pq on pq.id=a."paperQuestionId"
       join "Question" qq on qq.id=pq."questionId"
       where s."classId"=$1 and s.date=$2::date
       group by s.level order by s.level`,
    [CLASS_ID, latestDate],
  );

  const bucketRows = await q(
    `select least(5, case when "maxScore">0 then width_bucket(round("totalScore"::numeric/"maxScore"*100),0,100,5) else 1 end) b,
        count(*) n
       from "StudentSubmission" ss join "MorningQuizSession" s on s."paperAssignmentId"=ss."assignmentId"
       where s."classId"=$1 and s.date=$2::date and ss.status='marked'
       group by b order by b`,
    [CLASS_ID, latestDate],
  );
  const buckets = [0, 0, 0, 0, 0];
  bucketRows.forEach((r) => { const i = Math.min(4, Math.max(0, Number(r.b) - 1)); buckets[i] += Number(r.n); });

  const roster = Number(att.roster);
  return {
    generatedAt: new Date().toISOString(),
    facts: {
      apiCalls: 0,
      levels: 3,
      roster,
      stack: ['NestJS', 'React', 'Prisma', 'Postgres', 'Railway'],
    },
    bank: {
      simplifiedB: bankMap.simplifiedB || 0,
      olevelB: bankMap.olevelB || 0,
      sectionC: bankMap.sectionC || 0,
      ieltsPassages,
      simplifiedRunway: Math.max(0, (bankMap.simplifiedB || 0) - simplifiedServed),
    },
    week: {
      weekStart,
      total: sessions.length,
      repeats,
      sessions: sessions.map((s) => ({ date: s.d, level: s.level, status: s.status, story: prettyStory(s.story) })),
    },
    latest: {
      date: latestDate,
      submissions: Number(g.submissions),
      marked: Number(g.marked),
      markerQueue: Number(g.marker_queue),
      humanGraded: Number(g.human_graded),
      autoGraded: Number(g.auto_graded),
      onTime: Number(att.on_time),
      late: Number(att.late),
      absent: Math.max(0, roster - Number(att.on_time) - Number(att.late)),
      perLevel: perLevel.map((r) => ({
        level: r.level, subs: Number(r.subs), auto: Number(r.auto), human: Number(r.human), queue: Number(r.queue),
      })),
      buckets,
    },
  };
}

function prettyStory(ref) {
  if (!ref) return '—';
  // IELTS/ielts_authored_2026/Test3/P2  → Test3 · P2
  // OLEVEL/ai_authored_olevel_simplified_32_wayang/Paper2 → wayang
  // OLEVEL/ai_authored_olevel_summary_04_water/Paper2 → water (summary)
  const seg = ref.split('/');
  if (ref.startsWith('IELTS/')) return seg.slice(2).join(' · ');
  const key = seg[1] || ref;
  if (/summary_\d+_/.test(key)) return key.replace(/.*summary_\d+_/, '') + ' (summary)';
  if (/simplified_\d+_/.test(key)) return key.replace(/.*simplified_\d+_/, '');
  return key.replace(/.*olevel_\d+_/, '').replace(/^ai_authored_/, '');
}

// ── historical time-series (real quiz days) ─────────────────────────────────
async function buildSeries() {
  const rows = await q(
    `with days as (
        select distinct s.date::date d from "MorningQuizSession" s
        where s."classId"=$1 and s.status<>'cancelled'
      )
      select to_char(d,'YYYY-MM-DD') date,
        (select count(distinct ss.id) from "StudentSubmission" ss join "MorningQuizSession" s on s."paperAssignmentId"=ss."assignmentId"
           where s."classId"=$1 and s.date=days.d and ss.status in ('submitted','marked')) subs,
        (select count(distinct a."studentId") from "Attendance" a join "MorningQuizSession" s on s.id=a."sessionId"
           where s."classId"=$1 and s.date=days.d and a.status in ('on_time','late')) present,
        (select count(*) from "AnswerScript" x join "StudentSubmission" ss on ss.id=x."submissionId"
           join "MorningQuizSession" s on s."paperAssignmentId"=ss."assignmentId"
           where s."classId"=$1 and s.date=days.d and x."markedById" is not null and ss.status<>'practice') human,
        (select count(*) from "AnswerScript" x join "StudentSubmission" ss on ss.id=x."submissionId"
           join "MorningQuizSession" s on s."paperAssignmentId"=ss."assignmentId"
           where s."classId"=$1 and s.date=days.d and x."markedById" is null and x."awardedMarks" is not null and ss.status<>'practice') auto,
        (select round(avg(ss."totalScore"::numeric/nullif(ss."maxScore",0)*100)) from "StudentSubmission" ss
           join "MorningQuizSession" s on s."paperAssignmentId"=ss."assignmentId"
           where s."classId"=$1 and s.date=days.d and ss.status='marked') avg_pct
      from days order by d`,
    [CLASS_ID],
  );
  const days = rows
    .filter((r) => Number(r.subs) > 0)
    .map((r) => ({
      date: r.date, subs: Number(r.subs), present: Number(r.present),
      human: Number(r.human), auto: Number(r.auto),
      avgPct: r.avg_pct == null ? null : Number(r.avg_pct),
    }));
  const studentsEver = await q(
    `select count(distinct ss."studentId") n from "StudentSubmission" ss
       join "MorningQuizSession" s on s."paperAssignmentId"=ss."assignmentId"
       where s."classId"=$1 and ss.status in ('submitted','marked')`,
    [CLASS_ID],
  );
  const totalSubs = days.reduce((a, d) => a + d.subs, 0);
  const scored = days.filter((d) => d.avgPct != null);
  return {
    generatedAt: new Date().toISOString(),
    days,
    totals: {
      quizDays: days.length,
      totalSubs,
      studentsServed: Number(studentsEver[0] ? studentsEver[0].n : 0),
      avgScorePct: scored.length ? Math.round(scored.reduce((a, d) => a + d.avgPct, 0) / scored.length) : null,
      humanGraded: days.reduce((a, d) => a + d.human, 0),
      autoGraded: days.reduce((a, d) => a + d.auto, 0),
    },
  };
}

// ── cache ───────────────────────────────────────────────────────────────────
let cache = { at: 0, data: null };
async function getMetrics() {
  if (Date.now() - cache.at < 8000 && cache.data) return cache.data;
  const data = await buildMetrics();
  cache = { at: Date.now(), data };
  return data;
}
let scache = { at: 0, data: null };
async function getSeries() {
  if (Date.now() - scache.at < 30000 && scache.data) return scache.data;
  const data = await buildSeries();
  scache = { at: Date.now(), data };
  return data;
}

// ── server ──────────────────────────────────────────────────────────────────
const app = express();
app.disable('x-powered-by');

function gate(req, res, next) {
  if (!ACCESS_KEY) return next();
  if ((req.query.k || '') === ACCESS_KEY) return next();
  res.status(401).send('unauthorized — append ?k=<access key>');
}

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.get('/api/metrics', gate, async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await getMetrics());
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

app.get('/api/series', gate, async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await getSeries());
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

let runCache = null;
app.get('/api/run', gate, (_req, res) => {
  try {
    if (!runCache) runCache = JSON.parse(fs.readFileSync(path.join(__dirname, 'runs.json'), 'utf8'));
    res.set('Cache-Control', 'no-store');
    res.json(runCache);
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

app.get('/', gate, (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`ops-dashboard listening on :${PORT} (class=${CLASS_ID}, auth=${ACCESS_KEY ? 'on' : 'off'})`));
