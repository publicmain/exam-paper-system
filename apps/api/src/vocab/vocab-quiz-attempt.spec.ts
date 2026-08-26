import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { VocabQuizAttemptService } from './vocab-quiz-attempt.service';

/**
 * P6 —— 成绩实体的幂等与边界。
 *
 * 最重要的两组：
 * - **不碰 FSRS**：一旦考试开始改 due/reps/stability，「成绩」就又变回
 *   「一次练习」，阅读与词汇分开保存这条规则也就废了。假 Prisma 里那些
 *   写方法一被调用就抛，任何回归都会当场炸出来。
 * - **一份成绩**：双击提交 / 网络重试 / 并发创建都只能有一份。
 */

const ITEMS = [
  { qtype: 'word_to_meaning', headword: 'harbour', prompt: 'harbour', options: ['港口', '灯笼', '草地', '卵石'], correctIndex: 0, studentIndex: null, studentAnswer: null, isCorrect: null, answeredAt: null },
  { qtype: 'word_to_meaning', headword: 'lantern', prompt: 'lantern', options: ['港口', '灯笼', '草地', '卵石'], correctIndex: 1, studentIndex: null, studentAnswer: null, isCorrect: null, answeredAt: null },
  { qtype: 'spelling', headword: 'meadow', prompt: 'The ＿＿＿ was green.', options: [], correctIndex: -1, answer: 'meadow', studentIndex: null, studentAnswer: null, isCorrect: null, answeredAt: null },
  { qtype: 'word_to_meaning', headword: 'pebble', prompt: 'pebble', options: ['港口', '灯笼', '草地', '卵石'], correctIndex: 3, studentIndex: null, studentAnswer: null, isCorrect: null, answeredAt: null },
];

function makeSvc(opts: {
  attempt?: any;
  words?: any[];
  createThrows?: any;
  updateManyCount?: number;
  dlc?: any;
  reviewedToday?: any[];
} = {}) {
  const calls: Array<{ model: string; op: string; args: any }> = [];
  const track = (model: string, op: string, impl: Function) => (args: any) => {
    calls.push({ model, op, args });
    return impl(args);
  };
  let stored = opts.attempt ?? null;

  const prisma: any = {
    __calls: calls,
    vocabQuizAttempt: {
      findUnique: track('attempt', 'findUnique', async () => stored),
      findFirst: track('attempt', 'findFirst', async () => stored),
      create: track('attempt', 'create', async ({ data }: any) => {
        if (opts.createThrows) throw opts.createThrows;
        stored = {
          id: 'att1', status: 'in_progress', startedAt: new Date(), submittedAt: null,
          total: data.total ?? 0, correct: 0, score: 0, items: data.items,
        };
        return stored;
      }),
      updateMany: track('attempt', 'updateMany', async ({ data }: any) => {
        const n = opts.updateManyCount ?? 1;
        if (n > 0) stored = { ...stored, ...data, items: data.items ?? stored.items };
        return { count: n };
      }),
    },
    studentWord: {
      // 照着 where 真的过滤 —— 否则测的是假货，headword.in 写错也不会红
      findMany: track('studentWord', 'findMany', async (args: any) => {
        let ws = opts.words ?? [];
        const inList = args?.where?.headword?.in;
        if (Array.isArray(inList)) ws = ws.filter((w: any) => inList.includes(w.headword));
        if (args?.where?.firstTaughtAt?.not === null) ws = ws.filter((w: any) => w.firstTaughtAt != null);
        return ws;
      }),
      // 考试绝不许碰这些
      update: () => { throw new Error('考试不得改写 FSRS 字段'); },
      updateMany: () => { throw new Error('考试不得改写 FSRS 字段'); },
    },
    studentSubmission: {
      update: () => { throw new Error('考试不得写阅读答卷'); },
      create: () => { throw new Error('考试不得写阅读答卷'); },
      updateMany: () => { throw new Error('考试不得写阅读答卷'); },
    },
    wordReviewLog: {
      create: () => { throw new Error('考试不得写复习流水'); },
      findUnique: () => { throw new Error('考试不得读写复习流水'); },
      findMany: track('wordReviewLog', 'findMany', async () => opts.reviewedToday ?? []),
    },
    dailyLessonCompletion: {
      findUnique: track('dlc', 'findUnique', async () =>
        opts.dlc === null
          ? null
          : (opts.dlc ?? { id: 'dlc1', stage: 'vocab_test', vocabWords: (opts.words ?? []).map((w: any) => w.headword) })),
      update: () => { throw new Error('考试不得直接改任务行'); },
      updateMany: () => { throw new Error('考试不得直接改任务行'); },
    },
  };
  const words = { resolveStudent: vi.fn(async () => ({ id: 'stu1', name: '小明' })) } as any;
  const quiz = {
    buildQuiz: vi.fn(async () => ({ questions: ITEMS.map((i) => ({ ...i })) })),
  } as any;
  return { svc: new VocabQuizAttemptService(prisma, words, quiz), prisma, quiz };
}

