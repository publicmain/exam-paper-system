import { sentenceFitsLevel } from './cefr-difficulty';
import { isSchoolUnsafeContext } from './school-safe-sentences';
import { isApprovedContext } from './content-review';

export interface ContextCandidate {
  id: string;
  kind: string;
  position: number;
  sentence: string;
  translation: string;
  difficulty: number;
  /** 有翻译的才是 ready；没带这个字段的当 ready。 */
  qualityStatus?: string;
  /** 生成来源；`definition_template…` 是释义套模板，不是真句（2026-09-06 上线验收）。 */
  provider?: string | null;
}

export function isTemplateContext(row: { provider?: string | null }): boolean {
  return String(row.provider ?? '').startsWith('definition_template');
}

const ENCOUNTER_KIND: Record<number, string> = {
  1: 'article_original',
  2: 'short_same_meaning',
  3: 'alternate_topic',
  4: 'listening',
  5: 'active_use',
};

export function contextForEncounter(
  contexts: readonly ContextCandidate[],
  encounter: number,
  maximumDifficulty: number,
  /** 正在教的词 —— 它自己超纲不算数。 */
  headword?: string,
): ContextCandidate | null {
  // 校园闸门，硬过滤（2026-10-20「What is oral sex?」事故）。
  //
  // 下面每一层挑不出就退回上一层的兜底 —— `ready.length ? ready : [...contexts]`
  // 是头一个 —— 都能把拦下的句子捞回来，而且**偏偏在最该拦住的时候捞**：
  // 这个词只有一条例句、那一条正好是脏的，干净池子就是空的，于是退回全部。
  // 所以脏的在进池子之前剔掉，剔到空就返回 null（调用方全是 `?.sentence ?? null`，
  // 学生看到的是没有例句，不会白屏）。空例句框难看，上一句才是事故。
  const safe = contexts.filter((row) => {
    // 白名单（2026-10-20）：只给**审过的**（ready）。没审的 pending_review、缺中文的
    // needs_translation、人工拦下的 blocked_school 一律不给 —— 老师自己写的也不例外，
    // blocked_school 是最后的手动开关。原来「有翻译的优先，没有就退回没翻译的」那层
    // 兜底一并去掉：退回去的那一池正是没人审过的内容。
    if (!isApprovedContext(row)) return false;
    // 文字闸门只管**语料派生**的句子。`article_original` 是老师自己写的阅读
    // 文章原句，已经过每周内容评审；再用关键词扫一遍只会误杀课程材料 ——
    // 鸦片战争那篇的「sell opium grown in India into China」、地震学家那篇的
    // 「convicted of manslaughter」都是正当教学内容，而 Tatoeba 另外生成的
    // 同名副本（"Jonas destroyed the opium."）才是要拦的那种。
    if (row.kind === 'article_original') return true;
    return !isSchoolUnsafeContext(row);
  });
  if (!safe.length) return null;
  const readyPool = safe;
  // 真句（Tatoeba 等）优先；只有模板句时才用模板句
  const real = readyPool.filter((row) => !isTemplateContext(row));
  const realPool = real.length ? real : readyPool;
  // CEFR 闸门：把对这个档位超纲的句子往后放（2026-09-09 接入 CEFR-J 词表）。
  // 只是排序偏好，不是硬过滤 —— 全都超纲时照样得给一句，空例句框更糟。
  const fits = realPool.filter((row) => sentenceFitsLevel(row.sentence, maximumDifficulty, headword));
  const pool = fits.length ? fits : realPool;
  if (!pool.length) return null;
  // 难度上限内优先；一条都没有（基础档策略只放难度 1，生成的例句是 2 / 3）就退到
  // 最容易的那条 —— 空框比略难的句子更糟（2026-09-06 上线验收：10 个词 8 个空框）。
  const within = pool.filter((row) => row.difficulty <= maximumDifficulty);
  const available = within.length
    ? within
    : [...pool].sort((a, b) => a.difficulty - b.difficulty || a.position - b.position).slice(0, 1);
  const wanted = ENCOUNTER_KIND[Math.max(1, Math.min(5, Math.floor(encounter)))];
  return available
    .filter((row) => row.kind === wanted)
    .sort((a, b) => a.position - b.position)[0]
    ?? available.sort((a, b) => a.difficulty - b.difficulty || a.position - b.position)[(Math.max(1, encounter) - 1) % available.length]
    ?? null;
}
