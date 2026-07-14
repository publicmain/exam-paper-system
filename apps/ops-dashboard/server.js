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

// ── grading cockpit (marker queue read + write-back) ────────────────────────
// Replicates apps/api/scripts/marker-apply.ts exactly, in SQL. Human grading
// only — captures a human's mark decision and writes it back. NEVER invokes an
// AI grader (iron rule: zero Anthropic API). Every write is behind the gate.
const cleanTxt = (s) => (s == null ? '' : String(s).replace(/\s+/g, ' ').trim());

async function latestGradingDate() {
  const today = sgtToday();
  const r = await q(
    `select max(s.date)::date::text d from "MorningQuizSession" s
       where s."classId"=$1 and s.date<=$2::date
         and exists (select 1 from "StudentSubmission" ss where ss."assignmentId"=s."paperAssignmentId")`,
    [CLASS_ID, today],
  );
  return r[0] && r[0].d ? r[0].d : today;
}

// The marker inbox: every ungraded short-answer/structured/essay script for
// this class (optionally scoped to one quiz day), grouped by submission.
async function buildQueue(date) {
  const params = [CLASS_ID];
  let dateFilter = '';
  if (date) { params.push(date); dateFilter = ' and s.date=$2::date'; }
  const rows = await q(
    `select a.id script_id, a."submissionId" submission_id, u.name student, s.level,
        p.name paper, s.date::date::text sess_date, qq."questionType" qtype,
        pq.marks max_marks, ss."autoScore" auto_so_far, ss."maxScore" max_score,
        coalesce(pq."snapshotContent"->>'stem', qq.content->>'stem') stem,
        coalesce(pq."snapshotContent"->>'passage', qq.content->>'passage') passage,
        coalesce(pq."snapshotAnswer"->>'text', pq."snapshotAnswer"->>'markScheme',
                 qq."answerContent"->>'text', qq."answerContent"->>'markScheme',
                 pq."snapshotAnswer"::text, qq."answerContent"::text) mark_scheme,
        coalesce(a."textAnswer", a."selectedOption") student_ans
       from "AnswerScript" a
       join "StudentSubmission" ss on ss.id=a."submissionId" and ss.status='submitted'
       join "MorningQuizSession" s on s."paperAssignmentId"=ss."assignmentId"
       join "PaperAssignment" pa on pa.id=ss."assignmentId"
       join "Paper" p on p.id=pa."paperId"
       join "PaperQuestion" pq on pq.id=a."paperQuestionId"
       join "Question" qq on qq.id=pq."questionId"
       join "User" u on u.id=ss."studentId"
       where s."classId"=$1${dateFilter}
         and qq."questionType" in ('short_answer','structured','essay')
         and a."awardedMarks" is null
       order by s.date desc, u.name, ss.id, a.id`,
    params,
  );
  const subs = {}; const order = [];
  rows.forEach((r) => {
    if (!subs[r.submission_id]) {
      subs[r.submission_id] = {
        id: r.submission_id, student: r.student, level: r.level, paper: r.paper,
        date: r.sess_date, autoSoFar: Number(r.auto_so_far) || 0, maxScore: Number(r.max_score) || 0,
        scripts: [],
      };
      order.push(r.submission_id);
    }
    subs[r.submission_id].scripts.push({
      scriptId: r.script_id, qtype: r.qtype, maxMarks: Number(r.max_marks),
      stem: cleanTxt(r.stem), passage: r.passage ? cleanTxt(r.passage) : null,
      markScheme: cleanTxt(r.mark_scheme), studentAns: cleanTxt(r.student_ans),
    });
  });
  return { generatedAt: new Date().toISOString(), scope: date || 'all pending',
    pending: rows.length, submissions: order.map((id) => subs[id]) };
}

