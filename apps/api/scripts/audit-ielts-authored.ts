import * as fs from 'fs';
import * as path from 'path';

/**
 * 雅思标准层自撰补料审计（ielts-authored-aug2026）。
 *
 * 剑桥题库对本班耗尽后，标准层的新内容全部自撰。审计要盯住三件事：
 *
 *   1. **版权隔离** —— note 必须写明非真题，provenanceTag 必须是自撰标签。
 *      自撰内容混进 authentic 桶不会有版权问题，但被学生当成真题会误导
 *      难度判断，所以标注是硬要求。
 *   2. **段落匹配可解** —— 答案字母必须在正文实际存在的段落范围内，且
 *      4 条答案不能全指向同一段（否则学生蒙一个字母就得 4 分）。
 *   3. **填空答案逐字在原文**且为单词 —— 雅思 ONE WORD ONLY 规则。
 *
 * 用法：npx ts-node apps/api/scripts/audit-ielts-authored.ts
 */

const DIR = path.join(__dirname, '..', 'test-fixtures', 'ielts-authored-aug2026');
const TAG = 'ai_authored_ielts_2026';

const SPEC = {
  minWords: 620,
  maxWords: 900,
  totalQuestions: 13,
  matching: 4,
  tfng: 4,
  completion: 5,
};

type Issue = { file: string; sev: 'FAIL' | 'WARN'; check: string; detail: string };
const issues: Issue[] = [];
const fail = (f: string, c: string, d: string) => issues.push({ file: f, sev: 'FAIL', check: c, detail: d });
const warn = (f: string, c: string, d: string) => issues.push({ file: f, sev: 'WARN', check: c, detail: d });

const norm = (s: string) =>
  String(s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
const titles = new Set<string>();

console.log(`\n=== 雅思标准层自撰补料审计（${files.length} 篇）===\n`);

for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf-8'));

  // ── 版权隔离 ──
  if (d.provenanceTag !== TAG) fail(f, '版权', `provenanceTag=${d.provenanceTag}，应为 ${TAG}`);
  if (!/非.*真题|NOT STUDENT-FACING/.test(d.note ?? '')) {
    fail(f, '版权', 'note 未写明「非真题」—— 自撰内容必须与剑桥原文明确区分');
  }
  if (d.level !== 'ielts_authentic') fail(f, 'schema', `level=${d.level}，应为 ielts_authentic`);
  if (titles.has(d.passageTitle)) fail(f, '去重', `标题重复: ${d.passageTitle}`);
  titles.add(d.passageTitle);

  // ── 规格 ──
  const passage = String(d.passage ?? '');
  const words = passage.replace(/Paragraph [A-H]/g, '').split(/\s+/).filter(Boolean).length;
  if (words < SPEC.minWords || words > SPEC.maxWords) {
    fail(f, '规格', `正文 ${words} 词，应在 ${SPEC.minWords}-${SPEC.maxWords}`);
  }
  const paras = (passage.match(/Paragraph ([A-H])/g) ?? []).map((x) => x.slice(-1));
  const qs: any[] = d.questions ?? [];
  if (qs.length !== SPEC.totalQuestions) fail(f, '规格', `${qs.length} 题，应为 ${SPEC.totalQuestions}`);
  const nums = qs.map((q) => q.n);
  if (JSON.stringify(nums) !== JSON.stringify(qs.map((_, i) => i + 1))) {
    fail(f, 'schema', `题号不连续: ${nums.join(',')}`);
  }

  const match = qs.filter((q) => q.taskType === 'matching_information');
  const tfng = qs.filter((q) => q.taskType === 'true_false_not_given');
  const comp = qs.filter((q) => q.taskType === 'sentence_completion');
  if (match.length !== SPEC.matching) fail(f, '规格', `段落匹配 ${match.length} 题，应为 ${SPEC.matching}`);
  if (tfng.length !== SPEC.tfng) fail(f, '规格', `判断 ${tfng.length} 题，应为 ${SPEC.tfng}`);
  if (comp.length !== SPEC.completion) fail(f, '规格', `填空 ${comp.length} 题，应为 ${SPEC.completion}`);

  // ── 段落匹配可解性 ──
  const matchAnswers = match.map((q) => String(q.answer).trim().toUpperCase());
  for (const q of match) {
    const a = String(q.answer).trim().toUpperCase();
    if (!paras.includes(a)) {
      fail(f, '匹配', `Q${q.n} 答案 ${a} 不在正文段落范围（正文只有 ${paras.join('')}）`);
    }
  }
  if (new Set(matchAnswers).size === 1 && matchAnswers.length > 1) {
    fail(f, '匹配', `4 条答案全指向段落 ${matchAnswers[0]} —— 蒙一个字母得满分`);
  }
  if (new Set(matchAnswers).size < 3) {
    warn(f, '匹配', `答案只分布在 ${new Set(matchAnswers).size} 个段落，建议更分散`);
  }

  // ── TFNG 三值覆盖 ──
  const tAns = tfng.map((q) => String(q.answer).toUpperCase());
  for (const need of ['TRUE', 'FALSE', 'NOT GIVEN']) {
    if (!tAns.includes(need)) {
      fail(f, '判断', `四条答案缺 ${need}（实际 ${tAns.join(' / ')}）`);
    }
  }

  // ── 填空：逐字在原文、单词 ──
  const p = norm(passage).toLowerCase();
  for (const q of comp) {
    const a = String(q.answer ?? '').trim();
    if (!a) { fail(f, '填空', `Q${q.n} 答案为空`); continue; }
    if (/\s/.test(a)) fail(f, '填空', `Q${q.n} 答案「${a}」不是单个词`);
    const esc = a.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`\\b${esc}\\b`).test(p)) {
      fail(f, '填空', `Q${q.n} 答案「${a}」未逐字出现在原文`);
    }
    if (!/______/.test(String(q.item ?? ''))) warn(f, '填空', `Q${q.n} 题干缺空格占位符`);
  }

  // ── 指令齐备（渲染依赖它分组）──
  for (const q of qs) {
    if (!String(q.instruction ?? '').trim()) fail(f, 'schema', `Q${q.n} 缺 instruction`);
    if (q.questionType !== 'short_answer') fail(f, 'schema', `Q${q.n} questionType=${q.questionType}`);
    if ((q.marks ?? 0) !== 1) fail(f, 'schema', `Q${q.n} marks=${q.marks}，雅思单题应为 1`);
  }

  const own = issues.filter((i) => i.file === f);
  const mark = own.some((i) => i.sev === 'FAIL') ? '✗' : own.length ? '!' : '✓';
  console.log(
    `${mark} ${f.padEnd(28)} ${String(words).padStart(3)}词 ${paras.length}段 ${qs.length}题` +
      `(${match.length}匹配+${tfng.length}判断+${comp.length}填空) 「${d.passageTitle}」`,
  );
}

console.log('');
for (const i of issues) console.log(`  ${i.sev === 'FAIL' ? '✗' : '!'} [${i.check}] ${i.file}: ${i.detail}`);
const fails = issues.filter((i) => i.sev === 'FAIL').length;
console.log(`\n结果：${fails} FAIL · ${issues.length - fails} WARN\n`);
process.exit(fails > 0 ? 1 : 0);
