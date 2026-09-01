/**
 * 五档难度**写给学生看的样子**。
 *
 * 内部标识（`olevel` / `ielts_simplified` / `ielts_authentic`）只在请求
 * 体里出现，界面上一个都不露 —— 一个十五岁的人不该靠猜内部枚举来决定
 * 自己上哪一层。
 *
 * 这个列表必须和服务端的白名单逐字一致；
 * `src/__tests__/contract.test.ts` 里有一条守卫直接读服务端那个文件比对。
 */

export type PilotLevelId =
  | 'ielts_simplified'
  | 'olevel_intermediate'
  | 'olevel'
  | 'ielts_light'
  | 'ielts_authentic';

export interface PilotLevelChoice {
  id: PilotLevelId;
  /** 主标签 —— 学生看到的就是这个。 */
  label: string;
  /** 一句话说清「这一档是给谁的」。 */
  blurb: string;
}

/** 从易到难。界面按这个顺序排，不重新排序。 */
export const PILOT_LEVEL_CHOICES: readonly PilotLevelChoice[] = [
  {
    id: 'ielts_simplified',
    label: 'O-Level 基础',
    blurb: '精简短文和基础题型，适合先建立完整阅读习惯。拿不准可以从这一档开始。',
  },
  {
    id: 'olevel_intermediate',
    label: 'O-Level 进阶',
    blurb: '文章更长、推理更多，适合已经能稳定完成基础阅读的人。',
  },
  {
    id: 'olevel',
    label: 'O-Level 标准',
    blurb: '按 O-Level 标准阅读强度训练，包含理解、推断和语言效果题。',
  },
  {
    id: 'ielts_light',
    label: '雅思轻量',
    blurb: '保留雅思题型，但篇幅和词汇负担较轻，适合开始接触雅思阅读。',
  },
  {
    id: 'ielts_authentic',
    label: '雅思 · 真题型',
    blurb: '长文章、真题难度的题型和词汇。适合已经能整篇读下来、想练速度的人。',
  },
];

export function levelLabel(id: string | null | undefined): string | null {
  return PILOT_LEVEL_CHOICES.find((c) => c.id === id)?.label ?? null;
}
