/**
 * 从 Simple English Wikipedia 找说明文素材，按五档算难度（2026-09-11）。
 *
 *   npx ts-node apps/api/scripts/content/wiki-candidates.ts --titles=Pencil,Banknote,Bird_migration
 *   npx ts-node apps/api/scripts/content/wiki-candidates.ts --random=15         # 随便抓 15 篇看看
 *   npx ts-node apps/api/scripts/content/wiki-candidates.ts --titles=... --save # 正文存到 .local/wiki/
 *
 * ## 为什么是它
 *
 * 与 VOA（`voa-candidates.ts`）并列的第二个素材源。VOA 以新闻、人物为主；
 * Simple English Wikipedia 什么话题都有，而且本来就是写给英语学习者的简化
 * 版，正对基础、中级、轻量几档的说明文。
 *
 * ## 许可 —— 比 VOA 多一条义务
 *
 * VOA 是公共领域；维基百科是 **CC BY-SA 4.0**：可以改编、可以商用，但
 *   1. 必须署名（链接到原条目）；
 *   2. **改编后的文章也必须以 CC BY-SA 发布**（相同方式共享）。
 * 学校内部用没有问题；只是改编稿不能再宣称是「原创」、不能加更严的限制。
 * 输出的 `credit` 字段照抄进内容包文件头的注释里。
 *
 * ## 它不做什么
 *
 * 不出题，也不改写。抓回来的是素材，改写和出题仍然在聊天里人工做 ——
 * 零 Anthropic 调用。
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { difficultyProfile } from '../../src/vocab-v2/cefr-difficulty';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LEVEL_GATES } = require('../pilot/content/level-gates');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { wordPolicyFor } = require('../../src/vocab-v2/level-policy');

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const TITLES = (arg('titles') ?? '').split(',').map((t) => t.trim()).filter(Boolean);
const RANDOM = Number(arg('random') ?? 0);
const SAVE = process.argv.includes('--save');
const API = 'https://simple.wikipedia.org/w/api.php';
// Wikimedia 要求自报家门的 User-Agent
const HEADERS = { 'user-agent': 'daily-english-content-scout/1.0 (school reading materials; contact via repo owner)' };

async function api(params: Record<string, string>) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json() as Promise<any>;
}

async function randomTitles(n: number): Promise<string[]> {
  const j = await api({ action: 'query', list: 'random', rnnamespace: '0', rnlimit: String(Math.min(n, 50)) });
  return j.query.random.map((r: { title: string }) => r.title);
}

async function extract(title: string): Promise<{ title: string; text: string; url: string } | null> {
  const j = await api({ action: 'query', prop: 'extracts', explaintext: '1', exsectionformat: 'plain', redirects: '1', titles: title });
  const page = j.query.pages?.[0];
  if (!page || page.missing || !page.extract) return null;
  // 去掉「See also / References / Other websites」之后的尾巴
  const text = String(page.extract)
    .split(/\n(?:See also|References|Related pages|Other websites|Further reading)\n/)[0]
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { title: page.title, text, url: `https://simple.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}` };
}

/** 五档里哪一档最合适：篇幅落在区间内（或可以截到区间内）、超纲率最低。 */
function bestTier(text: string) {
  const rows = Object.entries(LEVEL_GATES as Record<string, { words: [number, number]; maxHard: number | null }>).map(
    ([level, gate]) => {
      const p = difficultyProfile(text, wordPolicyFor(level).contextDifficulty);
      // 真题档不设上限，拿 B2 口径算个参考值
      const display = gate.maxHard == null ? difficultyProfile(text, 4).hardRatio : p.hardRatio;
      const fitsHard = gate.maxHard == null || p.hardRatio <= gate.maxHard;
      const longEnough = p.words >= gate.words[0];
      return { level, words: p.words, hard: display, fitsHard, longEnough };
    },
  );
  const ok = rows.filter((r) => r.fitsHard && r.longEnough).sort((a, b) => a.hard - b.hard);
  return { pick: ok[0] ?? null, words: rows[0].words, rows };
}

(async () => {
  const titles = [...TITLES, ...(RANDOM ? await randomTitles(RANDOM) : [])];
  if (!titles.length) throw new Error('用法：--titles=A,B,C 或 --random=15');
  if (SAVE) mkdirSync(resolve(process.cwd(), '.local/wiki'), { recursive: true });
  console.log('Simple English Wikipedia 候选（CC BY-SA 4.0，改编需署名并同样方式共享）\n');
  console.log('档位'.padEnd(20), '词数   超纲    标题');
  for (const t of titles) {
    const page = await extract(t).catch(() => null);
    if (!page || page.text.split(/\s+/).length < 120) {
      console.log(`${'（太短 / 没有）'.padEnd(18)}          ${t}`);
      continue;
    }
    const { pick, words } = bestTier(page.text);
    console.log(
      (pick?.level ?? '（没有合适档）').padEnd(20),
      String(words).padStart(5),
      pick ? `${(pick.hard * 100).toFixed(1).padStart(5)}%` : '    —',
      ` ${page.title}`,
    );
    if (SAVE) {
      const slug = page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const credit = `来源：Simple English Wikipedia「${page.title}」\n原文：${page.url}\n许可：CC BY-SA 4.0 —— 改编稿须署名，并以同样许可发布`;
      writeFileSync(
        resolve(process.cwd(), `.local/wiki/${pick?.level ?? 'unfit'}-${slug}.txt`),
        `${page.title}\n\n${page.text}\n\n---\n${credit}\n`,
        'utf8',
      );
    }
    // 礼貌一点：维基的公共接口别刷太快
    await new Promise((r) => setTimeout(r, 300));
  }
  if (SAVE) console.log('\n正文已存到 .local/wiki/（未进仓库）。改编入库时把 credit 一起带上。');
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