const dueWords = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    headword: 'w' + i,
    firstTaughtAt: new Date(Date.now() - 3600_000),
    due: new Date(Date.now() - 3600_000),
    contextSentence: 'A sentence.',
    reps: 0,
  }));

describe('start —— 创建与恢复', () => {
  beforeEach(() => vi.clearAllMocks());

  it('没有教过的词 → not_ready，不建任何记录', async () => {
    const { svc, prisma } = makeSvc({
      words: [{ headword: 'a', firstTaughtAt: null, due: new Date(), contextSentence: '', reps: 0 }],
    });
    await expect(svc.start({ studentName: '小明' })).rejects.toThrow(ConflictException);
    expect(prisma.__calls.filter((c: any) => c.op === 'create')).toHaveLength(0);
  });

  it('教过的词不足 → insufficient_items，**不生成虚假测试**', async () => {
    const { svc, prisma } = makeSvc({ words: dueWords(3) });
    await expect(svc.start({ studentName: '小明' })).rejects.toThrow(ConflictException);
    expect(prisma.__calls.filter((c: any) => c.op === 'create')).toHaveLength(0);
  });

  it('够格 → 建一份，题目快照落库', async () => {
    const { svc, quiz } = makeSvc({ words: dueWords(5) });
    const r = await svc.start({ studentName: '小明' });
    expect(r.status).toBe('in_progress');
    expect(r.items).toHaveLength(4);
    expect(r.resumed).toBe(false);
    // 出题必须用固定词表，服务端不再自己补题
    expect(quiz.buildQuiz).toHaveBeenCalledWith(
      expect.objectContaining({ words: expect.any(Array) }),
    );
  });

  it('**作答前不下发正确答案**（下发了等于把答案放进 devtools）', async () => {
    const { svc } = makeSvc({ words: dueWords(5) });
    const r = await svc.start({ studentName: '小明' });
    for (const it of r.items) {
      expect(it.correctIndex).toBeNull();
      expect(it.answer).toBeNull();
    }
  });

  it('已有记录 → 原样恢复，**不重新出题**', async () => {
    const { svc, quiz } = makeSvc({
      attempt: { id: 'att1', status: 'in_progress', startedAt: new Date(), submittedAt: null, total: 4, correct: 0, score: 0, items: ITEMS },
    });
    const r = await svc.start({ studentName: '小明' });
    expect(r.resumed).toBe(true);
    expect(quiz.buildQuiz).not.toHaveBeenCalled();
  });

  it('**并发创建撞唯一约束 → 回读同一份**，不产生第二份', async () => {
    const winner = {
      id: 'att1', status: 'in_progress', startedAt: new Date(), submittedAt: null,
      total: 4, correct: 0, score: 0, items: ITEMS,
    };
    const { svc, prisma } = makeSvc({ words: dueWords(5), createThrows: { code: 'P2002' } });
    // findFirst：建之前返回 null（所以会去 create），撞约束后返回赢家那一份
    let first = true;
    prisma.vocabQuizAttempt.findFirst = async () => {
      if (first) { first = false; return null; }
      return winner;
    };
    const r = await svc.start({ studentName: '小明' });
    expect(r.attemptId).toBe('att1');
    expect(r.resumed).toBe(true);
  });
});

