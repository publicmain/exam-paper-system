/* eslint-disable no-console */
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_PUBLIC_URL or DATABASE_URL is required');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const tableRows = (await client.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name
    `)).rows;
    const tables = tableRows.map((row) => row.table_name);
    const tableSet = new Set(tables);

    const estimatedRows = (await client.query(`
      select s.relname as table_name,
        greatest(s.n_live_tup, 0)::bigint as estimated_rows,
        pg_total_relation_size(format('%I.%I', 'public', s.relname)::regclass)::bigint as total_bytes
      from pg_stat_user_tables s
      order by total_bytes desc, s.relname
    `)).rows;

    const report = {
      tableCount: tables.length,
      estimatedRows,
      prismaMigrations: tableSet.has('_prisma_migrations')
        ? (await client.query(`
            select migration_name, finished_at is not null as finished
            from "_prisma_migrations"
            order by started_at desc
            limit 8
          `)).rows
        : [],
      vocabularyV2Tables: [
        'VocabularyLexeme',
        'VocabularySense',
        'VocabularyContext',
        'VocabularyContentJob',
        'StudentVocabularySense',
        'VocabularyCollectionEvent',
      ].reduce((result, table) => ({ ...result, [table]: tableSet.has(table) }), {}),
      activeBackupQueries: (await client.query(`
        select state, coalesce(wait_event_type, '') as wait_event_type,
          coalesce(wait_event, '') as wait_event,
          extract(epoch from (now() - query_start))::int as running_seconds
        from pg_stat_activity
        where application_name like 'pg_dump%'
      `)).rows,
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exitCode = 1;
});
