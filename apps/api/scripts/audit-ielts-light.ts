import * as fs from 'fs';
import * as path from 'path';

/**
 * 雅思轻量层 fixture 审计。
 *
 * 除了通用的 schema / 规格检查，额外强制 PRD 里定的三条雅思专属规则：
 *
 *   1. TFNG 三条必须覆盖 TRUE / FALSE / NOT GIVEN 各一 —— 否则学生靠猜
 *      同一个答案就能蒙到分，这类题就白出了。
 *   2. 填空答案必须**逐字出现在原文**且是单个词。雅思的 ONE WORD ONLY
 *      规则如此，答案不在原文里学生永远做不对。
 *   3. 词表例句必须**逐字取自本篇原文**。基础层踩过这个坑：50 条里 7 条
 *      是改写/截断的，学生在原文里搜不到那句话。
 *
 * 用法：npx ts-node apps/api/scripts/audit-ielts-light.ts
 */

const DIR = path.join(__dirname, '..', 'test-fixtures', 'ielts-light-2026');
const TAG = 'ai_authored_ielts_light';

const SPEC = {
  minWords: 240,
  maxWords: 360,
  totalQuestions: 6,
  tfng: 3,
  completion: 3,
  wordlistSize: 8,
};

type Issue = { file: string; sev: 'FAIL' | 'WARN'; check: string; detail: string };
const issues: Issue[] = [];
const fail = (f: string, c: string, d: string) => issues.push({ file: f, sev: 'FAIL', check: c, detail: d });
const warn = (f: string, c: string, d: string) => issues.push({ file: f, sev: 'WARN', check: c, detail: d });

/** 归一化：把弯引号、破折号、连续空白拉平，再比对是否逐字包含。
 *  fixture 里写的是排版好看的 — 和 ’，原文同理，但两边可能不一致。 */
