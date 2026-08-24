import { describe, expect, it, vi } from 'vitest';
import { VocabReviewService } from './vocab-review.service';

/**
 * FSRS 调度的行为回归。
 *
 * 这里不测 FSRS 算法本身（ts-fsrs 有自己的测试），只锁住**我们的接线**：
 * 库里的调度字段能否正确还原成 FSRS Card、评分后能否正确写回、
 * 以及 state 映射（我们多一个 known、少一个 Relearning）不会串味。
 */

function makeWord(over: Partial<any> = {}) {
  return {
    id: 'w1',
    studentId: 's1',
    headword: 'coax',
    surfaceForm: 'coaxed',
    state: 'new',
    due: new Date('2026-08-01T00:00:00Z'),
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
    createdAt: new Date('2026-07-31T00:00:00Z'),
    ...over,
  };
}

function makeSvc(word: any) {
  const updated: any = {};
  const prisma: any = {
    studentWord: {
      findUnique: vi.fn().mockResolvedValue(word),
      update: vi.fn().mockImplementation(({ data }: any) => {
        Object.assign(updated, data);
        return Promise.resolve({ ...word, ...data });
      }),
    },
    wordReviewLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn().mockImplementation(async (fn: any) =>
      fn({
        studentWord: {
          update: ({ data }: any) => {
            Object.assign(updated, data);
            return Promise.resolve({ ...word, ...data });
          },
        },
        wordReviewLog: { create: () => Promise.resolve({}) },
      }),
    ),
  };
  const words: any = {
    resolveStudent: vi.fn().mockResolvedValue({ id: 's1', name: '张三' }),
  };
  return { svc: new VocabReviewService(prisma, words), updated, prisma };
}

describe('VocabReviewService.review — FSRS 接线', () => {
  it('新词评 good：写回 due/stability/reps，并记一次复习', async () => {
    const { svc, updated } = makeSvc(makeWord());
    const out = await svc.review({ studentName: '张三', headword: 'coax', rating: 'good' });
    expect(out.headword).toBe('coax');
    expect(updated.reps).toBe(1);
    expect(updated.lastReview).toBeInstanceOf(Date);
    expect(updated.due.getTime()).toBeGreaterThan(Date.now());
    expect(updated.stability).toBeGreaterThan(0);
  });

  it('评 again 的下次到期时间早于评 easy', async () => {
    const a = makeSvc(makeWord());
    await a.svc.review({ studentName: '张三', headword: 'coax', rating: 'again' });
    const e = makeSvc(makeWord());
    await e.svc.review({ studentName: '张三', headword: 'coax', rating: 'easy' });
    expect(a.updated.due.getTime()).toBeLessThan(e.updated.due.getTime());
  });

  it('间隔拉长到 60 天以上时标记为 known（给学生看的“已掌握”）', async () => {
    // 一个已经很稳固的复习态词：高 stability，多次成功
    const { svc, updated } = makeSvc(
      makeWord({
        state: 'review',
        stability: 200,
        difficulty: 3,
        reps: 8,
        scheduledDays: 90,
        lastReview: new Date('2026-05-01T00:00:00Z'),
        due: new Date('2026-07-30T00:00:00Z'),
      }),
    );
    await svc.review({ studentName: '张三', headword: 'coax', rating: 'easy' });
    expect(updated.scheduledDays).toBeGreaterThanOrEqual(60);
    expect(updated.state).toBe('known');
  });

  it('答错（again）会把 known/review 打回 learning，并累计 lapses', async () => {
    const { svc, updated } = makeSvc(
      makeWord({
        state: 'review',
        stability: 50,
        difficulty: 5,
        reps: 5,
        lapses: 1,
        scheduledDays: 30,
        lastReview: new Date('2026-07-01T00:00:00Z'),
        due: new Date('2026-07-31T00:00:00Z'),
      }),
    );
    await svc.review({ studentName: '张三', headword: 'coax', rating: 'again' });
    // 关掉日内步进后不再有 Relearning 态；真正要保证的是：脱离已掌握、
    // 间隔被大幅砍短、lapses 累计 —— 标签按间隔判定为 learning。
    expect(updated.state).not.toBe('known');
    expect(updated.state).toBe('learning');
    expect(updated.scheduledDays).toBeLessThan(7);
    expect(updated.lapses).toBeGreaterThan(1);
  });

  /**
   * 回归：间隔必须真的随复习次数变长。
   *
   * 这是间隔重复的**核心承诺**，也是 V3 验证抓到的真缺陷 ——
   * FSRS 默认带日内学习步进(1m/10m)，「现在第几步」记在 Card.learning_steps 上；
   * 我们把调度状态拆成列存，没有这一列，还原 Card 时只能填 0，
   * 于是每次复习都被重置回第一步、永远毕业不了，间隔恒为 0 天。
   * 修法是关闭日内步进（学生一天只复习一次，1 分钟后再来根本不会发生）。
   */
  it('连续答对时间隔单调变长，而不是永远卡在 0 天', async () => {
    const { svc, updated } = makeSvc(makeWord());
    const seen: number[] = [];
    const word = makeWord();
    for (let i = 0; i < 5; i++) {
      // 每次都在"到期那天"来复习
      Object.assign(word, updated, {
        due: new Date(),
        lastReview: word.reps ? new Date(Date.now() - (updated.scheduledDays ?? 0) * 86400000) : null,
      });
      const h = makeSvc(word);
      const r = await h.svc.review({ studentName: '张三', headword: 'coax', rating: 'good' });
      Object.assign(updated, h.updated);
      Object.assign(word, h.updated);
      seen.push(r.intervalDays);
    }
    void svc;
    // 第一次答对就应进入按天调度，而不是 0 天
    expect(seen[0]).toBeGreaterThan(0);
    // 间隔必须增长
    expect(seen[4]).toBeGreaterThan(seen[0]);
    expect(seen[4]).toBeGreaterThan(7);
  });

  it('不在生词本里的词报 404', async () => {
    const { svc, prisma } = makeSvc(makeWord());
    prisma.studentWord.findUnique.mockResolvedValueOnce(null);
    await expect(
      svc.review({ studentName: '张三', headword: 'zzz', rating: 'good' }),
    ).rejects.toThrow();
  });

  it('headword 大小写不敏感（学生端可能传 Coax）', async () => {
    const { svc, prisma } = makeSvc(makeWord());
    await svc.review({ studentName: '张三', headword: 'Coax', rating: 'good' });
    expect(prisma.studentWord.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId_headword: { studentId: 's1', headword: 'coax' } },
      }),
    );
  });
});

