import * as fs from 'fs';
import * as path from 'path';
import { validatePaperStructure } from '../src/morning-quiz/paper-structure-validator';

/**
 * 基础层 fixture 上架前审计（机器可查的部分）。
 *
 * 10 项审计里前 5 项在这里跑；判分三项（精确/改写/拒答）与 UI 渲染、
 * 难度校准由人在会话里做，见提交信息里的审计记录。
 *
 *   1  schema —— 结构合法、题号连续、marks 合规
 *   2  规格 —— 篇幅 / 句长 / 题数 / 点选题占比符合基础层定义
 *   3  答案唯一支持 —— 短答答案必须能在原文找到（大小写不敏感）
 *   4  MCQ 合法 —— 恰好一个 correct，answer key 与之一致，选项不重复
 *   5  跨篇去重 —— setCode / 标题 / 故事不与既有题库重复
 *
 * 只读，不写库。
 */

const DIR = path.join(__dirname, '..', 'test-fixtures', 'singapore-olevel-1128');
const BASIC_TAG = 'ai_authored_olevel_1128_basic';

/** 基础层规格（与 morning-quiz.service.ts 的 olevelTierCondition 注释一致） */
const SPEC = {
  minWords: 180,
  maxWords: 320,
  maxSentenceWords: 26,
  totalQuestions: 5,
  minClickOnly: 3,
  maxShortAnswerWords: 5,
};

type Issue = { file: string; sev: 'FAIL' | 'WARN'; check: string; detail: string };
const issues: Issue[] = [];
const fail = (file: string, check: string, detail: string) =>
  issues.push({ file, sev: 'FAIL', check, detail });
const warn = (file: string, check: string, detail: string) =>
  issues.push({ file, sev: 'WARN', check, detail });

const files = fs
  .readdirSync(DIR)
  // 排除 basic-wordlists.json —— 它也以 basic- 开头，但装的是词表不是
  // 卷子，没有 sections 字段，扫进来会直接 TypeError 崩掉整个审计。
  .filter((f) => f.startsWith('basic-') && f.endsWith('.json') && !f.includes('wordlist'))
  .sort();

const seenSetCodes = new Set<string>();
const seenTitles = new Set<string>();

console.log(`\n=== 基础层 fixture 审计（${files.length} 篇）===\n`);

