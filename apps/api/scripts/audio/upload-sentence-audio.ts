/** Run from repository root; default DRY-RUN does not even create PrismaClient:
 * npx ts-node --project apps/api/tsconfig.json apps/api/scripts/audio/upload-sentence-audio.ts \
 *   --manifest=tmp/sentence-mp3/manifest.json [--commit]
 * All files/hashes validated BEFORE writing. Only SentenceAudio.createMany is used;
 * skipDuplicates protects repeated/concurrent uploads. Never delete/update audio.
 */
import { readFileSync, realpathSync } from 'fs';
import { basename, dirname, resolve, sep } from 'path';
import { sentenceHash } from '../../src/audio/sentence-audio';
import { normalizeSentence } from '../../src/audio/sentences';

export function loadSentenceRows(manifestPath: string) {
  const dir = realpathSync(dirname(resolve(manifestPath)));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== 1 || typeof manifest.voice !== 'string' || !manifest.voice.trim()
    || !Array.isArray(manifest.sentences) || !manifest.sentences.length) throw new Error('Invalid manifest');
  const unique = new Map<string, { textHash: string; voice: string; text: string; contentType: string;
    bytes: Buffer; byteLength: number; durationMs: number }>();
  for (const s of manifest.sentences) {
    if (typeof s.text !== 'string' || !s.text || normalizeSentence(s.text) !== s.text
      || s.hash !== sentenceHash(s.text, manifest.voice)
      || s.file !== `${s.hash}.mp3` || basename(s.file) !== s.file
      || !Number.isSafeInteger(s.durationMs) || s.durationMs <= 0 || s.durationMs > 2147483647) {
      throw new Error('Invalid sentence entry (text/hash/file/durationMs)');
    }
    const file = realpathSync(resolve(dir, s.file));
    if (!file.startsWith(dir + sep)) throw new Error('Audio file escapes manifest directory');
    const bytes = readFileSync(file);
    const mp3 = bytes.subarray(0, 3).toString('ascii') === 'ID3'
      || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    if (!mp3 || bytes.length > 20 * 1024 * 1024) throw new Error('Invalid or oversized MP3');
    unique.set(s.hash, { textHash: s.hash, voice: manifest.voice, text: s.text,
      contentType: 'audio/mpeg', bytes, byteLength: bytes.length, durationMs: s.durationMs });
  }
  return [...unique.values()];
}

export async function uploadSentenceRows(rows: ReturnType<typeof loadSentenceRows>, table: {
  createMany(args: { data: typeof rows; skipDuplicates: true }): Promise<{ count: number }>;
}) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    inserted += (await table.createMany({ data: rows.slice(i, i + 50), skipDuplicates: true })).count;
  }
  return inserted;
}

export async function main(args: string[]) {
  if (args.some((a) => a !== '--commit' && a !== '--dry-run' && !a.startsWith('--manifest='))) throw new Error('Unknown argument');
  if (args.includes('--commit') && args.includes('--dry-run')) throw new Error('Choose --commit OR --dry-run');
  const path = args.find((a) => a.startsWith('--manifest='))?.slice('--manifest='.length);
  if (!path) throw new Error('Required: --manifest=<manifest.json>');
  const rows = loadSentenceRows(path);
  if (!args.includes('--commit')) {
    console.log(`DRY-RUN: ${rows.length} sentences validated; no database connection or writes.`);
    return;
  }
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try { console.log(`Inserted ${await uploadSentenceRows(rows, prisma.sentenceAudio)} sentences (duplicates skipped).`); }
  finally { await prisma.$disconnect(); }
}

if (require.main === module) main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exitCode = 1; });
