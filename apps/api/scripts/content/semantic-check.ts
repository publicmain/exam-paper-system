/**
 * 语义查重 + 同周话题重复检查（2026-09-11）。
 *
 *   railway run -s Postgres -e production -- npx ts-node apps/api/scripts/content/semantic-check.ts --week=week3
 *
 * ## 为什么在词面查重之外还要这个
 *
 * 发布脚本的查重是 5 词片段的字面重合 —— 能挡住抄袭和轻度改写，但挡不住
 * 「换了说法讲同一件事」。两篇都讲鸟为什么排成人字形、一字不同，字面查重
 * 会放行；学生读来就是同一篇。这里用本地句向量（all-MiniLM-L6-v2，与判分
 * 队列排序同一个模型）比较**整篇文章的意思**：
 *
 *   1. 本周每一篇 vs **学生读过的**全部文章（生产库只读，口径与发布脚本的
 *      deliveredHistory 一致：挂过作业、且那份作业下真有答卷）；
 *   2. 本周每一篇 vs 内容包里其余各周；
 *   3. 同一档本周内两两比较 —— 一周里别出现两篇讲同一个话题的。
 *
 * 余弦 ≥ 0.62 标「要人看」—— 必须把对方原文调出来读；≥ 0.80 基本是同一个
 * 话题，别发。
 *
 * 阈值是被真实漏报校准出来的：第一版设 0.75，第三周两篇就从缝里过去了 ——
 * 「Grandpa's Radio」对旧早测的「The Old Radio」0.65（外公、棕色收音机、银色
 * 旋钮、华语老歌全撞），「The Piano Through the Wall」对「The Piano Upstairs」
 * 0.72（同一个桥段）。同体裁的新加坡记叙文之间本来就有 0.5–0.6 的底，
 * 超过 0.62 就不是巧合了。
 *
 * 模型没装（`npm i --no-save @huggingface/transformers`）就直接说没法查，
 * 不假装通过。
 */
import { PrismaClient } from '@prisma/client';
import * as path from 'path';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const WEEK = arg('week') ?? 'week3';
const WARN = 0.62;
const BLOCK = 0.8;

type Extractor = (text: string, opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ data: ArrayLike<number> }>;

async function loadModel(): Promise<Extractor> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('@huggingface/transformers');
    return (await mod.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'fp32' })) as Extractor;
  } catch (e) {
    throw new Error(`句向量模型起不来（npm i --no-save @huggingface/transformers）：${(e as Error).message}`);
  }
}

/** 长文章切成段各自编码再平均 —— MiniLM 只看前 256 个词片，整篇丢进去后半篇等于没看。 */
async function embedPassage(run: Extractor, passage: string): Promise<Float32Array> {
  const paras = passage
    .replace(/^Paragraph \S+\s*/gm, '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40);
  let sum: Float32Array | null = null;
  for (const p of paras) {
    const out = await run(p.slice(0, 1500), { pooling: 'mean', normalize: true });
    const v = Float32Array.from(out.data as ArrayLike<number>);
    if (!sum) sum = v;
    else for (let i = 0; i < v.length; i += 1) sum[i] += v[i];
  }
  if (!sum) throw new Error('空文章');
  let norm = 0;
  for (const x of sum) norm += x * x;
  norm = Math.sqrt(norm);
  return sum.map((x) => x / norm);
}

const cosine = (a: Float32Array, b: Float32Array) => a.reduce((s, x, i) => s + x * b[i], 0);

(async () => {
  const run = await loadModel();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const content = require(path.resolve(__dirname, '..', 'pilot', 'content'));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DATES: WEEK_DATES } = require(path.resolve(__dirname, '..', 'pilot', 'content', WEEK, 'dates'));
  const weekDates = new Set<string>(WEEK_DATES);

  type Item = { id: string; level: string; date: string; title: string; vec?: Float32Array; passage: string };
  const mine: Item[] = [];
  const bundle: Item[] = [];
  for (const [level, days] of Object.entries(content.LEVELS as Record<string, Array<{ date: string; title: string; passage: string }>>)) {
    for (const d of days) {
      const item = { id: `${level}/${d.date}`, level, date: d.date, title: d.title, passage: d.passage };
      (weekDates.has(d.date) ? mine : bundle).push(item);
    }
  }

  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } } });
  const rows = await prisma.paperQuestion.findMany({
    where: { paper: { assignments: { some: { submissions: { some: {} } } } } },
    select: { snapshotContent: true, paper: { select: { name: true } } },
    take: 20000,
  });
  await prisma.$disconnect();
  const delivered = new Map<string, Item>();
  for (const r of rows) {
    const c = (r.snapshotContent ?? {}) as { passage?: string; passageTitle?: string };
    if (!c.passage || delivered.has(c.passage)) continue;
    delivered.set(c.passage, { id: `读过/${c.passageTitle ?? r.paper.name}`, level: '', date: '', title: c.passageTitle ?? r.paper.name, passage: c.passage });
  }
  // 学生读过的里面也包括内容包前两周 —— 标题相同的只留一份
  const bundleTitles = new Set(bundle.map((b) => b.title));
  const history = [...bundle, ...[...delivered.values()].filter((d) => !bundleTitles.has(d.title))];

  console.log(`本周 ${mine.length} 篇；对照：内容包其余 ${bundle.length} 篇 + 学生读过的库外文章 ${history.length - bundle.length} 篇`);
  for (const it of [...mine, ...history]) it.vec = await embedPassage(run, it.passage);

  let flagged = 0;
  console.log('\n【本周每篇最像的三篇】');
  for (const m of mine) {
    const top = history
      .map((h) => ({ h, s: cosine(m.vec!, h.vec!) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 3);
    const worst = top[0]?.s ?? 0;
    const mark = worst >= BLOCK ? '✗' : worst >= WARN ? '⚠' : '✓';
    if (worst >= WARN) flagged += 1;
    console.log(`${mark} ${m.id.padEnd(30)} ${m.title}`);
    for (const t of top) console.log(`    ${t.s.toFixed(2)}  ${t.h.title}`);
  }

  console.log('\n【同一档本周内两两】');
  for (const level of [...new Set(mine.map((m) => m.level))]) {
    const same = mine.filter((m) => m.level === level);
    for (let i = 0; i < same.length; i += 1) {
      for (let j = i + 1; j < same.length; j += 1) {
        const s = cosine(same[i].vec!, same[j].vec!);
        const mark = s >= WARN ? '⚠' : '✓';
        if (s >= WARN) flagged += 1;
        console.log(`${mark} ${level.padEnd(20)} ${s.toFixed(2)}  ${same[i].title}  ↔  ${same[j].title}`);
      }
    }
  }
  console.log(flagged ? `\n${flagged} 处要人看。` : '\n没有语义上撞车的文章。');
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
