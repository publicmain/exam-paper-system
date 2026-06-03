// backup-prod.mjs — logical full backup of the PRODUCTION database.
//
// Why not pg_dump? This Windows/Cowork environment has no pg_dump binary and
// Railway's Postgres is only reachable over the public proxy. This script uses
// the Prisma client (already proven to connect) to export every table to a
// single gzipped JSON snapshot, written to an OneDrive folder so it is
// automatically synced off-site (survives a total Railway loss).
//
// What it does NOT capture: the schema DDL itself (that lives in git +
// prisma/migrations and is restored by `migrate deploy`) and large binary
// columns (`Bytes`, e.g. PdfPage.imageBytes — source-PDF page images that are
// regenerable, not student data). Every scalar/enum column of every table —
// including all student submissions, answer scripts, grades, attendance — IS
// captured.
//
// Usage (DATABASE_URL must point at PROD — the public proxy URL):
//   export DATABASE_URL=<prod public url>
//   node scripts/backup-prod.mjs
//
// Exit code is non-zero on any failure so a scheduler can detect it.

import { PrismaClient, Prisma } from '@prisma/client';
import { gzipSync, gunzipSync } from 'node:zlib';
import { writeFileSync, readFileSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BACKUP_DIR = process.env.BACKUP_DIR || 'C:/Users/yaoke/OneDrive/exam-paper-backups';
const RETAIN = Number(process.env.BACKUP_RETAIN || 14);

function delegateName(model) {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function ts() {
  return new Date().toISOString();
}

const prisma = new PrismaClient();

(async () => {
  const models = Prisma.dmmf.datamodel.models;
  const dump = { _meta: { takenAt: ts(), schemaModelCount: models.length, bytesExcluded: {} } };
  const counts = {};

  for (const m of models) {
    const select = {};
    const skipped = [];
    for (const f of m.fields) {
      if (f.kind === 'scalar' || f.kind === 'enum') {
        if (f.type === 'Bytes') { skipped.push(f.name); continue; }
        select[f.name] = true;
      }
    }
    const delegate = prisma[delegateName(m.name)];
    if (!delegate || typeof delegate.findMany !== 'function') {
      console.warn(`  ! no delegate for model ${m.name} — skipped`);
      continue;
    }
    const rows = await delegate.findMany({ select });
    dump[m.name] = rows;
    counts[m.name] = rows.length;
    if (skipped.length) dump._meta.bytesExcluded[m.name] = skipped;
  }
  dump._meta.counts = counts;

  const json = JSON.stringify(dump, (k, v) => (typeof v === 'bigint' ? v.toString() : v));
  const gz = gzipSync(Buffer.from(json, 'utf8'), { level: 9 });

  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = ts().replace(/[:.]/g, '-').slice(0, 19);
  const file = join(BACKUP_DIR, `exam-backup-${stamp}.json.gz`);
  writeFileSync(file, gz);

  // ---- self-verify: read the file back, gunzip, parse, re-check counts ----
  const reparsed = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'));
  let mismatch = false;
  for (const [k, v] of Object.entries(counts)) {
    const got = Array.isArray(reparsed[k]) ? reparsed[k].length : -1;
    if (got !== v) { console.error(`  VERIFY FAIL ${k}: wrote ${v}, read back ${got}`); mismatch = true; }
  }
  if (mismatch) throw new Error('backup self-verification failed — file is corrupt, NOT counting this run as success');

  const sizeMB = (statSync(file).size / 1048576).toFixed(2);
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`[${ts()}] backup OK: ${file}`);
  console.log(`  ${models.length} tables, ${totalRows} rows, ${sizeMB} MB (gzip), self-verify PASSED`);
  console.log(`  key: submissions=${counts.StudentSubmission} answerScripts=${counts.AnswerScript} attendances=${counts.Attendance} users=${counts.User}`);

  // ---- rotation: keep RETAIN most recent (timestamp name => lexical = chrono) ----
  const all = readdirSync(BACKUP_DIR).filter((f) => /^exam-backup-.*\.json\.gz$/.test(f)).sort();
  const stale = all.slice(0, Math.max(0, all.length - RETAIN));
  for (const f of stale) { unlinkSync(join(BACKUP_DIR, f)); console.log(`  rotated out: ${f}`); }

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(`[${ts()}] BACKUP FAILED:`, e.message);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
