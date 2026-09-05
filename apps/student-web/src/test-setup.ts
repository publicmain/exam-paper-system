import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

/**
 * 「今天是不是教学日」在测试里必须是确定的 —— 周末跑测试时首页 / 结果页
 * 会走周末分支，把按工作日写的断言全部打翻（2026-09-05 周六晚实测）。
 * 默认当作教学日；要测周末分支的用例把 `globalThis.__teachingDay` 设成 false。
 */
declare global {
  // eslint-disable-next-line no-var
  var __teachingDay: boolean | undefined;
}
vi.mock('./lib/teaching-day', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./lib/teaching-day')>();
  return { ...mod, isTeachingDay: () => globalThis.__teachingDay ?? true };
});