describe('answer —— 第一次作答为准', () => {
  const inProgress = () => ({
    id: 'att1', status: 'in_progress', startedAt: new Date(), submittedAt: null,
    total: 4, correct: 0, score: 0, items: ITEMS.map((i) => ({ ...i })),
  });

  it('选对 → isCorrect=true，只写 items', async () => {
    const { svc, prisma } = makeSvc({ attempt: inProgress() });
    const r = await svc.answer({ studentName: '小明', index: 0, optionIndex: 0 });
    expect(r.accepted).toBe(true);
    expect((r as any).isCorrect).toBe(true);
    const w = prisma.__calls.find((c: any) => c.op === 'updateMany');
    expect(Object.keys(w.args.data)).toEqual(['items']);
    // 条件写入：只在仍进行中时落库
    expect(w.args.where.status).toBe('in_progress');
  });

  it('拼写题按文本判定（大小写/空白归一）', async () => {
    const { svc } = makeSvc({ attempt: inProgress() });
    const r = await svc.answer({ studentName: '小明', index: 2, text: '  Meadow ' });
    expect((r as any).isCorrect).toBe(true);
  });

  it('**重复作答同一题 → no-op**，保留第一次的答案', async () => {
    const a = inProgress();
    a.items[0] = { ...a.items[0], studentIndex: 1, studentAnswer: '灯笼', isCorrect: false, answeredAt: '2026-08-28T02:00:00.000Z' } as any;
    const { svc, prisma } = makeSvc({ attempt: a });
    const r = await svc.answer({ studentName: '小明', index: 0, optionIndex: 0 });
    expect(r.accepted).toBe(false);
    expect((r as any).reason).toBe('already_answered');
    expect(prisma.__calls.filter((c: any) => c.op === 'updateMany')).toHaveLength(0);
  });

  it('交卷后不再接受作答', async () => {
    const { svc } = makeSvc({
      attempt: { ...inProgress(), status: 'submitted', submittedAt: new Date() },
    });
    const r = await svc.answer({ studentName: '小明', index: 0, optionIndex: 0 });
    expect(r.accepted).toBe(false);
    expect((r as any).reason).toBe('already_submitted');
  });

  it('越界下标 → 400', async () => {
    const { svc } = makeSvc({ attempt: inProgress() });
    await expect(svc.answer({ studentName: '小明', index: 99, optionIndex: 0 })).rejects.toThrow();
    await expect(svc.answer({ studentName: '小明', index: 0, optionIndex: 9 })).rejects.toThrow();
  });

  it('没有当日测试 → no_attempt，不隐式创建', async () => {
    const { svc, prisma } = makeSvc({ attempt: null });
    await expect(svc.answer({ studentName: '小明', index: 0, optionIndex: 0 })).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.__calls.filter((c: any) => c.op === 'create')).toHaveLength(0);
  });
});