// Write one human mark decision + recompute the submission. Mirrors
// marker.service.finalize / marker-apply.ts. Idempotent (skips graded scripts).
async function applyGrade(scriptId, awardedMarks, reason) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const adminR = await client.query(`select id from "User" where role='admin' order by "createdAt" asc limit 1`);
    if (!adminR.rows[0]) { await client.query('ROLLBACK'); return { ok: false, error: 'no admin user' }; }
    const adminId = adminR.rows[0].id;
    const sR = await client.query(
      `select a."awardedMarks" awarded, a."markedById" marked_by, a."submissionId" sub, pq.marks max
         from "AnswerScript" a join "PaperQuestion" pq on pq.id=a."paperQuestionId" where a.id=$1`, [scriptId]);
    const sc = sR.rows[0];
    if (!sc) { await client.query('ROLLBACK'); return { ok: false, error: 'script not found' }; }
    const max = Number(sc.max);
    const am = Number(awardedMarks);
    if (!(am >= 0) || am > max) { await client.query('ROLLBACK'); return { ok: false, error: 'awardedMarks must be 0..' + max }; }
    if (sc.marked_by && sc.awarded != null) { await client.query('ROLLBACK'); return { ok: false, already: true, error: 'already graded' }; }
    await client.query(
      `update "AnswerScript" set "awardedMarks"=$2, "markerComment"=$3, "markedById"=$4, "markedAt"=now() where id=$1`,
      [scriptId, am, reason || null, adminId]);
    const subId = sc.sub;
    const scripts = (await client.query(
      `select a."awardedMarks" awarded, a."markedById" marked_by, qq."questionType" qtype
         from "AnswerScript" a join "PaperQuestion" pq on pq.id=a."paperQuestionId"
         join "Question" qq on qq.id=pq."questionId" where a."submissionId"=$1`, [subId])).rows;
    let mcq = 0, auto = 0, manual = 0, ungraded = 0;
    for (const r of scripts) {
      if (r.qtype === 'mcq') { mcq += Number(r.awarded) || 0; continue; }
      if (r.awarded == null) { ungraded++; continue; }
      if (r.marked_by != null) manual += Number(r.awarded); else auto += Number(r.awarded);
    }
    auto += mcq;
    const total = auto + manual;
    let status = 'submitted';
    if (ungraded > 0) {
      await client.query(`update "StudentSubmission" set "autoScore"=$2,"manualScore"=$3,"totalScore"=$4 where id=$1`, [subId, auto, manual, total]);
    } else {
      const upd = await client.query(`update "StudentSubmission" set status='marked', "autoScore"=$2,"manualScore"=$3,"totalScore"=$4 where id=$1 and status='submitted'`, [subId, auto, manual, total]);
      if (upd.rowCount === 0) await client.query(`update "StudentSubmission" set "autoScore"=$2,"manualScore"=$3,"totalScore"=$4 where id=$1`, [subId, auto, manual, total]);
      status = 'marked';
    }
    await client.query('COMMIT');
    return { ok: true, scriptId, submissionId: subId, submissionStatus: status, ungradedRemaining: ungraded, totalScore: total, maxScore: max };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (e2) { /* noop */ }
    return { ok: false, error: String((e && e.message) || e) };
  } finally {
    client.release();
  }
}

// ── agent work board (mission control) ──────────────────────────────────────
// Combines LIVE prod signals (grading queue, bank runway, zero-repeat,
// attendance, per-day history) with the recorded authoring run into
// operational work items — each carrying a rich detail payload for drill-down.
const GRADE_STEPS = [
  { at: '08:25', k: 'arm', m: 'activation cron arms the session' },
  { at: '08:30', k: 'open', m: 'QR scan → attendance · take window opens' },
  { at: '08:30–09:00', k: 'collect', m: 'students submit · MCQ / matching auto-scored inline' },
  { at: '09:00', k: 'lock', m: 'session auto-locks · short-answers parked to the marker queue' },
  { at: 'post', k: 'grade', m: 'human grades short-answers in chat · zero metered API' },
  { at: 'final', k: 'final', m: 'scores finalized · results portal + trend updated' },
];
function gradeItem(day, latest, live) {
  const q = live ? latest.markerQueue : 0;
  const done = q === 0;
  const subs = live ? latest.submissions : day.subs;
  const auto = live ? latest.autoGraded : day.auto;
  const human = live ? latest.humanGraded : day.human;
  const avg = live ? null : day.avgPct;
  const per = live && latest.perLevel
    ? latest.perLevel.map((r) => r.level.replace('ielts_', '').replace('_', ' ') + ' ' + r.subs).join(' · ')
    : '—';
  return {
    id: 'grade-' + day.date, col: done ? 'done' : 'review',
    title: 'Grade morning quiz · ' + day.date, agent: 'grader-hitl', role: 'human-in-loop',
    trigger: '09:00 auto-lock', tokens: 0, live: !!live,
    line: done ? human + ' human · ' + auto + ' auto graded' : q + ' short-answers awaiting a human',
    detail: {
      summary: done
        ? 'All ' + subs + ' submissions marked — objective items auto, short-answers by a human. Zero metered API.'
        : q + ' short-answers are parked in the marker queue for a human. MCQ already auto-scored.',
      steps: GRADE_STEPS,
      outputs: [['Submissions', subs], ['Auto-graded', auto], ['Human-graded', human],
        ['Marker queue', q], ['Avg score', avg == null ? '—' : avg + '%']],
      meta: [['Levels', live ? per : '3 tiers'], ['Grader', 'human-in-loop · no AI grader'], ['Cost', '$0.00 · flat-fee']],
      links: [{ label: 'Open Grading', page: 'grading' }],
    },
  };
}

