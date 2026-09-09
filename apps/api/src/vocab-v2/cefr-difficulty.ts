/**
 * 用 CEFR-J 词表判断一段英文对某个档位是不是超纲。
 *
 * 为什么需要：2026-09-09 调研发现，基础档（`contextDifficulty: 1`）的学生
 * 曾经被推到一句天文学例句 —— “The alignment has to be nearly edge-on, and for
 * most planetary systems it is not…”。例句本身没错，错在没人挡它。
 *
 * 判据只用来**排序和过滤候选**，永远不用来给学生打分。
 *
 * ## 词表外的词怎么算
 *
 * 第一版把「查不到等级」一律当成不难，结果上面那句天文例句照样过闸 —— 因为
 * alignment / planetary / transit 根本不在 CEFR-J 里，只有 majority 被抓到。
 * CEFR-J 收到 B2 为止，所以**词表外的实词基本都在 B2 以上**，现在按超纲算。
 *
 * 代价是专有名词会被误伤（Chandran、Tampines 不在词表里）。用大小写挡：句中
 * 出现的大写词当专有名词跳过，句首那个不算 —— 句首本来就大写，判断不了。
 */
import { CEFR_RANK, cefrLevelOf, type CefrLevel } from './cefr-wordlist';

/**
 * 内容难度档（`level-policy.ts` 的 `contextDifficulty`，1–5）对应的 CEFR 上限。
 *
 *   1 基础     → A2
 *   2 中级     → B1
 *   3 标准     → B1
 *   4 雅思轻量 → B2
 *   5 雅思真题 → 不设限（真题本来就会超纲，超纲词正是要学的）
 */
const CEILING: Readonly<Record<number, CefrLevel | null>> = {
  1: 'A2',
  2: 'B1',
  3: 'B1',
  4: 'B2',
  5: null,
};

export function ceilingFor(contextDifficulty: number): CefrLevel | null {
  return CEILING[Math.max(1, Math.min(5, Math.floor(contextDifficulty)))] ?? null;
}

interface Token {
  word: string;
  /** 原文里是大写开头，且不在句首 —— 多半是专有名词。 */
  properNoun: boolean;
}

/** 切词，保留「是不是句中大写」这个信息。缩写里的撇号保留（don't 不拆）。 */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  // 句子边界：句号 / 问号 / 感叹号 / 换行之后的第一个词算句首
  let sentenceStart = true;
  const re = /([A-Za-z][A-Za-z'-]*)|([.!?\n]+)|([^A-Za-z]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[2]) {
      sentenceStart = true;
      continue;
    }
    if (!m[1]) continue;
    const raw = m[1];
    const word = raw.toLowerCase().replace(/^['-]+|['-]+$/g, '');
    if (word.length > 1) {
      out.push({ word, properNoun: !sentenceStart && /^[A-Z]/.test(raw) });
    }
    sentenceStart = false;
  }
  return out;
}

/** 只要词，给需要词数的地方用。 */
export function wordsOf(text: string): string[] {
  return tokenize(text).map((t) => t.word);
}

/**
 * 超出上限的词。`headword` 是正在教的词 —— 它本来就可能超纲（那正是要学它的
 * 原因），不算在内。
 */
export function hardWordsFor(
  text: string,
  contextDifficulty: number,
  headword?: string,
): string[] {
  const ceiling = ceilingFor(contextDifficulty);
  if (!ceiling) return [];
  const max = CEFR_RANK[ceiling];
  const skip = String(headword ?? '').toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokenize(text)) {
    if (t.word === skip || seen.has(t.word)) continue;
    seen.add(t.word);
    if (t.properNoun) continue; // Chandran、Tampines 之类
    const level = cefrLevelOf(t.word);
    if (level) {
      if (CEFR_RANK[level] > max) out.push(t.word);
      continue;
    }
    // 词表外：CEFR-J 收到 B2，落在外面的实词基本都更难。三个字母以内的
    // 多半是缩写或功能词，放过。
    if (t.word.length > 3) out.push(t.word);
  }
  return out;
}

/**
 * 这句话适合这个档位吗。
 *
 * 阈值放得松：超纲词不超过 2 个，且占比不超过 15%。太严会把候选全筛掉，而
 * 「略难一点的真句」比「一句都没有」好得多 —— 首发第一周 10 个词里 8 个是空
 * 例句框，教训就在这里。
 */
export function sentenceFitsLevel(
  text: string,
  contextDifficulty: number,
  headword?: string,
): boolean {
  const ceiling = ceilingFor(contextDifficulty);
  if (!ceiling) return true;
  const total = wordsOf(text).length;
  if (total === 0) return true;
  const hard = hardWordsFor(text, contextDifficulty, headword).length;
  return hard <= 2 && hard / total <= 0.15;
}

/** 一段文章的难度画像 —— 给内容入库前的自动体检用。 */
export function difficultyProfile(text: string, contextDifficulty: number) {
  const tokens = tokenize(text);
  const counts: Record<string, number> = { A1: 0, A2: 0, B1: 0, B2: 0, 词表外: 0, 专名: 0 };
  for (const t of tokens) {
    if (t.properNoun) counts['专名'] += 1;
    else counts[cefrLevelOf(t.word) ?? '词表外'] += 1;
  }
  const hard = hardWordsFor(text, contextDifficulty);
  return {
    words: tokens.length,
    counts,
    hardWords: hard,
    hardRatio: tokens.length ? Number((hard.length / tokens.length).toFixed(4)) : 0,
    ceiling: ceilingFor(contextDifficulty),
  };
}
