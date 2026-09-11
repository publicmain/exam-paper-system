/**
 * 第三周（2026-09-14 起）内容包的装配。
 *
 * 从这一周起**全部原创**：题库里「从没发给学生过」的文章在首发周用完了。
 * 每个档位模块用 `../authored.js` 把一整天写明，这里只注入词表和例句中文：
 *
 *   · 词表来自 `vocab.generated.json`
 *     （`node ../../build-week2-vocab.js --week=week3 --csv <ecdict.csv>`）；
 *   · 例句中文来自 `../context-translations-week3.js`
 *     （`build-week2-context-translations.js --week=week3`，Azure，全自动）。
 *
 * 两处都 fail closed：少一天的词表、少一句中文，这里立刻抛错。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { createHash } = require('node:crypto');
const { DATES } = require('./dates');

const vocab = require('./vocab.generated.json');
const contextTranslations = require('../context-translations-week3.js');

const digest = (sentence) => createHash('sha256').update(sentence, 'utf8').digest('hex');

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
  if (!rows || !rows.length) throw new Error(`缺词表：${level} / ${source}（先跑 build-week2-vocab.js --week=week3）`);
  return rows.map((w) => {
    const contextTranslation = contextTranslations[digest(w.context)];
    if (!contextTranslation || !/[㐀-鿿]/u.test(contextTranslation)) {
      throw new Error(`缺例句中文：${level} / ${source} / ${w.headword}`);
    }
    return { ...w, contextTranslation };
  });
}

const LEVELS = {};
for (const mod of levelModules()) {
  LEVELS[mod.LEVEL] = mod.DAYS.map((day) => ({ ...day, words: wordsFor(mod.LEVEL, day.source) }));
}

module.exports = { LEVELS, DATES };
