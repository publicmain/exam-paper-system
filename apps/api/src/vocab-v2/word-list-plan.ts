/**
 * 老师词表 → 一周计划：纯函数部分（清洗、排天、按词性分配）。
 *
 * 由 `scripts/vocab-v2/publish-word-list.ts` 调用。放在 src 里是为了让
 * vitest 能测；这里不碰数据库。
 *
 * 口径（2026-09-05 与叶老师定的）：
 *   · 每天 5–20 个，默认往 10 个/天凑：12 个词 → 周一周二各 6 个，
 *     其余三天回到档位词表；37 个 → 四天 10/9/9/9；最多一周 100 个。
 *   · 词表外的词允许；
 *   · 按词性混排，免得某天全是名词、词测全是拼写题；
 *   · `*` 开头或行尾 `!` 的词是 force —— 见过的学生也照推。
 */

export interface ParsedWord {
  headword: string;
  force: boolean;
  /** 老师原文里的备注（逗号 / 制表符后面的内容），只回显不入库。 */
  note: string | null;
  line: number;
}

export interface ParseResult {
  words: ParsedWord[];
  rejected: Array<{ line: number; raw: string; reason: string }>;
  duplicates: Array<{ line: number; headword: string }>;
}

/** 一行一个词；`# 注释`；`word, 备注`；`*word` 或 `word!` = force。 */
export function parseWordList(text: string): ParseResult {
  const words: ParsedWord[] = [];
  const rejected: ParseResult['rejected'] = [];
  const duplicates: ParseResult['duplicates'] = [];
  const seen = new Map<string, number>();
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((rawLine, index) => {
    const line = index + 1;
    const raw = rawLine.trim();
    if (!raw || raw.startsWith('#')) return;
    const [head, ...rest] = raw.split(/[,\t，]/);
    const note = rest.join(',').trim() || null;
    let token = head.trim();
    let force = false;
    if (token.startsWith('*')) { force = true; token = token.slice(1); }
    if (token.endsWith('!')) { force = true; token = token.slice(0, -1); }
    // 去掉序号（"1. word" / "1) word"）与首尾标点
    token = token.replace(/^\d+[.)]\s*/, '').replace(/^[^A-Za-z]+|[^A-Za-z'-]+$/g, '').trim().toLowerCase();
    if (!token) { rejected.push({ line, raw, reason: '空' }); return; }
    if (!/^[a-z][a-z'-]*[a-z]$|^[a-z]$/.test(token)) { rejected.push({ line, raw, reason: '只收单个英文单词（字母、连字符、撇号）' }); return; }
    if (token.length > 40) { rejected.push({ line, raw, reason: '太长' }); return; }
    const first = seen.get(token);
    if (first != null) { duplicates.push({ line, headword: token }); return; }
    seen.set(token, line);
    words.push({ headword: token, force, note, line });
  });
  return { words, rejected, duplicates };
}

export const MIN_PER_DAY = 5;
export const MAX_PER_DAY = 20;
export const MAX_TEACHING_DAYS = 5;
export const DEFAULT_PER_DAY = 10;

/** 给 `total` 个词分几天、每天几个。返回每天的个数（长度 = 用到的天数）。 */
export function dayQuotas(total: number, perDay: number | 'auto' = 'auto'): number[] {
  if (total <= 0) return [];
  const target = perDay === 'auto' ? DEFAULT_PER_DAY : Math.max(MIN_PER_DAY, Math.min(MAX_PER_DAY, Math.floor(perDay)));
  let days = Math.min(MAX_TEACHING_DAYS, Math.max(1, Math.ceil(total / target)));
  if (Math.ceil(total / days) > MAX_PER_DAY) {
    throw new Error(`一周装不下：${total} 个词，每天最多 ${MAX_PER_DAY} 个 × ${MAX_TEACHING_DAYS} 天 = ${MAX_PER_DAY * MAX_TEACHING_DAYS}`);
  }
  // 不到 5 个/天就少用几天，别把 7 个词摊成 2/2/1/1/1。
  while (days > 1 && Math.floor(total / days) < MIN_PER_DAY) days -= 1;
  const base = Math.floor(total / days);
  const extra = total % days;
  return Array.from({ length: days }, (_, i) => base + (i < extra ? 1 : 0));
}

/** 周一 → 该周的教学日（周一到周五）。传进来的不是周一就报错，免得发错周。 */
export function teachingDaysOfWeek(mondayKey: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mondayKey)) throw new Error(`周次要写周一的日期 YYYY-MM-DD，收到「${mondayKey}」`);
  const monday = new Date(`${mondayKey}T00:00:00.000Z`);
  if (Number.isNaN(monday.getTime())) throw new Error(`不是合法日期：${mondayKey}`);
  if (monday.getUTCDay() !== 1) throw new Error(`${mondayKey} 不是周一`);
  return Array.from({ length: MAX_TEACHING_DAYS }, (_, i) => new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10));
}

const POS_ORDER = ['noun', 'verb', 'adjective', 'adverb'];

/**
 * 按词性混排分到各天。
 *
 * 做法：每种词性各自排成一队（保持老师给的顺序），把各队按比例均匀
 * 撒进一条总序列（9 个名词 + 3 个动词 → 动词落在 1/6、1/2、5/6 处），
 * 再按每天的配额顺着切段。这样每天都有各种词性，天内顺序也和老师给的
 * 大体一致。简单的轮流发牌不行 —— 四种词性对两天，会锁死成
 * 「周一全是名词形容词、周二全是动词副词」。
 */
export function distributeByPos<T extends { headword: string; pos: string }>(words: readonly T[], quotas: readonly number[]): T[][] {
  const days: T[][] = quotas.map(() => []);
  if (!days.length) return days;
  const capacity = quotas.reduce((sum, quota) => sum + quota, 0);
  if (capacity < words.length) throw new Error('配额比词少');
  const groups = new Map<string, T[]>();
  for (const word of words) {
    const key = POS_ORDER.includes(word.pos) ? word.pos : 'other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(word);
  }
  const total = words.length;
  const placed: Array<{ word: T; at: number; group: number }> = [];
  [...POS_ORDER, 'other'].filter((key) => groups.has(key)).forEach((key, groupIndex) => {
    const group = groups.get(key)!;
    group.forEach((word, index) => {
      placed.push({ word, at: ((index + 0.5) / group.length) * total, group: groupIndex });
    });
  });
  placed.sort((a, b) => a.at - b.at || a.group - b.group);
  let cursor = 0;
  quotas.forEach((quota, dayIndex) => {
    days[dayIndex] = placed.slice(cursor, cursor + quota).map((entry) => entry.word);
    cursor += quota;
  });
  return days;
}
