import { describe, expect, it, vi } from 'vitest';
import { MIN_HONEST_DWELL_MS, VocabReviewService, isTooFastToBeReal } from './vocab-review.service';

/**
 * 「秒选不算数」（2026-08-25 上线首日实测后加）。
 *
 * 真机证据：翻卡停留中位数 5.1s → 1.6s，21 次评分 100%「记住了」，
 * 一名学生 25 秒刷完 10 张、最后四张不到 1 秒。
 */
describe('isTooFastToBeReal — 判定', () => {
  it('正面评分 + 不足 1.5 秒 → 拦', () => {
    expect(isTooFastToBeReal('good', 800)).toBe(true);
    expect(isTooFastToBeReal('easy', 1499)).toBe(true);
  });
  it('刚好 1.5 秒 → 放行（阈值是「不足」）', () => {
    expect(isTooFastToBeReal('good', MIN_HONEST_DWELL_MS)).toBe(false);
  });
  it('秒选「忘了」是诚实的 → 永远放行', () => {
    expect(isTooFastToBeReal('again', 300)).toBe(false);
    expect(isTooFastToBeReal('hard', 300)).toBe(false);
  });
  it('自测线（不传 / 0 耗时）绝不误伤 —— 客观判分本来就可能很快', () => {
    expect(isTooFastToBeReal('good', 0)).toBe(false);
    expect(isTooFastToBeReal('good', undefined)).toBe(false);
  });
});

function makeWord(over: Partial<any> = {}) {
  return {
    id: 'w1', studentId: 's1', headword: 'coax', surfaceForm: 'coaxed',
    state: 'review', due: new Date('2026-08-25T00:00:00Z'),
    stability: 5, difficulty: 5, elapsedDays: 0, scheduledDays: 4,
    reps: 3, lapses: 0, lastReview: new Date('2026-08-21T00:00:00Z'),
    createdAt: new Date('2026-08-01T00:00:00Z'), ...over,
  };
}

function makeSvc(word: any) {
  const logs: any[] = [];
  const updates: any[] = [];
  const prisma: any = {
    studentWord: { findUnique: vi.fn().mockResolvedValue(word), update: vi.fn() },
    wordReviewLog: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: any) => { logs.push(data); return Promise.resolve({}); }),
    },
    $transaction: vi.fn().mockImplementation(async (fn: any) =>
      fn({
        studentWord: { update: ({ data }: any) => { updates.push(data); return Promise.resolve({ ...word, ...data }); } },
        wordReviewLog: { create: ({ data }: any) => { logs.push(data); return Promise.resolve({}); } },
      }),
    ),
  };
  const words: any = { resolveStudent: vi.fn().mockResolvedValue({ id: 's1', name: '张三' }) };
  return { svc: new VocabReviewService(prisma, words), logs, updates };
}

describe('review() — 秒选走兜底分支', () => {
  it('秒选「记得」：不写调度，但留一条流水作证据', async () => {
    const { svc, logs, updates } = makeSvc(makeWord());
    const out: any = await svc.review({ studentName: '张三', headword: 'coax', rating: 'good', elapsedMs: 900 });
    expect(out.tooFast).toBe(true);
    expect(updates).toHaveLength(0); // 调度一个字段都没动
    expect(logs).toHaveLength(1);
    expect(logs[0].elapsedMs).toBe(900);
    expect(logs[0].prevState).toBeUndefined(); // 没有调度变更 → 没有可撤销的东西
    // 返回的仍是词的当前状态，前端据此显示「这次不算」
    expect(out.reps).toBe(3);
    expect(out.intervalDays).toBe(4);
  });

  it('秒选「忘了」照常写调度 —— 诚实的快是允许的', async () => {
    const { svc, updates } = makeSvc(makeWord());
    const out: any = await svc.review({ studentName: '张三', headword: 'coax', rating: 'again', elapsedMs: 400 });
    expect(out.tooFast).toBeUndefined();
    expect(updates).toHaveLength(1);
    expect(updates[0].lapses).toBeGreaterThan(0);
  });

  it('认真看过（>1.5 秒）的「记得」照常写调度', async () => {
    const { svc, updates } = makeSvc(makeWord());
    const out: any = await svc.review({ studentName: '张三', headword: 'coax', rating: 'good', elapsedMs: 4200 });
    expect(out.tooFast).toBeUndefined();
    expect(updates).toHaveLength(1);
    expect(updates[0].reps).toBe(4);
  });

  it('自测线（不传 elapsedMs）不受影响', async () => {
    const { svc, updates } = makeSvc(makeWord());
    const out: any = await svc.review({ studentName: '张三', headword: 'coax', rating: 'good' });
    expect(out.tooFast).toBeUndefined();
    expect(updates).toHaveLength(1);
  });
});
