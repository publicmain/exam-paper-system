/**
 * 收词时的上下文处理（VOC05，2026-09-11）。
 *
 * 学生从阅读页传来的「这个词所在的句子」有两种去处，必须分开：
 *   · **个人**：只挂在这个学生自己的收词事件上（`contextText`），只给他本人看；
 *   · **共享**：写进 `VocabularyContext` 会进所有学生的教学卡。只有服务端能证明
 *     这句话确实出自学生有权阅读的那篇已发布文章时才允许，译文也由服务端出。
 */
import { containsTarget, wordCount } from './content-quality';

/** 教学卡要短句：一句话、含目标词、3–40 个词。整段文字只截含目标词的那一句。 */
export function focusedSentence(text: string | null | undefined, headword: string, maxWords = 40): string | null {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  const parts = clean.split(/(?<=[.!?。！？])\s+/).map((part) => part.trim()).filter(Boolean);
  const hit = parts.find((part) => containsTarget(part, headword) && wordCount(part) >= 3 && wordCount(part) <= maxWords);
  return hit ?? null;
}

export type SourceRef = { kind: 'assignment' | 'session'; id: string };

/** `assignment:<paperAssignmentId>` 或 `session:<morningQuizSessionId>`；其他写法一律不认。 */
export function parseSourceRef(ref: string | null | undefined): SourceRef | null {
  const match = String(ref ?? '').trim().match(/^(assignment|session):([A-Za-z0-9_-]{1,80})$/);
  return match ? { kind: match[1] as SourceRef['kind'], id: match[2] } : null;
}

const squash = (text: string) => text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

/** 句子是否逐字出现在某篇文章里（只忽略空白与弯直引号差异）。 */
export function sentenceInPassages(sentence: string, passages: readonly string[]): boolean {
  const needle = squash(sentence);
  if (!needle) return false;
  return passages.some((passage) => squash(passage).includes(needle));
}

/** 从题目 content JSON 里取文章正文（阅读题存在 `content.passage`）。 */
export function passageOf(content: unknown): string | null {
  if (!content || typeof content !== 'object') return null;
  const passage = (content as { passage?: unknown }).passage;
  return typeof passage === 'string' && passage.trim() ? passage : null;
}
