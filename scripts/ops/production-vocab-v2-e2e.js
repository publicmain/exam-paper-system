/* eslint-disable no-console */
'use strict';

const { Client } = require('pg');

const API = process.env.QA_API_ORIGIN || 'https://exam-paper-system-production.up.railway.app/api';
const EXPECTED_CLASSES = [
  'SGCE26W', 'SEC27W', 'OL26W', 'IAL27W', 'IAL27M',
  'IAL26W', 'IAL26S2', 'IAL26S1', 'IAL28S',
];
const LEVELS = [
  'ielts_simplified', 'olevel_intermediate', 'olevel', 'ielts_light', 'ielts_authentic',
];

function invariant(value, message) {
  if (!value) throw new Error(message);
}

async function call(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 120) }; }
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function archiveQaStudents(ids) {
  if (!ids.length) return 0;
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  invariant(connectionString, 'database connection is required for QA cleanup');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const result = await client.query(
      `update "User"
       set "archivedAt"=now(), "isActive"=false, "studentAuthVersion"="studentAuthVersion"+1
       where id = any($1::text[]) and name like '上线验收%'
       returning id`,
      [ids],
    );
    return result.rowCount;
  } finally {
    await client.end();
  }
}

async function main() {
  const createdIds = [];
  const report = { classes: 0, levels: {}, archivedQaStudents: 0 };
  try {
    const registration = await call('/student-auth/registration-classes');
    const names = registration.classes.map((row) => row.name);
    invariant(JSON.stringify(names) === JSON.stringify([...EXPECTED_CLASSES].sort()), 'registration classes mismatch');
    report.classes = names.length;

    const stamp = `${Date.now()}`.slice(-8);
    for (let index = 0; index < LEVELS.length; index += 1) {
      const level = LEVELS[index];
      const klass = registration.classes[index];
      const auth = await call('/student-auth/self-register', {
        method: 'POST',
        body: {
          classId: klass.id,
          name: `上线验收${stamp}${index}`,
          pin: String(730000 + index),
          englishLevel: level,
        },
      });
      invariant(auth.englishLevel === level, `${level}: registration did not persist level`);
      createdIds.push(auth.student.id);
      const token = auth.token;

      const today = await call('/lesson/today', { token });
      const read = today.segments.find((segment) => segment.key === 'read');
      invariant(read && read.questionCount === 10 && read.label, `${level}: today reading unavailable`);

      const profile = await call('/vocab-v2/profile', {
        method: 'POST', token, body: { dailyTarget: 10 },
      });
      invariant(profile.dailyTarget === 10, `${level}: daily target not saved`);

      let daily = await call('/vocab-v2/daily/start', { method: 'POST', token, body: {} });
      invariant(daily.target === 10 && daily.items.length === 10, `${level}: daily session is not 10 items`);
      invariant(new Set(daily.items.map((item) => item.card.headword)).size === 10, `${level}: duplicate daily words`);
      for (const item of daily.items) {
        invariant(item.card.translation && item.card.definition, `${level}: incomplete card`);
        invariant(!item.card.sentence || item.card.sentence.length <= 500, `${level}: oversized context`);
      }

      const oldHeadword = daily.items[0].card.headword;
      daily = await call('/vocab-v2/daily/replace', {
        method: 'POST', token, body: { sessionId: daily.id, itemId: daily.items[0].id },
      });
      invariant(daily.items.length === 10, `${level}: replacement changed total`);
      invariant(daily.items[0].card.headword !== oldHeadword, `${level}: replacement did not change word`);

      for (const item of daily.items) {
        daily = await call('/vocab-v2/daily/item', {
          method: 'POST', token,
          body: { sessionId: daily.id, itemId: item.id, action: 'normal', responseMs: 1200 },
        });
      }
      invariant(daily.completed === 10 && daily.status === 'completed', `${level}: learning did not complete 10/10`);

      let test = await call('/vocab-v2/test/start', {
        method: 'POST', token, body: { dailySessionId: daily.id },
      });
      invariant(test.total === 10 && test.items.length === 10, `${level}: formal test is not 10 items`);
      invariant(test.items.every((item) => !Object.prototype.hasOwnProperty.call(item.question, 'answer')), `${level}: answer leaked before response`);
      for (const item of test.items) {
        test = await call('/vocab-v2/test/answer', {
          method: 'POST', token,
          body: { sessionId: test.id, itemId: item.id, response: 0, responseMs: 1500 },
        });
      }
      invariant(test.answered === 10, `${level}: formal test stopped early`);
      test = await call('/vocab-v2/test/submit', { method: 'POST', token, body: { sessionId: test.id } });
      invariant(test.status === 'submitted' && test.answered === 10, `${level}: formal test submission incomplete`);

      const custom = await call('/vocab-v2/custom-test/start', {
        method: 'POST', token, body: { count: 5, scope: 'all' },
      });
      invariant(custom.total === 5 && custom.items.length === 5, `${level}: custom 5-word test unavailable`);

      const center = await call('/vocab-v2/center?page=1&pageSize=30', { token });
      invariant(center.stats.total >= 10 && center.items.length >= 10, `${level}: vocabulary center missing learned words`);
      report.levels[level] = {
        readingQuestions: read.questionCount,
        learned: daily.completed,
        tested: test.answered,
        customTest: custom.total,
        vocabularyCenter: center.stats.total,
      };
    }
  } finally {
    report.archivedQaStudents = await archiveQaStudents(createdIds);
  }
  invariant(report.archivedQaStudents === LEVELS.length, 'QA accounts were not all archived');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(String(error?.message || error).replace(/Bearer\s+\S+/gi, 'Bearer [redacted]'));
  process.exitCode = 1;
});
