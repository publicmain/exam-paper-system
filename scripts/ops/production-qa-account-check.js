/* eslint-disable no-console */
'use strict';

const { Client } = require('pg');

async function main() {
  const name = process.argv[2];
  if (!name) throw new Error('account name is required');
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('database connection is required');
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const result = await client.query(
      'select id, name, "isActive", "archivedAt" from "User" where name = $1 order by "createdAt" desc',
      [name],
    );
    console.log(JSON.stringify(result.rows));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
