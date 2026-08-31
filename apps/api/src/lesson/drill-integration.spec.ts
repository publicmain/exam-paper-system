/**
 * S12H 返工 1/2 —— **走真实的服务路径**，不是纯函数。
 *
 * v1.0 的复审抓到 B-1：drill 相关的两个纯函数写好了、测好了，
 * **但没有任何一个真实调用点传事实进去**，所以线上那个缺陷原样还在
 * （补段 0/5，主按钮却写着「看今天的总结」）。
 *
 * 这一份 spec 只从两个真实入口进：
 *
 *   · `LessonService.today()`             —— 主行动
 *   · `VocabQuizAttemptService.submit()`  —— 正式测试交卷那个事务
 *
 * 另外钉住一条 v1.0 漏掉的区分：**光把阶段停在 `vocab_test` 是不够的** ——
 * 那样主按钮会变成「再考一次单词测试」。必须让服务端知道「这次任务的
 * 正式测试已经交过了」。
 */
import { describe, it, expect, vi } from 'vitest';
import { LessonService } from './lesson.service';
import { VocabQuizAttemptService } from '../vocab/vocab-quiz-attempt.service';

const STUDENT = 'stu-1';
const DLC_ID = 'dlc-1';

// ─────────────────────────────────────────────────────────────
// LessonService.today() 的假 Prisma
// ─────────────────────────────────────────────────────────────

function lessonSvc(o: {
  stage?: string;
  drillTarget?: number;
  drillProgress?: number;
  quizSubmitted?: boolean;
  vocabWords?: string[] | null;
  /** S12L —— 队列里的词教过没有（词段进度的新口径）。 */
  taught?: boolean;
}) {
  const drillQueued = Math.max(0, (o.drillTarget ?? 5) - (o.drillProgress ?? 0));
  const frozen = {
    id: DLC_ID,
    studentId: STUDENT,
    date: new Date(),
    readTarget: 1,
    readProgress: 1,
    readDoneAt: new Date(),
    readSource: 'student',
    vocabTarget: 4,
    vocabProgress: 4,
    vocabDoneAt: new Date(),
    drillTarget: o.drillTarget ?? 5,
    drillProgress: o.drillProgress ?? 0,
    drillDoneAt: null,
    stage: o.stage ?? 'vocab_test',
    vocabCursor: 4,
    vocabWords: o.vocabWords === undefined ? ['alpha', 'beta', 'gamma', 'delta'] : o.vocabWords,
    rulesVersion: 99,
    targetsFrozenAt: new Date(),
  };
  const prisma: any = {
    dailyLessonCompletion: {
      findUnique: vi.fn().mockResolvedValue(frozen),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue(frozen),
      create: vi.fn().mockResolvedValue(frozen),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ englishLevel: 'ielts_authentic' }),
      findFirst: vi.fn().mockResolvedValue({ id: STUDENT, name: '验收学生' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    morningQuizSession: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'sess-1',
          level: 'ielts_authentic',
          quizEnd: new Date(Date.now() + 3600_000),
          makeupStart: null,
          makeupEnd: null,
          classId: 'c1',
          date: new Date(),
          class: { name: '验收班' },
          paperAssignment: {
            id: 'asg-1',
            paper: { id: 'p1', name: '今天的文章', totalMarksActual: 4, _count: { questions: 4 } },
          },
        },
      ]),
    },
    studentSubmission: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'sub-1',
        assignmentId: 'asg-1',
        finalSubmittedAt: new Date(),
        submitSource: 'student',
        autoFinalizeReason: null,
        status: 'submitted',
        totalScore: null,
        maxScore: 4,
      }),
    },
    mistakeEntry: { count: vi.fn().mockResolvedValue(o.drillProgress ?? 0) },
    wordReviewLog: { findMany: vi.fn().mockResolvedValue([]) },
    vocabQuizAttempt: {
      findFirst: vi.fn().mockResolvedValue(
        o.quizSubmitted === false
          ? null
          : { status: 'submitted', submittedAt: new Date(), total: 4, correct: 3, score: 75, items: [] },
      ),
    },
    studentWord: {
      // S12L —— 照 where 真的过滤。词段进度现在数的是「队列里教过几个」，
      // 假实现若无视 `firstTaughtAt: { not: null }`，测的就是假货：一批
      // 从没教过的词会被算成全教过，背段直接跳成 done。
      findMany: vi.fn(async (args: any) => {
        const all = ['alpha', 'beta', 'gamma', 'delta'].map((headword) => ({
          headword,
          firstTaughtAt: o.taught === false ? null : new Date(),
        }));
        const rows = args?.where?.firstTaughtAt?.not === null
          ? all.filter((w) => w.firstTaughtAt != null)
          : all;
        const inList = args?.where?.headword?.in;
        return Array.isArray(inList) ? rows.filter((w) => inList.includes(w.headword)) : rows;
      }),
      count: vi.fn().mockResolvedValue(0),
    },
  };
  const words: any = { resolveStudent: vi.fn().mockResolvedValue({ id: STUDENT, name: '验收学生' }) };
  const mistakes: any = {
    practiceQueue: vi.fn().mockResolvedValue({
      items: Array.from({ length: drillQueued }, (_, i) => ({ id: `m${i}` })),
      remaining: drillQueued,
    }),
  };
  return new LessonService(prisma, words, {} as any, mistakes);
}

