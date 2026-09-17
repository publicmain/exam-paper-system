/* Read-only, consistent release backup and aggregate checks. Never emits student rows or credentials. */
const { Client } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { gzipSync, gunzipSync } = require('node:zlib');
const PROJECT = 'c634fa12-fa7f-460b-a113-3bf4b9566c99';
const root = path.resolve(__dirname, '../..');
const out = path.join(root, '.local/badges-release');
const quote = s => '"' + s.replace(/"/g, '""') + '"';
async function main() {
  if (process.env.BADGE_RELEASE_PROJECT !== PROJECT) throw new Error('Explicit verified production project required');
  const connectionString = process.env.DATABASE_PUBLIC_URL;
  if (!connectionString) throw new Error('Production public database connection missing');
  const url = new URL(connectionString);
  if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) throw new Error('Production backup cannot target a local sandbox');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false }, application_name: 'badge_v5_release_readonly_backup', statement_timeout: 60000 });
  await client.connect();
  const startedAt = new Date().toISOString();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tables = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows.map(r => r.table_name);
    const columns = (await client.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
    const report = { startedAt, databaseReachable: true, readOnly: true, tableCount: tables.length, migrations: [], counts: {}, badgeTables: {}, reading: {}, vocabulary: {} };
    if (tables.includes('_prisma_migrations')) report.migrations = (await client.query('SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY started_at')).rows;
    for (const table of ['StudentAchievement', 'StudentAchievementCollection', 'ClassWeeklyGoal']) report.badgeTables[table] = tables.includes(table);
    const dump = { _meta: { takenAt: startedAt, consistency: 'repeatable-read read-only', sourceCommit: '92a082e5b2109aa4a5c1da5f5b105b466664e5c2', bytesExcluded: {}, counts: {} } };
    for (const table of tables) {
      const fields = columns.filter(c => c.table_name === table);
      const excluded = fields.filter(c => c.data_type === 'bytea').map(c => c.column_name);
      const included = fields.filter(c => c.data_type !== 'bytea').map(c => quote(c.column_name));
      if (!included.length) throw new Error('No scalar columns for ' + table);
      const rows = (await client.query(`SELECT ${included.join(',')} FROM public.${quote(table)}`)).rows;
      dump[table] = rows;
      dump._meta.counts[table] = rows.length;
      if (excluded.length) dump._meta.bytesExcluded[table] = excluded;
    }
    report.counts = dump._meta.counts;
    if (tables.includes('StudentSubmission')) report.reading = (await client.query('SELECT status, "submitSource", count(*)::int AS count, count("finalSubmittedAt")::int AS final_timestamp_count FROM "StudentSubmission" GROUP BY status, "submitSource"')).rows;
    if (tables.includes('VocabularyV2Session')) report.vocabulary = (await client.query('SELECT "sessionType",status,count(*)::int AS count FROM "VocabularyV2Session" GROUP BY "sessionType",status ORDER BY "sessionType",status')).rows;
    await client.query('COMMIT');
    fs.mkdirSync(out, { recursive: true });
    const stamp = startedAt.replace(/[:.]/g, '-');
    const file = path.join(out, 'before-badges-' + stamp + '.json.gz');
    const raw = JSON.stringify(dump, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    const gz = gzipSync(Buffer.from(raw), { level: 9 });
    fs.writeFileSync(file, gz, { flag: 'wx' });
    const restored = JSON.parse(gunzipSync(fs.readFileSync(file)));
    for (const [table, count] of Object.entries(dump._meta.counts)) if (restored[table]?.length !== count) throw new Error('Backup read-back verification failed: ' + table);
    report.backup = { file: path.relative(root, file), bytes: gz.length, sha256: crypto.createHash('sha256').update(gz).digest('hex'), verified: true, byteColumnsExcluded: dump._meta.bytesExcluded };
    report.completedAt = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'preflight.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ tableCount: report.tableCount, totalRows: Object.values(report.counts).reduce((a,b)=>a+b,0), backupVerified: true, backupBytes: gz.length, migrationCount: report.migrations.length, badgeTables: report.badgeTables, reading: report.reading, vocabulary: report.vocabulary }));
  } finally { await client.end(); }
}
main().catch(e => { console.error('Release read-only backup failed: ' + e.message); process.exitCode = 1; });
