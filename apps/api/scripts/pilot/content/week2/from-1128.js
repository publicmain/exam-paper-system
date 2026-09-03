/**
 * O-Level 1184 §B 记叙文题库的适配器（`ai-authored-*` / `simplified-*`）。
 *
 * 库文件的形状固定是两个 exercise：
 *
 *   · exercise 1 —— 7 到 10 道主观题，带参考答案与判分要点；
 *   · exercise 2 —— 4 道「情绪变化」配对题，每道自带**自己的**选项数组。
 *
 * ⚠️ 每道配对题的选项顺序都是独立打乱过的。拿第一题的选项去解读第四题
 * 的答案键会得出完全错误的结论（同一个字母在两题里是不同的词）。所以
 * 下面一律读 `q.options`，绝不共用。
 *
 * ## 一天十题怎么凑
 *
 *   4 道 matching_features  ← exercise 2 原样搬（选项与答案都现成）
 *   1 道 multiple_choice    ← exercise 1 里的词义/短语题 + 人工写的干扰项
 *   1 道 sentence_completion← 人工出的原文填空（库里没有这一类）
 *   4 道 short_answer       ← exercise 1 的主观题原样搬
 *
 * 六客观四主观，题型正好四种。**题型是学生可见的分组标题**（IELTS 外壳
 * 按 taskType + instruction 分组渲染），所以这里只按题目的真实性质标注，
 * 不为了凑数把普通问答标成 summary_completion。
 *
 * ## 参考答案与评分标准的分工
 *
 * 库里的 `answer` 其实是**给老师看的判分要点**（含 MP1/MP2、不给分的
 * 情形）。直接当参考答案会又长又泄题，所以：
 *
 *   · `rubric`  = 库里的原文，老师批卷时看；
 *   · `answer`  = 本文件里写的一句话参考答案。
 *
 * 两者都不会在交卷前给学生看。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { cleanPassage, paragraphs, mcqOptions, tidyStem } = require('./adapters');

const FIXTURES = path.resolve(__dirname, '..', '..', '..', '..', 'test-fixtures');

/**
 * 配对题这一组的指令 —— **自己写，不抄库文件的**。
 *
 * 库里那段 instruction 有两个问题，任何一个都不能发给学生：
 *
 * 1. **泄露内部实现**。原文最后一句是「The original task carries 4 marks;
 *    each blank is split into its own MCQ so each sub-part can be auto-graded
 *    independently.」—— 这是出卷侧的说明，学生读到「每个空被拆成独立的
 *    MCQ 以便自动判分」只会困惑。
 * 2. **让查重门误伤**。那段有一百多词，四道题各带一份，题干之间的
 *    4-词 shingle 相似度到 0.84，越过发布查重门的 0.8 阈值 —— 四道完全
 *    不同的题会被判成互相抄袭而拒绝发布。
 *
 * 换成一句短指令，两个问题一起消失。选项库本来就由 IELTS 外壳单独渲染
 * 一次，指令里不必再列一遍。
 */
const MATCHING_INSTRUCTION =
  'The narrator’s dominant feeling changes as the story goes on. For each moment below, choose the word from the list that best describes it.';

/** 字符串 → 32 位种子。同一篇文章永远得到同一个排列，可重放。 */
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

/** 答案键序列是不是等差的（ABCD、ACEG…）—— 那等于告诉学生不用读原文。 */
function isGuessableRun(keys) {
  if (keys.length < 3) return false;
  const step = keys[1].charCodeAt(0) - keys[0].charCodeAt(0);
  return keys.every((k, i) => i === 0 || k.charCodeAt(0) - keys[i - 1].charCodeAt(0) === step);
}

/**
 * 把一组配对题**统一到一个选项库**，并打乱这个库。
 *
 * 两个都必须做，否则学生会被冤枉：
 *
 * 1. **统一**：IELTS 外壳的共享选项区取自该组**第一题**的 options
 *    （`groupQuestions` 里 `sharedBank = pq.snapshotOptions`）。而
 *    `simplified-*` 那批库文件每道题的选项顺序各不相同 —— 学生照第一题的
 *    字母表作答，后三题却按它们各自的映射判分。想选「embarrassed」填了 H，
 *    存储答案却是 C，答对判错。所以整组必须共用一份 key→text。
 *
 * 2. **打乱**：`ai-authored-45/46/47` 的四道题答案依次就是 A、B、C、D，
 *    `the-tutor` 是 A、C、E、G。看出规律的人不读原文也能拿满这 4 分。
 *    按文章名做确定性置换，排出等差序列就换种子重排。
 *
 * 确定性是硬要求：同一篇文章每次生成都得到同一份卷子，否则重放和历史
 * 冻结都无从谈起。
 */
