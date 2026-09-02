/* eslint-disable no-console */
'use strict';

const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('database connection is required');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('begin read only');
    const row = (await client.query(`select
      (select count(*)::int from "Class" where id like 'p1_%') as p1_classes,
      (select count(*)::int from "Class" where id like 'p1_class_%') as registration_classes,
      (select count(*)::int from "ClassEnglishLevel" where id like 'p1_%') as class_levels,
      (select count(*)::int from "Paper" where id like 'p1_%') as papers,
      (select count(*)::int from "Question" where id like 'p1_%') as questions,
      (select count(*)::int from "PaperQuestion" where id like 'p1_%') as paper_questions,
      (select count(*)::int from "PaperAssignment" where id like 'p1_%') as assignments,
      (select count(*)::int from "MorningQuizSession" where id like 'p1_%') as sessions,
      (select count(*)::int from "VocabularyLexeme") as lexemes,
      (select count(*)::int from "VocabularySense") as senses,
      (select count(*)::int from "VocabularySense" where "qualityStatus"='ready') as ready_senses,
      (select count(*)::int from "VocabularyContext") as contexts,
      (select count(*)::int from "VocabularyContentJob" where status='published') as published_jobs,
      (select count(*)::int from "VocabularyContentJob" where status='failed') as failed_jobs,
      (select count(*)::int from "User" where name like '上线验收%' and "archivedAt" is null) as active_qa,
      (select count(*)::int from "User" where name like '上线验收%' and "archivedAt" is not null) as archived_qa,
      (select count(*)::int from "_prisma_migrations" where finished_at is null or rolled_back_at is not null) as bad_migrations
    `)).rows[0];
    await client.query('rollback');
    console.log(JSON.stringify(row, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(String(error?.message || error).replace(/postgres(ql)?:\/\/\S*/gi, '[redacted]'));
  process.exitCode = 1;
});
