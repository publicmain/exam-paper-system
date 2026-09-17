/**
 * 发布路径上的内容门禁（PUB03 / CONTENT01，2026-09-11）。
 *
 * ## 为什么要有这一份
 *
 * 内容规格原来只写在 `__tests__/pilot-week-content.spec.ts` 里。那是「写完跑
 * 一下测试」的约定，不是发布的前提 —— 没跑测试也照样能发。09-09 甘地那道题
 * （满分 1，评分标准写「两分：…各 1 分」）就是这样上了线。
 *
 * 所以把「学生一定会撞上的」那几类问题再写一遍，放在**发布脚本自己的路径上**：
 * 发布某一天之前，对那一天五档逐题检查，有问题就拒绝，一行都不写。
 *
 * 测试里的实现保持原样、不删不改 —— 两份各自独立写成，互为对照；
 * `publish-gates.spec.ts` 钉住两者对全部内容包的结论一致。
 *
 * ## 分两层
 *
 *   · 所有日期：结构、答案键、证据句、分值与评分标准**不矛盾**；
 *   · `GATES_FROM`（第三周）起：再加内容测试第 6 节的五道门 —— 评分标准
 *     必须以「N 分：」开头且等于满分、段号依据、判断题答案分布、配对题
 *     答案序列、选择题正确项长度、篇幅与超纲词。
 *
 * 旧日期不追溯第 6 节：那些天已经发出去、学生做过了，按新门槛挑刺改不了
 * 任何东西（发布脚本本来也不许改已被使用的卷子，见 PUB01）。
 *
 * 纯函数，不连库。
 */

'use strict';

const { questionItem } = require('./content-similarity');
const { GATES_FROM, LEVEL_GATES } = require('./content/level-gates');

const QUESTIONS_PER_DAY = 10;
const MIN_AUTO_PER_DAY = 6;
const MAX_HUMAN_PER_DAY = 4;
const MIN_WORDS_PER_DAY = 12;
const MAX_WORDS_PER_DAY = 21;
const SUPPORTED_TASKS = new Set([
  'true_false_not_given',
  'matching_features',
  'multiple_choice',
  'sentence_completion',
  'summary_completion',
  'short_answer',
]);

const NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, one: 1, two: 2, three: 3, four: 4, five: 5 };
const toNum = (s) => NUM[String(s).toLowerCase()] ?? Number(s);
const N = '(一|二|两|三|四|五|\\d+)';

/** 评分标准开头声明的分数：「两分：…」「1 分：…」。认不出返回 null。 */
function leadingDeclaredMarks(rubric) {
  const m = String(rubric ?? '').trim().match(new RegExp(`^${N}\\s*分`));
  return m ? toNum(m[1]) : null;
}

/**
 * 评分标准里**说出来的**分数，按三种说法分开收：
 *
 *   leading  —— 开头的「两分：」
 *   total    —— 「本题共 2 分」「满分 2 分」
 *   awards   —— 「给 2 分」「得 1 分」「再给 1 分」，一次给出的分
 *   english  —— 英文的「2 marks」「one mark」
 *
 * 「每点 1 分」「各 1 分」不收：要点有几个是写的人说了算，数不出来。
 */
function rubricMarkClaims(rubric) {
  const text = String(rubric ?? '');
  const total = text.match(new RegExp(`(?:本题共|满分|共)\\s*${N}\\s*分`));
  const awards = [...text.matchAll(new RegExp(`(?:给|得|计)\\s*${N}\\s*分`, 'g'))].map((m) => toNum(m[1]));
  const english = [...text.matchAll(/\b(one|two|three|four|five|\d+)\s+marks?\b/gi)].map((m) => toNum(m[1]));
  return {
    leading: leadingDeclaredMarks(text),
    total: total ? toNum(total[1]) : null,
    awards,
    english,
  };
}

/**
 * 分值与评分标准有没有**自相矛盾**。没有矛盾返回 null，否则返回一句原因。
 *
 * 只抓写出来就能判定的矛盾 —— 开头声明 / 「共 N 分」不等于满分，或者某一次
 * 「给 N 分」比满分还大。09-09 甘地那道题：开头「两分」，满分 1。
 */
