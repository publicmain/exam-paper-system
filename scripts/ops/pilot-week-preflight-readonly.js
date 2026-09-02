/* eslint-disable no-console */
'use strict';

const { Client } = require('pg');

const CLASS_NAMES = [
  'SGCE26W', 'SEC27W', 'OL26W', 'IAL27W', 'IAL27M',
  'IAL26W', 'IAL26S2', 'IAL26S1', 'IAL28S',
];

async function scalar(client, sql, params = []) {
  return Number((await client.query(sql, params)).rows[0].n);
}

async function main() {
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('database connection is required');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('begin read only');
    const report = {
      prefixed: {},
      conflictingClassNames: (await client.query(
        `select name from "Class" where name = any($1::text[]) and id not like 'p1_%' order by name`,
        [CLASS_NAMES],
      )).rows.map((row) => row.name),
      reservedUniqueConflicts: {
        examBoardCode: await scalar(client, `select count(*)::int n from "ExamBoard" where code='P1ENG' and id<>'p1_board'`),
        publisherEmail: await scalar(client, `select count(*)::int n from "User" where email='p1.publisher@example.invalid' and id<>'p1_publisher'`),
        qaEmail: await scalar(client, `select count(*)::int n from "User" where email='p1.qa@example.invalid' and id<>'p1_qa_student'`),
        classCodes: await scalar(client, `select count(*)::int n from "Class" where "classCode" = any($1::text[]) and id not like 'p1_%'`, [['PILOTW1', ...CLASS_NAMES]]),
      },
    };
    for (const table of [
      'Class', 'ClassEnglishLevel', 'ClassEnrollment', 'User', 'Paper', 'Question',
      'PaperQuestion', 'PaperAssignment', 'MorningQuizSession', 'StudentWord',
    ]) {
      report.prefixed[table] = await scalar(
        client,
        `select count(*)::int n from "${table}" where id like 'p1_%'`,
      );
    }
    await client.query('rollback');
    console.log(JSON.stringify(report, null, 2));
    if (report.conflictingClassNames.length || Object.values(report.reservedUniqueConflicts).some(Boolean)) {
      process.exitCode = 2;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(String(error?.message || error).replace(/postgres(ql)?:\/\/\S*/gi, '[redacted]'));
  process.exitCode = 1;
});