const norm = (s: string) =>
  String(s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
const titles = new Set<string>();

console.log(`\n=== 雅思轻量层审计（${files.length} 篇）===\n`);

for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf-8'));

  // ── schema ──
  if (d.provenanceTag !== TAG) fail(f, 'schema', `provenanceTag=${d.provenanceTag}，应为 ${TAG}`);
  if (d.level !== 'ielts_light') fail(f, 'schema', `level=${d.level}，应为 ielts_light`);
  if (!d.passageTitle) fail(f, 'schema', '缺 passageTitle');
  if (titles.has(d.passageTitle)) fail(f, '去重', `标题重复: ${d.passageTitle}`);
  titles.add(d.passageTitle);
  if (!/NOT STUDENT-FACING/.test(d.note ?? '')) {
    fail(f, '版权', 'note 未标注 NOT STUDENT-FACING / 非真题');
  }

  // ── 规格 ──
  const passage = String(d.passage ?? '');
  const words = passage.split(/\s+/).filter(Boolean).length;
  if (words < SPEC.minWords || words > SPEC.maxWords) {
    fail(f, '规格', `正文 ${words} 词，应在 ${SPEC.minWords}-${SPEC.maxWords}`);
  }
  const qs: any[] = d.questions ?? [];
  if (qs.length !== SPEC.totalQuestions) fail(f, '规格', `${qs.length} 题，应为 ${SPEC.totalQuestions}`);
  const nums = qs.map((q) => q.n);
  if (JSON.stringify(nums) !== JSON.stringify(qs.map((_, i) => i + 1))) {
    fail(f, 'schema', `题号不连续: ${nums.join(',')}`);
  }

  const tfng = qs.filter((q) => q.taskType === 'true_false_not_given');
  const comp = qs.filter((q) => q.taskType === 'sentence_completion');
  if (tfng.length !== SPEC.tfng) fail(f, '规格', `TFNG ${tfng.length} 题，应为 ${SPEC.tfng}`);
  if (comp.length !== SPEC.completion) fail(f, '规格', `填空 ${comp.length} 题，应为 ${SPEC.completion}`);

  // ── 规则 1：TFNG 三值必须齐 ──
  const answers = tfng.map((q) => String(q.answer).toUpperCase());
  for (const need of ['TRUE', 'FALSE', 'NOT GIVEN']) {
    if (!answers.includes(need)) {
      fail(f, 'TFNG', `三条答案缺 ${need}（实际: ${answers.join(' / ')}）—— 学生能靠猜同一个答案蒙分`);
    }
  }

  // ── 规则 2：填空答案必须逐字在原文、且是单词 ──
  const p = norm(passage).toLowerCase();
  for (const q of comp) {
    const a = String(q.answer ?? '').trim();
    if (!a) { fail(f, '填空', `Q${q.n} 答案为空`); continue; }
    if (/\s/.test(a)) fail(f, '填空', `Q${q.n} 答案「${a}」不是单个词（ONE WORD ONLY）`);
    if (!new RegExp(`\\b${a.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(p)) {
      fail(f, '填空', `Q${q.n} 答案「${a}」未逐字出现在原文`);
    }
    if (!/______/.test(String(q.item ?? ''))) warn(f, '填空', `Q${q.n} 题干没有空格占位符`);
  }

  // ── TFNG 题干不该直接照抄原文整句 ──
  for (const q of tfng) {
    const item = norm(q.item).toLowerCase();
    if (item.length > 12 && p.includes(item)) {
      warn(f, 'TFNG', `Q${q.n} 题干与原文逐字相同，判断题失去意义`);
    }
  }

  // ── 规则 3：词表 ──
  const wl: any[] = d.wordlist ?? [];
  if (wl.length !== SPEC.wordlistSize) fail(f, '词表', `${wl.length} 词，应为 ${SPEC.wordlistSize}`);
  const seen = new Set<string>();
  for (const w of wl) {
    const word = String(w.word ?? '').trim();
    if (!word) { fail(f, '词表', '有空词条'); continue; }
    if (seen.has(word.toLowerCase())) fail(f, '词表', `词重复: ${word}`);
    seen.add(word.toLowerCase());
    if (!String(w.meaning ?? '').trim()) fail(f, '词表', `${word} 缺中文释义`);
    const ex = norm(w.example);
    if (!ex) { fail(f, '词表', `${word} 缺例句`); continue; }
    // 例句允许以 … 开头（截取原文中段），比对时剥掉
    const core = ex.replace(/^[…\.]+\s*/, '').replace(/\s*[…\.]+$/, '');
    if (!norm(passage).includes(core)) {
      fail(f, '词表', `${word} 的例句非原文逐字：「${core.slice(0, 50)}…」`);
    }
    // 按**词根**匹配，不是整词 —— 例句里出现的常常是变形（rotate →
    // Rotating、refine → refining）。砍掉尾部两个字母做前缀匹配，既能
    // 认出变形，又不至于短到误判。
    const stem = word.toLowerCase().slice(0, Math.max(4, word.length - 2));
    if (!core.toLowerCase().includes(stem)) {
      warn(f, '词表', `${word} 的例句里没出现这个词（连词根 ${stem} 都没有）`);
    }
  }

  const own = issues.filter((i) => i.file === f);
  const mark = own.some((i) => i.sev === 'FAIL') ? '✗' : own.length ? '!' : '✓';
  console.log(
    `${mark} ${f.padEnd(34)} ${String(words).padStart(3)}词 ${qs.length}题` +
      `(${tfng.length}判断+${comp.length}填空) ${wl.length}词表 「${d.passageTitle}」`,
  );
}

console.log('');
for (const i of issues) console.log(`  ${i.sev === 'FAIL' ? '✗' : '!'} [${i.check}] ${i.file}: ${i.detail}`);
const fails = issues.filter((i) => i.sev === 'FAIL').length;
console.log(`\n结果：${fails} FAIL · ${issues.length - fails} WARN\n`);
process.exit(fails > 0 ? 1 : 0);