function rubricMarksConflict(rubric, marks) {
  const c = rubricMarkClaims(rubric);
  if (c.leading != null && c.leading !== marks) return `评分标准开头写 ${c.leading} 分，这道题满分却是 ${marks} 分`;
  if (c.total != null && c.total !== marks) return `评分标准写「共 ${c.total} 分」，这道题满分却是 ${marks} 分`;
  const award = Math.max(0, ...c.awards);
  if (award > marks) return `评分标准里有「给 ${award} 分」，超过了这道题的满分 ${marks} 分`;
  const en = Math.max(0, ...c.english);
  if (en > marks) return `评分标准写 ${en} marks，超过了这道题的满分 ${marks} 分`;
  return null;
}

/** 按段号或段字母取段落正文（去掉 `Paragraph X` 前缀）。与内容测试第 6 节同一口径。 */
function paragraphMap(passage) {
  const out = new Map();
  String(passage).split(/\n\s*\n/).forEach((block, i) => {
    const b = block.trim();
    const label = (b.match(/^Paragraph\s+(\S+)/) || [])[1];
    const body = b.replace(/^Paragraph\s+\S+\s*/, '').trim();
    out.set(String(i + 1), body);
    if (label) out.set(label, body);
  });
  return out;
}

/** 题目本身（不含整组共用的指令）里提到的段。 */
function referencedParagraphs(stem) {
  const item = questionItem(stem);
  const refs = [];
  for (const m of item.matchAll(/Paragraphs?\s+(\d+|[A-H])\b(?:\s*[-–]\s*(\d+|[A-H])\b)?/g)) {
    const from = m[1];
    const to = m[2];
    if (to && /^\d+$/.test(from) && /^\d+$/.test(to)) {
      for (let n = Number(from); n <= Number(to); n += 1) refs.push(String(n));
    } else if (to) {
      for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); c += 1) refs.push(String.fromCharCode(c));
    } else {
      refs.push(from);
    }
  }
  return refs;
}

/**
 * 一档一天的全部问题。空数组 = 可以发布。
 *
 * `levelTools`（可选）：`{ difficultyProfile, contextDifficultyFor }`，篇幅与
 * 超纲词门要用。它们在 `src/vocab-v2/*.ts` 里，发布脚本是纯 JS，由调用方
 * 负责加载；**第三周起的日子没给就算问题**（fail closed），不静默跳过。
 */