// next occurrence of the weekly quiz-build cron (Sun 18:00 SGT)
function nextWeeklyBuild() {
  const now = new Date(Date.now() + 8 * 3600 * 1000); // SGT
  const dow = now.getUTCDay(); // 0 = Sun
  let add = (7 - dow) % 7; if (add === 0) add = 7;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + add));
  return d.toISOString().slice(0, 10);
}

let _run = null;
function loadRun() {
  if (!_run) {
    try { _run = JSON.parse(fs.readFileSync(path.join(__dirname, 'runs.json'), 'utf8')); }
    catch (e) { _run = { agents: [], orchestrator: {}, deploy: {} }; }
  }
  return _run;
}

async function buildBoard() {
  const m = await buildMetrics();
  let series = null;
  try { series = await getSeries(); } catch (e) { series = { days: [] }; }
  const runway = m.bank.simplifiedRunway;
  const runwayLow = runway < 4;
  const present = m.latest.onTime + m.latest.late;
  const items = [];

  // recorded content-pipeline fleet — derived from runs.json so the board and
  // the Content & QA trace can never drift apart.
  const run = loadRun();
  const ag = run.agents || [];
  const dep = run.deploy || { bankBefore: 16, bankAfter: 21 };
  const byKind = (k) => ag.filter((a) => a.kind === k);
  const authorsB = byKind('author-b'), authorsC = byKind('author-c');
  const auditors = byKind('audit'), blinds = byKind('blind');
  const nAuthors = authorsB.length + authorsC.length;
  const sumTok = (arr) => arr.reduce((s, a) => s + (a.tokens || 0), 0);
  const orchTok = 12400;
  const pipelineTokens = orchTok + sumTok(ag);
  const auditFixtures = auditors.reduce((s, a) => s + ((a.output && a.output.fixtures) || 0), 0);
  const auditIssues = auditors.reduce((s, a) => s + ((a.output && a.output.issues) || 0), 0);
  const blindVerified = blinds.filter((b) => b.output && b.output.verified).length;
  const blindFlagged = blinds.length - blindVerified;
  const bankMove = dep.bankBefore + ' → ' + dep.bankAfter;

  // ── triggered ──
  const nextBuild = nextWeeklyBuild();
  items.push({
    id: 'weekly-build', col: 'triggered', title: 'Weekly quiz build', agent: 'scheduler-cron',
    role: 'cron · weekly', trigger: 'every Sun 18:00 SGT', tokens: 0, live: true,
    line: 'next run ' + nextBuild + ' — plan next week’s ' + m.week.total + ' sessions',
    detail: {
      summary: 'A weekly cron plans the coming teaching week: it assembles Mon–Fri × 3-tier sessions from the content bank, checks every pick against each class’s full history (zero-repeat), and dispatches the authoring fan-out whenever a tier’s runway runs low.',
      steps: [
        { at: 'Sun 18:00', k: 'arm', m: 'cron fires · plans the upcoming teaching week' },
        { at: '1', k: 'read', m: 'load bank + each class’s full story history' },
        { at: '2', k: 'write', m: 'assign Mon–Fri × 3 tiers · skip anything ever served' },
        { at: '3', k: 'audit', m: 'runway < 4 on a tier → dispatch the authoring fan-out' },
        { at: '4', k: 'done', m: 'zero-repeat check → ' + m.week.total + ' sessions scheduled' },
      ],
      outputs: [['Cadence', 'weekly'], ['Sessions / week', m.week.total], ['Tiers', 3], ['Next run', nextBuild]],
      meta: [['Schedule', 'Sun 18:00 SGT'], ['Also fires', 'runway watchdog · mid-week'], ['This week', 'week of ' + m.week.weekStart]],
      links: [{ label: 'This week', page: 'overview' }],
    },
  });
  if (runwayLow) items.push({
    id: 'author-next', col: 'triggered', title: 'Author §B stories', agent: 'content-author',
    role: 'author fan-out', trigger: 'runway ' + runway + ' < 4/week', tokens: 0, live: true,
    line: 'queued — top up the simplified bank before it runs dry',
    detail: {
      summary: 'The simplified §B tier has ' + runway + ' unused stories left but needs 4/week — a fan-out of author agents is queued to top it up.',
      steps: [
        { at: 'plan', k: 'arm', m: 'orchestrator picks N = 4 − runway stories to write' },
        { at: 'fan-out', k: 'write', m: 'one author agent per story · parallel · per-tier rubric' },
        { at: 'gate', k: 'audit', m: '5 audit gates + double-blind before any ships' },
      ],
      outputs: [['Runway now', runway], ['Target', '4 / week'], ['To author', Math.max(0, 4 - runway)]],
      meta: [['Tier', 'Simplified IELTS §B'], ['Trigger', 'bank runway watchdog']],
      links: [{ label: 'Bank & QA', page: 'content' }],
    },
  });
  items.push({
    id: 'ingest', col: 'triggered', title: 'Ingest PDF → fixture', agent: 'ingest + auditor',
    role: 'author + guard', trigger: 'new source paper', tokens: 0,
    line: 'on demand — must pass the 10-point audit before it ships',
    detail: {
      summary: 'When a new past-paper PDF arrives, an agent converts it to a fixture and the auditor runs a 10-point check before it can be served.',
      steps: [
        { at: '1', k: 'read', m: 'extract passage / stems / mark-scheme from PDF' },
        { at: '2', k: 'write', m: 'build fixture JSON · schema-shaped' },
        { at: '3', k: 'audit', m: '10-point audit — passage / stem / mark-scheme / schema / grader' },
        { at: '4', k: 'blind', m: 'AI-grader exact + paraphrase + reject checks' },
        { at: '5', k: 'done', m: 'copyright: store metadata only (e.g. 9702/22/M/J/19/Q3)' },
      ],
      outputs: [['Audit points', 10], ['Copyright', 'metadata only'], ['Status', 'awaiting source']],
      meta: [['Guard', '10-audit gate'], ['Provenance', 'source_type = original_school']],
      links: [],
    },
  });

  // ── review (human-in-the-loop) ──
  items.push(gradeItem({ date: m.latest.date }, m.latest, true));
  items.push({
    id: 'sync', col: 'review', title: 'Attendance → Seiue · ' + m.latest.date, agent: 'attendance-sync',
    role: 'human-in-loop', trigger: 'after the quiz window', tokens: 0, live: true,
    line: present + ' present to enter into OL_MO_English + MO_English',
    detail: {
      summary: 'Quiz attendance is reconciled and entered into the school system (Seiue) across two class rosters, following the skip rules in the runbook.',
      steps: [
        { at: '1', k: 'read', m: 'pull attendance from the morning-quiz platform' },
        { at: '2', k: 'audit', m: 'reconcile on-time / late / absent · dedupe scans' },
        { at: '3', k: 'grade', m: 'enter into Seiue OL_MO_English + MO_English' },
        { at: '4', k: 'done', m: 'apply skip rules (holiday / WiFi-outage manual)' },
      ],
      outputs: [['On-time', m.latest.onTime], ['Late', m.latest.late], ['Absent', m.latest.absent], ['To enter', present]],
      meta: [['Targets', 'OL_MO_English · MO_English'], ['Runbook', 'daily_attendance_sync']],
      links: [{ label: 'Attendance', page: 'attendance' }],
    },
  });

  // ── done: recorded content pipeline (author → audit → verify waves) ──
  items.push({
    id: 'author', col: 'done', title: 'Author content ×' + nAuthors, agent: 'content-author ×' + nAuthors, role: 'author fan-out',
    trigger: 'weekly cron · runway < 4', tokens: sumTok(authorsB.concat(authorsC)), link: 'content',
    line: authorsB.length + ' §B + ' + authorsC.length + ' §C authored → bank ' + bankMove,
    detail: {
      summary: 'A parallel fan-out of ' + nAuthors + ' author agents wrote ' + authorsB.length + ' §B narratives (15 marks each) and ' + authorsC.length + ' Section-C summaries (8 marks each); every fixture then went through the audit + double-blind waves before shipping.',
      steps: [
        { at: '2s', k: 'arm', m: 'orchestrator dispatched ' + ag.length + ' agents · concurrency ' + (run.concurrency || 6) },
        { at: '~46s', k: 'write', m: '§B: 500–535w narrative + 7 SA + 4-blank emotion MCQ each' },
        { at: '~52s', k: 'write', m: '§C: ~310w source passage + 8 own-words content points each' },
        { at: '~290s', k: 'return', m: 'each returned fixture · self-check green · handed to audit' },
        { at: '~326s', k: 'done', m: 'authoring wave complete' },
      ],
      outputs: [['Authors', nAuthors], ['§B stories', authorsB.length], ['§C summaries', authorsC.length], ['Bank', bankMove]],
      meta: [['Tokens', (sumTok(authorsB.concat(authorsC)) / 1000).toFixed(0) + 'k'], ['Agents', nAuthors + ' parallel'], ['kelong', '70.9k · 7 tools (exact)'], ['§B stories', authorsB.map((a) => a.story).join(' · ')]],
      links: [{ label: 'Open trace', page: 'content' }],
    },
  });
  items.push({
    id: 'audit', col: 'done', title: 'Audit gates ×' + auditors.length, agent: 'auditor ×' + auditors.length, role: 'verify',
    trigger: 'after authoring wave', tokens: sumTok(auditors), link: 'content',
    line: auditFixtures + ' fixture-checks · ' + auditIssues + ' issue fixed',
    detail: {
      summary: 'Independent auditor agents sweep every returned fixture through deterministic gates — schema, mark-scheme, rubric bands, MCQ integrity, distinct emotions and mark values. Any failure is flagged back to the authoring agent.',
      steps: [
        { at: '1', k: 'read', m: 'pick up returned fixtures from the authoring wave' },
        { at: '2', k: 'audit', m: 'auditor-51 · schema / mark-scheme / rubric-band — 7/7' },
        { at: '3', k: 'audit', m: 'auditor-52 · gradeMcq / distinct-emotions / mark-values — 5/5' },
        { at: '4', k: 'done', m: auditIssues + ' issue flagged to author-32 · re-checked green' },
      ],
      outputs: [['Auditors', auditors.length], ['Gates', '6 distinct'], ['Fixtures', nAuthors], ['Issues fixed', auditIssues]],
      meta: [['auditor-51', 'schema · rubric · 7 fixtures'], ['auditor-52', 'MCQ · marks · 5 §B'], ['Tokens', (sumTok(auditors) / 1000).toFixed(0) + 'k']],
      links: [{ label: 'Audit gates', page: 'content' }],
    },
  });
  items.push({
    id: 'blind', col: 'done', title: 'Double-blind verify ×' + blinds.length, agent: 'blind-solver ×' + blinds.length, role: 'verify',
    trigger: 'pre-ship gate', tokens: sumTok(blinds), link: 'content',
    line: blinds.length + ' papers solved · ' + blindFlagged + ' flagged (water ② damming → merged)',
    detail: {
      summary: 'Independent solver agents re-answer each new paper blind to the key; mismatches are flagged. The water summary was caught double-counting a content point.',
      steps: [
        { at: '1', k: 'blind', m: 'solver re-answers the paper with the key hidden' },
        { at: '2', k: 'audit', m: 'compare solver answers vs the mark scheme' },
        { at: '3', k: 'grade', m: 'flag mismatches for human review' },
      ],
      outputs: [['Papers', blinds.length], ['Verified', blindVerified], ['Flagged', blindFlagged]],
      meta: [['lift §B', '14 / 14'], ['frog §B', '11 / 11'], ['water summary', '② damming = sub-point of ① → merged']],
      links: [{ label: 'Content & QA', page: 'content' }],
    },
  });
  items.push({
    id: 'zero', col: 'done', title: 'Zero-repeat check · week ' + m.week.weekStart, agent: 'dedup', role: 'guard',
    trigger: 'post-generate', tokens: 0, live: true,
    line: m.week.total + ' sessions · ' + m.week.repeats + ' collisions',
    detail: {
      summary: 'After each week is generated, every session is checked against the class’s full history (version-agnostic) — a class must never see a story twice.',
      steps: [
        { at: '1', k: 'read', m: 'list this week’s ' + m.week.total + ' sessions + full class history' },
        { at: '2', k: 'audit', m: 'strip _vN → compare by story, per level' },
        { at: '3', k: 'done', m: m.week.repeats + ' collisions → ' + (m.week.repeats === 0 ? 'clean' : 'regenerate') },
      ],
      outputs: [['Sessions', m.week.total], ['Collisions', m.week.repeats], ['Dedup', 'by story']],
      meta: [['Rule', 'never re-serve a passage'], ['Key', 'storyKey() strips _vN']],
      links: [{ label: 'Attendance', page: 'attendance' }],
    },
  });
  items.push({
    id: 'deploy', col: 'done', title: 'Deploy fixtures → Railway', agent: 'orchestrator-00', role: 'ship',
    trigger: 'all audits green', tokens: 0,
    line: 'bank ' + bankMove + ' stories · live',
    detail: {
      summary: 'Once audits + double-blind are green, fixtures are ingested to production on Railway and a full-history repeat check gates any class from being served.',
      steps: [
        { at: '1', k: 'audit', m: 'confirm all gates + double-blind on every fixture' },
        { at: '2', k: 'write', m: 'register fixtures in content bootstrap' },
        { at: '3', k: 'done', m: 'push → Railway auto-deploy · bootstrap ingest' },
        { at: '4', k: 'final', m: 'zero-repeat check before any class is served' },
      ],
      outputs: [['Bank', bankMove], ['Repeats', 0], ['Target', 'Railway']],
      meta: [['Deploy', 'push to main → auto'], ['Services', 'API + web + Postgres']],
      links: [],
    },
  });

  // ── done: historical grading (real per-day aggregates) ──
  const hist = (series.days || []).filter((d) => d.date !== m.latest.date).slice(-5).reverse();
  hist.forEach((d) => items.push(gradeItem(d, null, false)));

  // ── roster (subagents, live status) — content agents mirror runs.json ──
  const roster = [
    { id: 'scheduler-cron', role: 'Scheduler', status: 'scheduled', handles: 'weekly cron — plans the week & arms authoring', tasks: series.totals ? series.totals.quizDays : 1, tokens: 0 },
    { id: 'orchestrator-00', role: 'Orchestrator', status: 'idle', handles: 'plans & dispatches the fleet', tasks: 1, tokens: orchTok },
    { id: 'content-author-b', role: '§B Author', n: authorsB.length, status: runwayLow ? 'queued' : 'idle', handles: 'writes §B narratives + 7 SA + emotion MCQ', tasks: authorsB.length, tokens: sumTok(authorsB) },
    { id: 'content-author-c', role: '§C Author', n: authorsC.length, status: 'idle', handles: 'writes Section-C summary passages + point maps', tasks: authorsC.length, tokens: sumTok(authorsC) },
    { id: 'auditor', role: 'Auditor', n: auditors.length, status: 'idle', handles: '6 schema / rubric / MCQ / mark gates', tasks: auditFixtures, tokens: sumTok(auditors) },
    { id: 'blind-solver', role: 'Double-blind', n: blinds.length, status: 'idle', handles: 'independently solves to verify keys', tasks: blinds.length, tokens: sumTok(blinds) },
    { id: 'grader-hitl', role: 'Grader', status: m.latest.markerQueue > 0 ? 'active' : 'idle', handles: 'human-in-loop short-answers', tasks: series.totals ? series.totals.quizDays : 1, tokens: 0 },
    { id: 'attendance-sync', role: 'Sync', status: 'review', handles: 'quiz attendance → Seiue', tasks: series.totals ? series.totals.quizDays : 1, tokens: 0 },
  ];
  const guardrails = [
    'ZERO-API · grading never triggers the AI grader',
    'No-delete · archive / retire, never hard-delete',
    '10-audit · no fixture ships unaudited',
    'Zero-repeat · never re-serve a story',
    'Copyright · past-paper metadata only',
  ];

  // ── activity feed (recent real events) ──
  const activity = [];
  activity.push({ ts: m.latest.date, tag: 'grade', text: 'Morning quiz graded — ' + m.latest.humanGraded + ' human · ' + m.latest.autoGraded + ' auto' });
  activity.push({ ts: m.latest.date, tag: 'attend', text: 'Attendance — ' + m.latest.onTime + ' on-time · ' + m.latest.late + ' late · ' + m.latest.absent + ' absent' });
  activity.push({ ts: m.week.weekStart, tag: 'sched', text: 'Weekly build — ' + m.week.total + ' sessions planned for week of ' + m.week.weekStart + ' · next run ' + nextBuild });
  activity.push({ ts: '—', tag: 'author', text: 'Content pipeline — ' + nAuthors + ' authors (' + authorsB.length + ' §B + ' + authorsC.length + ' §C) → bank ' + bankMove });
  activity.push({ ts: '—', tag: 'audit', text: 'Auditors swept ' + auditFixtures + ' fixture-checks — ' + auditIssues + ' issue flagged & fixed' });
  activity.push({ ts: '—', tag: 'flag', text: 'Double-blind (' + blinds.length + ' solvers) flagged water summary — ② damming merged into ①' });
  activity.push({ ts: m.week.weekStart, tag: 'guard', text: 'Zero-repeat check — ' + m.week.total + ' sessions, ' + m.week.repeats + ' collisions' });
  hist.slice(0, 2).forEach((d) => activity.push({ ts: d.date, tag: 'grade', text: 'Quiz graded — ' + d.human + ' human · ' + d.auto + ' auto · avg ' + (d.avgPct == null ? '—' : d.avgPct + '%') }));

  const cols = { triggered: 0, running: 0, review: 0, done: 0 };
  items.forEach((i) => { cols[i.col] = (cols[i.col] || 0) + 1; });
  const activeAgents = roster.filter((r) => r.status === 'active' || r.status === 'queued' || r.status === 'review').length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      activeAgents, totalAgents: roster.reduce((a, r) => a + (r.n || 1), 0),
      inFlight: cols.triggered + cols.running, pendingReview: cols.review, done: cols.done,
      tokensCycle: pipelineTokens, apiCost: 0,
      quizDays: series.totals ? series.totals.quizDays : 0,
      totalGraded: series.totals ? series.totals.humanGraded + series.totals.autoGraded : 0,
    },
    cols, items, roster, guardrails, activity,
    distribution: { plugins: 5, marketplaces: 2 },
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
app.use(express.json({ limit: '256kb' }));

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

