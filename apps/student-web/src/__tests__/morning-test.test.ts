/** 2026-09-29 起：今天学的词下一个教学日 8:30 早读时考（API 见 apps/api/src/vocab-v2/morning-test.ts）。 */
import { describe, expect, it } from 'vitest';
import { opensAtText, progressOf, testTaskView } from '../pages/Today';
import { reciteFromSession } from '../pages/VocabularyCoachLearn';
import type { V2Overview } from '../lib/api';

describe('早读才考', () => {
  it('开考时间按新加坡时间写：周二学的 → 周三早上 8:30，周五学的 → 周一早上 8:30', () => {
    expect(opensAtText('2026-09-30T00:30:00.000Z')).toBe('周三早上 8:30');
    expect(opensAtText('2026-10-05T00:30:00.000Z')).toBe('周一早上 8:30');
    expect(opensAtText(null)).toBe('');
  });

  it('首页测试卡：不算今天的任务，写清哪天几点考', () => {
    const ov = { home: { test: { state: 'not_applicable', reason: 'next_morning', opensAt: '2026-09-30T00:30:00.000Z' } } } as unknown as V2Overview;
    const view = testTaskView(ov);
    expect(view.applicable).toBe(false);
    expect(view.detail).toBe('周三早上 8:30 早读时考，今天不用做');
    expect(view.action).toEqual({ kind: 'none' });
    expect(progressOf([view])).toEqual({ done: 0, total: 0 });
  });

  it('刚学完：服务端没生成卷子、给了开考时间 → 背一背页拿到 locked', () => {
    const data = reciteFromSession({ id: 's1', date: '2026-09-29', learned: 1, items: [], generatedTestId: null, testOpensAt: '2026-09-30T00:30:00.000Z' } as any);
    expect(data.test).toEqual(expect.objectContaining({ testSessionId: null, locked: true, opensAt: '2026-09-30T00:30:00.000Z' }));
  });
});