function lessonProblems(level, day, { gatesFrom = GATES_FROM, levelTools = null } = {}) {
  const problems = [];
  const at = (i) => `${level}/${day?.date}/q${i + 1}`;
  if (!day || typeof day !== 'object') return [`${level}：没有这一天的内容`];
  const passage = String(day.passage ?? '');
  const questions = Array.isArray(day.questions) ? day.questions : [];

  // ── 形状 ──
  if (String(day.title ?? '').trim().length <= 5) problems.push(`${level}/${day.date}：标题太短`);
  if (passage.length <= 900) problems.push(`${level}/${day.date}：原文太短（${passage.length} 字符）`);
  if (questions.length !== QUESTIONS_PER_DAY) problems.push(`${level}/${day.date}：应有 ${QUESTIONS_PER_DAY} 题，实有 ${questions.length} 题`);
  const auto = questions.filter((q) => q.questionType === 'mcq').length;
  const human = questions.filter((q) => q.questionType === 'short_answer').length;
  if (auto < MIN_AUTO_PER_DAY || human > MAX_HUMAN_PER_DAY || auto + human !== questions.length) {
    problems.push(`${level}/${day.date}：自动判 ${auto} 题 / 人工判 ${human} 题，不合「≥${MIN_AUTO_PER_DAY} / ≤${MAX_HUMAN_PER_DAY}」`);
  }
  const words = Array.isArray(day.words) ? day.words : [];
  if (words.length < MIN_WORDS_PER_DAY || words.length > MAX_WORDS_PER_DAY) {
    problems.push(`${level}/${day.date}：候选词 ${words.length} 个，应在 ${MIN_WORDS_PER_DAY}–${MAX_WORDS_PER_DAY}`);
  }
  for (const w of words) {
    if (!passage.includes(String(w.context ?? '\u0000'))) problems.push(`${level}/${day.date}：词 ${w.headword} 的语境句不在原文里`);
  }

  // ── 分值 ──
  let total = 0;
  questions.forEach((q, i) => {
    if (!Number.isInteger(q.marks) || q.marks < 1 || q.marks > 2) problems.push(`${at(i)}：分值 ${q.marks} 不是 1–2 的整数`);
    else total += q.marks;
  });
  if (questions.length && (total < 10 || total > 16)) problems.push(`${level}/${day.date}：全卷 ${total} 分，应在 10–16`);

  // ── 逐题 ──
  let withEvidence = 0;
  questions.forEach((q, i) => {
    if (!['mcq', 'short_answer'].includes(q.questionType)) problems.push(`${at(i)}：题型 ${q.questionType} 引擎不认识`);
    if (!SUPPORTED_TASKS.has(q.taskType)) problems.push(`${at(i)}：任务类型 ${q.taskType} 渲染器不支持`);
    if (String(q.stem ?? '').trim().length <= 15) problems.push(`${at(i)}：题干太短`);
    if (String(q.explanation ?? '').trim().length <= 8) problems.push(`${at(i)}：没有解析`);
    if (q.evidence) {
      withEvidence += 1;
      if (!passage.includes(q.evidence)) problems.push(`${at(i)}：证据句不是原文逐字子串`);
    } else if (!(q.taskType === 'true_false_not_given' && q.answer === 'C')) {
      problems.push(`${at(i)}：没有证据句，却不是 NOT GIVEN`);
    }
    if (q.accept && !q.accept.map((a) => String(a).toLowerCase()).includes(String(q.answer).toLowerCase())) {
      problems.push(`${at(i)}：可接受写法里没有标准答案`);
    }

    if (q.questionType === 'mcq') {
      const options = Array.isArray(q.options) ? q.options : [];
      const keys = options.map((o) => o.key);
      const texts = options.map((o) => String(o.text ?? '').trim().toLowerCase());
      if (options.length < 3) problems.push(`${at(i)}：选项少于 3 个`);
      if (new Set(keys).size !== keys.length) problems.push(`${at(i)}：选项键重复`);
      if (new Set(texts).size !== texts.length) problems.push(`${at(i)}：选项文字重复（可能出现两个「正确」）`);
      if (texts.some((t) => !t)) problems.push(`${at(i)}：有空选项`);
      // 发布时 correct = (key === answer)：键唯一 + 答案在键里 ⇒ 恰好一个正确项
      if (keys.filter((k) => k === q.answer).length !== 1) problems.push(`${at(i)}：答案键 ${q.answer} 不是恰好一个选项`);
    } else if (q.questionType === 'short_answer') {
      if (q.options != null) problems.push(`${at(i)}：主观题不该有选项`);
      if (!String(q.answer ?? '').trim()) problems.push(`${at(i)}：主观题没有参考答案`);
      if (String(q.rubric ?? '').trim().length <= 10) problems.push(`${at(i)}：主观题没有评分标准`);
      const conflict = rubricMarksConflict(q.rubric, q.marks);
      if (conflict) problems.push(`${at(i)}：${conflict}`);
    }
  });
  if (questions.length && withEvidence < 8) problems.push(`${level}/${day.date}：只有 ${withEvidence} 道题有证据句（至少 8 道）`);

  // ── 第三周起（内容测试第 6 节）──
  if (day.date >= gatesFrom) {
    questions.forEach((q, i) => {
      if (q.questionType !== 'short_answer') return;
      const declared = leadingDeclaredMarks(q.rubric);
      if (declared == null) problems.push(`${at(i)}：评分标准没有以「N 分：」开头`);
    });
    const paras = paragraphMap(passage);
    questions.forEach((q, i) => {
      if (!q.evidence) return;
      const refs = referencedParagraphs(q.stem);
      if (!refs.length) return;
      const bodies = refs.map((r) => paras.get(r));
      if (!bodies.every(Boolean)) problems.push(`${at(i)}：题目引用了不存在的段 ${refs.join(',')}`);
      else if (!bodies.some((b) => b.includes(q.evidence))) problems.push(`${at(i)}：题目指向 Paragraph ${refs.join('/')}，依据句不在那里`);
    });
    const tf = questions.filter((q) => q.taskType === 'true_false_not_given').map((q) => q.answer);
    // 2026-09-17 外部审查 F5：不再要求一天三种各一（学生会用排除法），只拦全部相同；
    // 整周的分布由内容测试「全周判断题分布」管。
    if (tf.length >= 2 && new Set(tf).size === 1) problems.push(`${level}/${day.date}：判断题答案全部相同`);
    const matching = questions.filter((q) => q.taskType === 'matching_features').map((q) => String(q.answer));
    if (matching.length >= 3) {
      const codes = matching.map((k) => k.charCodeAt(0));
      const diffs = codes.slice(1).map((c, i) => c - codes[i]);
      if (diffs.every((d) => d === diffs[0])) problems.push(`${level}/${day.date}：配对题答案序列 ${matching.join('')} 可猜`);
    }
    questions.forEach((q, i) => {
      if (q.taskType !== 'multiple_choice' || !Array.isArray(q.options)) return;
      const correct = q.options.find((o) => o.key === q.answer);
      const others = q.options.filter((o) => o.key !== q.answer).map((o) => String(o.text).length);
      if (correct && others.length && String(correct.text).length / Math.max(...others) > 1.5) {
        problems.push(`${at(i)}：正确项比最长的干扰项长 50% 以上`);
      }
    });
    const gate = LEVEL_GATES[level];
    if (!gate) problems.push(`${level}：level-gates.js 里没有这一档的篇幅门槛`);
    else if (!levelTools) problems.push(`${level}/${day.date}：没有加载篇幅 / 超纲词检查器，拒绝放行`);
    else {
      const text = passage.replace(/^Paragraph \S+\s*/gm, '');
      const p = levelTools.difficultyProfile(text, levelTools.contextDifficultyFor(level));
      if (p.words < gate.words[0] || p.words > gate.words[1]) {
        problems.push(`${level}/${day.date}：${p.words} 词，这一档要 ${gate.words[0]}–${gate.words[1]} 词`);
      }
      if (gate.maxHard != null && p.hardRatio > gate.maxHard) {
        problems.push(`${level}/${day.date}：超纲词占 ${(p.hardRatio * 100).toFixed(1)}%，上限 ${(gate.maxHard * 100).toFixed(1)}%`);
      }
    }
  }
  return problems;
}

