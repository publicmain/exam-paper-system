import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { LEVEL_REGISTRY } from './level-registry';

/**
 * 前端各处的「等级 → 中文名」映射表必须覆盖全部等级。
 *
 * 2026-08-24 加 ielts_light / olevel_intermediate 时，后端注册表建好了，
 * 但前端有 4 处独立的硬编码映射全部漏改。其中最要命的是扫码页
 * （MorningQuizScan）：它直接 `LEVEL_LABEL[level].tint`，取到 undefined
 * 会抛异常、整个难度选择页白屏 —— 学生连码都扫不进去，而这是每天早上
 * 8:30 第一个被碰到的界面。
 *
 * 这个测试跨到前端源码里做文本检查。不优雅，但它能在 CI 里拦住
 * 「后端加了等级、前端忘了加标签」这类跨包遗漏 —— 类型系统管不到，
 * 因为那些映射表是 Record<string, string>。
 */

const WEB = path.join(__dirname, '..', '..', '..', 'web', 'src');

/** 每个文件里，等级名必须出现在映射表附近（简单起见：整文件包含即可） */
const FILES_REQUIRING_ALL_LEVELS = [
  'pages/MorningQuizScan.tsx', // 学生扫码选难度 —— 漏了会白屏
  'pages/MyHistory.tsx', // 学生看成绩
  'pages/MorningQuizSchedule.tsx', // 老师排课
  'pages/MorningQuizClassDayDashboard.tsx', // 老师班级日面板
  'lib/api.ts', // EnglishLevel 联合类型
];

describe('等级覆盖 —— 前端标签表不能落下任何一个等级', () => {
  const levels = Object.keys(LEVEL_REGISTRY);

  it('注册表本身有五个等级', () => {
    expect(levels).toHaveLength(5);
  });

  for (const rel of FILES_REQUIRING_ALL_LEVELS) {
    it(`${rel} 覆盖全部 ${Object.keys(LEVEL_REGISTRY).length} 个等级`, () => {
      const full = path.join(WEB, rel);
      // 前端文件不存在就跳过断言（避免目录结构变动时误报为等级遗漏）
      if (!fs.existsSync(full)) return;
      const src = fs.readFileSync(full, 'utf-8');
      const missing = levels.filter((l) => !src.includes(l));
      expect(missing, `${rel} 缺少等级: ${missing.join(', ')}`).toEqual([]);
    });
  }

  it('扫码页有取不到配置时的兜底 —— 未登记的等级不能让页面崩', () => {
    const full = path.join(WEB, 'pages/MorningQuizScan.tsx');
    if (!fs.existsSync(full)) return;
    const src = fs.readFileSync(full, 'utf-8');
    // 直接下标访问再读属性（LEVEL_LABEL[x].tint）是崩溃的根源，
    // 必须走兜底函数
    expect(src).toContain('levelFallback');
    expect(src).not.toMatch(/LEVEL_LABEL\[[^\]]+\]\.\w/);
  });
});
