/**
 * 发布前的拼写 / 语法检查：文章、题干、选项、参考答案（2026-09-11）。
 *
 *   npx ts-node apps/api/scripts/content/lint-language.ts --week=week3 [--level=olevel]
 *
 * 用 LanguageTool —— 学生端写作自查用的是同一个引擎。生产上那台在 Railway
 * 内网里，本机连不到，所以默认打公共接口 `api.languagetool.org`（免费、限速
 * 每分钟 20 次；一周十篇、每篇一次请求，远低于限额）。发出去的只有**我们自己
 * 写的内容**，没有任何学生数据。设了 `LANGUAGETOOL_URL` 就改用那台。
 *
 * 只报拼写和语法，不报风格 —— 与学生端同一口径（STYLE / TYPOGRAPHY 关掉）。
 * 人名地名（Mei Ling、Toa Payoh、Shollenberger）会被当成拼错，脚本把原文里
 * 句中大写出现过的词当专名跳过。
 */
import * as fs from 'fs';
import * as path from 'path';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const WEEK = arg('week') ?? 'week3';
const ONLY = arg('level');
const DIR = path.resolve(__dirname, '..', 'pilot', 'content', WEEK);
const BASE = (process.env.LANGUAGETOOL_URL || 'https://api.languagetool.org').replace(/\/$/, '').replace(/\/v2$/, '');

type Q = { stem: string; answer: string; options: Array<{ text: string }> | null; questionType: string };
type Day = { date: string; title: string; passage: string; questions: Q[] };

/** 句中大写出现过的词 —— 当专名，拼写检查不报它们。 */
function properNouns(text: string): Set<string> {
  const out = new Set<string>();
  // \p{Lu}\p{Ll}：Conté 这种带重音的名字也要认得
  for (const m of text.matchAll(/(?<=[\p{Ll},;:]\s)(\p{Lu}\p{Ll}+(?:[- ]\p{Lu}\p{Ll}+)*)/gu)) {
    for (const part of m[1].split(/[- ]/)) out.add(part);
  }
  return out;
}

/**
 * 第一次跑第三周时逐条人工看过、确认是**误报**的规则 —— 默认关掉，
 * 免得每次都要重新翻一遍（2026-09-11，38 条里 0 条真错）：
 *
 *   · 连续三句以同一个词开头：第一人称记叙文里「I … I … I」是刻意的；
 *   · 引导语后面「可能缺逗号」：英式英语短引导语不加逗号是常规；
 *   · 牛津拼写 -ize：en-GB 的 -ise 同样正确；
 *   · inter-school 连字符：新加坡通行写法。
 */
const NOISE_RULES = [
  'ENGLISH_WORD_REPEAT_BEGINNING_RULE',
  'MISSING_COMMA_AFTER_INTRODUCTORY_PHRASE',
  'SENT_START_CONJUNCTIVE_LINKING_ADVERB_COMMA',
  'OXFORD_SPELLING_Z_NOT_S',
  'PRP_COMMA',
  'COMMA_COMPOUND_SENTENCE',
  'EN_COMPOUNDS_INTER_SCHOOL',
];

/** 词典里没有、但确实是正确英文的专业词。 */
const ALLOW = new Set(['wingtip', 'wingtips', 'wingbeat', 'wingbeats']);

async function check(text: string) {
  const body = new URLSearchParams({
    text,
    language: 'en-GB',
    disabledCategories: 'STYLE,TYPOGRAPHY,CASING,REDUNDANCY',
    disabledRules: NOISE_RULES.join(','),
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(`${BASE}/v2/check`, { method: 'POST', body });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 15_000));
      continue;
    }
    if (!res.ok) throw new Error(`LanguageTool ${res.status}`);
    return (await res.json()) as {
      matches: Array<{ offset: number; length: number; message: string; rule: { id: string; issueType: string }; replacements: Array<{ value: string }> }>;
    };
  }
  throw new Error('LanguageTool 一直限流');
}

(async () => {
  const modules = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.js') && !['index.js'].includes(f))
    .sort()
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    .map((f) => require(path.join(DIR, f)))
    .filter((m) => typeof m.LEVEL === 'string' && Array.isArray(m.DAYS))
    .filter((m) => !ONLY || m.LEVEL === ONLY);

  let total = 0;
  for (const mod of modules) {
    for (const day of mod.DAYS as Day[]) {
      const passage = day.passage.replace(/^Paragraph \S+\s*/gm, '');
      const parts = [
        passage,
        ...day.questions.map((q) => q.stem.split('\n').pop() ?? q.stem),
        ...day.questions.flatMap((q) => (q.questionType === 'mcq' ? (q.options ?? []).map((o) => o.text) : [q.answer])),
      ];
      const text = parts.join('\n\n');
      const names = properNouns(passage);
      const { matches } = await check(text);
      const real = matches.filter((m) => {
        const hit = text.slice(m.offset, m.offset + m.length);
        if (m.rule.issueType === 'misspelling' && hit.split(/[- ]/).every((w) => names.has(w))) return false;
        if (m.rule.issueType === 'misspelling' && ALLOW.has(hit.toLowerCase())) return false;
        return true;
      });
      total += real.length;
      console.log(`${real.length ? '✗' : '✓'} ${mod.LEVEL.padEnd(20)} ${day.date}  ${day.title}`);
      for (const m of real) {
        const hit = text.slice(m.offset, m.offset + m.length);
        const around = text.slice(Math.max(0, m.offset - 30), m.offset + m.length + 30).replace(/\s+/g, ' ');
        const fix = m.replacements.slice(0, 3).map((r) => r.value).join(' / ');
        console.log(`    「${hit}」${fix ? ` → ${fix}` : ''}  [${m.rule.id}] ${m.message}\n      …${around}…`);
      }
      // 公共接口限速：两次请求之间留三秒
      if (!process.env.LANGUAGETOOL_URL) await new Promise((r) => setTimeout(r, 3_000));
    }
  }
  console.log(total ? `\n共 ${total} 处，逐条看：真错就改，误报就忽略。` : '\n没有拼写或语法问题。');
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
