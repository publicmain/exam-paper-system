/**
 * 首发周（2026-09-07 ~ 09-11）内容包的装配。
 *
 * 五个档位模块各自只负责「哪一天用哪篇文章 + 人工出的题」，词表和例句
 * 中文在这里注入：
 *
 *   · 词表来自 `vocab.generated.json`（`build-week2-vocab.js` 从 ECDICT 生成）；
 *   · 例句中文来自 `../context-translations-week2.js`
 *     （Azure 出草稿 + `context-translation-overrides.js` 人工复核）。
 *
 * 两处都**故意 fail closed**：少一天的词表、或少一句中文，这里立刻抛错。
 * 内容可以慢慢补，但绝不能带着缺口发布 —— 学生会在学习卡第二屏看到空白。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createHash } = require('node:crypto');
const { DATES } = require('./adapters');

const vocab = require('./vocab.generated.json');
const contextTranslations = require('../context-translations-week2.js');

const digest = (sentence) => createHash('sha256').update(sentence, 'utf8').digest('hex');

/**
 * 档位模块 = 本目录下**导出了 `LEVEL` 和 `DAYS`** 的那些 .js。
 *
 * 原来是维护一份「基础设施文件」黑名单，结果每加一个辅助文件（适配器、
 * 人工复核表）都得记得同步两处，忘一次就把它当成档位模块 require 进来，
 * 报一个 `mod.DAYS is undefined`。按接口认比按文件名认稳。
 */
function levelModules() {
  return fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.js') && f !== 'index.js')
    .sort()
    .map((f) => require(path.join(__dirname, f)))
    .filter((mod) => typeof mod.LEVEL === 'string' && Array.isArray(mod.DAYS));
}

function wordsFor(level, source) {
  const rows = vocab[level]?.[source];
  if (!rows || !rows.length) throw new Error(`缺词表：${level} / ${source}（先跑 build-week2-vocab.js）`);
  return rows.map((w) => {
    const contextTranslation = contextTranslations[digest(w.context)];
    if (!contextTranslation || !/[㐀-鿿]/u.test(contextTranslation)) {
      throw new Error(`缺例句中文：${level} / ${source} / ${w.headword}`);
    }
    return { ...w, contextTranslation };
  });
}

/** 五档的首发周内容。key 就是 `EnglishLevel` 枚举值。 */
const LEVELS = {};
for (const mod of levelModules()) {
  LEVELS[mod.LEVEL] = mod.DAYS.map((day) => {
    const { source, ...rest } = day;
    return { ...rest, words: wordsFor(mod.LEVEL, source), source };
  });
}

module.exports = { LEVELS, DATES };
