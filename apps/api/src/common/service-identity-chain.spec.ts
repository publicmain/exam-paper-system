import { describe, it, expect, vi } from 'vitest';
import { LessonService } from '../lesson/lesson.service';
import { StudentWordService } from '../vocab/student-word.service';
import { VocabReviewService } from '../vocab/vocab-review.service';
import { VocabQuizService } from '../vocab/vocab-quiz.service';
import { VocabQuizAttemptService } from '../vocab/vocab-quiz-attempt.service';
import { MistakeService } from '../vocab/mistake.service';

/**
 * **服务层**的 token-only 身份契约 —— 只 mock Prisma，服务全是真的。
 *
 * ## 为什么控制器层的测试挡不住这一类
 *
 * 上一轮的 26 条运行期用例用真控制器 + **假服务**。它证明的是
 * 「控制器把 authStudentId 交给了服务」，到此为止。服务**内部**再调另一个
 * 身份相关的方法时把 authStudentId 丢掉 —— 假服务根本不会执行那段代码，
 * 于是全绿。
 *
 * 真实后果有两种形态：
 *
 * 1. `markTaughtAndAdvance` 先在事务里写了 `firstTaughtAt` / `vocabCursor`，
 *    **然后**才调 `startOrResumeToday`，而那一步丢了身份 → 事务已提交、
 *    请求却 400。**部分写入 + 身份错误**，最糟的一种。
 * 2. `VocabQuizAttempt.start` 在建 attempt **之前**调 `buildQuiz`，同样丢
 *    身份 → 没有脏数据，但 token-only 请求直接失败。
 *
 * 所以这个文件的判据是：**同一次请求里的第二次身份解析，仍然按令牌的
 * 精确 id 查人**。
 */

const ID = 'stu-token-1';
const OTHER = 'stu-other';

type Rec = { calls: { m: string; args: unknown[] }[] };

/**
 * 宽松的假 Prisma：未预置的读回空、写回 count 0。
 *
 * 之所以不逐表精确造数据：这里要验的是**身份怎么传**，不是课程状态怎么算。
 * 「什么都没有」的学生正好走最短路径，把身份链完整跑一遍。
 */
function makePrisma(rec: Rec, results: Record<string, unknown> = {}) {
  const proxy: Record<string, unknown> = new Proxy({} as Record<string, unknown>, {
    get(_t, model) {
      if (typeof model !== 'string') return undefined;
      if (model === '$transaction') {
        return async (arg: unknown) =>
          typeof arg === 'function'
            ? (arg as (tx: unknown) => unknown)(proxy)
            : Promise.all(arg as Promise<unknown>[]);
      }
      return new Proxy({} as Record<string, unknown>, {
        get(_t2, op) {
          if (typeof op !== 'string') return undefined;
          return vi.fn(async (...args: unknown[]) => {
            const key = `${model}.${op}`;
            rec.calls.push({ m: key, args });
            if (key in results) {
              const v = results[key];
              return typeof v === 'function' ? (v as (...a: unknown[]) => unknown)(...args) : v;
            }
            if (op === 'findMany') return [];
            if (op.startsWith('find')) return null;
            if (op === 'count') return 0;
            if (op.endsWith('Many')) return { count: 0 };
            return {};
          });
        },
      });
    },
  });
  return proxy;
}

/** 在读学生一名。`findFirst`/`findUnique` 按 where.id 回，查不到就 null。 */
const eligibleRow = { id: ID, name: '张三', englishLevel: 'olevel' };
const userLookup = (args: unknown) => {
  const w = (args as { where?: Record<string, unknown> }).where ?? {};
  if (w.id === ID) return eligibleRow;
  if (w.name === '张三') return eligibleRow;
  return null;
};

function build(rec: Rec, results: Record<string, unknown> = {}) {
  const prisma = makePrisma(rec, {
    'user.findFirst': userLookup,
    'user.findUnique': userLookup,
    'user.findMany': (args: unknown) => {
      const r = userLookup(args);
      return r ? [r] : [];
    },
    ...results,
  }) as never;
  const vocab = {} as never;
  const words = new StudentWordService(prisma, vocab);
  const review = new VocabReviewService(prisma, words);
  const mistakes = new MistakeService(prisma);
  const quiz = new VocabQuizService(prisma, words, review);
  const attempts = new VocabQuizAttemptService(prisma, words, quiz);
  const lesson = new LessonService(prisma, words, review, mistakes);
  return { prisma, words, review, mistakes, quiz, attempts, lesson, rec };
}

/** token-only 的入参：有 authStudentId，姓名是空串，没有请求侧 studentId。 */
const tokenOnly = <T extends object>(extra: T) =>
  ({ studentName: '', studentId: undefined, authStudentId: ID, ...extra });

