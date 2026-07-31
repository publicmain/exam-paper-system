/**
 * 把内嵌在文章正文里的出处说明剥掉，只保留学生需要的 Glossary。
 *
 * 背景：一批早期 fixture 在 passage 正文结尾内嵌了这样一段——
 *   (AI-authored original narrative for O-Level 1128 §B style practice,
 *    simplified-band difficulty; not from a past examination paper.
 *    HDB: Housing and Development Board …)
 * 这段是**学生在卷面上能读到的正文的一部分**，等于直接告诉学生文章是 AI
 * 写的，还暴露了内部难度标记(simplified-band)。与「对学生不提 AI」的口径冲突。
 *
 * 处理方式：只删「出处那一句」，**保留后面的词汇注释**（那是学生真正需要的），
 * 并把括号改写成干净的 `(Glossary: …)` 形式。识别不出注释就整段删掉。
 *
 * 用法：
 *   npx ts-node scripts/strip-provenance-note.ts                # 全部 fixture，dry-run
 *   npx ts-node scripts/strip-provenance-note.ts --write        # 落盘
 *   npx ts-node scripts/strip-provenance-note.ts --file a.json --write
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', 'test-fixtures');

/** 匹配整段内嵌说明：从 "(AI-authored" 起到该括号结束。 */
const NOTE_RE = /\(\s*AI-authored[\s\S]*?\)\s*$/;

/**
 * 从说明里抽出真正的词汇注释部分。
 * 典型结构：`(AI-authored … not from a past exam(ination paper)?. <注释…>)`
 * 也可能夹一句 "The figures are illustrative."（对学生无意义，一并去掉）。
 */
export function rewriteNote(note: string): string | null {
  let inner = note.replace(/^\(\s*/, '').replace(/\)\s*$/, '').trim();
  // 砍掉出处句：到第一个 "past exam…." 为止
  const m = inner.match(/not from a past exam[^.]*\.\s*/i);
  if (m) inner = inner.slice((m.index ?? 0) + m[0].length);
  else {
    const m2 = inner.match(/^AI-authored[^.]*\.\s*/i);
    if (m2) inner = inner.slice(m2[0].length);
  }
  inner = inner.replace(/^The figures are illustrative\.\s*/i, '').trim();
  if (!inner) return null; // 没有剩余注释 → 整段删掉
  return `(Glossary: ${inner})`;
}

function processFile(file: string, write: boolean): boolean {
  const raw = fs.readFileSync(file, 'utf8');
  const j = JSON.parse(raw);
  let changed = false;

  const fix = (obj: any, key: string) => {
    const v = obj?.[key];
    if (typeof v !== 'string') return;
    const m = v.match(NOTE_RE);
    if (!m) return;
    const next = rewriteNote(m[0]);
    obj[key] = next ? v.replace(NOTE_RE, next) : v.replace(NOTE_RE, '').trimEnd();
    changed = true;
    console.log(`   · ${path.basename(file)} → ${next ? next.slice(0, 88) + '…' : '(整段移除)'}`);
  };

  if (Array.isArray(j.sections)) for (const s of j.sections) fix(s, 'passage');
  if (typeof j.passage === 'string') fix(j, 'passage');
  else if (j.passage && typeof j.passage === 'object') fix(j.passage, 'body');

  if (changed && write) fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n');
  return changed;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const only = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;

  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json')) files.push(p);
    }
  };
  walk(ROOT);

  let n = 0;
  for (const f of files) {
    if (only && !f.includes(only)) continue;
    if (processFile(f, write)) n++;
  }
  console.log(`\n${write ? '已修改' : '待修改(dry-run)'} ${n} 个 fixture`);
}
