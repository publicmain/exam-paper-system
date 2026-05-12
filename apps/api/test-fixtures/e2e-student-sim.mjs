// End-to-end student simulator. Drives 15 morning-quiz sessions
// (5 days × 3 levels) by:
//  1. Admin login → debug-activate each session (extends window)
//  2. Fetch QR token → scan as a unique demo student (auto-creates user)
//  3. Pull the paper, write mixed-quality answers per question type
//  4. Submit → fetch result → record autoScore vs maxScore + AI rationale
//
// Output: per-session table + content-QA flags (duplicate papers, missing
// fields, etc).

import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const API = 'http://localhost:4000/api';

const LEVELS = ['ielts_authentic', 'ielts_simplified', 'olevel'];
const WEEK_START = '2026-05-10';

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function http(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...opts.headers,
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) {
    throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function login(email, password) {
  return http('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

async function listSessions(weekStart) {
  return http(`/morning-quiz/scheduled?weekStart=${weekStart}`);
}

async function debugActivate(sessionId, adminToken) {
  return http(`/morning-quiz/sessions/${sessionId}/debug-activate`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${adminToken}` },
  });
}

async function qrCurrent(sessionId) {
  return http(`/qr/current?sessionId=${sessionId}`);
}

async function scan(qrToken, studentName, deviceUuid, sessionIdOverride = null) {
  const body = { qrToken, studentName, deviceUuid };
  if (sessionIdOverride) body.sessionIdOverride = sessionIdOverride;
  return http('/attendance/scan', { method: 'POST', body: JSON.stringify(body) });
}

async function getSession(sessionId, token) {
  return http(`/morning-quiz/sessions/${sessionId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function saveAnswer(sessionId, paperQuestionId, body, token) {
  return http(`/morning-quiz/sessions/${sessionId}/answer`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ paperQuestionId, ...body }),
  });
}

async function submit(sessionId, token) {
  return http(`/morning-quiz/sessions/${sessionId}/submit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
}

async function getResult(sessionId, token) {
  return http(`/morning-quiz/student-result/${sessionId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

// --- answer strategies per task type ---
//
// We model 4 student profiles to maximise grading-edge-case coverage:
//   excellent  — answers from key, perfect
//   paraphrase — answers semantically equivalent but textually different
//   bad        — clearly wrong / off-topic
//   blank      — leaves answer empty
//
// For each session we cycle through profiles by question index so a single
// run exercises all 3 grading paths (string-match, AI-grade, force-zero).

function shapeAnswer(profile, q) {
  const qt = q.questionType;
  const tt = (q.snapshotContent && q.snapshotContent.taskType) || '';
  // canonical answer is hidden from us — we know it indirectly via the
  // option keys (for mcq) and shape (for short_answer).
  const opts = q.snapshotOptions || [];

  if (qt === 'mcq') {
    if (profile === 'blank') return { selectedOption: null };
    if (profile === 'bad') {
      // Pick the first non-A option (or A if only A) — likely wrong
      const k = opts.find((o) => o.key !== 'A')?.key ?? opts[0]?.key ?? null;
      return { selectedOption: k };
    }
    // excellent / paraphrase: we genuinely don't know the right key without
    // server-side answer key access, so excellent picks a deterministic
    // option per stem hash — we'll see which ones the server marks correct
    // post-submit. This gives us the autoCorrect distribution without
    // needing to leak the key.
    const stem = (q.snapshotContent?.stem || q.snapshotContent?.prompt || '').slice(0, 40);
    let h = 0;
    for (let i = 0; i < stem.length; i++) h = (h * 31 + stem.charCodeAt(i)) | 0;
    const idx = Math.abs(h) % opts.length;
    return { selectedOption: opts[idx]?.key ?? null };
  }

  if (qt === 'short_answer') {
    if (profile === 'blank') return { textAnswer: '' };
    if (profile === 'bad') return { textAnswer: 'banana banana banana' };
    if (profile === 'paraphrase') {
      // Matching tasks: try descriptive content of correct paragraph.
      // Without the key we can't guarantee a paraphrase is right; but for
      // the test we want to see what AI does with a non-letter input.
      if (tt === 'matching_information' || tt === 'matching_features') {
        return { textAnswer: 'this is described in the relevant paragraph' };
      }
      // Generic paraphrase: include hedging language to test AI tolerance.
      return { textAnswer: 'something like that' };
    }
    // excellent (= we don't know the key, so pick a plausible 1-letter
    // guess A for matching, single short word for fill-in)
    if (tt === 'matching_information' || tt === 'matching_features' || tt === 'matching_headings') {
      return { textAnswer: 'A' };
    }
    return { textAnswer: 'unknown' };
  }
  return {};
}

const profileOrder = ['excellent', 'blank', 'paraphrase', 'bad'];

// Student-side responses don't expose `paperQuestion.question.questionType`
// (it's redacted in getStudentView), so infer from shape:
//   snapshotOptions array of length ≥2 → mcq
//   otherwise → short_answer
function inferType(pq) {
  const opts = pq.snapshotOptions;
  if (Array.isArray(opts) && opts.length >= 2) return 'mcq';
  return 'short_answer';
}

async function simulateOne(sess, adminToken, dayIdx) {
  const r = { sess: { id: sess.id, level: sess.level, date: sess.date.slice(0, 10), paper: sess.paperAssignment.paper.name } };
  try {
    // 1. Activate
    await debugActivate(sess.id, adminToken);

    // 2. Fetch QR token
    const { token: qrToken } = await qrCurrent(sess.id);

    // 3. Scan as a unique demo student
    const studentName = `测试生${sess.level.slice(0, 3)}d${dayIdx}`;
    const deviceUuid = randomUUID();
    const scanRes = await scan(qrToken, studentName, deviceUuid);
    r.scan = { status: scanRes.attendance?.status, submissionId: scanRes.submissionId };
    const stuToken = scanRes.scanToken;

    // 4. Fetch paper (student view: paperQuestions[] flat, no .question)
    const sessFull = await getSession(sess.id, stuToken);
    const paperQs = sessFull.paperQuestions || [];
    r.paperQs = paperQs.length;
    r.level = sessFull.level;
    r.paperMode = sessFull.paperMode;

    // Content QA: scan all questions for missing/empty fields
    r.contentFlags = [];
    for (const pq of paperQs) {
      const sc = pq.snapshotContent || {};
      const stem = sc.stem || sc.prompt || '';
      const qt = inferType(pq);
      if (!stem.trim()) r.contentFlags.push(`Q${pq.sortOrder} empty stem`);
      if (qt === 'mcq') {
        const opts = pq.snapshotOptions || [];
        if (opts.length < 2) r.contentFlags.push(`Q${pq.sortOrder} mcq with <2 options`);
      }
      // Passage sanity for IELTS reading shells
      if ((sc.taskType || '').match(/matching_|true_false|sentence_completion|note_completion/) && !(sc.passage || '').trim()) {
        r.contentFlags.push(`Q${pq.sortOrder} ${sc.taskType} missing passage`);
      }
    }

    // 5. Answer with rotating profiles
    const answers = [];
    for (let i = 0; i < paperQs.length; i++) {
      const pq = paperQs[i];
      const profile = profileOrder[i % profileOrder.length];
      const qt = inferType(pq);
      const a = shapeAnswer(profile, { questionType: qt, snapshotContent: pq.snapshotContent, snapshotOptions: pq.snapshotOptions });
      try {
        await saveAnswer(sess.id, pq.id, a, stuToken);
        answers.push({ idx: i + 1, profile, qt, ...a });
      } catch (e) {
        answers.push({ idx: i + 1, profile, qt, error: String(e).slice(0, 100) });
      }
    }
    r.answersWritten = answers.length;
    r.profilesUsed = answers.map((a) => a.profile);

    // 6. Submit
    const subResult = await submit(sess.id, stuToken);
    r.submit = { autoScore: subResult.autoScore, maxScore: subResult.maxScore, status: subResult.status };

    // 7. Fetch result (top-level autoScore/maxScore + items[])
    const result = await getResult(sess.id, stuToken);
    r.result = {
      autoScore: result.autoScore,
      maxScore: result.maxScore,
      breakdown: (result.items || []).map((it, i) => ({
        idx: it.sortOrder,
        profile: r.profilesUsed[i] ?? '?',
        qt: it.questionType,
        tt: it.snapshotContent?.taskType,
        autoCorrect: it.autoCorrect,
        awarded: it.awardedMarks,
        canonical: typeof it.correctAnswer === 'string' ? it.correctAnswer.slice(0, 60) : it.correctAnswer,
        student: typeof it.textAnswer === 'string' ? it.textAnswer.slice(0, 40) : it.selectedOption,
        aiComment: it.markerComment ? it.markerComment.slice(0, 100) : null,
      })),
    };
  } catch (e) {
    r.error = String(e.message || e).slice(0, 200);
  }
  return r;
}

async function main() {
  log('=== student e2e simulator ===');
  const { token: adminToken } = await login('admin@school.local', 'admin123');
  log('admin login ok');

  const sessions = await listSessions(WEEK_START);
  log(`got ${sessions.length} sessions`);

  // Sort by (date, level) for stable output
  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.level.localeCompare(b.level));

  const results = [];
  // Number each session within its level for unique student names
  const counters = {};
  for (const s of sessions) {
    counters[s.level] = (counters[s.level] ?? 0) + 1;
    const r = await simulateOne(s, adminToken, counters[s.level]);
    results.push(r);
    const score = r.result?.autoScore ?? r.submit?.autoScore ?? '?';
    const max = r.result?.maxScore ?? r.submit?.maxScore ?? '?';
    log(`${r.sess.date} [${r.sess.level.padEnd(18)}] ${score}/${max}  ${r.error ? '✗ ' + r.error : '✓'}  ${r.contentFlags?.length ? 'flags=' + r.contentFlags.length : ''}`);
    // Brief throttle so the server / Anthropic API keep up
    await sleep(300);
  }

  await fs.writeFile('e2e-student-sim-out.json', JSON.stringify(results, null, 2));
  log('\nwrote e2e-student-sim-out.json');

  // Summary
  log('\n=== SUMMARY ===');
  const byLevel = {};
  for (const r of results) {
    if (r.error) continue;
    const lev = r.sess.level;
    if (!byLevel[lev]) byLevel[lev] = { sessions: 0, autoSum: 0, maxSum: 0, aiCalls: 0 };
    byLevel[lev].sessions += 1;
    byLevel[lev].autoSum += r.result?.autoScore ?? 0;
    byLevel[lev].maxSum += r.result?.maxScore ?? 0;
    byLevel[lev].aiCalls += (r.result?.breakdown || []).filter((b) => b.aiComment).length;
  }
  for (const [lev, agg] of Object.entries(byLevel)) {
    log(`${lev.padEnd(20)} sessions=${agg.sessions}  total ${agg.autoSum}/${agg.maxSum}  ai-grade calls=${agg.aiCalls}`);
  }

  // Content QA
  log('\n=== CONTENT QA FLAGS ===');
  let qaCount = 0;
  for (const r of results) {
    if (r.contentFlags?.length) {
      log(`${r.sess.date} ${r.sess.level}: ${r.contentFlags.join(', ')}`);
      qaCount++;
    }
  }
  if (qaCount === 0) log('(none)');

  // Paper repetition QA
  log('\n=== PAPER REPETITION ===');
  const byPaper = {};
  for (const r of results) {
    if (r.error) continue;
    const p = r.sess.paper;
    byPaper[p] = (byPaper[p] || 0) + 1;
  }
  for (const [name, n] of Object.entries(byPaper).sort((a, b) => b[1] - a[1])) {
    log(`  ${n}× ${name}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
