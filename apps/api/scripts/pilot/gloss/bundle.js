'use strict';

const fs = require('fs');
const path = require('path');
const { articleTokens } = require('./tokens');
const { weekForDay } = require('../visible-fingerprint');
const CONTENT_ROOT = path.join(__dirname, '..', 'content');

// 不改 tokens.js / check.js；覆盖与字段有效性沿用 check.js 的原规则。
const CJK = /[一-鿿]/;
const POS_OK = /^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.|num\.|int\.|aux\.|det\.|phr\.|名)$/;
function levelGlossProblems(level, days, data) {
  const problems = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [`${level}：释义文件必须是对象`];
  const sources = new Set(days.map((day) => day.source));
  for (const key of Object.keys(data)) if (!sources.has(key)) problems.push(`${level}：多出来的文章键 ${key}（内容包里没有）`);
  for (const day of days) {
    const label = `${level} ${day.date} ${day.source}（${day.title}）`;
    const glosses = data[day.source]?.glosses;
    if (!glosses || typeof glosses !== 'object' || Array.isArray(glosses)) { problems.push(`${label}：没有 glosses`); continue; }
    const tokens = articleTokens(day.passage);
    for (const token of tokens) {
      const entry = Object.prototype.hasOwnProperty.call(glosses, token) ? glosses[token] : null;
      if (!entry) { problems.push(`${label}：缺「${token}」`); continue; }
      if (typeof entry.zh !== 'string' || !entry.zh.trim() || !CJK.test(entry.zh)) problems.push(`${label}「${token}」zh 不是中文`);
      else if (entry.zh.length > 24) problems.push(`${label}「${token}」zh 太长（${entry.zh.length} 字，上限 24）`);
      if (typeof entry.pos !== 'string' || !POS_OK.test(entry.pos)) problems.push(`${label}「${token}」pos 不合规：${JSON.stringify(entry.pos)}`);
      if (entry.lemma != null && (typeof entry.lemma !== 'string' || !/^[a-z][a-z' -]*$/.test(entry.lemma))) problems.push(`${label}「${token}」lemma 不合规：${JSON.stringify(entry.lemma)}`);
    }
    const tokenSet = new Set(tokens);
    const extra = Object.keys(glosses).filter((key) => !tokenSet.has(key));
    if (extra.length) problems.push(`${label}：多出 ${extra.length} 个正文里没有的键：${extra.join(', ')}`);
  }
  return problems;
}

/** 一旦有目录，必须全周全档通过，不能只检查正在发布的那一天。 */
function loadWeekGlosses(week, root = CONTENT_ROOT) {
  if (!/^week\d+$/.test(week)) throw new Error(`不合法的周目录：${week}`);
  const dir = path.join(root, week);
  if (!fs.existsSync(path.join(dir, 'glosses'))) return null;
  const pack = require(path.join(dir, 'index.js'));
  const levels = pack.LEVELS || pack;
  const data = {};
  const problems = [];
  for (const [level, days] of Object.entries(levels)) {
    const file = path.join(dir, 'glosses', `${level}.json`);
    try {
      data[level] = JSON.parse(fs.readFileSync(file, 'utf8'));
      problems.push(...levelGlossProblems(level, days, data[level]));
    } catch (error) {
      problems.push(`${week} ${level}：无法读取 ${file}（${error.code || error.name}）`);
    }
  }
  if (problems.length) throw new Error(`点词释义门禁未通过：\n${problems.join('\n')}`);
  return { levels, data };
}

function wordGlossesFor(level, lesson, root = CONTENT_ROOT) {
  const week = weekForDay(lesson.date, root);
  if (!week) return undefined;
  const bundle = loadWeekGlosses(week, root);
  if (!bundle) return undefined;
  const entry = bundle.data[level]?.[lesson.source];
  if (!entry) throw new Error(`${week} ${level} ${lesson.date} ${lesson.source}：没有 glosses`);
  return entry.glosses;
}

function articleGlossReviewLines(glosses) {
  return [
    `--- 文章点词释义（${Object.keys(glosses).length} 个）`,
    ...Object.entries(glosses).map(([key, entry]) => `${key} → ${entry.pos} ${entry.zh}${entry.lemma ? `（lemma: ${entry.lemma}）` : ''}`),
  ];
}

module.exports = { CONTENT_ROOT, levelGlossProblems, loadWeekGlosses, wordGlossesFor, articleGlossReviewLines };
