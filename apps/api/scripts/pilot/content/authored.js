/**
 * **全原创**一天的装配器（第三周起，2026-09-14）。
 *
 * 前两周的五档大多改编自题库里「从没发给学生过」的文章，每档一个适配器
 * （`week2/from-ielts.js` / `from-1128.js` …），题目一半来自库文件。库里那批
 * 已经用完，从第三周起每一篇都是新写的 —— 那就不再需要按来源分适配器：
 * 一份 spec 把文章和十道题**全部写明**，这里统一装配成内容包要的形状。
 *
 * 装配时顺手做掉的机械活（原来每个适配器各写一遍）：
 *
 *   · 选项按内容确定性打乱，答案键由打乱后的位置算出来（`mcqOptions`）；
 *   · 段落配对的证据取整段原文；情绪配对共用一个选项库并避开「ABCD」式
 *     一眼可猜的答案序列；
 *   · 填空题的字数限制按答案的实际词数写（ONE WORD / TWO WORDS）；
 *   · 解析、`accept` 列表按规则生成，不手写。
 *
 * 装配**不校验**内容质量 —— 那是 `__tests__/pilot-week-content.spec.ts` 的事。
 * 这里只在 spec 本身写错时（答案不在选项里、段落不存在）当场抛。
 */

'use strict';

const { TFNG, TFNG_KEY, mcqOptions } = require('./week2/adapters');

// ─────────────────────────────────────────────────────────────
// 指令（同一组题共用一份，查重时 `questionItem` 会把它剥掉）
// ─────────────────────────────────────────────────────────────

const TFNG_INSTRUCTION =
  'Do the following statements agree with the information in the passage? Write TRUE if the statement agrees, FALSE if it contradicts the passage, or NOT GIVEN if the passage does not say.';
const MATCHING_PARAGRAPH_INSTRUCTION = (letters) =>
  `The passage has ${letters.length} paragraphs, ${letters[0]}–${letters[letters.length - 1]}. Which paragraph contains the following information? Choose the correct letter.`;
const MATCHING_FEELING_INSTRUCTION =
  "Choose the word from the box that best describes the narrator's feelings at each of the following moments.";

/** 数字编号段落：`Paragraph 1\n…`。基础档 / O-Level 档用。 */
function numbered(paragraphs) {
  return paragraphs.map((p, i) => `Paragraph ${i + 1}\n${p}`).join('\n\n');
}

/** 字母编号段落：`Paragraph A\n…`。雅思真题档用（段落信息配对要靠字母）。 */
function lettered(paragraphs) {
  return paragraphs.map((p, i) => `Paragraph ${String.fromCharCode(65 + i)}\n${p}`).join('\n\n');
}

/** 不编号，段落之间空一行。雅思轻量档的原样。 */
function plain(paragraphs) {
  return paragraphs.join('\n\n');
}

/** 第 n 段（1 起）或字母段的正文，去掉 `Paragraph X` 前缀后仍是原文逐字子串。 */
function paragraphText(passage, ref) {
  const blocks = passage.split(/\n\s*\n/).map((b) => b.trim());
  if (typeof ref === 'number') {
    const block = blocks[ref - 1];
    if (!block) throw new Error(`没有第 ${ref} 段（共 ${blocks.length} 段）`);
    return block.replace(/^Paragraph\s+\S+\s*/, '').trim();
  }
  const hit = blocks.find((b) => new RegExp(`^Paragraph\\s+${ref}\\b`).test(b));
  if (!hit) throw new Error(`没有 Paragraph ${ref}`);
  return hit.replace(new RegExp(`^Paragraph\\s+${ref}\\s*`), '').trim();
}

function paragraphLetters(passage) {
  return passage
    .split(/\n\s*\n/)
    .map((b) => b.trim().match(/^Paragraph\s+([A-Z])\b/)?.[1])
    .filter(Boolean);
}