const today = (svc: LessonService) =>
  (svc as any).getToday({ studentName: '', authStudentId: STUDENT });

// ─────────────────────────────────────────────────────────────
// 1. 真实 today() 的主行动
// ─────────────────────────────────────────────────────────────

describe('S12H/1 —— 真实 LessonService.today() 的主行动', () => {
  //
  // S12L —— **错题本在试点期整个暂停**（`lesson/pilot-flags.ts`）。
  //
  // 这一组原本钉的是「补段欠着就该给 drill」。那条路由规则本身没被删，
  // 仍然由 `drill-flow.spec.ts` 与 `next-action.spec.ts` 逐条覆盖（纯函数
  // 层）。这里改成钉**暂停之后真实服务的行为**：补段不出现、不挡路、
  // 不进分母 —— 一个学生绝不该被引导去一个进不去的段落。
  //
  // 恢复错题本时把 `MISTAKES_FEATURE` 改回 `available`，这一组要跟着
  // 改回去；那正是它存在的意义。

  it('补段暂停：测试交过了 + 库里还欠着 5 道 → 直接给总结，不给 drill', async () => {
    const r: any = await today(lessonSvc({ stage: 'vocab_test', drillTarget: 5, drillProgress: 0 }));
    expect(r.nextAction.kind).toBe('summary');
  });

  it('补段暂停：测试**还没交** → 仍然是 vocab_test，考试这一关没被顺带跳过', async () => {
    const r: any = await today(
      lessonSvc({ stage: 'vocab_test', drillTarget: 5, drillProgress: 0, quizSubmitted: false, taught: false }),
    );
    expect(r.nextAction.kind).toBe('vocab_test');
  });

  it('补段做完 5 / 5 → summary（暂停与否都一样）', async () => {
    const r: any = await today(lessonSvc({ stage: 'vocab_test', drillTarget: 5, drillProgress: 5 }));
    expect(r.nextAction.kind).toBe('summary');
  });

  it('今天没有补段（target 0）→ summary', async () => {
    const r: any = await today(lessonSvc({ stage: 'vocab_test', drillTarget: 0, drillProgress: 0 }));
    expect(r.nextAction.kind).toBe('summary');
  });

  it('补段段落标成不可用，且**不进分母**（今天是 2 段不是 3 段）', async () => {
    const r: any = await today(lessonSvc({ stage: 'vocab_test', drillTarget: 5, drillProgress: 0 }));
    const drill = r.segments.find((x: any) => x.key === 'drill');
    expect(drill.available).toBe(false);
    expect(drill.unavailableReason).toContain('暂未开放');
    expect(drill.target).toBe(0);
    expect(r.total).toBe(2);
  });

  it('暂停期间**一次错题查询都不发**', async () => {
    const svc = lessonSvc({ stage: 'vocab_test', drillTarget: 5, drillProgress: 0 });
    const mistakes = (svc as any).mistakes;
    await today(svc);
    expect(mistakes.practiceQueue).not.toHaveBeenCalled();
  });

  it('主行动只由服务端事实决定 —— 请求里塞补段字段也改不了结论', async () => {
    const svc = lessonSvc({ stage: 'vocab_test', drillTarget: 5, drillProgress: 0 });
    const r: any = await (svc as any).getToday({
      studentName: '',
      authStudentId: STUDENT,
      // 这些都不是合法入参；就算硬塞也不能改变结论
      drillTarget: 99,
      drillProgress: 0,
      drillSettled: false,
    });
    expect(r.nextAction.kind).toBe('summary');
    // href 从来不参与新端导航（前端只认 kind），但它绝不能带身份
    expect(String(r.nextAction.href ?? '')).not.toContain(STUDENT);
    expect(String(r.nextAction.href ?? '')).not.toContain('name=');
  });
});

// ─────────────────────────────────────────────────────────────
// 2. 真实的正式测试交卷事务
// ─────────────────────────────────────────────────────────────