describe('submit —— 一份成绩', () => {
  const answered = (correct: number) => ({
    id: 'att1', status: 'in_progress', startedAt: new Date(), submittedAt: null,
    total: 4, correct: 0, score: 0,
    items: ITEMS.map((it, i) => ({ ...it, isCorrect: i < correct })),
  });

  it('算分落库：3/4 = 75', async () => {
    const { svc, prisma } = makeSvc({ attempt: answered(3) });
    const r = await svc.submit({ studentName: '小明' });
    expect(r.alreadySubmitted).toBe(false);
    const w = prisma.__calls.find((c: any) => c.op === 'updateMany');
    expect(w.args.data).toMatchObject({ status: 'submitted', total: 4, correct: 3, score: 75 });
    // 条件更新：只有仍是 in_progress 的那一次会成功
    expect(w.args.where.status).toBe('in_progress');
  });

  it('**已交过 → 原样返回同一份，不重算不新建**', async () => {
    const { svc, prisma } = makeSvc({
      attempt: { ...answered(3), status: 'submitted', submittedAt: new Date(), total: 4, correct: 3, score: 75 },
    });
    const r = await svc.submit({ studentName: '小明' });
    expect(r.alreadySubmitted).toBe(true);
    expect(r.score).toBe(75);
    expect(prisma.__calls.filter((c: any) => c.op === 'updateMany')).toHaveLength(0);
  });

  it('**并发提交：后到的匹配 0 行 → 回读同一份**', async () => {
    const { svc } = makeSvc({ attempt: answered(3), updateManyCount: 0 });
    const r = await svc.submit({ studentName: '小明' });
    expect(r.alreadySubmitted).toBe(true);
  });

  it('提交后下发正确答案，供结果页逐题回看', async () => {
    const { svc } = makeSvc({ attempt: answered(4) });
    const r = await svc.submit({ studentName: '小明' });
    expect(r.items[0].correctIndex).toBe(0);
  });

  it('没有当日测试 → no_attempt', async () => {
    const { svc } = makeSvc({ attempt: null });
    await expect(svc.submit({ studentName: '小明' })).rejects.toThrow(ConflictException);
  });
});

describe('全程不碰 FSRS / 阅读答卷', () => {
  it('start → answer → submit 一路下来，只写过 VocabQuizAttempt', async () => {
    const { svc: s1, prisma: p1 } = makeSvc({ words: dueWords(5) });
    await s1.start({ studentName: '小明' });
    await s1.answer({ studentName: '小明', index: 0, optionIndex: 0 });
    await s1.submit({ studentName: '小明' });
    const writes = p1.__calls.filter((c: any) =>
      ['create', 'update', 'updateMany', 'delete', 'deleteMany'].includes(c.op),
    );
    expect(writes.length).toBeGreaterThan(0);
    expect(new Set(writes.map((w: any) => w.model))).toEqual(new Set(['attempt']));
  });
});

/**
 * P6 收尾 —— 正式测试**属于一次任务**，不是「学生 + 今天」。
 *
 * 原来靠 (studentId, date) 定位：日历日与任务今天恰好一一对应，但那是
 * 巧合不是契约。更现实的风险是 SGT 午夜前后两处各算一次「今天」，
 * 任何一处算法微调都会让测试挂到另一天的任务上。
 */
