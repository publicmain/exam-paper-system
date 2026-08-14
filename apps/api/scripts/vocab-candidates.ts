import { PrismaClient } from '@prisma/client';

/**
 * 词表选词辅助：把候选词逐个查 ECDICT，报出释义、考纲标签、词频，
 * 用来判断难度是否落在「基础层学生该背」的区间。
 *
 * 零 AI —— 全部走本地 DictEntry 表。
 *
 *   DATABASE_URL=... npx ts-node apps/api/scripts/vocab-candidates.ts word1 word2 ...
 *   DATABASE_URL=... npx ts-node apps/api/scripts/vocab-candidates.ts --from-basic-passages
 */

const prisma = new PrismaClient();

/** 与 vocab.service 的 candidateForms 同口径的极简版：原形 + 常见屈折还原。 */
function forms(raw: string): string[] {
  const w = raw.toLowerCase().trim();
  const out = new Set([w]);
  if (w.endsWith('ies')) out.add(w.slice(0, -3) + 'y');
  if (w.endsWith('es')) out.add(w.slice(0, -2));
  if (w.endsWith('s')) out.add(w.slice(0, -1));
  if (w.endsWith('ed')) { out.add(w.slice(0, -2)); out.add(w.slice(0, -1)); }
  if (w.endsWith('ing')) { out.add(w.slice(0, -3)); out.add(w.slice(0, -3) + 'e'); }
  if (/([a-z])\1(ed|ing)$/.test(w)) out.add(w.replace(/([a-z])\1(ed|ing)$/, '$1'));
  return [...out];
}

(async () => {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  let words = args;

  if (process.argv.includes('--from-basic-passages')) {
    const qs = await prisma.question.findMany({
      where: { provenanceTag: 'ai_authored_olevel_1128_basic', status: 'active' },
      select: { content: true },
    });
    const seen = new Set<string>();
    for (const q of qs) {
      const p = ((q.content ?? {}) as any).passage ?? '';
      for (const m of String(p).matchAll(/[A-Za-z][A-Za-z'-]{3,}/g)) {
        seen.add(m[0].toLowerCase());
      }
    }
    words = [...seen].sort();
  }

  const rows: any[] = [];
  for (const w of words) {
    const hit = await prisma.dictEntry.findFirst({ where: { word: { in: forms(w) } } });
    rows.push({
      word: w,
      hit: hit ? hit.word : '—',
      tag: hit?.tag?.join(',') ?? '',
      collins: hit?.collins ?? null,
      oxford: hit?.oxford ?? false,
      bnc: hit?.bnc ?? null,
      zh: (hit?.translation ?? '').split('\n')[0].slice(0, 26),
    });
  }
  rows.sort((a, b) => (b.bnc === null ? 1e9 : b.bnc) - (a.bnc === null ? 1e9 : a.bnc));
  console.table(rows);
  console.log(`\n查得到 ${rows.filter((r) => r.hit !== '—').length} / ${rows.length}`);
  console.log('bnc 越小越常用；oxford=true 为牛津 3000 核心词。\n');
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
