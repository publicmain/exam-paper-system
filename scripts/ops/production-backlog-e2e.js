/* eslint-disable no-console */
'use strict';

const { Client } = require('pg');

const API = process.env.QA_API_ORIGIN || 'https://exam-paper-system-production.up.railway.app/api';

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function sgtDate(offsetDays = 0) {
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000 + offsetDays * 86_400_000);
  return shifted.toISOString().slice(0, 10);
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
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 160) }; }
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function database() {
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  invariant(connectionString, 'database connection is required');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

async function main() {
  const yesterday = sgtDate(-1);
  const created = [];
  const report = { date: yesterday, scenarios: {}, archivedQaStudents: 0 };
  const db = await database();
  try {
    const registration = await call('/student-auth/registration-classes');
    const klass = registration.classes[0];
    invariant(klass, 'no registration class');
    const stamp = `${Date.now()}`.slice(-7);
    const scenarios = ['reading_only', 'words_only', 'neither', 'partial_words'];
    for (let index = 0; index < scenarios.length; index += 1) {
      const auth = await call('/student-auth/self-register', {
        method: 'POST',
        body: {
          classId: klass.id,
          name: `欠交验收${stamp}${index}`,
          pin: String(740000 + index),
          englishLevel: 'ielts_simplified',
        },
      });
      created.push({ id: auth.student.id, token: auth.token, scenario: scenarios[index] });
    }

    // These temporary students stand in for accounts that already belonged to
    // the class yesterday.  The product rule intentionally excludes papers
    // published before a real student's join date.
    await db.query(
      `update "ClassEnrollment" set "joinedAt"=$2::timestamptz where "userId"=any($1::text[])`,
      [created.map((row) => row.id), `${yesterday}T00:00:00.000Z`],
    );

    for (const account of created) {
      let daily = await call('/vocab-v2/daily/start', {
        method: 'POST', token: account.token, body: { date: yesterday },
      });
      invariant(daily.date === yesterday && daily.target > 0, `${account.scenario}: old word task missing`);

      if (account.scenario === 'words_only') {
        for (const item of daily.items) {
          daily = await call('/vocab-v2/daily/item', {
            method: 'POST', token: account.token,
            body: { sessionId: daily.id, itemId: item.id, action: 'normal', responseMs: 1600 },
          });
        }
        invariant(daily.status === 'completed', 'words_only: words did not complete');
      } else if (account.scenario === 'partial_words') {
        for (const item of daily.items.slice(0, 3)) {
          daily = await call('/vocab-v2/daily/item', {
            method: 'POST', token: account.token,
            body: { sessionId: daily.id, itemId: item.id, action: 'normal', responseMs: 1600 },
          });
        }
        invariant(daily.completed === 3, 'partial_words: exact progress was not saved');
      }

      let overview = await call('/vocab-v2/overview', { token: account.token });
      const oldReading = overview.readingBacklog.find((row) => row.date === yesterday);
      if (account.scenario === 'reading_only') {
        invariant(oldReading, 'reading_only: old reading was not offered');
        await call(`/morning-quiz/sessions/${encodeURIComponent(oldReading.sessionId)}/open`, {
          method: 'POST', token: account.token, body: {},
        });
        const reading = await call(`/morning-quiz/sessions/${encodeURIComponent(oldReading.sessionId)}`, { token: account.token });
        invariant(reading.paperQuestions.length === 10, 'reading_only: frozen reading is incomplete');
        await call(`/morning-quiz/sessions/${encodeURIComponent(oldReading.sessionId)}/submit`, {
          method: 'POST', token: account.token, body: { final: true },
        });
        overview = await call('/vocab-v2/overview', { token: account.token });
      }

      const readingPending = overview.readingBacklog.some((row) => row.date === yesterday);
      const learning = overview.learningBacklog.find((row) => row.date === yesterday);
      const testPending = overview.pendingTests.some((row) => row.date === yesterday);
      const observed = {
        readingPending,
        learningPending: Boolean(learning),
        learned: learning?.completed ?? daily.completed,
        testPending,
      };
      const expected = {
        reading_only: { readingPending: false, learningPending: true, learned: 0, testPending: false },
        words_only: { readingPending: true, learningPending: false, learned: daily.target, testPending: true },
        neither: { readingPending: true, learningPending: true, learned: 0, testPending: false },
        partial_words: { readingPending: true, learningPending: true, learned: 3, testPending: false },
      }[account.scenario];
      invariant(JSON.stringify(observed) === JSON.stringify(expected), `${account.scenario}: ${JSON.stringify({ observed, expected })}`);
      report.scenarios[account.scenario] = observed;
    }
  } finally {
    if (created.length) {
      const archived = await db.query(
        `update "User"
         set "archivedAt"=now(), "isActive"=false, "studentAuthVersion"="studentAuthVersion"+1
         where id=any($1::text[]) and name like '欠交验收%'
         returning id`,
        [created.map((row) => row.id)],
      );
      report.archivedQaStudents = archived.rowCount;
    }
    await db.end();
  }
  invariant(report.archivedQaStudents === 4, 'QA accounts were not all archived');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(String(error?.message || error).replace(/Bearer\s+\S+/gi, 'Bearer [redacted]'));
  process.exitCode = 1;
});
