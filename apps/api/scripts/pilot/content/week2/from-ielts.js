/**
 * 雅思学术阅读题库的适配器（`ielts-authored-aug2026` / `ielts-adapted-2026-v5`
 * 以及形状相同的原创）。
 *
 * 库文件一篇八段，段落以 `Paragraph A` … `Paragraph H` 编号，题目 13 道，
 * 分三类：段落信息配对、判断题、句子填空。
 *
 * ## 一天十题怎么取
 *
 *   3 道 matching_features   ← 段落信息配对（选项就是 A–H 八个段落）
 *   3 道 true_false_not_given← 判断题
 *   2 道 sentence_completion ← 句子填空，保留主观题形态（拼写也要考）
 *   2 道 short_answer        ← 人工出的两分理解题
 *
 * 六客观四主观，题型四种。段落配对**不打乱选项**：这里的字母就是答案
 * 本身（选 G 的意思是「在第 G 段」），换掉字母就换掉了题。
 *
 * ## 两处必须处理的库内不一致
 *
 * 1. 判断题的答案，`aug2026` 写成 `TRUE`/`FALSE`/`NOT GIVEN`，
 *    `adapted-v5` 写成 `A`/`B`/`C`。两种都收。
 * 2. 有的填空题标着 “ONE WORD ONLY”，答案却是两个词（`sulphur dioxide`）。
 *    这里按题目实际答案自动改写指令，不让学生照着错的字数限制去答。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { TFNG, TFNG_KEY, cleanPassage, bestEvidence } = require('./adapters');

const FIXTURES = path.resolve(__dirname, '..', '..', '..', '..', 'test-fixtures');

const MATCHING_INSTRUCTION =
  'The passage has eight paragraphs, A–H. Which paragraph contains the following information? Choose the correct letter.';
const TFNG_INSTRUCTION =
  'Do the following statements agree with the information given in the passage? Write TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, or NOT GIVEN if there is no information on this.';

/** 段落信息配对的选项库：八个段落字母。字母即答案，不打乱。 */
const PARAGRAPH_BANK = 'ABCDEFGH'.split('').map((letter) => ({ key: letter, text: `Paragraph ${letter}` }));

/** 按字母取段落正文（去掉 `Paragraph X` 前缀后的部分仍是原文逐字子串）。 */
function paragraphByLetter(passage, letter) {
  const blocks = passage.split(/\n\s*\n/);
  const hit = blocks.find((b) => new RegExp(`^Paragraph\\s+${letter}\\b`).test(b.trim()));
  if (!hit) throw new Error(`找不到 Paragraph ${letter}`);
  return hit.trim().replace(new RegExp(`^Paragraph\\s+${letter}\\s*`), '').trim();
}

/** `TRUE` / `FALSE` / `NOT GIVEN`，或已经是 `A` / `B` / `C`。 */
function tfngKey(answer) {
  const raw = String(answer).trim().toUpperCase();
  if (['A', 'B', 'C'].includes(raw)) return raw;
  const key = TFNG_KEY[raw];
  if (!key) throw new Error(`判断题答案无法识别：${answer}`);
  return key;
}

function tfngWord(key) {
  return { A: 'TRUE', B: 'FALSE', C: 'NOT GIVEN' }[key];
}

function loadSource(spec) {
  if (spec.inline) return spec.inline;
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, spec.dir, spec.source), 'utf8'));
}

function buildDay(spec, date) {
  const raw = loadSource(spec);
  const passage = cleanPassage(raw.passage);
  const byNumber = new Map(raw.questions.map((q) => [q.n, q]));
  const pick = (n) => {
    const q = byNumber.get(n);
    if (!q) throw new Error(`${spec.source ?? spec.key}：没有第 ${n} 题`);
    return q;
  };

  // ── 3 道段落信息配对 ───────────────────────────────────────
  const matching = spec.matching.map((n) => {
    const q = pick(n);
    const letter = String(q.answer).trim().toUpperCase();
    return {
      taskType: 'matching_features',
      questionType: 'mcq',
      marks: 1,
      options: PARAGRAPH_BANK,
      answer: letter,
      stem: `${MATCHING_INSTRUCTION}\n\n${q.item}`,
      evidence: paragraphByLetter(passage, letter),
      explanation: `这条信息出现在 Paragraph ${letter}。`,
    };
  });

  // ── 3 道判断题 ────────────────────────────────────────────
  const tfng = spec.tfng.map(({ n, evidence }) => {
    const q = pick(n);
    const key = tfngKey(q.answer);
    if (key !== 'C' && !evidence) throw new Error(`${spec.source ?? spec.key}：第 ${n} 题缺证据句`);
    return {
      taskType: 'true_false_not_given',
      questionType: 'mcq',
      marks: 1,
      options: TFNG,
      answer: key,
      stem: `${TFNG_INSTRUCTION}\n\n${q.item}`,
      evidence: key === 'C' ? '' : evidence,
      explanation:
        key === 'C'
          ? '原文没有提供这项信息，既不能证实也不能否定，所以选 NOT GIVEN。'
          : `原文的对应句与题干${key === 'A' ? '一致' : '相反'}，所以选 ${tfngWord(key)}。`,
    };
  });

  // ── 2 道句子填空（保留主观题形态，拼写也在考查范围内） ──────
  const completion = spec.completion.map((n) => {
    const q = pick(n);
    const answer = String(q.answer).trim();
    // 指令按答案的实际词数写。库里有的题标着 ONE WORD ONLY，答案却是
    // 两个词 —— 照抄会让照着字数限制作答的学生被判错。
    const words = answer.split(/\s+/).length;
    const limit = words > 1 ? 'NO MORE THAN TWO WORDS' : 'ONE WORD ONLY';
    return {
      taskType: 'sentence_completion',
      questionType: 'short_answer',
      marks: 1,
      options: null,
      answer,
      accept: [answer, answer.toLowerCase()].filter((v, i, a) => a.indexOf(v) === i),
      stem: `Complete the sentence. Choose ${limit} from the passage.\n\n${String(q.item).replace(/\[BLANK\]|\/\d+\//g, '______')}`,
      evidence: bestEvidence(passage, answer, q.item),
      rubric: `一分：只认原文里的 “${answer}”（大小写不计）。同义词不给分 —— 题目要求用原文的词。`,
      explanation: `原文在这个位置用的词是 “${answer}”。`,
    };
  });

  // ── 2 道人工出的理解题 ─────────────────────────────────────
  const authored = spec.shortAnswers.map((q) => ({
    taskType: 'short_answer',
    questionType: 'short_answer',
    marks: q.marks ?? 2,
    options: null,
    answer: q.answer,
    accept: null,
    stem: q.stem,
    evidence: q.evidence,
    rubric: q.rubric,
    explanation: `答案依据原文这一句：${q.evidence}`,
  }));

  return {
    date,
    title: raw.passageTitle,
    passage,
    questions: [...matching, ...tfng, ...completion, ...authored],
    words: [],
    source: spec.source ?? spec.key,
  };
}

module.exports = { buildDay, paragraphByLetter, PARAGRAPH_BANK };
