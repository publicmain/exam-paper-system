/**
 * 学生允许自己选择的五档难度，以及两个归一函数。
 *
 * ## 为什么是白名单，而不是直接用 `EnglishLevel` 枚举
 *
 * 这里必须覆盖 `EnglishLevel` 的五个值。过去为了赶三档试点，把
 * `ielts_light` 与 `olevel_intermediate` 从注册白名单里删掉，造成迁移后
 * 的学生端比原系统少两档；更糟的是客户端又把剩下的枚举写成了错误中文名。
 * 五档的对外语义以 `LEVEL_REGISTRY` 为准，客户端有契约测试逐项对齐。
 *
 * 顺序有意义：从易到难，界面按这个顺序排。
 */

/** 从易到难；注册页与账号设置都按这个顺序展示。 */
export const PILOT_LEVELS = [
  'ielts_simplified',
  'olevel_intermediate',
  'olevel',
  'ielts_light',
  'ielts_authentic',
] as const;

export type PilotLevel = (typeof PILOT_LEVELS)[number];

export function isPilotLevel(v: unknown): v is PilotLevel {
  return typeof v === 'string' && (PILOT_LEVELS as readonly string[]).includes(v);
}

/**
 * 这一档，学生所在的班今天开着没有。
 *
 * 白名单只回答「学生能不能选」，这个函数回答「选了有没有东西上」。
 * 两道闸都要过 —— 少任何一道，学生都可能落进一天空白。
 */
export function levelOffered(level: string, offered: readonly string[]): boolean {
  return offered.includes(level);
}

/**
 * 姓名归一 —— **只用于比较**，不是用来落库的。
 *
 * 落库存学生自己写的样子（去掉首尾空白、并掉中间的连续空白）；比较时
 * 再降到小写。`Amy Tan` / `amy  tan` 在同一个班里是同一个人 —— 否则两个
 * 人各注册一个号，教师看到两行、成绩分两半。
 */
export function normalizeName(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** 落库用的显示名：去首尾、并连续空白，**保留大小写**。 */
export function displayName(raw: string): string {
  return String(raw ?? '').trim().replace(/\s+/g, ' ');
}

/** 班级码归一 —— 学生会连着空格粘贴，也会打小写。 */
export function normalizeClassCode(raw: string): string {
  return String(raw ?? '').trim().toUpperCase();
}
