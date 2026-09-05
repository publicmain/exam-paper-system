/**
 * 首发周（2026-09-07 起）内容包的**共用适配器**。
 *
 * 第一周的五档分成两套写法：三档手写、两档从 fixture 库改编。首发周五档
 * 全部改编自库里从未发布过的文章，所以把改编逻辑收在这里一处，五个档位
 * 模块只提供「这一天用哪篇 + 人工补的题」。
 *
 * 这里的每一个函数都为 `__tests__/pilot-week-content.spec.ts` 的硬断言服务：
 *
 *   · `cleanPassage`   —— 去掉库里的内部出处说明（学生不该看到）；
 *   · `bestEvidence`   —— 证据句必须是原文**逐字**子串，否则错题重练的
 *                         原文高亮标不上（S12I 的教训）；
 *   · `mcqOptions`     —— 选项去重、答案键必在选项内、正确项唯一。
 *
 * 与第一周 `fixture-levels.js` 的唯一实质差别是 `bestEvidence`：第一周取
 * 「第一句包含答案的句子」，于是 `internet` 这种在首段就出现过的词会把证据
 * 指到一句不相干的话上。这里改成按题干关键词重叠度挑，取不到再退回第一句。
 */

'use strict';

/** 首发周的五个教学日（新加坡日历日，周一到周五）。 */
const DATES = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'];

const TFNG = [
  { key: 'A', text: 'TRUE' },
  { key: 'B', text: 'FALSE' },
  { key: 'C', text: 'NOT GIVEN' },
];

const TFNG_KEY = { TRUE: 'A', FALSE: 'B', 'NOT GIVEN': 'C' };

/** 库里的文章尾部带内部出处说明，学生不得看到。 */
function cleanPassage(text) {
  return String(text)
    .replace(/\n\n\(AI-authored original[\s\S]*$/, '')
    .replace(/\n\n\(Adapted[\s\S]*$/, '')
    .trim();
}

/** 段落。`Paragraph N` 是库里的编号前缀，切句时不算正文。 */
function paragraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^Paragraph \d+\s*/, '').trim())
    .filter((p) => p && !p.startsWith('(AI-authored') && !p.startsWith('(Adapted'));
}

/**
 * 把整篇原文切成句子。
 *
 * 切完的每一句都必须仍是原文的**逐字子串** —— 所以只在句末标点后切，
 * 且只剥掉行首的 `Paragraph N` 前缀（剥前缀不影响剩下那半句的子串性质）。
 */
function sentences(passage) {
  return passage
    .replace(/^Paragraph \d+\s*/gm, '')
    .split(/(?<=[.!?"”])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);
}

const EVIDENCE_STOP = new Set(
  `a an the and or but of in on at to for from with without by as is are was were be been being do does did
   this that these those it its he she they them his her their what which who whom whose how why when where
   passage paragraph write answer question following statement above below according does not no than then
   about into over under more most less least own same such only very can could will would may might must`
    .split(/\s+/),
);

function keywords(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .match(/[a-z][a-z-]{2,}/g)
      ?.filter((w) => !EVIDENCE_STOP.has(w)) ?? [],
  );
}

/**
 * 挑一句最能支撑这道题的原文句子。
 *
 * 必须含答案（大小写不敏感）；在此前提下按与题干的关键词重叠度排序。
 * 一句都找不到时返回空串 —— 调用方要么换题，要么这本来就是 NOT GIVEN。
 */
function bestEvidence(passage, answer, stem = '') {
  const needle = String(answer).toLowerCase().trim();
  if (!needle) return '';
  const stemWords = keywords(stem);
  const hits = sentences(passage).filter((s) => s.toLowerCase().includes(needle));
  if (hits.length === 0) return '';
  let best = hits[0];
  let bestScore = -1;
  for (const s of hits) {
    let score = 0;
    for (const w of keywords(s)) if (stemWords.has(w)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

/** 题干指名了 `Paragraph N` 就用那一段作证据，否则用第一段。 */
function paragraphEvidence(stem, passage) {
  const requested = String(stem).match(/Paragraph\s+(\d+)/i)?.[1];
  const ps = paragraphs(passage);
  if (requested) return ps[Number(requested) - 1] ?? ps[0];
  return ps[0];
}

/**
 * 从「正确答案 + 若干干扰项」造一道四选一。
 *
 * 去重后固定四项；答案键由去重后的实际位置算出来，不写死 —— 写死是
 * 「一道题永远判错」最常见的来源。
 */
/** 字符串 → 32 位种子（FNV-1a）。同一道题永远得到同一个选项顺序，可重放。 */
function seedOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffled(items, seed) {
  let s = seed || 1;
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 从「正确答案 + 若干干扰项」造一道四选一。
 *
 * **选项顺序按题目内容确定性打乱。** 原来的写法（沿用自第一周的
 * `options()`）把正确项固定放在末尾 —— 结果首发周 30 道填空转四选一的
 * 答案全是 D，四选一 25 道里 16 道是 D。学生做到第二天就会发现
 * 「填空题选最后一个」。打乱的种子取自答案与干扰项本身，所以同一道题
 * 每次生成的顺序一致，重发布不会让已冻结的卷子对不上。
 */
function mcqOptions(answer, distractors) {
  const seen = new Set();
  const texts = [];
  for (const t of [String(answer), ...distractors.map(String)]) {
    const key = t.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    texts.push(t.trim());
  }
  if (texts.length < 3) throw new Error(`mcqOptions: 干扰项不够（${texts.length}）：${answer}`);
  const ordered = shuffled(texts.slice(0, 4), seedOf(texts.slice(0, 4).join('|')));
  const answerIndex = ordered.findIndex((t) => t.toLowerCase() === String(answer).trim().toLowerCase());
  if (answerIndex < 0) throw new Error(`mcqOptions: 答案被挤出选项：${answer}`);
  return {
    answer: String.fromCharCode(65 + answerIndex),
    options: ordered.map((text, i) => ({ key: String.fromCharCode(65 + i), text })),
  };
}

/** 去掉库里题干上的 `Q3.` 编号与 `[1]` 分值标记 —— 学生端自己会编号。 */
function tidyStem(stem) {
  return String(stem)
    .replace(/^Q\d+(\([iv]+\))?\.\s*/i, '')
    .replace(/\s*\[\d+(\s*marks?)?\]\s*$/i, '')
    .trim();
}

module.exports = {
  DATES,
  TFNG,
  TFNG_KEY,
  cleanPassage,
  paragraphs,
  sentences,
  bestEvidence,
  paragraphEvidence,
  mcqOptions,
  tidyStem,
};
