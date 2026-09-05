/**
 * 词条显示的三处清洁（2026-09-05 盲测 P2-9 / P2-10 / P2-11）。
 *
 * 词典数据来自 ECDICT，原样显示有三个毛病：音标里混着西里尔字母 ә、有的带
 * 斜杠有的不带；词性没识别出来时是字符串 `other`，被当成标签打了出来
 * （「other. n. 大灾难」）；中文释义里带 `[化]`「[计]」这类专业义项，中学生
 * 用不上。这里统一在**显示层**清一遍，数据不动。
 */

/** 音标：统一成 /…/，修掉 ECDICT 里的西里尔 ә 与老式记号。 */
export function formatPhonetic(raw: string | null | undefined): string | null {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  s = s
    .replace(/ә/g, 'ə') // 西里尔 ә → 拉丁 ə
    .replace(/ə/g, 'ə')
    .replace(/[\[\]/]/g, '') // 去掉原有的 / 与 [ ]，下面统一加
    .replace(/'/g, 'ˈ') // 老式重音记号 ' → ˈ
    .replace(/\s+/g, ' ')
    .trim();
  return s ? `/${s}/` : null;
}

const POS_LABEL: Readonly<Record<string, string>> = {
  noun: 'n.',
  verb: 'v.',
  adjective: 'adj.',
  adverb: 'adv.',
  preposition: 'prep.',
  conjunction: 'conj.',
  pronoun: 'pron.',
  interjection: 'int.',
};

/** 词性标签：认识的翻成 n. / v. / adj.；`other` 或空 → 不显示。 */
export function posLabel(pos: string | null | undefined): string | null {
  const key = String(pos ?? '').trim().toLowerCase();
  if (!key || key === 'other') return null;
  if (POS_LABEL[key]) return POS_LABEL[key];
  // 已经是 "n." / "vt." 这类缩写就原样用
  if (/^[a-z]{1,5}\.?$/.test(key)) return key.endsWith('.') ? key : `${key}.`;
  return null;
}

/** 释义已经自带「n. …」这样的开头时，不再在前面重复一个词性标签。 */
export function posPrefixFor(pos: string | null | undefined, translation: string | null | undefined): string {
  const label = posLabel(pos);
  if (!label) return '';
  const text = String(translation ?? '').trimStart();
  return /^[a-z]{1,5}\.\s/i.test(text) ? '' : `${label} `;
}

const DOMAIN_TAG = /^\s*[\[【][^\]】]{1,6}[\]】]/;

/**
 * 中文释义：按行拆，去掉带专业领域标记（[化] [计] [医] …）的行；
 * 全是专业行时保留原文，别把释义清空。
 */
export function cleanTranslation(raw: string | null | undefined): string {
  const text = String(raw ?? '').replace(/\\n/g, '\n').trim();
  if (!text) return '';
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const kept = lines.filter((line) => !DOMAIN_TAG.test(line));
  return (kept.length ? kept : lines).join('\n');
}