describe('任务绑定（P6 收尾）', () => {
  beforeEach(() => vi.clearAllMocks());

  it('**没有当日任务 → no_task**，不建 attempt、不出题', async () => {
    const { svc, prisma, quiz } = makeSvc({ dlc: null, words: dueWords(8) });
    await expect(svc.start({ studentName: '小明' })).rejects.toThrow(ConflictException);
    expect(prisma.__calls.filter((c: any) => c.op === 'create')).toHaveLength(0);
    expect(quiz.buildQuiz).not.toHaveBeenCalled();
  });

  it('**按任务查已有 attempt**（dailyLessonCompletionId），不按学生+日期', async () => {
    const { svc, prisma } = makeSvc({
      dlc: { id: 'dlc_today' },
      attempt: {
        id: 'att1', status: 'in_progress', startedAt: new Date(), submittedAt: null,
        total: 4, correct: 0, score: 0, items: ITEMS,
      },
    });
    await svc.start({ studentName: '小明' });
    const q = prisma.__calls.find((c: any) => c.model === 'attempt' && c.op === 'findFirst');
    expect(q.args.where).toEqual({ dailyLessonCompletionId: 'dlc_today' });
  });

  it('**新建的 attempt 一定带任务绑定**', async () => {
    const { svc, prisma } = makeSvc({ dlc: { id: 'dlc_today', stage: 'vocab_test', vocabWords: ['w0','w1','w2','w3','w4','w5','w6','w7'] }, words: dueWords(8) });
    await svc.start({ studentName: '小明' });
    const c = prisma.__calls.find((x: any) => x.op === 'create');
    expect(c.args.data.dailyLessonCompletionId).toBe('dlc_today');
  });

  it('**候选词的 SQL 里就写死了 firstTaughtAt IS NOT NULL**，不靠下游过滤', async () => {
    const { svc, prisma } = makeSvc({ dlc: { id: 'd', stage: 'vocab_test', vocabWords: ['w0','w1','w2','w3','w4','w5','w6','w7'] }, words: dueWords(8) });
    await svc.start({ studentName: '小明' });
    const w = prisma.__calls.find((c: any) => c.model === 'studentWord' && c.op === 'findMany');
    expect(w.args.where.firstTaughtAt).toEqual({ not: null });
    expect(w.args.where.studentId).toBe('stu1');
  });

  it('**任务归属只认任务自己记的队列**：不看 due、不看「今天动过」', async () => {
    const { svc, prisma } = makeSvc({
      dlc: { id: 'd', stage: 'vocab_test', vocabWords: ['w0', 'w1', 'w2', 'w3', 'w4'] },
      words: dueWords(8),
    });
    await svc.start({ studentName: '小明' });
    const w = prisma.__calls.find((c: any) => c.model === 'studentWord' && c.op === 'findMany');
    // where 里绝不能出现「due <= now」这种全局条件
    expect(w.args.where.due).toBeUndefined();
    // 也不再有「今天教过 OR 今天复习过」的日期推断
    expect(w.args.where.OR).toBeUndefined();
    // 只剩：这个学生 + 教过 + 在这次任务的队列里
    expect(w.args.where.headword).toEqual({ in: ['w0', 'w1', 'w2', 'w3', 'w4'] });
    expect(w.args.where.firstTaughtAt).toEqual({ not: null });
  });

  it('**不再读 WordReviewLog 推断归属** —— 自由练习的日志碰不到出题范围', async () => {
    const { svc, prisma } = makeSvc({
      dlc: { id: 'd', stage: 'vocab_test', vocabWords: ['w0', 'w1', 'w2', 'w3'] },
      words: dueWords(8),
      reviewedToday: [{ studentWord: { headword: '自由练习的陈年旧词' } }],
    });
    await svc.start({ studentName: '小明' });
    expect(prisma.__calls.some((c: any) => c.model === 'wordReviewLog')).toBe(false);
    const w = prisma.__calls.find((c: any) => c.model === 'studentWord' && c.op === 'findMany');
    expect(w.args.where.headword.in).not.toContain('自由练习的陈年旧词');
  });

  it('旧任务行没有队列快照 → 空集 → insufficient_items，绝不放宽', async () => {
    const { svc, prisma } = makeSvc({ dlc: { id: 'd', stage: 'vocab_test', vocabWords: null }, words: dueWords(8) });
    await expect(svc.start({ studentName: '小明' })).rejects.toThrow(ConflictException);
    const w = prisma.__calls.find((c: any) => c.model === 'studentWord' && c.op === 'findMany');
    expect(w.args.where.headword).toEqual({ in: [] });
    expect(prisma.__calls.filter((c: any) => c.op === 'create')).toHaveLength(0);
  });


  it('**User.englishLevel 全程不参与**：任何查询的 where 里都没有它', async () => {
    const { svc, prisma } = makeSvc({ dlc: { id: 'd', stage: 'vocab_test', vocabWords: ['w0','w1','w2','w3','w4','w5','w6','w7'] }, words: dueWords(8) });
    await svc.start({ studentName: '小明' });
    const json = JSON.stringify(prisma.__calls.map((c: any) => c.args));
    expect(json).not.toContain('englishLevel');
  });
});

