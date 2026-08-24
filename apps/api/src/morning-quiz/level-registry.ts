import type { EnglishLevel } from '@prisma/client';

/**
 * 英语等级注册表 —— 对外显示名与题库桶的**唯一事实来源**。
 *
 * 为什么需要这张表：枚举名是历史包袱，和实际含义已经对不上。
 * `ielts_simplified` 这个位置原本是「轻雅思」，2026-07-24 停用，
 * 2026-08-14 起装的是「O-Level 基础」的内容。库里挂着几个月的场次、
 * 答卷、考勤，重命名要回填全部历史行，风险远大于收益 —— 所以枚举名
 * 冻结，语义靠这张表表达。
 *
 * **任何地方都不要硬编码等级的中文名**。硬编码过一次就会散落到面板、
 * 导出、家长端、通知文案里，下次语义再变时必然漏改。
 */

export type LevelBucket =
  | 'ielts_authentic'
  | 'ielts_light'
  | 'olevel_standard'
  | 'olevel_simplified'
  | 'olevel_basic';

export interface LevelMeta {
  /** 对外显示名（学生 / 老师 / 家长看到的） */
  label: string;
  /** 题库桶 —— picker 据此决定从哪抽卷 */
  bucket: LevelBucket;
  /** 由难到易的展示顺序 */
  order: number;
  /** 一句话说明，用于配置页和面板的 tooltip */
  hint: string;
  /** 建场时是否自动推送配套词表（短文层才有） */
  pushesWordlist: boolean;
}

export const LEVEL_REGISTRY: Record<EnglishLevel, LevelMeta> = {
  ielts_authentic: {
    label: '雅思真题',
    bucket: 'ielts_authentic',
    order: 1,
    hint: '剑桥雅思原文，700–900 词、13–14 题',
    pushesWordlist: false,
  },
  ielts_light: {
    label: '雅思轻量',
    bucket: 'ielts_light',
    order: 2,
    hint: '250–350 词短文 + 6 题（判断 3 + 填空 3）+ 词汇',
    pushesWordlist: true,
  },
  olevel: {
    label: 'O-Level 标准',
    bucket: 'olevel_standard',
    order: 3,
    hint: '§B 记叙文，440–650 词、14 题 19 分',
    pushesWordlist: false,
  },
  olevel_intermediate: {
    label: 'O-Level 进阶',
    bucket: 'olevel_simplified',
    order: 4,
    hint: '中等长度记叙文，500–790 词、11 题',
    pushesWordlist: false,
  },
  ielts_simplified: {
    label: 'O-Level 基础',
    bucket: 'olevel_basic',
    order: 5,
    hint: '精简短文 + 5 题 + 词汇训练',
    pushesWordlist: true,
  },
};

/** 显示名。未知等级回落到枚举名本身，绝不抛异常 —— 面板不能因为多了
 *  一个没登记的等级就整页白屏。 */
export function levelLabel(level: string): string {
  return (LEVEL_REGISTRY as Record<string, LevelMeta>)[level]?.label ?? level;
}

export function levelBucket(level: EnglishLevel): LevelBucket {
  return LEVEL_REGISTRY[level].bucket;
}

/** 由难到易排序，用于配置页 / 面板列表 */
export function levelsByOrder(): EnglishLevel[] {
  return (Object.keys(LEVEL_REGISTRY) as EnglishLevel[]).sort(
    (a, b) => LEVEL_REGISTRY[a].order - LEVEL_REGISTRY[b].order,
  );
}

/** 这一层建场时要不要自动推送配套词表 */
export function levelPushesWordlist(level: EnglishLevel): boolean {
  return LEVEL_REGISTRY[level]?.pushesWordlist === true;
}
