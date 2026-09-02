/* eslint-disable no-console */
'use strict';

const { Client } = require('pg');

async function main() {
  const name = process.argv[2];
  const confirmation = process.argv[3];
  if (!name) throw new Error('account name is required');
  if (confirmation !== '--confirm') throw new Error('pass --confirm to archive the exact account');

  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('database connection is required');

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('begin');
    const found = await client.query(
      `select id, name, role, "isActive", "archivedAt"
       from "User"
       where name = $1
       for update`,
      [name],
    );
    if (found.rowCount !== 1) {
      throw new Error(`expected exactly one account named ${name}, found ${found.rowCount}`);
    }
    const account = found.rows[0];
    if (account.role !== 'student') throw new Error('refusing to archive a non-student account');

    const archived = await client.query(
      `update "User"
       set "archivedAt" = coalesce("archivedAt", now()),
           "isActive" = false,
           "studentAuthVersion" = "studentAuthVersion" + 1
       where id = $1
       returning id, name, "isActive", "archivedAt"`,
      [account.id],
    );
    await client.query('commit');
    console.log(JSON.stringify(archived.rows[0]));
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
