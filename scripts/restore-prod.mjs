// restore-prod.mjs — restore a backup-prod.mjs snapshot into a target database.
//
// SAFETY: refuses to run unless you pass the backup file AND, for a non-dry
// run, the literal token RESTORE as the 2nd arg. The TARGET is whatever
// DATABASE_URL points at — set it to a SCRATCH/TEST db for a drill, or to a
// freshly-recreated prod db for real disaster recovery. Schema must already
// exist (run `npx prisma migrate deploy` against the target first).
//
// Usage:
//   # dry run — parse + topo-order + report counts, write nothing:
//   DATABASE_URL=<target> node scripts/restore-prod.mjs <backup.json.gz>
//   # real restore:
//   DATABASE_URL=<target> node scripts/restore-prod.mjs <backup.json.gz> RESTORE
//
// FK constraints are deferred via `session_replication_role = replica` so
// tables can be loaded in any order (requires the DB role to be able to set
// it; the postgres superuser on a local/Railway db can).

import { PrismaClient, Prisma } from '@prisma/client';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const confirm = process.argv[3];
const DRY = confirm !== 'RESTORE';

if (!file) {
  console.error('Usage: DATABASE_URL=<target> node scripts/restore-prod.mjs <backup.json.gz> [RESTORE]');
  process.exit(2);
}

function delegateName(model) {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

const prisma = new PrismaClient();

(async () => {
  const dump = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'));
  const models = Prisma.dmmf.datamodel.models;
  const present = models.map((m) => m.name).filter((n) => Array.isArray(dump[n]));

  console.log(`Backup taken: ${dump._meta?.takenAt}`);
  console.log(`Target DB: ${(process.env.DATABASE_URL || '').replace(/:[^:@/]+@/, ':***@')}`);
  console.log(`Mode: ${DRY ? 'DRY RUN (no writes)' : 'REAL RESTORE'}`);
  console.log(`Tables in backup: ${present.length}\n`);

  if (DRY) {
    let total = 0;
    for (const n of present) { total += dump[n].length; }
    console.log(`Dry run OK — backup parses cleanly, ${total} rows across ${present.length} tables ready to load.`);
    console.log(`key: StudentSubmission=${dump.StudentSubmission?.length} AnswerScript=${dump.AnswerScript?.length} Attendance=${dump.Attendance?.length}`);
    await prisma.$disconnect();
    return;
  }

  // Real restore: defer FK checks, load every table, re-enable.
  await prisma.$executeRawUnsafe('SET session_replication_role = replica');
  let loaded = 0;
  try {
    for (const m of models) {
      const rows = dump[m.name];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      // Coerce ISO date strings back to Date for DateTime columns.
      const dateFields = m.fields.filter((f) => f.type === 'DateTime').map((f) => f.name);
      for (const r of rows) {
        for (const df of dateFields) if (r[df] != null) r[df] = new Date(r[df]);
      }
      await prisma[delegateName(m.name)].createMany({ data: rows, skipDuplicates: true });
      loaded += rows.length;
      console.log(`  loaded ${m.name}: ${rows.length}`);
    }
  } finally {
    await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT');
  }
  console.log(`\nRestore complete: ${loaded} rows loaded.`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('RESTORE FAILED:', e.message);
  try { await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT'); } catch {}
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
