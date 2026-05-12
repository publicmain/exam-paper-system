// Deeper grading audit: for each of 15 sessions, look up the canonical
// answer key server-side, then deliberately submit answers that exercise:
//   1. exact match (sanity)
//   2. paraphrase / case-insensitive variant
//   3. wrong-but-plausible distractor
//   4. blank
// Confirm autoCorrect + AI rationale align with the intent.

import { randomUUID } from 'node:crypto';

const API = 'http://localhost:4000/api';

async function http(p, o = {}) {
  const r = await fetch(`${API}${p}`, { ...o, headers: { 'content-type': 'application/json', ...o.headers } });
  const t = await r.text();
  let b;
  try { b = JSON.parse(t); } catch { b = t; }
  if (!r.ok) throw new Error(`${o.method || 'GET'} ${p}: ${r.status}: ${typeof b === 'string' ? b : JSON.stringify(b).slice(0, 200)}`);
  return b;
}

const { token: adminToken } = await http('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@school.local', password: 'admin123' }) });
const sessions = await http('/morning-quiz/scheduled?weekStart=2026-05-10');

// Group by (level, paperId) so we only audit ONE representative session per
// unique (level, paper) pair — saves API spend and AI calls. Same paper
// graded on day1 vs day3 has byte-identical questions.
const seen = new Set();
const reps = [];
for (const s of sessions) {
  const k = `${s.level}::${s.paperAssignment.paperId}`;
  if (seen.has(k)) continue;
  seen.add(k);
  reps.push(s);
}
console.log(`Auditing ${reps.length} unique (level, paper) combos out of ${sessions.length} sessions`);

const out = [];
for (const s of reps) {
  console.log(`\n--- ${s.level} · ${s.paperAssignment.paper.name} ---`);
  await http(`/morning-quiz/sessions/${s.id}/debug-activate`, { method: 'PATCH', headers: { authorization: `Bearer ${adminToken}` } });
  const { token: qrToken } = await http(`/qr/current?sessionId=${s.id}`);
  const studentName = `审卷员${Math.floor(Math.random() * 9999)}`;
  const scanRes = await http('/attendance/scan', { method: 'POST', body: JSON.stringify({ qrToken, studentName, deviceUuid: randomUUID() }) });
  const stuToken = scanRes.scanToken;
  const studentId = scanRes.student.id;

  // Read the paper from the student view
  const sessFull = await http(`/morning-quiz/sessions/${s.id}`, { headers: { authorization: `Bearer ${stuToken}` } });
  const paperQs = sessFull.paperQuestions;

  // Get canonical answer keys via admin (server returns them server-side
  // in the questions table; read via the admin paper detail endpoint).
  // Simpler: read the result endpoint AFTER submit — it surfaces correctAnswer.
  // So strategy: submit a placeholder pass first to learn the keys, then
  // we can't re-submit. Instead, use a fresh demo student per pass.

  // Pass 1: submit "everything correct" by reading correctAnswer from a
  // PRE-SUBMIT admin probe. We can hit /papers/:paperId as admin.
  const adminPaper = await http(`/papers/${s.paperAssignment.paperId}`, { headers: { authorization: `Bearer ${adminToken}` } });
  const keys = new Map();
  for (const pq of adminPaper.questions) {
    const sc = pq.snapshotContent || {};
    const opts = pq.snapshotOptions;
    let correct = null;
    if (Array.isArray(opts)) {
      const c = opts.find((o) => o.correct === true);
      if (c) correct = c.key;
    }
    if (!correct) {
      if (typeof sc.correctOption === 'string') correct = sc.correctOption;
      else if (typeof sc.correctAnswer === 'string') correct = sc.correctAnswer;
      else if (pq.question?.answerContent?.text) correct = pq.question.answerContent.text;
    }
    keys.set(pq.id, correct);
  }

  // Now run 4 sub-tests sharing the same session by spawning 4 students
  const subTests = [
    { name: 'exact', shaper: (pq, key, qt) => qt === 'mcq' ? { selectedOption: key } : { textAnswer: key } },
    { name: 'lowercase_paren', shaper: (pq, key, qt) => qt === 'mcq' ? { selectedOption: key } : { textAnswer: `(${String(key).toLowerCase()})` } },
    { name: 'paraphrase', shaper: (pq, key, qt) => {
        if (qt === 'mcq') {
          // Pick a deliberately-wrong distractor for paraphrase paths on MCQ
          const opts = pq.snapshotOptions || [];
          const wrong = opts.find((o) => o.key !== key)?.key;
          return { selectedOption: wrong ?? key };
        }
        // For matching tasks, use a phrase that semantically points to the
        // right paragraph. Without knowing the passage we just send something
        // reasonable; the AI may credit it or not depending on context.
        return { textAnswer: 'a paraphrase of the answer' };
      } },
    { name: 'blank', shaper: () => ({ selectedOption: null, textAnswer: '' }) },
  ];

  const result = { session: s.id, level: s.level, paper: s.paperAssignment.paper.name, paperQs: paperQs.length, runs: [] };

  for (const test of subTests) {
    const { token: tQr } = await http(`/qr/current?sessionId=${s.id}`);
    const sName = `${test.name}_${Math.floor(Math.random() * 9999)}`;
    const scan2 = await http('/attendance/scan', { method: 'POST', body: JSON.stringify({ qrToken: tQr, studentName: sName, deviceUuid: randomUUID() }) });
    const tk = scan2.scanToken;
    const fresh = await http(`/morning-quiz/sessions/${s.id}`, { headers: { authorization: `Bearer ${tk}` } });
    for (const pq of fresh.paperQuestions) {
      const opts = pq.snapshotOptions;
      const qt = Array.isArray(opts) && opts.length >= 2 ? 'mcq' : 'short_answer';
      const key = keys.get(pq.id);
      const ans = test.shaper(pq, key, qt);
      await http(`/morning-quiz/sessions/${s.id}/answer`, { method: 'PATCH', headers: { authorization: `Bearer ${tk}` }, body: JSON.stringify({ paperQuestionId: pq.id, ...ans }) });
    }
    await http(`/morning-quiz/sessions/${s.id}/submit`, { method: 'POST', headers: { authorization: `Bearer ${tk}` } });
    const r = await http(`/morning-quiz/student-result/${s.id}`, { headers: { authorization: `Bearer ${tk}` } });
    const summary = {
      test: test.name,
      autoScore: r.autoScore,
      maxScore: r.maxScore,
      perItem: r.items.map((it) => ({
        idx: it.sortOrder,
        qt: it.questionType,
        tt: it.snapshotContent?.taskType,
        ans: it.studentAnswer,
        correct: it.correctAnswer,
        autoCorrect: it.autoCorrect,
        awarded: it.awardedMarks,
        ai: it.markerComment ? it.markerComment.slice(0, 110) : null,
      })),
    };
    result.runs.push(summary);
    console.log(`  [${test.name.padEnd(15)}] ${r.autoScore}/${r.maxScore}`);
  }
  out.push(result);
}

