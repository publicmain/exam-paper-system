/**
 * 导入 ECDICT 英汉词典到 DictEntry 表（生词本 P1）。
 *
 * 来源：https://github.com/skywind3000/ECDICT  (MIT)  ecdict.csv  770,612 条
 * 铁律：点词查义必须走本地词典，**零 Anthropic API 调用**。
 *
 * 不全量导入 —— 77 万条里大量是生僻词/专名/词组，对备考无用且撑大生产库。
 *
 * 两遍扫描：
 *   Pass A  选出「值得保留的词头」：bnc>0 / frq>0 / collins>0 / oxford /
 *           带考纲标签(ielts/cet4/…)，同时收集这些词头 exchange 字段里
 *           声明的全部变形。
 *   Pass B  写入「词头 ∪ 其变形」。
 *
 * ⚠️ 为什么必须收变形：ECDICT 的词频字段只标在原形上，had / were / went /
 * looked 这类变形 bnc=frq=0、无标签，只用 Pass A 的条件会把它们全部漏掉 ——
 * 实测那样做覆盖率从 99.4% 掉到 89.5%（低于 PRD 的 90% 闸门）。变形正是学生
 * 在文章里最常点到的形态，必须保留。
 *
 * 用法：
 *   # 先把 ecdict.csv 放到某处（或用 --download 自动拉取到临时目录）
 *   DATABASE_URL=... npx ts-node scripts/import-ecdict.ts --csv /path/ecdict.csv
 *   DATABASE_URL=... npx ts-node scripts/import-ecdict.ts --download
 *
 * 幂等：使用 createMany + skipDuplicates，重复跑不会报错也不会重复插入。
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as https from 'https';

const ECDICT_URL =
  'https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv';
/** 词形还原表：只在**导入期**使用，用于补齐 exchange 没覆盖到的变形
 *  （典型如 were / thousands）。查询期不需要它，解析链仍是三步。 */
const LEMMA_URL =
  'https://raw.githubusercontent.com/skywind3000/ECDICT/master/lemma.en.txt';

const prisma = new PrismaClient();

/** 与前端点词分词器保持一致的归一化。 */
const norm = (w: string) => w.toLowerCase().replace(/’/g, "'");

/**
 * ECDICT 的 CSV 用两字符转义 `\n` 表示释义内的换行。原样入库的话，
 * 学生在点词卡上会看到可见的脏字符：
 *     vt. 哄, 诱骗, 耐心地摆弄\nvi. 哄骗\n[计] 同轴电缆
 * 全库 103,092 条里有 52,292 条中招（实测），必须在导入时就换成真换行。
 */
const unescapeNl = (s: string) => s.split(String.fromCharCode(92) + 'n').join('\n');

