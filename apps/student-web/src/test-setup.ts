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

/**
 * 写作自查的「功能开着没有」缓存是模块级的 —— 浏览器里一次会话问一次正是想要的，
 * 但在测试里会跨文件串：writing-hints 那组把它设成 true 之后，别的用例的阅读页
 * 就会真的去 POST /writing-check，把「请求顺序逐条对上」这类断言打翻
 * （2026-09-09 全量跑才复现，单文件跑是绿的）。每个用例前清一次。
 */
import { beforeEach } from 'vitest';
import { __resetWritingCheckCache } from './lesson/shared/WritingHints';

beforeEach(() => {
  __resetWritingCheckCache();
});
