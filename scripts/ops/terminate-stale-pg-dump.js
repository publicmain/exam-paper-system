/* eslint-disable no-console */
const { Client } = require('pg');

async function main() {
  const pid = Number(process.env.EXPECTED_PID);
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('EXPECTED_PID is required');
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_PUBLIC_URL or DATABASE_URL is required');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const activity = (await client.query(`
      select application_name, state, coalesce(wait_event_type, '') as wait_event_type,
        coalesce(wait_event, '') as wait_event, query
      from pg_stat_activity where pid = $1
    `, [pid])).rows[0];
    if (!activity) {
      console.log(JSON.stringify({ pid, alreadyGone: true }));
      return;
    }
    if (activity.application_name !== 'pg_dump'
      || activity.wait_event_type !== 'Client'
      || activity.wait_event !== 'ClientWrite'
      || !activity.query.includes('COPY public."PdfPage"')) {
      throw new Error('refusing_to_terminate_unexpected_backend');
    }
    const terminated = (await client.query('select pg_terminate_backend($1) as terminated', [pid])).rows[0]?.terminated;
    console.log(JSON.stringify({ pid, terminated: Boolean(terminated) }));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exitCode = 1;
});