import fs from 'node:fs/promises';
await fs.writeFile('e2e-grading-audit-out.json', JSON.stringify(out, null, 2));
console.log('\nwrote e2e-grading-audit-out.json');

// Quick aggregate report
console.log('\n=== EXACT-ANSWER PASS-RATE (sanity) ===');
for (const r of out) {
  const exact = r.runs.find((x) => x.test === 'exact');
  const pct = exact ? Math.round(100 * exact.autoScore / exact.maxScore) : 0;
  const flag = pct >= 100 ? 'OK' : pct >= 90 ? 'minor-loss' : 'BUG';
  console.log(`  [${flag}] ${r.level.padEnd(18)} ${r.paper.slice(0, 60).padEnd(62)} ${exact?.autoScore}/${exact?.maxScore} (${pct}%)`);
}
console.log('\n=== LOWERCASE_PAREN normalizer (should match exact) ===');
for (const r of out) {
  const a = r.runs.find((x) => x.test === 'lowercase_paren');
  const exact = r.runs.find((x) => x.test === 'exact');
  const same = a?.autoScore === exact?.autoScore;
  console.log(`  ${same ? 'OK ' : '⚠ '} ${r.level.padEnd(18)} exact=${exact?.autoScore} norm=${a?.autoScore}`);
}
console.log('\n=== PARAPHRASE behaviour (AI fallback) ===');
for (const r of out) {
  const p = r.runs.find((x) => x.test === 'paraphrase');
  const aiCalls = (p?.perItem || []).filter((it) => it.ai).length;
  const credited = (p?.perItem || []).filter((it) => it.awarded > 0 && it.qt === 'short_answer').length;
  console.log(`  ${r.level.padEnd(18)} score=${p?.autoScore}/${p?.maxScore}  ai-calls=${aiCalls}  credited-paraphrases=${credited}`);
}
console.log('\n=== BLANK behaviour (no AI calls expected, all 0) ===');
for (const r of out) {
  const b = r.runs.find((x) => x.test === 'blank');
  const aiCalls = (b?.perItem || []).filter((it) => it.ai).length;
  console.log(`  ${r.level.padEnd(18)} score=${b?.autoScore}  ai-calls=${aiCalls}  ${b?.autoScore === 0 && aiCalls === 0 ? 'OK' : '⚠'}`);
}
