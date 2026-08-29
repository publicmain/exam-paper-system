import { describe, it, expect, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { VocabQuizAttemptService } from '../vocab/vocab-quiz-attempt.service';
import { LESSON_RULES_VERSION } from './lesson-rules';

/**
 * S9D1 —— **保存复习断点时要把阶段一起对齐**。
 *
 * ## 缺陷
 *
 * 正式测试的阶段门读的是**落库**的 `DailyLessonCompletion.stage`：
 *
 * ```
 * const stage = String(dlc.stage ?? STAGE_ORDER[0]);
 * if (stageRank(stage) !== stageRank('vocab_test'))
 *     throw new ConflictException({ code: 'stage_not_ready', stage });
 * ```
 *
 * 而 `/lesson/today` 返回的是**推导 + 钳制之后**的阶段。两者只在有人把推导值
 * 写回库时才一致，而写回只发生在 `today(freeze:true)`。
 *
 * 教学路径早就补过这一刀：`markTaughtAndAdvance()` 落完卡片进度之后会调
 * `startOrResumeToday({freeze:true})`，它自己的注释写着「不落库的话学生教完
 * 最后一张卡也开不了正式测试」。
 *
 * **复习路径没有这一刀。** `saveVocabCursor()` 只写 cursor，于是纯复习日
 * 走完四张卡之后：`/lesson/today` 说 `vocab_test`、UI 显示「开始单词测试」、
 * 点下去 `attempt/start` 读到落库的 `reading` → 409 `stage_not_ready` → 弹回
 * 今天的课。学生靠自己出不去。staging 上的 `t5_review` 实测如此。
 *
 * 修法就是补上同一刀：**确认当日任务行存在之后**，走同一个
 * `startOrResumeToday`。规则不在这里重写一份。
 */

type Row = {
  id: string;
  studentId: string;
  date: Date;
  stage: string;
  vocabCursor: number;
  rulesVersion: number;
  vocabWords: string[] | null;
  readTarget: number;
  vocabTarget: number;
  drillTarget: number;
  targetsFrozenAt: Date | null;
  stageAt: Date | null;
};

const QUEUE4 = ['ripple', 'vessel', 'willow', 'anchor'];
const DAY = new Date('2026-08-28T16:00:00.000Z');

/** 教过的复习词（reps>0、firstTaughtAt 已写）——纯复习日的形状。 */
const reviewWord = (headword: string) => ({
  headword,
  firstTaughtAt: new Date('2026-08-01'),
  reps: 5,
});

/**
 * 有状态的假 Prisma：任务行 + 学生拥有的词 + 当日 attempt。
 *
 * 没有阅读场次 → 读段 target 0 → 读段算「完成」，阶段判定因此完全落在
 * 课程卡与 cursor 上，正是本片要测的。
 */
function makeSvc(opts: {
  row?: Partial<Row> | null;
  owned?: Array<{ headword: string; firstTaughtAt: Date | null; reps: number }>;
  attempt?: { status: string } | null;
}) {
  const owned = opts.owned ?? QUEUE4.map(reviewWord);
  let row: Row | null =
    opts.row === null
      ? null
      : {
          id: 'dlc1', studentId: 'stu-1', date: DAY, stage: 'reading', vocabCursor: 0,
          rulesVersion: LESSON_RULES_VERSION, vocabWords: QUEUE4,
          readTarget: 0, vocabTarget: 4, drillTarget: 0,
          targetsFrozenAt: new Date(), stageAt: null,
          ...opts.row,
        };

  const matches = (w: (typeof owned)[number], where: any): boolean => {
    if (where?.headword?.in && !where.headword.in.includes(w.headword)) return false;
    if (where?.firstTaughtAt === null && w.firstTaughtAt !== null) return false;
    if (where?.firstTaughtAt?.not === null && w.firstTaughtAt === null) return false;
    if (where?.reps === 0 && w.reps !== 0) return false;
    return true;
  };

  const writes: string[] = [];
  const prisma: any = {
    user: {
      findUnique: async () => ({ englishLevel: 'olevel' }),
      // token 路径走 resolveAuthenticatedStudent(prisma, authStudentId)
      findFirst: async () => ({ id: 'stu-1', name: '测试五号' }),
      updateMany: async () => ({ count: 0 }),
    },
    morningQuizSession: { findMany: async () => [] },
    studentSubmission: {
      findFirst: async () => null,
      create: () => { throw new Error('保存断点不得写阅读答卷'); },
      update: () => { throw new Error('保存断点不得写阅读答卷'); },
    },
    mistakeEntry: { count: async () => 0 },
    wordReviewLog: {
      findMany: async () => [],
      create: () => { throw new Error('保存断点不得写复习流水'); },
      delete: () => { throw new Error('保存断点不得写复习流水'); },
    },
    vocabQuizAttempt: {
      findFirst: async () => opts.attempt ?? null,
      create: () => { throw new Error('保存断点不得建正式测试'); },
      updateMany: () => { throw new Error('保存断点不得改正式测试'); },
    },
    studentWord: {
      findMany: async ({ where }: any) =>
        owned.filter((w) => matches(w, where)).map((w) => ({ headword: w.headword })),
      count: async ({ where }: any) => owned.filter((w) => matches(w, where)).length,
      update: () => { throw new Error('保存断点不得改 FSRS 字段'); },
      updateMany: () => { throw new Error('保存断点不得改 FSRS 字段'); },
    },
    dailyLessonCompletion: {
      findUnique: async () => (row ? { ...row } : null),
      findMany: async () => [],
      create: async ({ data }: any) => {
        writes.push('dlc.create');
        row = {
          id: 'dlc1', studentId: 'stu-1', date: DAY, stage: data.stage ?? 'reading',
          vocabCursor: data.vocabCursor ?? 0,
          rulesVersion: data.rulesVersion ?? LESSON_RULES_VERSION,
          vocabWords: data.vocabWords ?? null,
          readTarget: data.readTarget ?? 0, vocabTarget: data.vocabTarget ?? 0,
          drillTarget: data.drillTarget ?? 0, targetsFrozenAt: new Date(), stageAt: null,
        };
        return { ...row };
      },
      update: async ({ data }: any) => {
        writes.push('dlc.update:' + Object.keys(data).sort().join(','));
        row = { ...(row as Row), ...data };
        return { ...(row as Row) };
      },
      updateMany: async ({ where, data }: any) => {
        writes.push('dlc.updateMany:' + Object.keys(data).sort().join(','));
        if (!row) return { count: 0 };
        // 忠实模拟条件写：vocabCursor: { lt: wanted } 不满足就是 0 行
        if (where?.vocabCursor?.lt !== undefined && !(row.vocabCursor < where.vocabCursor.lt)) {
          return { count: 0 };
        }
        if (where?.stage?.in !== undefined && !where.stage.in.includes(row.stage)) {
          return { count: 0 };
        }
        if (typeof where?.stage === 'string' && row.stage !== where.stage) return { count: 0 };
        if (where?.id !== undefined && where.id !== row.id) return { count: 0 };
        row = { ...row, ...data };
        return { count: 1 };
      },
    },
  };
  const words: any = {
    resolveStudent: vi.fn(async (name: string, id?: string, auth?: string) => {
      if (!name && !id && !auth) throw new Error('name_required');
      return { id: 'stu-1', name: '测试五号' };
    }),
  };
  const svc = new LessonService(prisma, words, {} as any, { practiceQueue: async () => ({ items: [] }) } as any);
  return { svc, storedRow: () => row, writes, resolveStudent: words.resolveStudent };
}

/** 正式测试的阶段门 —— **原样使用，不改一个字**，只喂它落库的那一行。 */
function quizStartAgainst(row: Row | null) {
  const prisma: any = {
    dailyLessonCompletion: {
      findUnique: async () => (row ? { id: row.id, vocabWords: row.vocabWords, stage: row.stage } : null),
    },
    vocabQuizAttempt: { findFirst: async () => null },
    studentWord: { findMany: async () => [] },
  };
  const words: any = { resolveStudent: vi.fn(async () => ({ id: 'stu-1', name: '测试五号' })) };
  return new VocabQuizAttemptService(prisma, words, {} as any);
}

// ─────────────────────────────────────────────────────────────
// AC-01 / AC-02 最后一张卡之后阶段要落库
// ─────────────────────────────────────────────────────────────

describe('AC-02 保存最后一张复习卡的断点 → 阶段落库为 vocab_test', () => {
  it('**cursor 3 → 4：落库阶段必须变成 vocab_test**（修复前停在 reading）', async () => {
    const { svc, storedRow } = makeSvc({ row: { stage: 'reading', vocabCursor: 3 } });
    const r = await svc.saveVocabCursor({ studentName: '测试五号', cursor: 4 });

    expect(r).toEqual({ ok: true, cursor: 4, stored: true }); // 响应形状一个字段不变
    expect(storedRow()!.vocabCursor).toBe(4);
    expect(storedRow()!.stage).toBe('vocab_test');
  });

  it('**重复上报 cursor 4（已完成）也要对齐阶段**', async () => {
    const { svc, storedRow } = makeSvc({ row: { stage: 'reading', vocabCursor: 4 } });
    const r = await svc.saveVocabCursor({ studentName: '测试五号', cursor: 4 });

    // 条件写匹配 0 行 → 回读真实值；形状不变
    expect(r).toEqual({ ok: true, cursor: 4, stored: true });
    expect(storedRow()!.vocabCursor).toBe(4);
    expect(storedRow()!.stage).toBe('vocab_test');
  });

  it('**落库阶段对齐之后，正式测试的阶段门才放行**', async () => {
    const { svc, storedRow } = makeSvc({ row: { stage: 'reading', vocabCursor: 3 } });

    // 对齐之前：阶段门原样拒绝（这正是 staging 上 t5 撞到的 409）
    await expect(
      quizStartAgainst({ ...(storedRow() as Row), stage: 'reading' }).start({ studentName: '测试五号' }),
    ).rejects.toThrow(ConflictException);

    await svc.saveVocabCursor({ studentName: '测试五号', cursor: 4 });

    // 对齐之后：不再是 stage_not_ready（后面因为没有可考的词而另行报错，
    // 那是资格判据，不是阶段门 —— 这里只证明阶段这一关过了）
    let code: string | undefined;
    await quizStartAgainst(storedRow()).start({ studentName: '测试五号' }).catch((e: any) => {
      code = e?.response?.code ?? e?.message;
    });
    expect(code).not.toBe('stage_not_ready');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-03 中途与单调安全
// ─────────────────────────────────────────────────────────────

describe('AC-03 中途、单调、既有阶段安全', () => {
  it('**cursor 1–3 仍留在 vocab_learn**（卡还没走完）', async () => {
    for (const c of [1, 2, 3]) {
      const { svc, storedRow } = makeSvc({ row: { stage: 'reading', vocabCursor: c - 1 } });
      await svc.saveVocabCursor({ studentName: '测试五号', cursor: c });
      expect(storedRow()!.vocabCursor, `cursor=${c}`).toBe(c);
      expect(storedRow()!.stage, `cursor=${c}`).toBe('vocab_learn');
    }
  });

  it('**旧标签页较小的 cursor 不会把进度冲回去**，阶段也不倒退', async () => {
    const { svc, storedRow } = makeSvc({ row: { stage: 'vocab_test', vocabCursor: 4 } });
    const r = await svc.saveVocabCursor({ studentName: '测试五号', cursor: 2 });
    expect(r).toEqual({ ok: true, cursor: 4, stored: true }); // 回读真实值
    expect(storedRow()!.vocabCursor).toBe(4);
    expect(storedRow()!.stage).toBe('vocab_test');
  });

  it('**落库 vocab_test / done 不因这次对齐而倒退**', async () => {
    for (const stored of ['vocab_test', 'done'] as const) {
      const { svc, storedRow } = makeSvc({ row: { stage: stored, vocabCursor: 4 } });
      await svc.saveVocabCursor({ studentName: '测试五号', cursor: 4 });
      expect(storedRow()!.stage, stored).toBe(stored);
    }
  });

  it('**已经开考的任务不会被拉回学词段**', async () => {
    const { svc, storedRow } = makeSvc({
      row: { stage: 'vocab_test', vocabCursor: 0 },
      attempt: { status: 'in_progress' },
    });
    await svc.saveVocabCursor({ studentName: '测试五号', cursor: 1 });
    expect(storedRow()!.stage).toBe('vocab_test');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-04 没有当日任务行
// ─────────────────────────────────────────────────────────────

describe('AC-04 没有当日任务行时什么都不建', () => {
  it('**返回既有形状，且绝不创建任务行**', async () => {
    const { svc, storedRow, writes } = makeSvc({ row: null });
    const r = await svc.saveVocabCursor({ studentName: '测试五号', cursor: 4 });

    expect(r).toEqual({ ok: true, cursor: 0, stored: false });
    expect(storedRow()).toBeNull();
    expect(writes.filter((w) => w.startsWith('dlc.create'))).toEqual([]);
    // 也没有任何 stage / cursor 落库
    expect(writes.filter((w) => w.includes('stage'))).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-05 令牌身份
// ─────────────────────────────────────────────────────────────

describe('AC-05 token-only 调用要把身份整条链传下去', () => {
  it('**只有 authStudentId 时也能对齐阶段**，不会掉进 name_required', async () => {
    const { svc, storedRow, resolveStudent } = makeSvc({ row: { stage: 'reading', vocabCursor: 3 } });
    const r = await svc.saveVocabCursor({ studentName: '', authStudentId: 'stu-1', cursor: 4 });

    expect(r).toEqual({ ok: true, cursor: 4, stored: true });
    expect(storedRow()!.stage).toBe('vocab_test');
    // 内部那次 today() 也必须拿到 authStudentId —— 否则第二次解析会空手
    for (const call of resolveStudent.mock.calls) {
      expect(call[0] === '' ? call[2] : true).toBeTruthy();
    }
    expect(resolveStudent.mock.calls.some((c: any[]) => c[2] === 'stu-1')).toBe(true);
  });

  it('**旧的姓名 / studentId 入口照旧可用**', async () => {
    const { svc, storedRow } = makeSvc({ row: { stage: 'reading', vocabCursor: 3 } });
    const r = await svc.saveVocabCursor({ studentName: '测试五号', studentId: 'stu-1', cursor: 4 });
    expect(r).toEqual({ ok: true, cursor: 4, stored: true });
    expect(storedRow()!.stage).toBe('vocab_test');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 写边界
// ─────────────────────────────────────────────────────────────

describe('AC-06 写边界', () => {
  it('**只碰任务行**：不写复习流水、不改 FSRS、不建正式测试、不碰答卷', async () => {
    // 假 Prisma 对这四类写一律抛异常；跑通即证明一次都没发生
    const { svc, writes } = makeSvc({ row: { stage: 'reading', vocabCursor: 3 } });
    await svc.saveVocabCursor({ studentName: '测试五号', cursor: 4 });
    for (const w of writes) expect(w.startsWith('dlc.')).toBe(true);
  });

  it('**cursor 的直接写仍然只有条件更新那一条**', async () => {
    const { svc, writes } = makeSvc({ row: { stage: 'reading', vocabCursor: 3 } });
    await svc.saveVocabCursor({ studentName: '测试五号', cursor: 4 });
    const cursorWrites = writes.filter((w) => w.includes('vocabCursor'));
    expect(cursorWrites).toEqual(['dlc.updateMany:vocabCursor']);
  });
});