/**
 * P6 最终核查 —— 阶段门。
 *
 * 资格判据回答的是「这些词能不能考」，回答不了「他该不该现在考」。
 * 一个还在翻卡学新词的学生，哪怕这次任务的词碰巧都教过（队列里全是往日
 * 的复习词），也不该从深链接直接跳进正式测试。
 */
describe('阶段门（P6 最终核查）', () => {
  beforeEach(() => vi.clearAllMocks());

  const WORDS = ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'];

  it('**stage=vocab_learn → 不许开考**，哪怕所有词都教过了', async () => {
    const { svc, prisma, quiz } = makeSvc({
      dlc: { id: 'd', vocabWords: WORDS, stage: 'vocab_learn' },
      words: dueWords(8),
    });
    await expect(svc.start({ studentName: '小明' })).rejects.toThrow(ConflictException);
    expect(prisma.__calls.filter((c: any) => c.op === 'create')).toHaveLength(0);
    expect(quiz.buildQuiz).not.toHaveBeenCalled();
  });

  it('**stage=reading / reading_done 同样不许开考**（深链接绕不过去）', async () => {
    for (const stage of ['reading', 'reading_done']) {
      const { svc, prisma } = makeSvc({
        dlc: { id: 'd', vocabWords: WORDS, stage },
        words: dueWords(8),
      });
      await expect(svc.start({ studentName: '小明' })).rejects.toThrow(ConflictException);
      expect(prisma.__calls.filter((c: any) => c.op === 'create')).toHaveLength(0);
    }
  });

  it('走到 vocab_test 才能开考', async () => {
    const { svc } = makeSvc({
      dlc: { id: 'd', vocabWords: WORDS, stage: 'vocab_test' },
      words: dueWords(8),
    });
    const r = await svc.start({ studentName: '小明' });
    expect(r.status).toBe('in_progress');
  });

  it('**stage=done 且没有现成的测试 → 不新开第二份**', async () => {
    const { svc, prisma } = makeSvc({
      dlc: { id: 'd', vocabWords: WORDS, stage: 'done' },
      words: dueWords(8),
    });
    await expect(svc.start({ studentName: '小明' })).rejects.toThrow(ConflictException);
    expect(prisma.__calls.filter((c: any) => c.op === 'create')).toHaveLength(0);
  });

  it('stage=done 但已有测试 → 照常读回成绩（阶段门在恢复之后）', async () => {
    const { svc } = makeSvc({
      dlc: { id: 'd', vocabWords: WORDS, stage: 'done' },
      attempt: {
        id: 'att1', status: 'submitted', startedAt: new Date(), submittedAt: new Date(),
        total: 4, correct: 3, score: 75, items: ITEMS,
      },
    });
    const r = await svc.start({ studentName: '小明' });
    expect(r.resumed).toBe(true);
    expect(r.score).toBe(75);
  });

  it('stage 缺失（旧任务行）按最早阶段处理 → 不许开考', async () => {
    const { svc } = makeSvc({
      dlc: { id: 'd', vocabWords: WORDS, stage: null },
      words: dueWords(8),
    });
    await expect(svc.start({ studentName: '小明' })).rejects.toThrow(ConflictException);
  });

  it('任务队列大小写/空白不一致时仍能匹配上（规范化防线）', async () => {
    const { svc, prisma } = makeSvc({
      dlc: { id: 'd', vocabWords: ['  W0 ', 'W1', 'w2', 'w3', 'w4'], stage: 'vocab_test' },
      words: dueWords(8),
    });
    await svc.start({ studentName: '小明' });
    const w = prisma.__calls.find((c: any) => c.model === 'studentWord' && c.op === 'findMany');
    expect(w.args.where.headword.in).toEqual(['w0', 'w1', 'w2', 'w3', 'w4']);
  });
});