/**
 * 发布脚本用：把 `src/vocab-v2` 里的篇幅 / 超纲词函数加载进纯 JS 进程。
 *
 * 那两个文件是 TypeScript，发布脚本用 `node` 直接跑。借仓库自带的 ts-node
 * 只做转译（不做类型检查），只注册 `.ts` 的 require 钩子，不影响其它模块。
 * 加载失败就抛 —— 调用方据此拒绝发布，而不是「查不了就当通过」。
 */
function loadLevelTools() {
  // eslint-disable-next-line global-require
  require('ts-node').register({
    transpileOnly: true,
    skipProject: true,
    compilerOptions: { module: 'commonjs', target: 'es2020', esModuleInterop: true, resolveJsonModule: true },
  });
  const path = require('path');
  const src = path.resolve(__dirname, '..', '..', 'src', 'vocab-v2');
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const { difficultyProfile } = require(path.join(src, 'cefr-difficulty.ts'));
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const { wordPolicyFor } = require(path.join(src, 'level-policy.ts'));
  return { difficultyProfile, contextDifficultyFor: (level) => wordPolicyFor(level).contextDifficulty };
}

module.exports = {
  GATES_FROM,
  leadingDeclaredMarks,
  rubricMarkClaims,
  rubricMarksConflict,
  paragraphMap,
  referencedParagraphs,
  lessonProblems,
  loadLevelTools,
};
