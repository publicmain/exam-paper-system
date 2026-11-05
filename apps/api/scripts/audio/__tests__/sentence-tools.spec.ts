import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { extractPassages, prepareSentences } from '../prepare-sentence-audio';
import { loadSentenceRows, main, uploadSentenceRows } from '../upload-sentence-audio';

let dir: string;
let manifest: ReturnType<typeof prepareSentences> & { sentences: any[] };
function save() { writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest)); }
beforeEach(() => {
  dir = mkdtempSync(join(process.cwd(), 'sentence-tools-test-'));
  manifest = prepareSentences(['Hello. Hello.\n\nAnother.']);
  manifest.sentences = manifest.sentences.map((s) => ({ ...s, file: `${s.hash}.mp3`, durationMs: 500 }));
  for (const s of manifest.sentences) writeFileSync(join(dir, s.file), Buffer.from([0xff, 0xfb, 0x90, 0]));
  save();
});
afterEach(() => {
  if (!resolve(dir).startsWith(resolve(process.cwd()) + '\\') && !resolve(dir).startsWith(resolve(process.cwd()) + '/')) throw new Error('Unexpected temp directory');
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('offline sentence tooling', () => {
  it('extracts week DAYS and published snapshots without reading answer fields', () => {
    expect(extractPassages({ DAYS: [{ passage: 'Hello.', answer: { passage: 'SECRET' } }],
      paperQuestions: [{ snapshotContent: { passage: 'Another.', markScheme: 'SECRET' } }] }))
      .toEqual(['Hello.', 'Another.']);
    expect(extractPassages({ passages: [{ text: 'Hi.' }, 'Bye.'] })).toEqual(['Hi.', 'Bye.']);
    expect(extractPassages({ articles: [{ title: 'Article', text: 'Body.' }] })).toEqual(['Body.']);
  });
  it('prepares stable unique hashes using the same API rules', () => {
    expect(prepareSentences([' “Hello.” ', '"Hello."']).sentences).toHaveLength(1);
    expect(manifest.sentences).toHaveLength(2);
    expect(loadSentenceRows(join(dir, 'manifest.json'))).toHaveLength(2);
  });
  it('default dry-run validates without database access or file changes', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const before = readFileSync(join(dir, 'manifest.json'), 'utf8');
    await main([`--manifest=${join(dir, 'manifest.json')}`]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('no database connection or writes'));
    expect(readFileSync(join(dir, 'manifest.json'), 'utf8')).toBe(before);
  });
  it('rejects conflicting flags and unknown arguments', async () => {
    await expect(main(['--commit', '--dry-run'])).rejects.toThrow('Choose');
    await expect(main(['--force'])).rejects.toThrow('Unknown');
  });
  it.each(['hash', 'text', 'file', 'durationMs'])('rejects corrupted %s before uploading', (field) => {
    manifest.sentences[0][field] = field === 'durationMs' ? -1 : '../invalid'; save();
    expect(() => loadSentenceRows(join(dir, 'manifest.json'))).toThrow('Invalid sentence');
  });
  it('rejects missing and invalid audio', () => {
    writeFileSync(join(dir, manifest.sentences[0].file), Buffer.from('not audio'));
    expect(() => loadSentenceRows(join(dir, 'manifest.json'))).toThrow('Invalid or oversized');
    rmSync(join(dir, manifest.sentences[0].file));
    expect(() => loadSentenceRows(join(dir, 'manifest.json'))).toThrow();
  });
  it('repeated and concurrent uploads use only skipDuplicates createMany', async () => {
    const hashes = new Set<string>();
    const createMany = vi.fn(async ({ data, skipDuplicates }: any) => {
      expect(skipDuplicates).toBe(true);
      let count = 0;
      for (const r of data) if (!hashes.has(r.textHash)) { hashes.add(r.textHash); count++; }
      return { count };
    });
    const rows = loadSentenceRows(join(dir, 'manifest.json'));
    const counts = await Promise.all([uploadSentenceRows(rows, { createMany }), uploadSentenceRows(rows, { createMany })]);
    expect(counts.reduce((n, x) => n + x, 0)).toBe(2);
    expect(await uploadSentenceRows(rows, { createMany })).toBe(0);
    expect(hashes.size).toBe(2);
  });
});