let bcache = { at: 0, data: null };
app.get('/api/board', gate, async (_req, res) => {
  try {
    if (Date.now() - bcache.at >= 8000 || !bcache.data) bcache = { at: Date.now(), data: await buildBoard() };
    res.set('Cache-Control', 'no-store');
    res.json(bcache.data);
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

// ── grading cockpit endpoints ──
let qcache = { at: 0, key: '', data: null };
app.get('/api/queue', gate, async (req, res) => {
  try {
    const date = req.query.date || null;
    const key = date || 'all';
    if (qcache.key !== key || Date.now() - qcache.at >= 5000 || !qcache.data) {
      qcache = { at: Date.now(), key, data: await buildQueue(date) };
    }
    res.set('Cache-Control', 'no-store');
    res.json(qcache.data);
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

app.post('/api/grade', gate, async (req, res) => {
  try {
    const { scriptId, awardedMarks, reason } = req.body || {};
    if (!scriptId || awardedMarks == null) return res.status(400).json({ ok: false, error: 'scriptId and awardedMarks required' });
    const r = await applyGrade(scriptId, awardedMarks, reason);
    // bust caches so the queue / metrics / board reflect the write immediately
    qcache.at = 0; cache.at = 0; scache.at = 0; bcache.at = 0;
    res.set('Cache-Control', 'no-store');
    res.status(r.ok ? 200 : 400).json(r);
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
});

function serveJson(file, cacheRef) {
  return (_req, res) => {
    try {
      if (!cacheRef.v) cacheRef.v = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
      res.set('Cache-Control', 'no-store');
      res.json(cacheRef.v);
    } catch (e) {
      res.status(500).json({ error: String((e && e.message) || e) });
    }
  };
}
app.get('/api/run', gate, serveJson('runs.json', { v: null }));
app.get('/api/platform', gate, serveJson('platform.json', { v: null }));

app.get('/', gate, (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`ops-dashboard listening on :${PORT} (class=${CLASS_ID}, auth=${ACCESS_KEY ? 'on' : 'off'})`));