function attemptSvc(o: { drillTarget: number; drillProgress: number; stage?: string; already?: boolean }) {
  const attempt = {
    id: 'att-1',
    studentId: STUDENT,
    date: new Date(),
    dailyLessonCompletionId: DLC_ID,
    status: o.already ? 'submitted' : 'in_progress',
    startedAt: new Date(),
    submittedAt: o.already ? new Date() : null,
    total: 4,
    correct: 3,
    score: 75,
    items: [
      { qtype: 'spelling', headword: 'alpha', isCorrect: true },
      { qtype: 'cloze', headword: 'beta', isCorrect: true },
      { qtype: 'word_to_meaning', headword: 'gamma', isCorrect: true },
      { qtype: 'meaning_to_word', headword: 'delta', isCorrect: false },
    ],
  };
  const dlcUpdates: any[] = [];
  const dlcRow = {
    id: DLC_ID,
    stage: o.stage ?? 'vocab_test',
    drillTarget: o.drillTarget,
    drillProgress: o.drillProgress,
  };
  const tx: any = {
    vocabQuizAttempt: {
      updateMany: vi.fn().mockResolvedValue({ count: o.already ? 0 : 1 }),
    },
    dailyLessonCompletion: {
      findUnique: vi.fn().mockResolvedValue(dlcRow),
      updateMany: vi.fn().mockImplementation(async (args: any) => {
        dlcUpdates.push(args);
        return { count: 1 };
      }),
    },
  };
  const prisma: any = {
    vocabQuizAttempt: {
      findFirst: vi.fn().mockResolvedValue(attempt),
      findUnique: vi.fn().mockResolvedValue({ ...attempt, status: 'submitted' }),
    },
    studentWord: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    wordReviewLog: { create: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn().mockImplementation(async (fn: any) => fn(tx)),
  };
  const words: any = { resolveStudent: vi.fn().mockResolvedValue({ id: STUDENT, name: '验收学生' }) };
  const svc = new VocabQuizAttemptService(prisma, words, {} as any);
  return { svc, prisma, dlcUpdates };
}

const submit = (svc: VocabQuizAttemptService) =>
  (svc as any).submit({ studentName: '', authStudentId: STUDENT });

const stageWritten = (dlcUpdates: any[]) =>
  dlcUpdates.length ? dlcUpdates[dlcUpdates.length - 1].data?.stage : undefined;

describe('S12H/1 —— 真实的正式测试交卷事务', () => {
  it('补段 0 / 5 → 阶段停在 vocab_test', async () => {
    const { svc, dlcUpdates } = attemptSvc({ drillTarget: 5, drillProgress: 0 });
    await submit(svc);
    expect(stageWritten(dlcUpdates), '交卷把没做完的一天推成了 done').toBe('vocab_test');
  });

  it('补段 2 / 5 → 阶段停在 vocab_test', async () => {
    const { svc, dlcUpdates } = attemptSvc({ drillTarget: 5, drillProgress: 2 });
    await submit(svc);
    expect(stageWritten(dlcUpdates)).toBe('vocab_test');
  });

  it('补段 5 / 5 → 进 done', async () => {
    const { svc, dlcUpdates } = attemptSvc({ drillTarget: 5, drillProgress: 5 });
    await submit(svc);
    expect(stageWritten(dlcUpdates)).toBe('done');
  });

  it('今天没有补段（target 0）→ 进 done', async () => {
    const { svc, dlcUpdates } = attemptSvc({ drillTarget: 0, drillProgress: 0 });
    await submit(svc);
    expect(stageWritten(dlcUpdates)).toBe('done');
  });

  it('重复交卷：条件更新匹配 0 行，不写阶段，也不重算成绩', async () => {
    const { svc, dlcUpdates } = attemptSvc({ drillTarget: 5, drillProgress: 0, already: true });
    const r: any = await submit(svc);
    expect(r.alreadySubmitted).toBe(true);
    expect(dlcUpdates.length).toBe(0);
  });

  it('阶段写入仍然带条件（只从 vocab_test 往前走），不会让 done 回退', async () => {
    const { svc, dlcUpdates } = attemptSvc({ drillTarget: 5, drillProgress: 0 });
    await submit(svc);
    expect(dlcUpdates[0].where.stage).toBe('vocab_test');
    expect(dlcUpdates[0].where.id).toBe(DLC_ID);
  });

  it('交卷不写 StudentWord、也不写 WordReviewLog', async () => {
    const { svc, prisma } = attemptSvc({ drillTarget: 5, drillProgress: 0 });
    await submit(svc);
    expect(prisma.studentWord.update).not.toHaveBeenCalled();
    expect(prisma.studentWord.updateMany).not.toHaveBeenCalled();
    expect(prisma.wordReviewLog.create).not.toHaveBeenCalled();
    expect(prisma.wordReviewLog.createMany).not.toHaveBeenCalled();
  });

  it('成绩仍然由服务端算：4 题对 3 → 75 分', async () => {
    const { svc, prisma } = attemptSvc({ drillTarget: 5, drillProgress: 0 });
    await submit(svc);
    const call = (prisma.$transaction as any).mock.calls.length;
    expect(call).toBe(1);
  });

  it('补段事实取自库里的任务行，请求里塞什么都不作数', async () => {
    const { svc, dlcUpdates } = attemptSvc({ drillTarget: 5, drillProgress: 0 });
    await (svc as any).submit({
      studentName: '',
      authStudentId: STUDENT,
      drillSettled: true,
      drillProgress: 5,
    });
    expect(stageWritten(dlcUpdates)).toBe('vocab_test');
  });
});