/** 一次「按姓名查人」的解析（旧路径的形状）。 */
const nameLookups = (rec: Rec) =>
  rec.calls.filter(
    (c) =>
      (c.m === 'user.findFirst' || c.m === 'user.findMany') &&
      'name' in (((c.args[0] as { where?: object })?.where ?? {}) as object),
  );
/** 一次「按令牌 id 查人」的解析。 */
const idLookups = (rec: Rec) =>
  rec.calls.filter(
    (c) =>
      (c.m === 'user.findFirst' || c.m === 'user.findMany') &&
      ((c.args[0] as { where?: { id?: string } })?.where ?? {}).id === ID,
  );

// ─────────────────────────────────────────────────────────────
// 缺陷 ①：markTaughtAndAdvance → startOrResumeToday 丢身份
// ─────────────────────────────────────────────────────────────

describe('LessonService.markTaughtAndAdvance 的内部身份传递', () => {
  it('**token-only 调用不再「先写一半再报身份错误」**', async () => {
    const rec: Rec = { calls: [] };
    const { lesson } = build(rec, {
      // 词已在本子里（不然第一步就 404，验不到后面的链）
      'studentWord.findUnique': { id: 'sw1' },
      'studentWord.updateMany': { count: 1 },
    });

    await expect(
      lesson.markTaughtAndAdvance(tokenOnly({ headword: 'ephemeral', cursor: 0 })),
    ).resolves.toBeTruthy();

    // 事务里的写确实发生了 —— 也正因为它先发生，身份错误才格外糟
    expect(rec.calls.some((c) => c.m === 'studentWord.updateMany')).toBe(true);
  });

  it('**第二次解析仍按令牌 id 查人，一次姓名查询都没有**', async () => {
    const rec: Rec = { calls: [] };
    const { lesson } = build(rec, {
      'studentWord.findUnique': { id: 'sw1' },
      'studentWord.updateMany': { count: 1 },
    });
    await lesson.markTaughtAndAdvance(tokenOnly({ headword: 'ephemeral', cursor: 0 }));

    // 至少两次：markTaughtAndAdvance 自己一次 + today() 里一次
    expect(idLookups(rec).length).toBeGreaterThanOrEqual(2);
    expect(nameLookups(rec), '走了按姓名查人 —— 身份在服务内部被丢掉了').toEqual([]);
  });

  it('**内部 today() 拿到的是库里解析出的 id**，不是空姓名', async () => {
    const rec: Rec = { calls: [] };
    const { lesson } = build(rec, {
      'studentWord.findUnique': { id: 'sw1' },
      'studentWord.updateMany': { count: 1 },
    });
    await lesson.markTaughtAndAdvance(tokenOnly({ headword: 'ephemeral', cursor: 0 }));
    // 今日任务行按 studentId 查 —— 那个 id 必须是令牌的
    const dlc = rec.calls.find((c) => c.m === 'dailyLessonCompletion.findUnique');
    expect(dlc).toBeDefined();
    const where = (dlc!.args[0] as { where: { studentId_date?: { studentId: string } } }).where;
    expect(where.studentId_date?.studentId).toBe(ID);
  });

  it('旧客户端（无令牌 + 姓名）行为不变', async () => {
    const rec: Rec = { calls: [] };
    const { lesson } = build(rec, {
      'studentWord.findUnique': { id: 'sw1' },
      'studentWord.updateMany': { count: 1 },
    });
    await expect(
      lesson.markTaughtAndAdvance({ studentName: '张三', headword: 'ephemeral', cursor: 0 }),
    ).resolves.toBeTruthy();
    expect(nameLookups(rec).length, '旧路径就该按姓名查').toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────
// getToday / startOrResumeToday 直接调用
// ─────────────────────────────────────────────────────────────

describe('LessonService.getToday / startOrResumeToday 直接吃 authStudentId', () => {
  for (const [label, call] of [
    ['getToday', (s: LessonService) => s.getToday(tokenOnly({}))],
    ['startOrResumeToday', (s: LessonService) => s.startOrResumeToday(tokenOnly({}))],
  ] as const) {
    it(`**${label}(authStudentId) 直接调用就能解析**，不靠控制器预先塞 studentId`, async () => {
      const rec: Rec = { calls: [] };
      const { lesson } = build(rec);
      await expect(call(lesson)).resolves.toBeTruthy();
      expect(idLookups(rec).length).toBeGreaterThanOrEqual(1);
      expect(nameLookups(rec)).toEqual([]);
    });
  }

  it('**资格谓词就是阶段 5A 那一套**（role + isActive + archivedAt + 在读班级）', async () => {
    const rec: Rec = { calls: [] };
    const { lesson } = build(rec);
    await lesson.getToday(tokenOnly({}));
    const w = (idLookups(rec)[0].args[0] as { where: Record<string, unknown> }).where;
    expect(w.role).toBe('student');
    expect(w.isActive).toBe(true);
    expect(w.archivedAt).toBeNull();
    expect(w.classEnrollments).toEqual({
      some: { role: 'student', class: { archivedAt: null } },
    });
  });

  it('**令牌身份对不上在读条件 → student_not_eligible**，不回落到姓名查询', async () => {
    const rec: Rec = { calls: [] };
    const { lesson } = build(rec, { 'user.findFirst': null, 'user.findMany': [] });
    await expect(lesson.getToday(tokenOnly({}))).rejects.toMatchObject({
      response: { code: 'student_not_eligible' },
    });
    expect(nameLookups(rec)).toEqual([]);
  });

  it('旧调用（只有 studentId）走原来的 id 路径，谓词一字未改', async () => {
    const rec: Rec = { calls: [] };
    const { lesson } = build(rec);
    await expect(lesson.getToday({ studentName: '', studentId: ID })).resolves.toBeTruthy();
    const w = (idLookups(rec)[0].args[0] as { where: Record<string, unknown> }).where;
    // 旧 id 路径本来就没查 role / archivedAt —— 不得因为本次修复被收紧
    expect(w).not.toHaveProperty('role');
    expect(w).not.toHaveProperty('archivedAt');
  });

  it('旧调用（只有姓名）仍然按姓名查', async () => {
    const rec: Rec = { calls: [] };
    const { lesson } = build(rec);
    await expect(lesson.getToday({ studentName: '张三' })).resolves.toBeTruthy();
    expect(nameLookups(rec).length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────
// 缺陷 ②：VocabQuizAttempt.start → buildQuiz 丢身份
// ─────────────────────────────────────────────────────────────

describe('VocabQuizAttemptService.start 的内部身份传递', () => {
  /** 走到 buildQuiz 需要：今日任务行 + stage=vocab_test + 已教的词。 */
  const readyForQuiz = {
    'dailyLessonCompletion.findUnique': {
      id: 'dlc1',
      vocabWords: ['alpha', 'beta', 'gamma', 'delta'],
      stage: 'vocab_test',
    },
    'vocabQuizAttempt.findFirst': null,
    'studentWord.findMany': ['alpha', 'beta', 'gamma', 'delta'].map((w, i) => ({
      id: `sw${i}`, headword: w, contextSentence: null, reps: 1, firstTaughtAt: new Date(),
    })),
  };

  it('**token-only 走到 buildQuiz 时身份还在**（第二次解析仍按 id）', async () => {
    const rec: Rec = { calls: [] };
    const { attempts } = build(rec, readyForQuiz);
    // 出题数量可能不够而抛业务错 —— 那不影响本判据：只要不是身份错误，
    // 且第二次解析确实按 id 查了人。
    await attempts.start(tokenOnly({})).catch((e: unknown) => {
      const code = (e as { response?: { code?: string } })?.response?.code;
      expect(
        ['name_required', 'student_not_eligible', 'multiple_students_with_same_name'],
        `start 抛了身份错误：${code}`,
      ).not.toContain(code);
    });
    expect(idLookups(rec).length).toBeGreaterThanOrEqual(2);
    expect(nameLookups(rec), 'buildQuiz 里回落到了按姓名查人').toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// 组合点清单 —— 新增一个「服务调服务」的身份点就必须在这里登记
// ─────────────────────────────────────────────────────────────

describe('内部身份组合点清单', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

  it('**in-scope 服务里，服务调服务的身份点恰好两处，且都带上了 authStudentId**', () => {
    const points = [
      ['lesson/lesson.service.ts', 'this.startOrResumeToday({'],
      ['vocab/vocab-quiz-attempt.service.ts', 'this.quiz.buildQuiz({'],
    ] as const;
    for (const [file, marker] of points) {
      const src = read(file);
      const at = src.indexOf(marker);
      expect(at, `${file} 找不到 ${marker}`).toBeGreaterThan(-1);
      const block = src.slice(at, at + 400);
      expect(block, `${file} 的 ${marker} 没有把 authStudentId 传下去`).toMatch(/authStudentId/);
    }
  });

  it('**范围外的解析点不得被顺手改动**（skill-profile / practice / trend 等）', () => {
    const src = read('morning-quiz/morning-quiz.service.ts');
    // 这六处 out-of-scope 的调用仍然是两参数形态
    const twoArg = [...src.matchAll(/this\.resolveStudentByName\(\s*\w+,\s*\w+\s*\)/g)];
    expect(twoArg.length).toBeGreaterThanOrEqual(3);
  });
});
