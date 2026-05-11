// One-shot bootstrap for a fresh prod DB. Pushes the same content
// the dev DB has so weekly-generate stops failing with
// no_passages_in_bank / no_olevel_papers_in_bank.
//
// Reads:
//   PROD_API_URL    e.g. https://exam-api-production-xxxx.up.railway.app
//   PROD_ADMIN_EMAIL  admin@school.local
//   PROD_ADMIN_PASSWORD  <prod password>
//
// USAGE:
//   PROD_API_URL=https://... \
//   PROD_ADMIN_EMAIL=admin@... \
//   PROD_ADMIN_PASSWORD=... \
//   node apps/api/scripts/ingest-prod.mjs
//
// Idempotent: every ingest endpoint skips rows whose sourceRef already
// exists. Re-running after a partial failure picks up where it left off.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '..', 'test-fixtures');

const API = process.env.PROD_API_URL?.replace(/\/$/, '');
const EMAIL = process.env.PROD_ADMIN_EMAIL;
const PASSWORD = process.env.PROD_ADMIN_PASSWORD;
if (!API || !EMAIL || !PASSWORD) {
  console.error('Missing PROD_API_URL / PROD_ADMIN_EMAIL / PROD_ADMIN_PASSWORD env vars.');
  process.exit(2);
}

async function http(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...opts.headers },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) {
    const summary = typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300);
    throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${summary}`);
  }
  return body;
}

const log = (...a) => console.log(...a);

async function main() {
  log(`Connecting to prod: ${API}`);
  const auth = await http('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  const token = auth.token;
  if (!token) throw new Error('login response did not include token');
  log(`Logged in as ${auth.user.role} ${auth.user.name}`);

  const authHdr = { authorization: `Bearer ${token}` };

  // ─── IELTS GT 14 (simplified band) ───
  const gtSections = [
    'cambridge-ielts-gt-14/test1-section1.json',
    'cambridge-ielts-gt-14/test1-section2.json',
    'cambridge-ielts-gt-14/test1-section3.json',
  ];
  log(`\nIngesting Cambridge IELTS 14 GT sections (simplified band)`);
  for (const rel of gtSections) {
    const f = path.join(FIXTURES, rel);
    const json = JSON.parse(await fs.readFile(f, 'utf8'));
    log(`  → ${rel}`);
    const r = await http('/api/ielts-ingest/passage', { method: 'POST', headers: authHdr, body: JSON.stringify(json) });
    log(`    created=${r.created} skipped=${r.skipped} prefix=${r.sourceRefPrefix}`);
    if (r.sourceRefPrefix) {
      const a = await http('/api/ielts-ingest/approve', { method: 'POST', headers: authHdr, body: JSON.stringify({ sourceRefPrefix: r.sourceRefPrefix }) });
      log(`    approve: promoted=${a.promoted} alreadyActive=${a.alreadyActive}`);
    }
  }

  // ─── Cambridge IELTS 8 Academic (authentic band) ───
  const camb8Passages = [
    { file: 'cambridge-ielts-8/test1-passage1.json', passageNumber: 1 },
    { file: 'cambridge-ielts-8/test1-passage2.json', passageNumber: 2 },
    { file: 'cambridge-ielts-8/test1-passage3.json', passageNumber: 3 },
  ];
  log(`\nIngesting Cambridge IELTS 8 Academic passages (authentic band)`);
  for (const pkg of camb8Passages) {
    const f = path.join(FIXTURES, pkg.file);
    const raw = JSON.parse(await fs.readFile(f, 'utf8'));
    // The camb8-*.json fixtures were the original seed format. Normalise
    // to the ingest schema: bookCode, testNumber, passageNumber,
    // passage:{title,body}, questions[]. If the file is already in the
    // ingest shape, pass through.
    let payload;
    if (raw.bookCode && raw.passage && raw.questions) {
      payload = raw;
    } else if (Array.isArray(raw.questions) && raw.title) {
      payload = {
        bookCode: 'cambridge_ielts_8',
        provenanceTag: 'cambridge_ielts_8_authentic',
        testNumber: 1,
        passageNumber: pkg.passageNumber,
        passage: { title: raw.title, body: raw.body ?? raw.passage ?? '' },
        questions: raw.questions,
      };
    } else {
      log(`    ${pkg.file}: unrecognised shape — skipping`);
      continue;
    }
    log(`  → ${pkg.file} (Test1/P${pkg.passageNumber})`);
    try {
      const r = await http('/api/ielts-ingest/passage', { method: 'POST', headers: authHdr, body: JSON.stringify(payload) });
      log(`    created=${r.created} skipped=${r.skipped} prefix=${r.sourceRefPrefix}`);
      if (r.sourceRefPrefix) {
        const a = await http('/api/ielts-ingest/approve', { method: 'POST', headers: authHdr, body: JSON.stringify({ sourceRefPrefix: r.sourceRefPrefix }) });
        log(`    approve: promoted=${a.promoted} alreadyActive=${a.alreadyActive}`);
      }
    } catch (e) {
      log(`    SKIP: ${e.message.slice(0, 120)}`);
    }
  }

  // ─── IGCSE 0510 papers (olevel band) ───
  const olevelPapers = [
    'cie-0510/paper-s24-12.json',
    'cie-0510/paper-s23-12.json',
    'cie-0510/paper-w24-12.json',
  ];
  log(`\nIngesting Cambridge IGCSE 0510 papers (olevel band)`);
  for (const rel of olevelPapers) {
    const f = path.join(FIXTURES, rel);
    const json = JSON.parse(await fs.readFile(f, 'utf8'));
    log(`  → ${rel}`);
    const r = await http('/api/olevel-ingest/paper', { method: 'POST', headers: authHdr, body: JSON.stringify(json) });
    log(`    created=${r.created} skipped=${r.skipped} prefix=${r.sourceRefPrefix}`);
    if (r.sourceRefPrefix) {
      const a = await http('/api/olevel-ingest/approve', { method: 'POST', headers: authHdr, body: JSON.stringify({ sourceRefPrefix: r.sourceRefPrefix }) });
      log(`    approve: promoted=${a.promoted} alreadyActive=${a.alreadyActive}`);
    }
  }

  log(`\n✓ Bootstrap complete. Now POST /api/morning-quiz/weekly-generate/run-now from`);
  log(`  the admin UI to materialise the week's sessions.`);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