/** 流式 CSV 解析（ECDICT 的释义字段含逗号与引号，必须按引号状态机解析）。 */
function* parseCSV(text: string): Generator<string[]> {
  let i = 0;
  let field = '';
  let row: string[] = [];
  let inQ = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      yield row;
      row = [];
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    yield row;
  }
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          download(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`download failed: HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      })
      .on('error', (e) => {
        try {
          fs.unlinkSync(dest);
        } catch {
          /* ignore */
        }
        reject(e);
      });
  });
}

(async () => {
  const args = process.argv.slice(2);
  const csvArgIdx = args.indexOf('--csv');
  let csvPath = csvArgIdx >= 0 ? args[csvArgIdx + 1] : '';
  let downloaded = false;

  if (!csvPath) {
    if (!args.includes('--download')) {
      console.error('用法: --csv <ecdict.csv 路径>  或  --download');
      process.exit(1);
    }
    csvPath = path.join(os.tmpdir(), 'ecdict.csv');
    if (!fs.existsSync(csvPath)) {
      console.log('下载 ecdict.csv (~63MB) …');
      await download(ECDICT_URL, csvPath);
      downloaded = true;
    }
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`找不到 CSV: ${csvPath}`);
    process.exit(1);
  }

  console.log(`读取 ${csvPath} …`);
  const text = fs.readFileSync(csvPath, 'utf8');

  type Row = {
    word: string;
    phonetic: string | null;
    translation: string;
    definition: string | null;
    pos: string | null;
    collins: number | null;
    oxford: boolean;
    tag: string[];
    bnc: number | null;
    frq: number | null;
  };

  // ── Pass A：选出词头，并收集其 exchange 声明的所有变形 ──────────────
  const keptHeads = new Set<string>();
  const inflections = new Set<string>();
  let scannedA = 0;
  for (const r of parseCSV(text)) {
    scannedA++;
    if (scannedA === 1) continue;
    const word = norm(r[0] || '').trim();
    if (!word || word.length > 64) continue;
    if (!(r[3] || '').trim()) continue; // 无中文释义的不要
    const collins = parseInt(r[5] || '', 10);
    const oxford = (r[6] || '').trim() === '1';
    const tag = (r[7] || '').split(/\s+/).filter(Boolean);
    const bnc = parseInt(r[8] || '', 10);
    const frq = parseInt(r[9] || '', 10);
    const worth =
      (Number.isFinite(bnc) && bnc > 0) ||
      (Number.isFinite(frq) && frq > 0) ||
      (Number.isFinite(collins) && collins > 0) ||
      oxford ||
      tag.length > 0;
    if (!worth) continue;
    keptHeads.add(word);
    for (const seg of (r[10] || '').split('/')) {
      const p = seg.split(':');
      if (p.length !== 2) continue;
      const f = norm(p[1]).trim();
      if (f && f.length <= 64) inflections.add(f);
    }
  }
  // lemma 表补齐：exchange 只声明部分变形（be 的 exchange 不含 were），
  // 用 lemma.en.txt 把「已保留词头」的其余变形一并纳入。
  const lemmaPath = path.join(os.tmpdir(), 'lemma.en.txt');
  if (!fs.existsSync(lemmaPath)) {
    console.log('下载 lemma.en.txt (~2MB) …');
    await download(LEMMA_URL, lemmaPath);
  }
  const formToHead = new Map<string, string>();
  for (const line of fs.readFileSync(lemmaPath, 'utf8').split('\n')) {
    if (!line || line[0] === ';') continue;
    const parts = line.split('->');
    if (parts.length !== 2) continue;
    const head = norm(parts[0].split('/')[0].trim());
    if (!keptHeads.has(head)) continue;
    for (const f of parts[1].split(',')) {
      const k = norm(f.trim());
      if (k && k.length <= 64 && !keptHeads.has(k)) {
        inflections.add(k);
        if (!formToHead.has(k)) formToHead.set(k, head);
      }
    }
  }
  console.log(
    `Pass A: 词头 ${keptHeads.size.toLocaleString()} + 变形 ${inflections.size.toLocaleString()}`,
  );

  const batch: Row[] = [];
  let scanned = 0;
  let kept = 0;
  let inserted = 0;
  const seen = new Set<string>();
  /** 需要留底的原形（供后面给"词典里没有独立条目/释义为空"的变形合成词条） */
  const neededHeads = new Set(formToHead.values());
  const headData = new Map<string, Row>();

  const flush = async () => {
    if (!batch.length) return;
    const res = await prisma.dictEntry.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += res.count;
    batch.length = 0;
  };

  for (const r of parseCSV(text)) {
    scanned++;
    if (scanned === 1) continue; // header
    const word = norm(r[0] || '').trim();
    if (!word || word.length > 64) continue;
    // 只要能被点到的词：必须有中文释义
    const translation = (r[3] || '').trim();
    if (!translation) continue;

    const collins = parseInt(r[5] || '', 10);
    const oxford = (r[6] || '').trim() === '1';
    const tag = (r[7] || '')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const bnc = parseInt(r[8] || '', 10);
    const frq = parseInt(r[9] || '', 10);

    // Pass B 收录条件：Pass A 选中的词头，或它们的任一变形
    if (!keptHeads.has(word) && !inflections.has(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);

    kept++;
    const row: Row = {
      word,
      phonetic: (r[1] || '').trim() || null,
      translation: unescapeNl(translation),
      definition: unescapeNl((r[2] || '').trim()) || null,
      pos: (r[4] || '').trim() || null,
      collins: Number.isFinite(collins) && collins > 0 ? collins : null,
      oxford,
      tag,
      bnc: Number.isFinite(bnc) && bnc > 0 ? bnc : null,
      frq: Number.isFinite(frq) && frq > 0 ? frq : null,
    };
    if (neededHeads.has(word)) headData.set(word, row);
    batch.push(row);
    if (batch.length >= 2000) {
      await flush();
      if (kept % 20000 === 0) console.log(`  … 已保留 ${kept.toLocaleString()} 条，已写入 ${inserted.toLocaleString()}`);
    }
  }
  await flush();

  // ── 补齐：词典里没有独立条目（或释义为空）的变形 ─────────────────
  // 典型如 were —— 它既没有词频标记、也不在 be 的 exchange 里，且自身条目
  // 无中文释义。这类词学生在文章里点击频率很高（were 在本系统语料出现 129 次），
  // 漏掉会直接把覆盖率拉到闸门以下。按 ECDICT 自身的行文风格合成词条。
  let synthesized = 0;
  const synthBatch: Row[] = [];
  for (const [form, head] of formToHead) {
    if (seen.has(form)) continue;
    const h = headData.get(head);
    if (!h) continue;
    synthBatch.push({
      word: form,
      phonetic: h.phonetic,
      translation: `${head} 的变形。\n${h.translation}`,
      definition: null,
      pos: h.pos,
      collins: h.collins,
      oxford: h.oxford,
      tag: h.tag,
      bnc: null,
      frq: null,
    });
    seen.add(form);
    synthesized++;
    if (synthBatch.length >= 2000) {
      const res = await prisma.dictEntry.createMany({ data: synthBatch, skipDuplicates: true });
      inserted += res.count;
      synthBatch.length = 0;
    }
  }
  if (synthBatch.length) {
    const res = await prisma.dictEntry.createMany({ data: synthBatch, skipDuplicates: true });
    inserted += res.count;
  }
  console.log(`补齐变形词条: ${synthesized.toLocaleString()}`);

  const total = await prisma.dictEntry.count();
  console.log('');
  console.log('=== 导入完成 ===');
  console.log('  扫描词条 :', scanned.toLocaleString());
  console.log('  符合子集 :', kept.toLocaleString());
  console.log('  本次写入 :', inserted.toLocaleString());
  console.log('  表内总数 :', total.toLocaleString());

  if (downloaded) {
    try {
      fs.unlinkSync(csvPath);
      console.log('  已删除临时 CSV');
    } catch {
      /* ignore */
    }
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('ERR', e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
