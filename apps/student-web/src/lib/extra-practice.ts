/** Result-only contracts. No typed input, per-key timing or recording belongs here. */
export type ExtraDrill = 'type' | 'ladder' | 'shadow';
export interface ExtraStep { step: number; prompt: string; answer: string; translation: string }
export interface ExtraItem { senseId?: string; textHash?: string; headword?: string; translation?: string;
  text?: string; audioUrl?: string; steps: ExtraStep[] }
export interface ExtraRound { roundId: string; roundToken: string; drill: ExtraDrill; items: ExtraItem[] }
export interface ExtraResult { roundId: string; roundToken: string; drill: ExtraDrill; senseId?: string; textHash?: string;
  step: number; attempt: 'first' | 'retry'; retryN?: number; isCorrect: boolean | null; hinted: boolean; timeBucket: 'fast' | 'normal' | 'slow' }
export function extraResultKey(r: ExtraResult) {
  return `${r.roundId}:${r.drill}:${r.senseId ?? r.textHash}:${r.step}:${r.attempt}:${r.retryN ?? 0}`;
}
export const timeBucket = (elapsed: number): ExtraResult['timeBucket'] => elapsed < 3000 ? 'fast' : elapsed <= 30000 ? 'normal' : 'slow';
export function judgeBlocks(expected: string, blocks: string[]) {
  const tokens = expected.trim().split(/\s+/);
  const firstWrong = tokens.findIndex((token, i) => token !== blocks[i]);
  return { correct: firstWrong === -1 && tokens.length === blocks.length,
    wrongBlock: firstWrong === -1 ? tokens.length + 1 : firstWrong + 1 };
}
export function shuffledBlocks(text: string): string[] {
  const source = text.trim().split(/\s+/); const blocks = [...source];
  for (let i = blocks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; }
  if (blocks.join(' ') === source.join(' ') && blocks.length > 1) blocks.push(blocks.shift()!);
  return blocks;
}
