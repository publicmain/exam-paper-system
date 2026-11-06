// 文章点词释义（article gloss）的切词与归一规则 —— 唯一口径。
// 2026-11-06 叶老师定：学生可见内容只用 GPT 写、审过的；阅读点词不再显示词典原文。
// 内容侧（GPT 写释义、check.js 查覆盖）和 API 侧（查词时按这个口径找释义）必须用同一套规则；
// API 里的 TS 实现有测试逐篇对照本文件的输出。
'use strict';

/** 学生点到的原始词 → 释义表里的键。小写；弯引号归直；去首尾标点；去所有格 's。 */
function glossKey(raw) {
  let w = String(raw == null ? '' : raw).normalize('NFKC').replace(/[‘’ʼ]/g, "'").toLowerCase().trim();
  w = w.replace(/^[^a-z]+|[^a-z]+$/g, '');
  if (w.endsWith("'s")) w = w.slice(0, -2);
  else if (w.endsWith("s'")) w = w.slice(0, -1);
  return w;
}

const WORD_RE = /[A-Za-z]+(?:['’][A-Za-z]+)*(?:-[A-Za-z]+(?:['’][A-Za-z]+)*)*/g;

/** 一篇文章正文里学生能点到的全部键（去重、按首次出现排序）。连字符词：整词和每一段都算。 */
function articleTokens(passage) {
  const text = String(passage == null ? '' : passage).replace(/^Paragraph \d+\s*$/gm, ' ');
  const seen = new Set();
  const out = [];
  const add = (k) => { if (k && k.length >= 1 && !seen.has(k)) { seen.add(k); out.push(k); } };
  for (const m of text.matchAll(WORD_RE)) {
    const whole = glossKey(m[0]);
    add(whole);
    if (whole.includes('-')) for (const part of whole.split('-')) add(glossKey(part));
  }
  return out;
}

module.exports = { glossKey, articleTokens, WORD_RE };
