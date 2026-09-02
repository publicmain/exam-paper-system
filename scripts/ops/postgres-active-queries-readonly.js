/* eslint-disable no-console */
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_PUBLIC_URL or DATABASE_URL is required');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const rows = (await client.query(`
      select a.pid, a.application_name, a.state,
        coalesce(a.wait_event_type, '') as wait_event_type,
        coalesce(a.wait_event, '') as wait_event,
        extract(epoch from (now() - a.query_start))::int as running_seconds,
        left(regexp_replace(a.query, '\\s+', ' ', 'g'), 180) as query,
        pg_blocking_pids(a.pid) as blocking_pids
      from pg_stat_activity a
      where a.datname = current_database()
        and a.pid <> pg_backend_pid()
        and a.state <> 'idle'
      order by a.query_start
    `)).rows;
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exitCode = 1;
});
