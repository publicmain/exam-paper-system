/**
 * 生成**首发周**学习卡上的例句中文句意。
 *
 * ## 为什么需要它
 *
 * 学习页只有两个教学屏，第二屏就是「短例句 + 中文翻译」。`content/index.js`
 * 在装配内容包时会逐条校验：少一条中文，发布脚本和内容测试**立即失败**，
 * 不允许带缺口发布。第一周那五档的翻译表是手写的，首发周 500 句手写不现实，
 * 所以这里走 Azure Translator —— 就是学生在阅读页点词时用的同一个服务，
 * 译文风格一致。
 *
 * ## 关于密钥
 *
 * 密钥只从运行环境读，**不落文件、不进日志、不进仓库**。跑法：
 *
 * ```bash
 * railway run -s exam-paper-system -e production -- \
 *   node apps/api/scripts/pilot/build-week2-context-translations.js
 * ```
 *
 * 输出是 `content/context-translations-week2.js`，key 为英文原句的 SHA-256
 * （与第一周同构），提交进仓库。
 *
 * ## 机器翻译的边界
 *
 * 机翻在整句上够用，但会漏两类：一是把多义词按错误词义翻（`still`、
 * `charge` 这种）；二是把英式标点译得别扭。生成后**必须人工过一遍**，
 * `--review` 会把可疑的挑出来单独列。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createHash } = require('node:crypto');

const WEEK2 = path.join(__dirname, 'content', 'week2');
const OUT = path.join(__dirname, 'content', 'context-translations-week2.js');
const VOCAB = path.join(WEEK2, 'vocab.generated.json');

/**
 * 人工复核过的译文。覆盖永远赢 —— 重跑生成器不得把审过的句子冲回机翻。
 * 分两个文件只是为了好读：第一批是雅思轻量档，第二批是其余四档。
 */
const OVERRIDES = {
  ...require('./content/week2/context-translation-overrides.js'),
  ...require('./content/week2/context-translation-overrides-2.js'),
};

const ENDPOINT = (process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com').replace(/\/$/, '');
const KEY = process.env.AZURE_TRANSLATOR_KEY;
const REGION = process.env.AZURE_TRANSLATOR_REGION;

/** Azure 单次最多 100 条、5 万字符；这里保守一点，一次 25 条。 */
const BATCH = 25;

const digest = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

function uniqueContexts() {
  const vocab = JSON.parse(fs.readFileSync(VOCAB, 'utf8'));
  const set = new Set();
  for (const byFile of Object.values(vocab)) {
    for (const rows of Object.values(byFile)) {
      for (const w of rows) set.add(w.context);
    }
  }
  return [...set];
}

/** 已经翻过的不再翻 —— 重跑一次不该把账单翻倍，也不该让已审过的句子变样。 */
function existing() {
  if (!fs.existsSync(OUT)) return {};
  delete require.cache[require.resolve(OUT)];
  return require(OUT);
}

async function translate(batch) {
  const response = await fetch(`${ENDPOINT}/translate?api-version=3.0&from=en&to=zh-Hans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': KEY,
      ...(REGION ? { 'Ocp-Apim-Subscription-Region': REGION } : {}),
    },
    body: JSON.stringify(batch.map((text) => ({ Text: text }))),
  });
  if (!response.ok) {
    throw new Error(`Azure 返回 ${response.status}（密钥不打印）：${(await response.text()).slice(0, 200)}`);
  }
  const rows = await response.json();
  return rows.map((r) => r.translations[0].text);
}

/**
 * 明显不可信的译文 —— 生成后人工优先看这些。
 *
 * 「残留英文」只在这个词**原句里没有**时才算问题。新加坡故事里的人名
 * （Chandran、Faizal、Nurhaliza）是刻意保留不音译的：音译要么杜撰一个
 * 汉字姓（Teo 译成「张」），要么写成学生认不出的一串字，两种都比原样
 * 留着差。不做这个区分的话，报警里全是它们，真问题反而被淹掉。
 */
function suspicious(en, zh) {
  const reasons = [];
  if (!/[㐀-鿿]/.test(zh)) reasons.push('没有中文');
  if (zh.trim().length < 4) reasons.push('太短');
  const source = en.toLowerCase();
  const stray = (zh.match(/[A-Za-z]{4,}/g) ?? []).filter((w) => !source.includes(w.toLowerCase()));
  if (stray.length) reasons.push(`残留英文：${stray.join('/')}`);
  if (zh.length > en.length * 1.2) reasons.push('过长，可能逐词直译');
  return reasons;
}

async function main() {
  if (!KEY) {
    throw new Error(
      '没有 AZURE_TRANSLATOR_KEY。用 `railway run -s exam-paper-system -e production -- node <本文件>` 注入环境变量运行。',
    );
  }
  const contexts = uniqueContexts();
  const have = existing();
  const reviewed = new Set(Object.keys(OVERRIDES).map(digest));
  // 已有译文的、以及已经人工审过的，都不必再送去机翻。
  const todo = contexts.filter((c) => !have[digest(c)] && !reviewed.has(digest(c)));
  console.log(
    `例句 ${contexts.length} 句：已有 ${contexts.length - todo.length - 0} 句无需重翻`
    + `（其中人工复核 ${contexts.filter((c) => reviewed.has(digest(c))).length} 句），本次需翻 ${todo.length} 句`,
  );

  const out = { ...have };
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const zh = await translate(batch);
    batch.forEach((en, k) => { out[digest(en)] = zh[k]; });
    console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  }
  // 人工复核最后覆盖，机翻不得翻案。
  for (const [en, zh] of Object.entries(OVERRIDES)) out[digest(en)] = zh;

  const missing = contexts.filter((c) => !out[digest(c)]);
  if (missing.length) throw new Error(`还有 ${missing.length} 句没有译文，第一句：${missing[0].slice(0, 60)}`);

  const lines = contexts.map((en) => `  '${digest(en)}': ${JSON.stringify(out[digest(en)])}, // ${en.replace(/\s+/g, ' ').slice(0, 78)}`);
  fs.writeFileSync(
    OUT,
    `'use strict';\n\n`
      + `// 首发周例句的中文句意。key 是英文原句的 SHA-256；\n`
      + `// content/index.js 会逐条校验，少一条就立即报错，不能带缺口发布。\n`
      + `// 由 scripts/pilot/build-week2-context-translations.js 生成（Azure Translator），\n`
      + `// 生成后经人工复核。行尾注释是原句，方便审阅时不必回查。\n`
      + `module.exports = {\n${lines.join('\n')}\n};\n`,
    'utf8',
  );
  console.log(`已写入 ${OUT}：${contexts.length} 条`);

  const flagged = contexts
    .map((en) => ({ en, zh: out[digest(en)], why: suspicious(en, out[digest(en)]) }))
    .filter((r) => r.why.length);
  if (flagged.length) {
    console.log(`\n需要人工看的 ${flagged.length} 条：`);
    for (const r of flagged) console.log(`  · [${r.why.join('/')}] ${r.en.slice(0, 60)}\n      → ${r.zh}`);
  } else {
    console.log('\n没有自动标记出可疑译文（仍建议抽查一遍多义词）。');
  }
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });

module.exports = { digest, uniqueContexts, suspicious, OUT };
