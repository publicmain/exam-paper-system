/**
 * 从 VOA Learning English 拉候选文章，按五档算难度，挑出每档能用的。
 *
 *   npx ts-node apps/api/scripts/content/voa-candidates.ts            # 默认几个栏目
 *   npx ts-node apps/api/scripts/content/voa-candidates.ts --limit=6  # 每个栏目取几篇
 *   npx ts-node apps/api/scripts/content/voa-candidates.ts --save     # 正文存到 .local/voa/
 *
 * ## 为什么是 VOA
 *
 * 仓库自带的 fixture 题库在首发周用尽，第三周起文章必须新写。VOA Learning English
 * 的文本、音频、图片都是**公共领域**，明确允许教育和商业用途转载，只要署名
 * learningenglish.voanews.com；而且它本来就是给英语学习者写的分级读物（中级和
 * 上初级词汇、语速放慢），正对基础档和轻量档。
 *
 * ## 版权注意
 *
 * VOA 自己的文本和图片是公共领域，但页面里**美联社 / 路透社的图片不是** ——
 * 本脚本只取正文文字，不碰图片，就不会踩到这条。
 * 改编后入库时必须带上署名，见下面输出的 `credit` 字段。
 *
 * ## 它不做什么
 *
 * 不出题。抓回来的是**素材**，题目仍然由人写 —— 出题走的是聊天里人工出题那条路，
 * 与零 Anthropic 调用的铁律一致。
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { difficultyProfile } from '../../src/vocab-v2/cefr-difficulty';

/**
 * RSS 订阅地址，取自 VOA 的 /rssfeeds 页面。栏目名不写死 —— 从 RSS 自己的
 * <title> 读，站点调整栏目时不会对不上号。地址失效就重新去 /rssfeeds 抓一遍。
 */
const FEEDS: string[] = [
  '/api/zoroqql-vomx-tpeptpqq',
  '/api/z_gjqyl-vomx-tpevmrov',
  '/api/zkm-ql-vomx-tpej-rqi',
  '/api/zyg__l-vomx-tpetmty',
  '/api/zpyp_l-vomx-tpe_rym',
];
const HOST = 'https://learningenglish.voanews.com';

/** 五档对应的内容难度参数，和 level-policy 保持一致。 */
const TIERS: Array<{ level: string; difficulty: number; words: [number, number] }> = [
  { level: 'ielts_simplified', difficulty: 1, words: [150, 320] },
  { level: 'olevel_intermediate', difficulty: 2, words: [300, 480] },
  { level: 'olevel', difficulty: 3, words: [420, 700] },
  { level: 'ielts_light', difficulty: 4, words: [240, 420] },
  { level: 'ielts_authentic', difficulty: 5, words: [500, 900] },
];

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const LIMIT = Number(arg('limit') ?? 4);
const SAVE = process.argv.includes('--save');

function decode(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'daily-english-content-scout/1.0' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

/** RSS 里取文章链接 —— 只要 /a/ 开头的正文页，栏目首页（/z/）跳过。 */
function articleLinks(xml: string, limit: number): Array<{ title: string; link: string; date: string }> {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  const out: Array<{ title: string; link: string; date: string }> = [];
  for (const item of items) {
    const link = item.match(/<link>([^<]*)<\/link>/)?.[1] ?? '';
    if (!link.includes('/a/')) continue;
    out.push({
      title: decode(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''),
      link,
      date: (item.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1] ?? '').slice(5, 16),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** 正文段落。VOA 的正文在 <div class="wsw"> 里，段落是朴素的 <p>。 */
function paragraphs(html: string): string[] {
  return [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)]
    .map((m) => decode(m[1]))
    // 太短的多半是图注、栏目提示、订阅招呼
    .filter((p) => p.split(/\s+/).length > 8)
    // 站点固定的尾巴
    .filter((p) => !/^(I'm|We want to hear from you|Words in This Story)/i.test(p));
}

/** 这篇文章最适合哪一档：长度落在区间内、且超纲比例最低。 */
function bestTier(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const scored = TIERS.map((t) => {
    const p = difficultyProfile(text, t.difficulty);
    // 真题档不设限，超纲率恒为 0，看不出难易 —— 展示时按 B2 口径算一个参考值
    const display = t.difficulty >= 5 ? difficultyProfile(text, 4).hardRatio : p.hardRatio;
    const lengthFits = words >= t.words[0] && words <= t.words[1];
    return { ...t, hardRatio: p.hardRatio, displayRatio: display, lengthFits };
  });
  const fitting = scored.filter((s) => s.lengthFits && s.hardRatio <= 0.12);
  const pick = (fitting.length ? fitting : scored.filter((s) => s.lengthFits)).sort(
    (a, b) => a.hardRatio - b.hardRatio,
  )[0];
  return { words, pick, scored };
}

(async () => {
  if (SAVE) mkdirSync(resolve(process.cwd(), '.local/voa'), { recursive: true });
  console.log('VOA Learning English 候选文章（公共领域，转载需署名）\n');
  console.log('档位'.padEnd(20), '词数  超纲   栏目 / 标题');

  for (const path of FEEDS) {
    let links: Array<{ title: string; link: string; date: string }>;
    let section = path;
    try {
      const xml = await get(HOST + path);
      section = decode(xml.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? path).replace(/ - Voice of America$/, '');
      links = articleLinks(xml, LIMIT);
    } catch (e) {
      console.log(`  ！${path} 取不到：${(e as Error).message}`);
      continue;
    }
    for (const item of links) {
      let text: string;
      try {
        text = paragraphs(await get(item.link)).join('\n\n');
      } catch {
        continue;
      }
      if (!text) continue;
      const { words, pick } = bestTier(text);
      if (!pick) {
        console.log(`${'（长度都不合）'.padEnd(18)} ${String(words).padStart(4)}   —     ${section} · ${item.title.slice(0, 44)}`);
        continue;
      }
      console.log(
        pick.level.padEnd(20),
        String(words).padStart(4),
        (pick.displayRatio * 100).toFixed(1).padStart(5) + '%',
        ` ${section} · ${item.title.slice(0, 44)}`,
      );
      if (SAVE) {
        const slug = item.link.split('/').pop()?.replace(/\.html$/, '') ?? String(Date.now());
        const credit = `来源：VOA Learning English（公共领域）\n原文：${item.link}\n署名：learningenglish.voanews.com`;
        writeFileSync(
          resolve(process.cwd(), `.local/voa/${pick.level}-${slug}.txt`),
          `${item.title}\n\n${text}\n\n---\n${credit}\n`,
          'utf8',
        );
      }
    }
  }
  if (SAVE) console.log('\n正文已存到 .local/voa/（未进仓库）。改编入库时把 credit 一起带上。');
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