function canonicalMatching(questions, sourceKey) {
  const texts = questions[0].options.map((o) => o.text);
  for (const q of questions) {
    const own = q.options.map((o) => o.text);
    if (own.length !== texts.length || own.some((t) => !texts.includes(t))) {
      throw new Error(`${sourceKey}：配对题 ${q.n} 的选项集合与第一题不一致，无法共用选项库`);
    }
    if (!q.options.some((o) => o.key === q.answer)) {
      throw new Error(`${sourceKey}：配对题 ${q.n} 的答案键 ${q.answer} 不在自己的选项里`);
    }
  }
  const answerTexts = questions.map((q) => q.options.find((o) => o.key === q.answer).text);

  let bank = null;
  let keys = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const order = shuffled(texts, seedOf(`${sourceKey}#${attempt}`));
    const candidate = order.map((text, i) => ({ key: String.fromCharCode(65 + i), text }));
    const candidateKeys = answerTexts.map((t) => candidate.find((o) => o.text === t).key);
    if (!isGuessableRun(candidateKeys)) {
      bank = candidate;
      keys = candidateKeys;
      break;
    }
  }
  if (!bank) throw new Error(`${sourceKey}：八次重排都排出等差答案序列，请手动调整选项`);
  return { bank, keys, answerTexts };
}

/** 取第 n 段（1 起）。段号来自题干里的 `Paragraph N`，由 spec 显式给出。 */
function paragraphAt(passage, n) {
  const ps = paragraphs(passage);
  const hit = ps[n - 1];
  if (!hit) throw new Error(`没有第 ${n} 段（共 ${ps.length} 段）`);
  return hit;
}

/** 库文件，或形状相同的内联原创。 */
function loadSource(spec) {
  if (spec.inline) return spec.inline;
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, spec.dir, spec.source), 'utf8'));
}

/**
 * @param spec 见 `olevel_intermediate.js` / `olevel.js` 里的注释
 * @param date 这一天的新加坡日历日
 */
function buildDay(spec, date) {
  const raw = loadSource(spec);
  const ex1 = raw.sections[0];
  const ex2 = raw.sections[1];
  const passage = cleanPassage(ex1.passage);

  // ── 4 道情绪配对：统一选项库 + 确定性打乱 ─────────────────
  const sourceKey = spec.source ?? spec.key;
  const { bank, keys, answerTexts } = canonicalMatching(ex2.questions, sourceKey);
  const matching = ex2.questions.map((q, i) => {
    // 库里有的文件（ai-authored-05）exercise 2 干脆没写 marks 字段。照抄
    // 就会得到 marks: undefined —— 全卷总分变成 NaN，学生那一栏永远显示
    // 不出分数，而结构检查里的 `marks < 1` 对 NaN 恒为 false，静静放过。
    // 配对题在题干里写的是 [1]，这里显式兜底成 1。
    const marks = Number.isFinite(q.marks) ? q.marks : 1;
    if (marks < 1 || marks > 2) throw new Error(`配对题 ${q.n} 的分值 ${marks} 越界`);
    return {
      taskType: 'matching_features',
      questionType: 'mcq',
      marks,
      options: bank,
      answer: keys[i],
      stem: `${MATCHING_INSTRUCTION}\n${tidyStem(q.stem)}`,
      evidence: paragraphAt(passage, spec.matchingParas[i]),
      explanation: `这一段里主导的情绪与选项 ${keys[i]}（${answerTexts[i]}）最吻合。`,
    };
  });

  // ── 1 道词义/短语四选一（人工写干扰项） ───────────────────
  const src = ex1.questions[spec.multipleChoice.index];
  const choice = mcqOptions(spec.multipleChoice.answer, spec.multipleChoice.distractors);
  const multipleChoice = {
    taskType: 'multiple_choice',
    questionType: 'mcq',
    marks: 1,
    options: choice.options,
    answer: choice.answer,
    stem: `Choose the correct letter.\n${tidyStem(src.stem)}`,
    evidence: paragraphAt(passage, spec.multipleChoice.para),
    explanation: spec.multipleChoice.explanation,
  };

  // ── 1 道原文填空（库里没有这一类，人工出） ────────────────
  const gap = mcqOptions(spec.gapFill.answer, spec.gapFill.distractors);
  const gapFill = {
    taskType: 'sentence_completion',
    questionType: 'mcq',
    marks: 1,
    options: gap.options,
    answer: gap.answer,
    stem: `Complete the sentence with ONE WORD ONLY from the passage.\n${spec.gapFill.stem}`,
    evidence: spec.gapFill.evidence,
    explanation: `原文在这个位置用的词是 “${spec.gapFill.answer}”。`,
  };

  // ── 4 道主观题（exercise 1 原样，判分要点当 rubric） ───────
  const shortAnswers = spec.shortAnswers.map((sa) => {
    const q = ex1.questions[sa.index];
    return {
      taskType: 'short_answer',
      questionType: 'short_answer',
      marks: sa.marks,
      options: null,
      answer: sa.answer,
      accept: null,
      stem: tidyStem(q.stem),
      evidence: paragraphAt(passage, sa.para),
      rubric: String(q.answer).trim(),
      explanation: `答案依据第 ${sa.para} 段。`,
    };
  });

  return {
    date,
    title: ex1.passageTitle,
    passage,
    questions: [...matching, multipleChoice, gapFill, ...shortAnswers],
    words: [],
    source: spec.source ?? spec.key,
  };
}

module.exports = { buildDay, FIXTURES, paragraphAt };
