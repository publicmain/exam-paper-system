import * as fs from 'fs';
import * as path from 'path';
import { validatePaperStructure } from '../src/morning-quiz/paper-structure-validator';

/**
 * O-Level 标准层 fixture 审计（机器可查的部分）。
 *
 * 与基础层审计（audit-basic-fixtures）同一套骨架，但规格不同：
 * 标准层是 14 题 / 19 分，10 道短答（1/2 分混合）+ 4 空情绪流程 MCQ。
 *
 *   1 schema  —— 结构合法、题号连续、分值合规
 *   2 规格    —— 篇幅 / 题数 / 分数 / 题型配比
 *   3 答案    —— 2 分题必须给出两个得分点；1 分题不得空
 *   4 MCQ     —— 恰好一个 correct、key 与 answer 一致、四空答案互不重复
 *   5 去重    —— setCode / 标题不与既有题库重复
 *
 * 用法：npx ts-node apps/api/scripts/audit-standard-fixtures.ts [文件名前缀…]
 * 不给前缀则审计所有 ai-authored-4*.json（本批新增）。
 */

const DIR = path.join(__dirname, '..', 'test-fixtures', 'singapore-olevel-1128');
const TAG = 'ai_authored_olevel_1128';

const SPEC = {
  minWords: 380,
  maxWords: 720,
  totalQuestions: 14,
  totalMarks: 19,
  shortAnswer: 10,
  mcq: 4,
};

type Issue = { file: string; sev: 'FAIL' | 'WARN'; check: string; detail: string };
const issues: Issue[] = [];
const fail = (f: string, c: string, d: string) => issues.push({ file: f, sev: 'FAIL', check: c, detail: d });
const warn = (f: string, c: string, d: string) => issues.push({ file: f, sev: 'WARN', check: c, detail: d });

const prefixes = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json') && !f.includes('wordlist'))
  // 默认审计本批新增的 43–50；给了前缀就只审前缀命中的
  .filter((f) => (prefixes.length ? prefixes.some((p) => f.startsWith(p)) : /^ai-authored-(4[3-9]|50)-/.test(f)))
  .sort();

// 既有题库的标题/setCode（用于跨篇去重）
const existingTitles = new Set<string>();
const existingSetCodes = new Set<string>();
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json') && !x.includes('wordlist'))) {
  if (files.includes(f)) continue;
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf-8'));
    existingSetCodes.add(d.setCode);
    for (const s of d.sections ?? []) if (s.passageTitle) existingTitles.add(s.passageTitle);
  } catch { /* 跳过坏文件 */ }
}

console.log(`\n=== O-Level 标准层审计（${files.length} 篇）===\n`);