/** FNV-1a —— 与 adapters 同一个，保证同一道题每次装配结果一致。 */
function seedOf(text) {
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffled(items, seed) {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 答案键排成 ABCD / DCBA / AAAA 这种一眼可猜的序列。 */
function isGuessableRun(keys) {
  if (keys.length < 3) return false;
  const codes = keys.map((k) => k.charCodeAt(0));
  const diffs = codes.slice(1).map((c, i) => c - codes[i]);
  return diffs.every((d) => d === diffs[0]);
}

function limitFor(answer) {
  const n = String(answer).trim().split(/\s+/).length;
  if (n === 1) return 'ONE WORD ONLY';
  if (n === 2) return 'NO MORE THAN TWO WORDS';
  return 'NO MORE THAN THREE WORDS';
}

// ─────────────────────────────────────────────────────────────
// 每一种题
// ─────────────────────────────────────────────────────────────

function multipleChoice(q) {
  const choice = mcqOptions(q.answer, q.distractors);
  return {
    taskType: 'multiple_choice',
    questionType: 'mcq',
    marks: 1,
    options: choice.options,
    answer: choice.answer,
    stem: `Choose the correct letter.\n\n${q.stem}`,
    evidence: q.evidence,
    explanation: q.explanation ?? `原文依据：${q.evidence}`,
  };
}

function trueFalse(q) {
  const key = TFNG_KEY[q.answer];
  if (!key) throw new Error(`判断题答案只能是 TRUE / FALSE / NOT GIVEN：${q.answer}`);
  if (key !== 'C' && !q.evidence) throw new Error(`判断题缺证据句：${q.item}`);
  return {
    taskType: 'true_false_not_given',
    questionType: 'mcq',
    marks: 1,
    options: TFNG,
    answer: key,
    stem: `${TFNG_INSTRUCTION}\n\n${q.item}`,
    evidence: key === 'C' ? '' : q.evidence,
    explanation:
      q.explanation ??
      (key === 'C'
        ? '原文没有提供这项信息，既不能证实也不能否定，所以选 NOT GIVEN。'
        : `原文的对应句与题干${key === 'A' ? '一致' : '相反'}，所以选 ${q.answer}。`),
  };
}

/** 填空转四选一：干扰项由 spec 写明，最好取同一篇里词性相同的词。 */
function gapChoice(q) {
  const choice = mcqOptions(q.answer, q.distractors);
  return {
    taskType: 'sentence_completion',
    questionType: 'mcq',
    marks: 1,
    options: choice.options,
    answer: choice.answer,
    stem: `Complete the sentence. Choose the word the passage uses.\n\n${q.stem}`,
    evidence: q.evidence,
    explanation: `原文在这个位置用的词是 “${q.answer}”。`,
  };
}

/** 填空要学生自己写：拼写也在考查范围内。只认原文的词，大小写不计。 */
function gapTyped(q) {
  const answer = String(q.answer).trim();
  const marks = q.marks ?? 1;
  return {
    taskType: q.summary ? 'summary_completion' : 'sentence_completion',
    questionType: 'short_answer',
    marks,
    options: null,
    answer,
    accept: [answer, answer.toLowerCase()].filter((v, i, a) => a.indexOf(v) === i),
    stem: q.summary
      ? `Complete the sentence with information from the passage.\n\n${q.stem}`
      : `Complete the sentence. Choose ${limitFor(answer)} from the passage.\n\n${q.stem}`,
    evidence: q.evidence,
    rubric:
      q.rubric ??
      `${marks === 1 ? '一分' : '两分'}：只认原文里的 “${answer}”（大小写不计）。同义词不给分 —— 题目要求用原文的词。`,
    explanation: `原文在这个位置用的词是 “${answer}”。`,
  };
}

function shortAnswer(q) {
  if (!q.rubric) throw new Error(`主观题缺评分标准：${q.stem}`);
  return {
    taskType: 'short_answer',
    questionType: 'short_answer',
    marks: q.marks ?? 2,
    options: null,
    answer: q.answer,
    accept: null,
    stem: q.stem,
    evidence: q.evidence,
    rubric: q.rubric,
    explanation: q.explanation ?? `答案依据原文这一句：${q.evidence}`,
  };
}

/** 段落信息配对（雅思）：选项就是段落字母，字母即答案，不打乱。 */
function matchingParagraphs(passage, items) {
  const letters = paragraphLetters(passage);
  if (letters.length < 4) throw new Error('段落信息配对要求文章按 Paragraph A/B/C… 编号');
  const bank = letters.map((l) => ({ key: l, text: `Paragraph ${l}` }));
  const keys = items.map((q) => q.letter);
  if (new Set(keys).size !== keys.length) throw new Error(`段落配对的答案重复：${keys.join('')}`);
  return items.map((q) => {
    if (!letters.includes(q.letter)) throw new Error(`没有 Paragraph ${q.letter}`);
    return {
      taskType: 'matching_features',
      questionType: 'mcq',
      marks: 1,
      options: bank,
      answer: q.letter,
      stem: `${MATCHING_PARAGRAPH_INSTRUCTION(letters)}\n\n${q.item}`,
      evidence: paragraphText(passage, q.letter),
      explanation: `这条信息出现在 Paragraph ${q.letter}。`,
    };
  });
}

/**
 * 情绪配对（O-Level）：几道题共用一个词库，每道题问一个「时刻」。
 *
 * 词库按文章标题确定性打乱；排出一眼可猜的答案序列就换种子重排。
 */
function matchingFeelings(passage, title, spec) {
  const { bank: words, items } = spec;
  for (const q of items) {
    if (!words.includes(q.answer)) throw new Error(`情绪配对的答案 ${q.answer} 不在词库里`);
  }
  let bank = null;
  let keys = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const order = shuffled(words, seedOf(`${title}#${attempt}`));
    const candidate = order.map((text, i) => ({ key: String.fromCharCode(65 + i), text }));
    const candidateKeys = items.map((q) => candidate.find((o) => o.text === q.answer).key);
    if (!isGuessableRun(candidateKeys)) {
      bank = candidate;
      keys = candidateKeys;
      break;
    }
  }
  if (!bank) throw new Error(`${title}：情绪配对排不出不可猜的答案序列`);
  return items.map((q, i) => ({
    taskType: 'matching_features',
    questionType: 'mcq',
    marks: 1,
    options: bank,
    answer: keys[i],
    stem: `${MATCHING_FEELING_INSTRUCTION}\n\n${q.moment}`,
    evidence: paragraphText(passage, q.para),
    explanation: q.explanation ?? `这一刻叙述者的感受是 “${q.answer}”，依据第 ${q.para} 段。`,
  }));
}

// ─────────────────────────────────────────────────────────────
// 一天
// ─────────────────────────────────────────────────────────────

/**
 * @param spec `{ key, title, passage, questions: [...] }`
 *   `questions` 按学生看到的顺序排，每项 `{ kind, ... }`：
 *     mcq / tfng / gapChoice / gapTyped / short / matchingParagraphs / matchingFeelings
 * @param date 新加坡日历日
 */
function buildAuthoredDay(spec, date) {
  const out = [];
  for (const q of spec.questions) {
    switch (q.kind) {
      case 'mcq':
        out.push(multipleChoice(q));
        break;
      case 'tfng':
        out.push(trueFalse(q));
        break;
      case 'gapChoice':
        out.push(gapChoice(q));
        break;
      case 'gapTyped':
        out.push(gapTyped(q));
        break;
      case 'short':
        out.push(shortAnswer(q));
        break;
      case 'matchingParagraphs':
        out.push(...matchingParagraphs(spec.passage, q.items));
        break;
      case 'matchingFeelings':
        out.push(...matchingFeelings(spec.passage, spec.title, q));
        break;
      default:
        throw new Error(`${spec.key}：不认识的题型 ${q.kind}`);
    }
  }
  return {
    date,
    title: spec.title,
    passage: spec.passage,
    questions: out,
    words: [],
    source: spec.key,
  };
}

module.exports = {
  buildAuthoredDay,
  numbered,
  lettered,
  plain,
  paragraphText,
  paragraphLetters,
  isGuessableRun,
  TFNG_INSTRUCTION,
};
