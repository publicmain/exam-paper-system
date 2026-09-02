/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Client } = require('pg');

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) throw new Error('usage: node backup-postgres-json.js <output.json.gz>');
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_PUBLIC_URL or DATABASE_URL is required');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const tables = (await client.query(
      "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name",
    )).rows.map((row) => row.table_name);
    const columns = (await client.query(
      "select table_name, column_name, data_type, is_nullable, column_default, ordinal_position from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position",
    )).rows;
    const backup = {
      createdAt: new Date().toISOString(),
      kind: 'logical-json-pre-migration',
      columns,
      tables: {},
    };
    let rowCount = 0;
    for (const table of tables) {
      const quoted = `"${table.replace(/"/g, '""')}"`;
      const rows = (await client.query(`select * from ${quoted}`)).rows;
      backup.tables[table] = rows;
      rowCount += rows.length;
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, zlib.gzipSync(Buffer.from(JSON.stringify(backup))));
    console.log(JSON.stringify({ tables: tables.length, rows: rowCount, path: outputPath }));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exitCode = 1;
});