/** 撤销 + 弱网重发去重（2026-08-24 学生十问修复 #4/#10）的接线。 */
describe('VocabReviewService — undo 与 requestId 幂等', () => {
  function makeUndoSvc(word: any, log: any) {
    const state: any = { word: { ...word }, deletedLogId: null };
    const prisma: any = {
      studentWord: {
        findUnique: vi.fn().mockImplementation(() => Promise.resolve(state.word)),
        update: vi.fn().mockImplementation(({ data }: any) => {
          Object.assign(state.word, data);
          return Promise.resolve(state.word);
        }),
      },
      wordReviewLog: {
        findFirst: vi.fn().mockResolvedValue(log),
        findUnique: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockImplementation(({ where }: any) => {
          state.deletedLogId = where.id;
          return Promise.resolve({});
        }),
        create: vi.fn().mockResolvedValue({}),
      },
      // undo 用的是数组形式的 $transaction（两个已构造的 promise）
      $transaction: vi.fn().mockImplementation(async (ops: any) =>
        Array.isArray(ops) ? Promise.all(ops) : ops({
          studentWord: prisma.studentWord,
          wordReviewLog: prisma.wordReviewLog,
        }),
      ),
    };
    const words: any = { resolveStudent: vi.fn().mockResolvedValue({ id: 's1', name: '张三' }) };
    return { svc: new VocabReviewService(prisma, words), state, prisma };
  }

  it('undo：从快照精确还原调度状态并删掉流水', async () => {
    const rated = makeWord({
      reps: 1, stability: 3, scheduledDays: 2, state: 'review',
      due: new Date('2026-08-26T00:00:00Z'), lastReview: new Date('2026-08-24T00:00:00Z'),
    });
    const log = {
      id: 'log1',
      reviewedAt: new Date(), // 刚评完
      prevState: {
        due: '2026-08-24T00:00:00.000Z', stability: 0, difficulty: 0,
        elapsedDays: 0, scheduledDays: 0, reps: 0, lapses: 0,
        lastReview: null, state: 'new',
      },
    };
    const { svc, state } = makeUndoSvc(rated, log);
    const out = await svc.undo({ studentName: '张三', headword: 'coax' });
    expect(out.undone).toBe(true);
    expect(state.word.reps).toBe(0);
    expect(state.word.state).toBe('new');
    expect(state.word.stability).toBe(0);
    expect(state.word.lastReview).toBeNull();
    expect(state.deletedLogId).toBe('log1');
  });

  it('undo：超过 10 分钟拒绝（undo_window_expired）', async () => {
    const log = {
      id: 'log1',
      reviewedAt: new Date(Date.now() - 11 * 60_000),
      prevState: { due: '2026-08-24T00:00:00.000Z', stability: 0, difficulty: 0,
        elapsedDays: 0, scheduledDays: 0, reps: 0, lapses: 0, lastReview: null, state: 'new' },
    };
    const { svc } = makeUndoSvc(makeWord({ reps: 1 }), log);
    await expect(svc.undo({ studentName: '张三', headword: 'coax' })).rejects.toMatchObject({
      response: { code: 'undo_window_expired' },
    });
  });

  it('undo：没有可撤的流水（或无快照）拒绝', async () => {
    const { svc } = makeUndoSvc(makeWord(), null);
    await expect(svc.undo({ studentName: '张三', headword: 'coax' })).rejects.toMatchObject({
      response: { code: 'nothing_to_undo' },
    });
  });

  it('requestId 重放：直接返回当前状态，不再写 FSRS', async () => {
    const word = makeWord({ reps: 1, scheduledDays: 2, state: 'review' });
    const prisma: any = {
      studentWord: {
        findUnique: vi.fn().mockResolvedValue(word),
        update: vi.fn(),
      },
      wordReviewLog: {
        findUnique: vi.fn().mockResolvedValue({ id: 'log-exists' }), // 已记过
      },
      $transaction: vi.fn(),
    };
    const words: any = { resolveStudent: vi.fn().mockResolvedValue({ id: 's1', name: '张三' }) };
    const svc = new VocabReviewService(prisma, words);
    const out: any = await svc.review({
      studentName: '张三', headword: 'coax', rating: 'good', requestId: 'rq-1',
    });
    expect(out.duplicate).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled(); // 没有第二次调度
  });
});
