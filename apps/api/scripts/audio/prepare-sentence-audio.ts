/** Offline input adapter. Run from repository root (no database, no network):
 * npx ts-node --project apps/api/tsconfig.json apps/api/scripts/audio/prepare-sentence-audio.ts \
 *   --input=apps/api/scripts/pilot/content/week10 --out=tmp/sentence-input.json
 * JSON accepts {passage}, {passages:[{text}]} or paperQuestions[].snapshotContent.passage.
 * A week directory loads ONLY the five trusted level .js content modules.
 * The Python generator consumes the resulting JSON, so sentence/hash rules have ONE source.
 */
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { sentenceHash } from '../../src/audio/sentence-audio';
import { normalizeSentence, SENTENCE_VOICE, splitSentenceRanges } from '../../src/audio/sentences';

export function extractPassages(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(extractPassages);
  const obj = value as Record<string, unknown>;
  const found: string[] = [];
  if (typeof obj.passage === 'string') found.push(obj.passage);
  if (typeof obj.text === 'string' && Object.keys(obj).every((k) => ['text', 'title', 'id'].includes(k))) found.push(obj.text);
  if (Array.isArray(obj.articles)) found.push(...obj.articles.flatMap(extractPassages));
  if (Array.isArray(obj.passages)) {
    for (const p of obj.passages) {
      if (typeof p === 'string') found.push(p);
      else if (p && typeof p.text === 'string') found.push(p.text);
      else found.push(...extractPassages(p));
    }
  }
  // Never read answers/explanations/vocab/context sentences as article text.
  for (const key of ['DAYS', 'days', 'lessons', 'papers', 'paper', 'questions', 'paperQuestions', 'snapshotContent', 'content',
    'ielts_authentic', 'ielts_light', 'ielts_simplified', 'olevel', 'olevel_intermediate']) {
    if (obj[key]) found.push(...extractPassages(obj[key]));
  }
  return found;
}

export function prepareSentences(passages: string[], voice = SENTENCE_VOICE) {
  const sentences = new Map<string, { hash: string; text: string }>();
  for (const passage of passages) for (const s of splitSentenceRanges(passage)) {
    const text = normalizeSentence(s.text);
    if (/^Paragraph\s+[0-9A-H]+$/i.test(text)) continue;
    const hash = sentenceHash(text, voice);
    sentences.set(hash, { hash, text });
  }
  return { version: 1, voice, sentences: [...sentences.values()] };
}

if (require.main === module) {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const input = arg('input');
  const output = arg('out');
  if (!input || !output) throw new Error('Required: --input=<week directory or article JSON> --out=<prepared JSON>');
  const source = resolve(input);
  const values = statSync(source).isDirectory()
    ? ['ielts_authentic', 'ielts_light', 'ielts_simplified', 'olevel', 'olevel_intermediate']
      .map((level) => require(resolve(source, `${level}.js`)))
    : JSON.parse(readFileSync(source, 'utf8'));
  const prepared = prepareSentences(extractPassages(values), arg('voice') ?? SENTENCE_VOICE);
  if (!prepared.sentences.length) throw new Error('No article passages found; nothing written.');
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(output, JSON.stringify(prepared, null, 2), 'utf8');
  console.log(`${prepared.sentences.length} unique sentences prepared (${prepared.voice}).`);
}