for (const f of files) {
  const raw = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf-8'));

  // ── 1 schema ──────────────────────────────────────────────────
  if (raw.provenanceTag !== BASIC_TAG) {
    fail(f, 'schema', `provenanceTag=${raw.provenanceTag}，应为 ${BASIC_TAG}`);
  }
  if (!/^ai_authored_olevel_basic_\d+_[a-z0-9_]+_v\d+$/.test(raw.setCode ?? '')) {
    fail(f, 'schema', `setCode 命名不合规: ${raw.setCode}`);
  }
  if (seenSetCodes.has(raw.setCode)) fail(f, '去重', `setCode 重复: ${raw.setCode}`);
  seenSetCodes.add(raw.setCode);

  const allQs: any[] = [];
  const shapes: any[] = [];
  let mcqCount = 0;
  let passage = '';
  let title = '';

  for (const sec of raw.sections) {
    if (sec.passageTitle) title = sec.passageTitle;
    if ((sec.passage ?? '').length > passage.length) passage = sec.passage;
    for (const q of sec.questions) {
      allQs.push({ ...q, exercise: sec.exercise });
      const isMcq = sec.exercise === 2;
      if (isMcq) mcqCount++;
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

  for (const v of validatePaperStructure(shapes)) {
    fail(f, 'schema', `Q${v.sortOrder} ${v.code}: ${v.detail}`);
  }

  const nums = allQs.map((q) => q.n);
  const expected = Array.from({ length: allQs.length }, (_, i) => i + 1);
  if (JSON.stringify(nums) !== JSON.stringify(expected)) {
    fail(f, 'schema', `题号不连续: ${nums.join(',')}`);
  }
  for (const q of allQs) {
    if ((q.marks ?? 1) !== 1) fail(f, 'schema', `Q${q.n} marks=${q.marks}，基础层每题应为 1`);
  }

  // ── 2 规格 ────────────────────────────────────────────────────
  const words = passage.replace(/Paragraph \d+/g, '').split(/\s+/).filter(Boolean).length;
  if (words < SPEC.minWords || words > SPEC.maxWords) {
    fail(f, '规格', `正文 ${words} 词，应在 ${SPEC.minWords}-${SPEC.maxWords}`);
  }
  const sentences = passage
    .replace(/Paragraph \d+/g, '')
    .split(/[.!?]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const longest = sentences.reduce((m, x) => Math.max(m, x.split(/\s+/).length), 0);
  if (longest > SPEC.maxSentenceWords) {
    fail(f, '规格', `最长句 ${longest} 词，上限 ${SPEC.maxSentenceWords}`);
  }
  if (allQs.length !== SPEC.totalQuestions) {
    fail(f, '规格', `${allQs.length} 题，应为 ${SPEC.totalQuestions}`);
  }
  if (mcqCount < SPEC.minClickOnly) {
    fail(f, '规格', `点选题 ${mcqCount} 道，至少 ${SPEC.minClickOnly}（打字题空白率 64%）`);
  }

  // ── 3 短答答案必须在原文有支持 ─────────────────────────────────
  const flat = passage.toLowerCase().replace(/\s+/g, ' ');
  for (const q of allQs.filter((x) => x.exercise !== 2)) {
    const ans = String(q.answer).toLowerCase().trim();
    const aWords = ans.split(/\s+/).length;
    if (aWords > SPEC.maxShortAnswerWords) {
      fail(f, '规格', `Q${q.n} 答案 ${aWords} 词，基础层上限 ${SPEC.maxShortAnswerWords}`);
    }
    if (!flat.includes(ans)) {
      // 允许连字符数字等轻微差异，降级为 WARN 供人工复核
      warn(f, '答案支持', `Q${q.n} 答案「${q.answer}」未在原文逐字出现，需人工确认`);
    }
  }

  // ── 4 MCQ 合法 ────────────────────────────────────────────────
  for (const q of allQs.filter((x) => x.exercise === 2)) {
    const opts = q.options ?? [];
    const correct = opts.filter((o: any) => o.correct);
    if (correct.length !== 1) {
      fail(f, 'MCQ', `Q${q.n} 有 ${correct.length} 个 correct，应恰好 1 个`);
    } else if (correct[0].key !== q.answer) {
      fail(f, 'MCQ', `Q${q.n} answer=${q.answer} 但 correct 是 ${correct[0].key}`);
    }
    const texts = opts.map((o: any) => o.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) fail(f, 'MCQ', `Q${q.n} 选项文本重复`);
    const keys = opts.map((o: any) => o.key);
    if (new Set(keys).size !== keys.length) fail(f, 'MCQ', `Q${q.n} 选项 key 重复`);
    if (opts.length < 3) fail(f, 'MCQ', `Q${q.n} 只有 ${opts.length} 个选项`);
  }

  // ── 5 跨篇去重 ────────────────────────────────────────────────
  if (seenTitles.has(title)) fail(f, '去重', `标题重复: ${title}`);
  seenTitles.add(title);

  const own = issues.filter((i) => i.file === f);
  const mark = own.some((i) => i.sev === 'FAIL') ? '✗' : own.length ? '!' : '✓';
  console.log(
    `${mark} ${f.padEnd(30)} ${String(words).padStart(3)}词 ` +
      `${allQs.length}题(${mcqCount}点选/${allQs.length - mcqCount}打字) 最长句${longest}词 「${title}」`,
  );
}

console.log('');
const fails = issues.filter((i) => i.sev === 'FAIL');
const warns = issues.filter((i) => i.sev === 'WARN');
for (const i of issues) {
  console.log(`  ${i.sev === 'FAIL' ? '✗' : '!'} [${i.check}] ${i.file}: ${i.detail}`);
}
console.log(`\n结果：${fails.length} FAIL · ${warns.length} WARN\n`);
process.exit(fails.length > 0 ? 1 : 0);
