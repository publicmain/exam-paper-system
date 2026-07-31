/**
 * 导入 ECDICT 英汉词典到 DictEntry 表（生词本 P1）。
 *
 * 来源：https://github.com/skywind3000/ECDICT  (MIT)  ecdict.csv  770,612 条
 * 铁律：点词查义必须走本地词典，**零 Anthropic API 调用**。
 *
 * 不全量导入 —— 77 万条里大量是生僻词/专名/词组，对备考无用且撑大生产库。
 * 只保留「真实语料里出现过的词」：bnc>0 或 frq>0 或 collins>0 或 oxford
 * 或带考纲标签(ielts/cet4/…)。P0 实测证明这个子集足以覆盖本系统 99.4% 的词次。
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

const prisma = new PrismaClient();

/** 与前端点词分词器保持一致的归一化。 */
const norm = (w: string) => w.toLowerCase().replace(/’/g, "'");

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

  const batch: Row[] = [];
  let scanned = 0;
  let kept = 0;
  let inserted = 0;
  const seen = new Set<string>();

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

    // 子集筛选：真实语料出现过 / 考纲词 / 核心词
    const worthKeeping =
      (Number.isFinite(bnc) && bnc > 0) ||
      (Number.isFinite(frq) && frq > 0) ||
      (Number.isFinite(collins) && collins > 0) ||
      oxford ||
      tag.length > 0;
    if (!worthKeeping) continue;
    if (seen.has(word)) continue;
    seen.add(word);

    kept++;
    batch.push({
      word,
      phonetic: (r[1] || '').trim() || null,
      translation,
      definition: (r[2] || '').trim() || null,
      pos: (r[4] || '').trim() || null,
      collins: Number.isFinite(collins) && collins > 0 ? collins : null,
      oxford,
      tag,
      bnc: Number.isFinite(bnc) && bnc > 0 ? bnc : null,
      frq: Number.isFinite(frq) && frq > 0 ? frq : null,
    });
    if (batch.length >= 2000) {
      await flush();
      if (kept % 20000 === 0) console.log(`  … 已保留 ${kept.toLocaleString()} 条，已写入 ${inserted.toLocaleString()}`);
    }
  }
  await flush();

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
