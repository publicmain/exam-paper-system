import { ServiceUnavailableException } from '@nestjs/common';

/**
 * 产品升级新增模块的开关（2026-09-15，提示词 §13.2）。
 *
 * 规矩：「模块可关闭，**服务端也限制访问与写入**；开关不是仅隐藏按钮」。
 * 所以每个新模块的服务方法第一行都先 `assertModuleEnabled(...)`，关着就在任何
 * 读写之前回 503 `module_off`；学生端 / 教师端再按 `/product/modules` 决定显不显示入口。
 *
 * 用环境变量而不是改代码：出问题时在 Railway 上改一个变量、重启就能关，不用发版。
 *
 *   PRODUCT_MODULES_OFF=achievements      紧急关闭徽章读写
 *   PRODUCT_MODULES_ON=class_goal         仅独立授权后开放已实现的可选模块
 *
 * 本次独立发布仅 achievements 默认打开。未发布的其它升级模块保持关闭，
 * 不能因为本地演示曾启用而自动进入生产。
 *
 * 这些模块都不在每日三项主线里：它们全关时，注册、阅读、学词、词测、判分照常。
 */
export const PRODUCT_MODULES = [
  /** F03 阅读证据教练 + 内容反馈 */
  'coach',
  /** F02 成长报告 + 个人档案 */
  'growth',
  /** F05 个人徽章 */
  'achievements',
  /** F05 班级共同目标 */
  'class_goal',
  /** F05 可选周榜 */
  'leaderboard',
  /** F06 教师教学支持工作台 */
  'teaching',
  /** F01 每周重点 */
  'weekly_focus',
  /** F01 可选诊断 */
  'diagnostic',
  /** F04 自由阅读 */
  'free_reading',
] as const;

export type ProductModule = (typeof PRODUCT_MODULES)[number];

// This release enables only the independently verified medal collection.
// Other upgrade modules are absent from AppModule and never exposed by default.
const DEFAULT_OFF: ReadonlySet<ProductModule> = new Set<ProductModule>(PRODUCT_MODULES.filter((module) => module !== 'achievements'));

function listOf(raw: string | undefined): Set<string> {
  return new Set(
    String(raw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function enabledModules(env: NodeJS.ProcessEnv = process.env): Record<ProductModule, boolean> {
  const off = listOf(env.PRODUCT_MODULES_OFF);
  const on = listOf(env.PRODUCT_MODULES_ON);
  const out = {} as Record<ProductModule, boolean>;
  for (const m of PRODUCT_MODULES) {
    // 显式关 > 显式开 > 默认 —— 同时写在两边时按「关」处理，宁可少一个功能
    out[m] = off.has(m) ? false : on.has(m) ? true : !DEFAULT_OFF.has(m);
  }
  return out;
}

export function moduleEnabled(m: ProductModule, env: NodeJS.ProcessEnv = process.env): boolean {
  return enabledModules(env)[m];
}

/** 关着就在任何读写之前拒绝。 */
export function assertModuleEnabled(m: ProductModule, env: NodeJS.ProcessEnv = process.env): void {
  if (!moduleEnabled(m, env)) throw new ServiceUnavailableException({ code: 'module_off', module: m });
}
