import { createHash } from 'crypto';
import { normalizeSentence, SENTENCE_VOICE, splitSentenceParagraphs } from './sentences';

export function sentenceHash(text: string, voice = SENTENCE_VOICE): string {
  return createHash('sha256').update(`${normalizeSentence(text)}|${voice}`, 'utf8').digest('hex');
}

export interface SentenceAudioItem { text: string; audioUrl: string | null }
export interface PassageAudio { passage: string; paragraphs: SentenceAudioItem[][] }
type AudioReader = { sentenceAudio: { findMany(args: {
  where: { textHash: { in: string[] } }; select: { textHash: true };
}): Promise<{ textHash: string }[]> } };

/** Only accept passage strings, never spread snapshot fields into this response. */
export async function readingSentenceAudio(passages: string[], db: AudioReader): Promise<PassageAudio[]> {
  const parsed = [...new Set(passages.filter((p) => p.trim()))].map((passage) => ({
    passage,
    paragraphs: splitSentenceParagraphs(passage).map((sentences) => sentences
      .filter((s) => !/^Paragraph\s+[0-9A-H]+$/i.test(s.text))
      .map((s) => ({ text: s.text, hash: sentenceHash(s.text) }))).filter((p) => p.length),
  }));
  const hashes = [...new Set(parsed.flatMap((p) => p.paragraphs.flatMap((ss) => ss.map((s) => s.hash))))];
  const available = new Set<string>();
  for (let i = 0; i < hashes.length; i += 500) {
    const rows = await db.sentenceAudio.findMany({
      where: { textHash: { in: hashes.slice(i, i + 500) } }, select: { textHash: true },
    });
    rows.forEach((r) => available.add(r.textHash));
  }
  return parsed.map((p) => ({ passage: p.passage, paragraphs: p.paragraphs.map((ss) => ss.map((s) => ({
    text: s.text, audioUrl: available.has(s.hash) ? `/api/audio/sentence/${s.hash}.mp3` : null,
  }))) }));
}