for (const f of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf-8'));

  if (raw.provenanceTag !== TAG) fail(f, 'schema', `provenanceTag=${raw.provenanceTag}，应为 ${TAG}`);
  if (!/^ai_authored_olevel_\d+_[a-z0-9_]+_v\d+$/.test(raw.setCode ?? '')) {
    fail(f, 'schema', `setCode 命名不合规: ${raw.setCode}`);
  }
  if (existingSetCodes.has(raw.setCode)) fail(f, '去重', `setCode 与既有题库重复: ${raw.setCode}`);

  const allQs: any[] = [];
  const shapes: any[] = [];
  let mcqCount = 0;
  let passage = '';
  let title = '';

  for (const sec of raw.sections) {
    if (sec.passageTitle) title = sec.passageTitle;
    if ((sec.passage ?? '').length > passage.length) passage = sec.passage;
    for (const q of sec.questions) {
      const isMcq = sec.exercise === 2;
      if (isMcq) mcqCount++;
      allQs.push({ ...q, exercise: sec.exercise });
      shapes.push({
        sortOrder: q.n,
        snapshotOptions: isMcq ? q.options : null,
        snapshotContent: {
          taskType: isMcq ? 'multi_match' : 'short_answer',
          stem: `${sec.instruction}\n\n${q.stem}`,
        },
        snapshotAnswer: q.answer,
        question: { questionType: isMcq ? 'mcq' : 'short_answer' },
      });
    }
  }

  for (const v of validatePaperStructure(shapes)) fail(f, 'schema', `Q${v.sortOrder} ${v.code}: ${v.detail}`);

  const nums = allQs.map((q) => q.n);
  const expect = Array.from({ length: allQs.length }, (_, i) => i + 1);
  if (JSON.stringify(nums) !== JSON.stringify(expect)) fail(f, 'schema', `题号不连续: ${nums.join(',')}`);

  // ── 规格 ──
  const words = passage.replace(/Paragraph \d+/g, '').split(/\s+/).filter(Boolean).length;
  if (words < SPEC.minWords || words > SPEC.maxWords) {
    fail(f, '规格', `正文 ${words} 词，应在 ${SPEC.minWords}-${SPEC.maxWords}`);
  }
  if (allQs.length !== SPEC.totalQuestions) fail(f, '规格', `${allQs.length} 题，应为 ${SPEC.totalQuestions}`);
  const marks = allQs.reduce((n, q) => n + (q.marks ?? 1), 0);
  if (marks !== SPEC.totalMarks) fail(f, '规格', `总分 ${marks}，应为 ${SPEC.totalMarks}`);
  if (mcqCount !== SPEC.mcq) fail(f, '规格', `MCQ ${mcqCount} 道，应为 ${SPEC.mcq}`);
  if (allQs.length - mcqCount !== SPEC.shortAnswer) {
    fail(f, '规格', `短答 ${allQs.length - mcqCount} 道，应为 ${SPEC.shortAnswer}`);
  }

  // ── 答案 ──
  for (const q of allQs.filter((x) => x.exercise !== 2)) {
    const a = String(q.answer ?? '').trim();
    if (!a) { fail(f, '答案', `Q${q.n} 答案为空`); continue; }
    // 2 分题的得分点要求分两类（照 O-Level mark scheme 惯例，也与既有
    // 题库一致）：
    //   「Using your own words, explain…」→ 必须两个独立得分点（①②）
    //   「What is the effect of…」/「What does X suggest」→ 一段完整的
    //   效果解释即可，硬拆两点反而不像真实评分标准
    const needsTwoPoints = /using your own words/i.test(String(q.stem ?? ''));
    if ((q.marks ?? 1) === 2 && needsTwoPoints) {
      const points = (a.match(/①|②/g) ?? []).length;
      const hasSemi = a.includes(';') || a.includes('；');
      if (points < 2 && !hasSemi) {
        warn(f, '答案', `Q${q.n} [2分] 未见两个得分点，人工确认: ${a.slice(0, 46)}…`);
      }
    }
    if (a.length > 240) warn(f, '答案', `Q${q.n} 参考答案 ${a.length} 字符，偏长`);
  }

  // ── MCQ ──
  const mcqAnswers: string[] = [];
  for (const q of allQs.filter((x) => x.exercise === 2)) {
    const opts = q.options ?? [];
    const correct = opts.filter((o: any) => o.correct);
    if (correct.length !== 1) fail(f, 'MCQ', `Q${q.n} 有 ${correct.length} 个 correct`);
    else if (correct[0].key !== q.answer) fail(f, 'MCQ', `Q${q.n} answer=${q.answer} 但 correct 是 ${correct[0].key}`);
    if (opts.length < 4) fail(f, 'MCQ', `Q${q.n} 只有 ${opts.length} 个选项`);
    const texts = opts.map((o: any) => o.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) fail(f, 'MCQ', `Q${q.n} 选项文本重复`);
    mcqAnswers.push(q.answer);
  }
  // 情绪流程四空：答案不该重复（题干写明 each word may be used once only）
  if (new Set(mcqAnswers).size !== mcqAnswers.length) {
    fail(f, 'MCQ', `情绪流程四空答案重复: ${mcqAnswers.join(',')}`);
  }

  // ── 去重 ──
  if (existingTitles.has(title)) fail(f, '去重', `标题与既有题库重复: ${title}`);
  existingTitles.add(title);

  const own = issues.filter((i) => i.file === f);
  const mark = own.some((i) => i.sev === 'FAIL') ? '✗' : own.length ? '!' : '✓';
  console.log(
    `${mark} ${f.padEnd(42)} ${String(words).padStart(3)}词 ${allQs.length}题/${marks}分 ` +
      `(${allQs.length - mcqCount}短答+${mcqCount}选择) 「${title}」`,
  );
}

console.log('');
for (const i of issues) console.log(`  ${i.sev === 'FAIL' ? '✗' : '!'} [${i.check}] ${i.file}: ${i.detail}`);
const fails = issues.filter((i) => i.sev === 'FAIL').length;
console.log(`\n结果：${fails} FAIL · ${issues.length - fails} WARN\n`);
process.exit(fails > 0 ? 1 : 0);
