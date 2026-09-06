/**
 * 词条显示的三处清洁（2026-09-05 盲测 P2-9 / P2-10 / P2-11）。
 *
 * 词典数据来自 ECDICT，原样显示有三个毛病：音标里混着西里尔字母 ә、有的带
 * 斜杠有的不带；词性没识别出来时是字符串 `other`，被当成标签打了出来
 * （「other. n. 大灾难」）；中文释义里带 `[化]`「[计]」这类专业义项，中学生
 * 用不上。这里统一在**显示层**清一遍，数据不动。
 */

/**
 * 音标：统一成 /…/。
 *
 * ECDICT 用的是老式 Jones 记号（ә、ә:、ei、ai、i、u、ɔ …），课本用的是新式
 * IPA（ə、ɜː、eɪ、aɪ、ɪ、ʊ、ɒ …）。看到老式标记（西里尔 ә、冒号长音、
 * 撇号重音）就整套转成新式（2026-09-06 第五轮盲测 16：germinate 显示成
 * /ˈdʒəːmineit/，课本是 /ˈdʒɜːmɪneɪt/）。剑桥式的新式音标不动。
 */
export function formatPhonetic(raw: string | null | undefined): string | null {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  // 老式标记：西里尔 ә、冒号长音、撇号重音，或老式双元音 ei / ai / ɔi / au / ou（新式写 eɪ / aɪ …）
  const oldStyle = /[ә:']|ei|ai|ɔi|au|ou|[εɛ]ə/.test(s); // iə / uə 新式里也会出现（rɪˈzɪliənt），不当标记
  s = s
    .replace(/ә/g, 'ə') // 西里尔 ә → 拉丁 ə
    .replace(/[\[\]/]/g, '') // 去掉原有的 / 与 [ ]，下面统一加
    .replace(/'/g, 'ˈ') // 老式重音记号 ' → ˈ
    .replace(/:/g, 'ː') // 老式长音 : → ː
    .replace(/(?<=[^\s])\.(?=[^\s])/g, '') // 剑桥式音节点 ˈsɪl.vər → ˈsɪlvər，两套数据看起来一样
    .replace(/\s+/g, ' ')
    .trim();
  if (oldStyle) s = jonesToIpa(s);
  return s ? `/${s}/` : null;
}

/** 老式 Jones 记号 → 新式 IPA。先处理双元音和长音，再换剩下的短元音。 */
function jonesToIpa(s: string): string {
  return s
    .replace(/əː/g, 'ɜː')
    .replace(/aː/g, 'ɑː')
    .replace(/ei/g, 'eɪ')
    .replace(/ai/g, 'aɪ')
    .replace(/ɔi/g, 'ɔɪ')
    .replace(/au/g, 'aʊ')
    .replace(/əu/g, 'əʊ')
    .replace(/ou/g, 'əʊ')
    .replace(/iə/g, 'ɪə')
    .replace(/[εɛ]ə/g, 'eə')
    .replace(/uə/g, 'ʊə')
    // 短 i / u 只在后面跟辅音时换成 ɪ / ʊ；词尾的 i（happy、catastrophe）
    // 新式音标也写 i，不动。iː / uː 不动。
    .replace(/i(?![ːaeiouəɜɑæʌɒɔʊɪ\s]|$)/g, 'ɪ')
    .replace(/u(?![ːaeiouəɜɑæʌɒɔʊɪ\s]|$)/g, 'ʊ')
    .replace(/ɔ(?!ː|ɪ)/g, 'ɒ'); // 短 ɔ → ɒ
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
  // ECDICT 的 a. / ad. 中学生看不懂（2026-09-06 第五轮盲测 15）
  if (key === 'a' || key === 'a.') return 'adj.';
  if (key === 'ad' || key === 'ad.') return 'adv.';
  // 已经是 "n." / "vt." 这类缩写就原样用
  if (/^[a-z]{1,5}\.?$/.test(key)) return key.endsWith('.') ? key : `${key}.`;
  return null;
}

/** 释义已经自带「n. …」这样的开头时，不再在前面重复一个词性标签。 */
export function posPrefixFor(pos: string | null | undefined, translation: string | null | undefined): string {
  const label = posLabel(pos);
  if (!label) return '';
  const text = String(translation ?? '').trimStart();
  return /^[a-z]{1,7}\.\s/i.test(text) ? '' : `${label} `;
}

const DEF_POS: Readonly<Record<string, string>> = {
  a: 'adj.', s: 'adj.', adj: 'adj.', n: 'n.', v: 'v.', vi: 'vi.', vt: 'vt.', r: 'adv.', adv: 'adv.',
  prep: 'prep.', conj: 'conj.', pron: 'pron.', int: 'int.',
};

/**
 * 英文释义（ECDICT / WordNet 原样）：每行开头是 "a." "s." "n" "v" "r" 这类缩写，
 * 中学生看不懂（2026-09-06 第五轮复测 15）。按行换成 adj. / n. / v. / adv.；
 * 行与行之间保留换行，显示层用 whitespace-pre-wrap。
 */
export function cleanDefinition(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/\\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.replace(/^([a-z]{1,4})\.?\s+(?=\S)/i, (m, p: string) => {
        const k = p.toLowerCase();
        return DEF_POS[k] ? `${DEF_POS[k]} ` : m;
      }),
    )
    .join('\n');
}

const DOMAIN_TAG = /^\s*[\[【][^\]】]{1,6}[\]】]/;

/**
 * 中文释义：按行拆，去掉带专业领域标记（[化] [计] [医] …）的行；
 * 全是专业行时保留原文，别把释义清空。
 */
export function cleanTranslation(raw: string | null | undefined): string {
  const text = String(raw ?? '').replace(/\\n/g, '\n').trim();
  if (!text) return '';
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    // 行首的 a. / ad. 换成学生认识的 adj. / adv.（2026-09-06 第五轮盲测 15）
    .map((line) => line.replace(/^a\.\s*/, 'adj. ').replace(/^ad\.\s*/, 'adv. '));
  const kept = lines.filter((line) => !DOMAIN_TAG.test(line));
  return (kept.length ? kept : lines).join('\n');
}
