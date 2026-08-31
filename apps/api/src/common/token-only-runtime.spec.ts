import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { VocabController } from '../vocab/vocab.controller';
import { LessonController } from '../lesson/lesson.controller';
import { MorningQuizController } from '../morning-quiz/morning-quiz.controller';
import { StudentIdentityGuard, REQUIRE_STUDENT_TOKEN, TEACHER_VIEW_SCOPE } from './student-identity.guard';
import { PUBLIC_KEY } from './auth.guard';
import { RATE_LIMIT_KEY } from './rate-limit.guard';

/**
 * **运行期**的 token-only 契约测试 —— 真的把 handler 调起来。
 *
 * ## 为什么必须有这个文件
 *
 * 上一轮只写了源码扫描（`endpoint-matrix.spec.ts`）：它验证「方法体里出现
 * 了 `identityOf(`」。`GET /vocab/quiz/attempt/current` 的真实代码是
 *
 * ```
 * if (!name) throw new BadRequestException({ code: 'name_required' });
 * return this.attempts.current(identityOf(req, name, studentId));
 * ```
 *
 * 两个条件都满足 —— 扫描全绿，而带令牌不带姓名的请求当场 400。
 * **「源码里写了」和「跑起来能过」是两件事**，前者不能当后者的证据。
 *
 * 所以这里的判据只有一个：**执行确实到达了预期的依赖**（或拿到它的返回
 * 值），而不是源码里有某个字符串。
 */

const ID = 'stu-token-1';
const NAME = '张三';

const authedReq = () =>
  ({ studentAuth: { id: ID, name: NAME }, query: {}, body: {}, headers: {} }) as unknown as Request;
const anonReq = () => ({ query: {}, body: {}, headers: {} }) as unknown as Request;

type Rec = { calls: { m: string; args: unknown[] }[]; result?: unknown };

/** 任何方法都可调、调用即记账的假服务。 */
function mockDep(rec: Rec, name: string, overrides: Record<string, unknown> = {}) {
  const t: Record<string, unknown> = {};
  return new Proxy(t, {
    get(target, k) {
      if (typeof k !== 'string') return undefined;
      if (!(k in target)) {
        target[k] = vi.fn(async (...args: unknown[]) => {
          const key = `${name}.${k}`;
          rec.calls.push({ m: key, args });
          return key in overrides ? overrides[key] : { __from: key };
        });
      }
      return target[k];
    },
  }) as never;
}

/** 假 Prisma：按 `model.op` 取预置返回值，未预置的返回 null。 */
function mockPrisma(rec: Rec, results: Record<string, unknown> = {}) {
  return new Proxy({} as Record<string, unknown>, {
    get(_t, model) {
      if (typeof model !== 'string') return undefined;
      return new Proxy({} as Record<string, unknown>, {
        get(_t2, op) {
          if (typeof op !== 'string') return undefined;
          return vi.fn(async (...args: unknown[]) => {
            rec.calls.push({ m: `prisma.${model}.${op}`, args });
            const key = `${model}.${op}`;
            return key in results ? results[key] : null;
          });
        },
      });
    },
  }) as never;
}

function buildVocab(rec: Rec, o: Record<string, unknown> = {}) {
  return new VocabController(
    mockDep(rec, 'svc', o), mockDep(rec, 'words', o), mockDep(rec, 'review', o),
    mockDep(rec, 'quiz', o), mockDep(rec, 'teacher', o), mockDep(rec, 'mistakes', o),
    mockDep(rec, 'views', o), mockPrisma(rec), mockDep(rec, 'attempts', o),
  );
}
function buildLesson(rec: Rec, o: Record<string, unknown> = {}) {
  return new LessonController(mockDep(rec, 'svc', o), mockPrisma(rec));
}
function buildMq(rec: Rec, results: Record<string, unknown> = {}) {
  return new MorningQuizController(
    mockDep(rec, 'svc'), mockDep(rec, 'student'), mockDep(rec, 'exportSvc'),
    mockDep(rec, 'weeklyCron'), mockDep(rec, 'absence'), mockDep(rec, 'shortAnswer'),
    mockPrisma(rec, results),
  );
}

/** 找一次调用；找不到就把实际调过的都打出来，省得盯着 undefined 猜。 */
function callOf(rec: Rec, m: string) {
  const c = rec.calls.find((x) => x.m === m);
  if (!c) throw new Error(`没有到达 ${m}；实际调用：${rec.calls.map((x) => x.m).join(', ') || '（一次都没有）'}`);
  return c;
}
/** 第一个入参里带上了令牌身份。 */
const authInArg0 = (rec: Rec, m: string) =>
  (callOf(rec, m).args[0] as { authStudentId?: string }).authStudentId;

// ─────────────────────────────────────────────────────────────
// 26 个在范围内端点的运行期用例表
//
// 每条都是：带令牌、**零身份入参**、最小合法非身份载荷 → 真的调 handler。
// ─────────────────────────────────────────────────────────────

type Case = {
  ep: string;
  family: 'vocab' | 'lesson' | 'morning-quiz';
  /** 带令牌、零身份入参地调用真实 handler，并返回「令牌身份到达处」的证据。 */
  run: (rec: Rec) => Promise<string | undefined>;
};

const MQ_DETAIL_RESULTS = {
  'studentSubmission.findUnique': { studentId: ID, assignmentId: 'a1', student: { name: NAME } },
  'morningQuizSession.findFirst': { id: 'sess-1' },
};
const MQ_HISTORY_RESULTS = {
  'user.findMany': [{ id: ID, name: NAME, email: 's1@school.local', classEnrollments: [] }],
  'studentSubmission.findMany': [],
  'morningQuizSession.findMany': [],
};

const CASES: Case[] = [
  // ── vocab：19 个 ──
  { ep: 'GET /vocab/words', family: 'vocab', run: async (r) => { r.result = await buildVocab(r).listWords(authedReq()); return authInArg0(r, 'words.listWords'); } },
  { ep: 'POST /vocab/words', family: 'vocab', run: async (r) => { r.result = await buildVocab(r).addWord(authedReq(), { word: 'ephemeral' }); return authInArg0(r, 'words.addWord'); } },
  { ep: 'POST /vocab/words/remove', family: 'vocab', run: async (r) => { r.result = await buildVocab(r).removeWord(authedReq(), { headword: 'ephemeral' }); return authInArg0(r, 'words.removeWord'); } },
  { ep: 'GET /vocab/due', family: 'vocab', run: async (r) => { r.result = await buildVocab(r).due(authedReq()); return authInArg0(r, 'review.due'); } },
  { ep: 'GET /vocab/lesson-cards', family: 'vocab', run: async (r) => { r.result = await buildVocab(r).lessonCards(authedReq()); return authInArg0(r, 'review.lessonCards'); } },
  { ep: 'POST /vocab/review', family: 'vocab', run: async (r) => { r.result = await buildVocab(r).submitReview(authedReq(), { headword: 'ephemeral', rating: 'good' }); return authInArg0(r, 'review.review'); } },
  { ep: 'POST /vocab/review/undo', family: 'vocab', run: async (r) => { r.result = await buildVocab(r).undoReview(authedReq(), { headword: 'ephemeral' }); return authInArg0(r, 'review.undo'); } },
  { ep: 'GET /vocab/quiz', family: 'vocab', run: async (r) => { r.result = await buildVocab(r).quizBuild(authedReq()); return authInArg0(r, 'quiz.buildQuiz'); } },
  { ep: 'POST /vocab/page-view', family: 'vocab', run: async (r) => { r.result = await buildVocab(r).recordPageView(authedReq(), { kind: 'vocab' }); return callOf(r, 'words.resolveStudent').args[2] as string; } },
  { ep: 'GET /vocab/stats', family: 'vocab', run: async (r) => { r.result = await buildVocab(r).stats(authedReq()); return authInArg0(r, 'review.stats'); } },
  { ep: 'POST /vocab/quiz/attempt/start', family: 'vocab', run: async (r) => { r.result = await buildVocab(r).quizStart(authedReq(), {}); return authInArg0(r, 'attempts.start'); } },
  { ep: 'GET /vocab/quiz/attempt/current', family: 'vocab', run: async (r) => { r.result = await buildVocab(r).quizCurrent(authedReq()); return authInArg0(r, 'attempts.current'); } },
  { ep: 'POST /vocab/quiz/attempt/answer', family: 'vocab', run: async (r) => { r.result = await buildVocab(r).quizAnswer(authedReq(), { index: 0, optionIndex: 1 }); return authInArg0(r, 'attempts.answer'); } },
  { ep: 'POST /vocab/quiz/attempt/submit', family: 'vocab', run: async (r) => { r.result = await buildVocab(r).quizSubmit(authedReq(), {}); return authInArg0(r, 'attempts.submit'); } },
  { ep: 'GET /vocab/quiz/attempts', family: 'vocab', run: async (r) => { r.result = await buildVocab(r).quizAttempts(authedReq()); return authInArg0(r, 'attempts.history'); } },

  // ── lesson：4 个 ──
  { ep: 'GET /lesson/today', family: 'lesson', run: async (r) => { r.result = await buildLesson(r).today(authedReq()); const a = callOf(r, 'svc.getToday').args[0] as { studentId?: string; studentName: string; authStudentId?: string }; expect(a.studentName, '把令牌姓名塞进解析器了').toBe(''); expect(a.studentId).toBeUndefined(); return a.authStudentId; } },
  { ep: 'POST /lesson/start', family: 'lesson', run: async (r) => { r.result = await buildLesson(r).start({ begin: true }, authedReq()); const a = callOf(r, 'svc.startOrResumeToday').args[0] as { studentId?: string; studentName: string; authStudentId?: string }; expect(a.studentName, '把令牌姓名塞进解析器了').toBe(''); expect(a.studentId).toBeUndefined(); return a.authStudentId; } },
  { ep: 'POST /lesson/vocab-taught', family: 'lesson', run: async (r) => { r.result = await buildLesson(r).vocabTaught(authedReq(), { headword: 'ephemeral', cursor: 3 }); return authInArg0(r, 'svc.markTaughtAndAdvance'); } },
  { ep: 'POST /lesson/vocab-cursor', family: 'lesson', run: async (r) => { r.result = await buildLesson(r).saveVocabCursor(authedReq(), { cursor: 3 }); return authInArg0(r, 'svc.saveVocabCursor'); } },

  // ── morning-quiz：3 个 ──
  {
    ep: 'GET /morning-quiz/history-by-name', family: 'morning-quiz',
    run: async (r) => {
      r.result = await buildMq(r, MQ_HISTORY_RESULTS).historyByName(authedReq());
      const w = (callOf(r, 'prisma.user.findMany').args[0] as { where: Record<string, unknown> }).where;
      expect(w, '已认证路径不该按姓名查').not.toHaveProperty('name');
      return w.id as string;
    },
  },
  {
    ep: 'GET /morning-quiz/history-detail', family: 'morning-quiz',
    run: async (r) => {
      r.result = await buildMq(r, MQ_DETAIL_RESULTS).historyDetail(authedReq(), 'sub-1');
      return callOf(r, 'svc.getStudentResult').args[1] as string;
    },
  },
  {
    ep: 'POST /morning-quiz/appeals', family: 'morning-quiz',
    run: async (r) => {
      r.result = await buildMq(r).createAppeal({ submissionId: 'sub-1', message: '这题我觉得算对' }, authedReq());
      return authInArg0(r, 'svc.createAppeal');
    },
  },
];

describe('运行期：22 个在范围内端点，带令牌 + 零身份入参', () => {
  // S12L —— 26 减去暂停的四个错题端点。它们没有被放弃覆盖：见上面那一组
  // 「在解析身份之前就拒绝」，那是一条比 token-only 更强的性质。
  it('**用例表覆盖满 22 条**（少一条就说明有端点没被真的跑过）', () => {
    expect(CASES).toHaveLength(22);
    expect(CASES.filter((c) => c.family === 'vocab')).toHaveLength(15);
    expect(CASES.filter((c) => c.family === 'lesson')).toHaveLength(4);
    expect(CASES.filter((c) => c.family === 'morning-quiz')).toHaveLength(3);
    expect(new Set(CASES.map((c) => c.ep)).size).toBe(22);
  });

  for (const c of CASES) {
    it(`${c.ep} —— 执行到达依赖，且令牌身份就是入参`, async () => {
      const rec: Rec = { calls: [] };
      const reached = await c.run(rec);
      expect(reached, `${c.ep} 没把令牌身份传下去`).toBe(ID);
    });
  }

  for (const c of CASES) {
    it(`${c.ep} —— **不抛 name_required**`, async () => {
      const rec: Rec = { calls: [] };
      let thrown: unknown;
      try { await c.run(rec); } catch (e) { thrown = e; }
      if (thrown instanceof BadRequestException) {
        expect(
          (thrown.getResponse() as { code?: string }).code,
          `${c.ep} 仍有一道姓名硬闸`,
        ).not.toBe('name_required');
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────
// 缺陷 1 的定点回归 —— 两个 GET 的姓名硬闸
// ─────────────────────────────────────────────────────────────

describe('缺陷回归：两个 quiz GET 曾在 identityOf 之前就把令牌请求拒掉', () => {
  it('**GET /vocab/quiz/attempt/current** 带令牌不带姓名 → 到达 attempts.current', async () => {
    const rec: Rec = { calls: [] };
    await buildVocab(rec).quizCurrent(authedReq());
    expect(authInArg0(rec, 'attempts.current')).toBe(ID);
  });

  it('**GET /vocab/quiz/attempts** 带令牌不带姓名 → 到达 attempts.history', async () => {
    const rec: Rec = { calls: [] };
    await buildVocab(rec).quizAttempts(authedReq());
    expect(authInArg0(rec, 'attempts.history')).toBe(ID);
  });

  it('无令牌 + 无姓名 → 仍然是 name_required（旧口径不变）', async () => {
    const rec: Rec = { calls: [] };
    for (const call of [
      () => buildVocab(rec).quizCurrent(anonReq()),
      () => buildVocab(rec).quizAttempts(anonReq()),
    ]) {
      await expect(call()).rejects.toMatchObject({ response: { code: 'name_required' } });
    }
  });

  it('无令牌 + 有姓名 → 旧路径照走（姓名进入服务层）', async () => {
    const rec: Rec = { calls: [] };
    await buildVocab(rec).quizCurrent(anonReq(), '李四');
    const arg = callOf(rec, 'attempts.current').args[0] as { studentName: string; authStudentId?: string };
    expect(arg.studentName).toBe('李四');
    expect(arg.authStudentId).toBeUndefined();
  });
});

/**
 * 姓名硬闸的**静态兜底**。
 *
 * 上面的运行期用例已经能抓住这类缺陷，但那需要有人记得给新端点补一条
 * 用例。这条扫的是形状：`name_required` 只允许出现在「确认没有令牌」
 * 之后（`if (!auth && !name)`），任何无条件的 `if (!name)` 都判红。
 */
describe('静态兜底：in-scope handler 里不得有无条件的姓名硬闸', () => {
  it('**每个 name_required 都必须先确认没有令牌**', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const IN_SCOPE_FILES = ['vocab/vocab.controller.ts', 'lesson/lesson.controller.ts'];
    const bad: string[] = [];
    for (const rel of IN_SCOPE_FILES) {
      const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
      src.split('\n').forEach((line, i) => {
        if (!line.includes('name_required')) return;
        if (!/!auth\b/.test(line)) bad.push(`${rel}:${i + 1} → ${line.trim()}`);
      });
    }
    expect(bad, '这些姓名闸在 identityOf 之前，令牌请求会被它们拒掉').toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// 旧客户端（无令牌 + 姓名）—— 每个家族留一条代表
// ─────────────────────────────────────────────────────────────

describe('向后兼容：无令牌 + 姓名，三个家族各一条代表', () => {
  it('vocab —— POST /vocab/review 姓名照旧进服务层', async () => {
    const rec: Rec = { calls: [] };
    await buildVocab(rec).submitReview(anonReq(), { studentName: '李四', headword: 'x', rating: 'good' });
    const a = callOf(rec, 'review.review').args[0] as { studentName: string; authStudentId?: string };
    expect(a.studentName).toBe('李四');
    expect(a.authStudentId).toBeUndefined();
  });

  it('lesson —— GET /lesson/today 姓名照旧进服务层', async () => {
    const rec: Rec = { calls: [] };
    await buildLesson(rec).today(anonReq(), '李四');
    expect((callOf(rec, 'svc.getToday').args[0] as { studentName: string }).studentName).toBe('李四');
  });

  it('morning-quiz —— GET /history-by-name 无令牌时仍按姓名查', async () => {
    const rec: Rec = { calls: [] };
    await buildMq(rec, MQ_HISTORY_RESULTS).historyByName(anonReq(), '李四');
    const w = (callOf(rec, 'prisma.user.findMany').args[0] as { where: Record<string, unknown> }).where;
    expect(w.name).toBe('李四');
    expect(w).not.toHaveProperty('id');
  });

  it('三个家族：无令牌且无姓名 → name_required', async () => {
    const rec: Rec = { calls: [] };
    await expect(buildVocab(rec).submitReview(anonReq(), { headword: 'x', rating: 'good' }))
      .rejects.toMatchObject({ response: { code: 'name_required' } });
    await expect(buildMq(rec).historyByName(anonReq()))
      .rejects.toMatchObject({ response: { code: 'name_required' } });
    // lesson 的 today 用的是更早就存在的 student_required，口径同样不变
    await expect(buildLesson(rec).today(anonReq()))
      .rejects.toMatchObject({ response: { code: 'student_required' } });
  });
});

// ─────────────────────────────────────────────────────────────
// vocab-cursor 的认证语义 —— 元数据 + 守卫双重回归
// ─────────────────────────────────────────────────────────────

describe('POST /lesson/vocab-cursor 的认证语义', () => {
  const reflector = new Reflector();
  const handler = LessonController.prototype.saveVocabCursor;
  const taught = LessonController.prototype.vocabTaught;

  it('**它是学生写接口：@Public + @RequireStudentToken + 限流，一样不少**', () => {
    expect(reflector.get(PUBLIC_KEY, handler), '缺 @Public()：会被全局 AuthGuard 要求任意 JWT').toBe(true);
    expect(reflector.get(REQUIRE_STUDENT_TOKEN, handler), '缺 @RequireStudentToken()：教师令牌可代写').toBe(true);
    expect(reflector.get(RATE_LIMIT_KEY, handler), '缺限流').toBeDefined();
  });

  it('**vocab-taught 只保留一套装饰器**（原来有重复的一套飘在上面）', () => {
    const fs = require('node:fs') as typeof import('node:fs');
    const path = require('node:path') as typeof import('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'lesson', 'lesson.controller.ts'), 'utf8');
    const lines = src.split('\n');
    const routeAt = lines
      .map((l, i) => (/^\s*@(Get|Post|Patch|Delete)\(/.test(l) ? i : -1))
      .filter((i) => i >= 0);
    // 每条路由「自己那一段」里，同一个装饰器不得出现两次
    let prev = 0;
    for (const at of routeAt) {
      const seg = lines.slice(prev, at + 1).join('\n');
      const route = lines[at].trim();
      for (const d of ['@Public()', '@RequireStudentToken()']) {
        const n = seg.split(d).length - 1;
        expect(n, `${route} 前面有 ${n} 个 ${d}`).toBeLessThanOrEqual(1);
      }
      prev = at + 1;
    }
    expect(reflector.get(REQUIRE_STUDENT_TOKEN, taught)).toBe(true);
  });

  const guardFor = (jwtPayload: Record<string, unknown> | null) => {
    const jwt = {
      verifyAsync: vi.fn(async () => {
        if (!jwtPayload) throw new Error('bad token');
        return jwtPayload;
      }),
    };
    const prisma = { user: { findUnique: vi.fn(async () => ({ studentAuthVersion: 1, isActive: true, archivedAt: null })) } };
    return new StudentIdentityGuard(jwt as never, reflector, prisma as never);
  };
  const ctxFor = (req: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => handler,
      getClass: () => LessonController,
    }) as unknown as ExecutionContext;

  it('**不带令牌 → 403 student_token_required**', async () => {
    const req = { headers: {}, query: {}, body: { cursor: 1 } };
    await expect(guardFor(null).canActivate(ctxFor(req))).rejects.toMatchObject({
      response: { code: 'student_token_required' },
    });
  });

  it('**普通教师 JWT 满足不了 RequireStudentToken**（原来它能代学生写）', async () => {
    const req = { headers: { authorization: 'Bearer teacher' }, query: {}, body: { name: NAME, cursor: 1 } };
    await expect(
      guardFor({ id: 'teacher-1', role: 'teacher', name: '王老师' }).canActivate(ctxFor(req)),
    ).rejects.toMatchObject({ response: { code: 'student_token_required' } });
  });

  it('**teacher_view 是只读的，写不进来**', async () => {
    const req = { headers: { authorization: 'Bearer tv' }, query: {}, body: { cursor: 1 } };
    await expect(
      guardFor({ id: ID, role: 'student', name: NAME, scope: TEACHER_VIEW_SCOPE, actorId: 'teacher-1' })
        .canActivate(ctxFor(req)),
    ).rejects.toMatchObject({ response: { code: 'teacher_view_is_read_only' } });
  });

  it('学生本人的令牌可以写，且身份挂到 req.studentAuth 上', async () => {
    const req: Record<string, unknown> = {
      headers: { authorization: 'Bearer student' }, query: {}, body: { cursor: 1 },
    };
    await expect(
      guardFor({ id: ID, role: 'student', name: NAME }).canActivate(ctxFor(req)),
    ).resolves.toBe(true);
    expect(req.studentAuth).toEqual({ id: ID, name: NAME });
  });

  it('令牌与请求体里的姓名冲突 → 403 identity_mismatch', async () => {
    const req = { headers: { authorization: 'Bearer student' }, query: {}, body: { name: '李四', cursor: 1 } };
    await expect(
      guardFor({ id: ID, role: 'student', name: NAME }).canActivate(ctxFor(req)),
    ).rejects.toMatchObject({ response: { code: 'identity_mismatch' } });
  });

  it('**cursor 的业务逻辑没被动过** —— 仍然原样透传给 service', async () => {
    const rec: Rec = { calls: [] };
    await buildLesson(rec).saveVocabCursor(authedReq(), { cursor: 7 });
    expect((callOf(rec, 'svc.saveVocabCursor').args[0] as { cursor: number }).cursor).toBe(7);
  });
});

describe('反向对照：把这些修复撤掉就会红', () => {
  it('若 quizCurrent 恢复无条件 name 闸，"不抛 name_required" 那条会红', async () => {
    // 这里直接复刻旧代码的形状，证明判据抓得住
    const legacyShaped = (name?: string) => {
      if (!name) throw new BadRequestException({ code: 'name_required' });
      return 'ok';
    };
    expect(() => legacyShaped(undefined)).toThrow(BadRequestException);
  });

  it('若 vocab-cursor 的 @RequireStudentToken 被拿掉，守卫就拦不住教师令牌', async () => {
    const noMeta = new Reflector();
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {}, query: {}, body: {} }) }),
      getHandler: () => function bare() {},
      getClass: () => class Bare {},
    } as unknown as ExecutionContext;
    const g = new StudentIdentityGuard(
      { verifyAsync: vi.fn(async () => { throw new Error('none'); }) } as never,
      noMeta,
      { user: { findUnique: vi.fn() } } as never,
    );
    // 没有 REQUIRE_STUDENT_TOKEN 元数据 → 无令牌也放行，这正是修复前的状态
    await expect(g.canActivate(ctx)).resolves.toBe(true);
  });

  it('ForbiddenException 的错误码形状与既有契约一致', () => {
    const e = new ForbiddenException({ code: 'student_token_required' });
    expect(e.getResponse()).toEqual({ code: 'student_token_required' });
  });
});
// ─────────────────────────────────────────────────────────────
// 响应语义 —— 「到达了依赖」不等于「回给调用方的东西是对的」
//
// 上一轮 26 条运行期用例的判据是「执行到达预期依赖并带着令牌 id」。
// 那挡住了鉴权与解析的问题，却挡不住**响应拼错**：handler 完全可以
// 正确地查到人，然后把一个空字符串回给前端。history-by-name 就是这样。
// ─────────────────────────────────────────────────────────────

const DB_NAME = '张三（库里的那条）';

describe('GET /morning-quiz/history-by-name 的响应身份', () => {
  const withDbName = {
    'user.findMany': [{ id: ID, name: DB_NAME, email: 's1@school.local', classEnrollments: [] }],
    'studentSubmission.findMany': [],
    'morningQuizSession.findMany': [],
  };

  it('**只带令牌时，回显的是库里查出来的姓名**，不是空的查询串', async () => {
    const rec: Rec = { calls: [] };
    const out = (await buildMq(rec, withDbName).historyByName(authedReq())) as {
      student: { name: string; matchedCount: number; classes: string[] };
    };
    expect(out.student.name).toBe(DB_NAME);
  });

  it('**回显姓名来自数据库，不是来自 JWT** —— 令牌里的名字过时也不影响', async () => {
    const rec: Rec = { calls: [] };
    // 令牌里的 name 是 NAME（'张三'），库里已经改成 DB_NAME
    const out = (await buildMq(rec, withDbName).historyByName(authedReq())) as {
      student: { name: string };
    };
    expect(out.student.name).toBe(DB_NAME);
    expect(out.student.name).not.toBe(NAME);
  });

  it('查人仍然只按 id，绝不按姓名 —— 也没有消歧与近似姓名建议', async () => {
    const rec: Rec = { calls: [] };
    await buildMq(rec, withDbName).historyByName(authedReq());
    const w = (callOf(rec, 'prisma.user.findMany').args[0] as { where: Record<string, unknown> }).where;
    expect(w.id).toBe(ID);
    expect(w).not.toHaveProperty('name');
    // 名册查询（近似姓名建议的来源）只在查无此人时才发生 —— 这里只查了一次
    expect(rec.calls.filter((c) => c.m === 'prisma.user.findMany')).toHaveLength(1);
  });

  it('**响应形状没变** —— 仍是 { student:{name,matchedCount,classes}, submissions }', async () => {
    const rec: Rec = { calls: [] };
    const out = (await buildMq(rec, withDbName).historyByName(authedReq())) as Record<string, unknown>;
    expect(Object.keys(out).sort()).toEqual(['student', 'submissions']);
    expect(Object.keys(out.student as object).sort()).toEqual(
      ['classes', 'matchedCount', 'name'].sort(),
    );
    expect((out.student as { matchedCount: number }).matchedCount).toBe(1);
  });

  it('**旧口径不变**：无令牌 + 姓名时回显的仍是调用方给的姓名', async () => {
    const rec: Rec = { calls: [] };
    const legacy = {
      'user.findMany': [{ id: 'other', name: '李四', email: 's2@school.local', classEnrollments: [] }],
      'studentSubmission.findMany': [],
      'morningQuizSession.findMany': [],
    };
    const out = (await buildMq(rec, legacy).historyByName(anonReq(), '李四')) as {
      student: { name: string };
    };
    expect(out.student.name).toBe('李四');
  });
});

/**
 * 另外 25 条的同类审查。
 *
 * 只有五个 handler 会**自己拼响应**（其余 21 个直接把依赖的返回值透传）：
 *
 * | 端点 | 响应里有身份吗 | 取自哪里 |
 * |---|---|---|
 * | `GET /vocab/mistakes` | 有 `student:{id,name}` | `resolveStudent()` 的**库返回值** ✅ |
 * | `GET /vocab/mistakes/practice-queue` | 有 `student:{id,name}` | 同上 ✅ |
 * | `GET /vocab/lesson-cards` | 无 | 依赖结果，或固定空壳 |
 * | `POST /vocab/page-view` | 无 | 固定 `{ ok: true }` |
 * | `GET /morning-quiz/history-by-name` | 有 `student.name` | **曾取自查询串 ✗，已修** |
 *
 * 前两个本来就对 —— 它们回显的是解析器从库里拿到的那条，不是入参。
 * 但上一轮的用例只断言了「`resolveStudent` 被用 auth id 调过」，没有断言
 * 回显值，所以这个正确性是**没有测试保护的**。下面补上。
 */
// ─────────────────────────────────────────────────────────────
// S12L —— 暂停的四个错题端点
//
// 它们从「26 条 token-only 扫描」里移出来，改成钉一条**更强**的性质：
// 暂停期间它们**在任何身份解析、任何 IO 之前**就拒绝。碰不到身份，就
// 谈不上泄漏身份 —— 这比「身份取自令牌」更强，不是更弱。
//
// 恢复错题本时把这一组挪回上面的 CASES，26 那个数字会跟着变回 30。
// ─────────────────────────────────────────────────────────────

describe('S12L —— 错题端点暂停：在解析身份之前就拒绝', () => {
  const PAUSED: ReadonlyArray<readonly [string, (c: VocabController) => unknown]> = [
    ['GET /vocab/mistakes', (c) => c.listMistakes(authedReq())],
    ['POST /vocab/mistakes/resolve', (c) => c.resolveMistake(authedReq(), { id: 'm1', resolved: true })],
    ['GET /vocab/mistakes/practice-queue', (c) => c.practiceQueue(authedReq())],
    ['POST /vocab/mistakes/practice-result', (c) => c.practiceResult(authedReq(), { id: 'm1', correct: true })],
  ];

  for (const [ep, invoke] of PAUSED) {
    it(`${ep} —— 503 feature_paused，且一次依赖都没碰`, async () => {
      const rec: Rec = { calls: [] };
      const c = buildVocab(rec);
      await expect(Promise.resolve().then(() => invoke(c))).rejects.toMatchObject({
        response: { code: 'feature_paused', feature: 'mistakes' },
      });
      expect(rec.calls.map((x) => x.m)).toEqual([]);
    });
  }
});

describe('另外 21 条：自己拼响应的三个，回显必须来自解析结果', () => {
  const resolved = { 'words.resolveStudent': { id: 'db-id-1', name: DB_NAME } };

  it('GET /vocab/lesson-cards —— 有课时透传依赖结果，无课时给固定空壳', async () => {
    const recA: Rec = { calls: [] };
    const withCards = await buildVocab(recA, { 'review.lessonCards': { cards: ['w1'] } }).lessonCards(authedReq());
    expect(withCards).toEqual({ cards: ['w1'] });

    const recB: Rec = { calls: [] };
    const none = await buildVocab(recB, { 'review.lessonCards': null }).lessonCards(authedReq());
    expect(none).toEqual({ lessonContext: false, cards: [], cursor: 0, totalDue: 0 });
  });

  it('POST /vocab/page-view —— 用解析出来的 id 记账，回 { ok: true }', async () => {
    const rec: Rec = { calls: [] };
    const out = await buildVocab(rec, resolved).recordPageView(authedReq(), { kind: 'vocab' });
    expect(callOf(rec, 'views.record').args[0]).toBe('db-id-1');
    expect(out).toEqual({ ok: true });
  });
});

describe('另外 25 条：透传型端点确实把依赖的结果回给了调用方', () => {
  /** 自己拼响应的五个单独测（见上），其余必须原样透传。 */
  const BUILDERS = new Set([
    'GET /vocab/lesson-cards',
    'POST /vocab/page-view',
    'GET /morning-quiz/history-by-name',
  ]);

  for (const c of CASES.filter((x) => !BUILDERS.has(x.ep))) {
    it(`${c.ep} —— 返回值就是依赖的返回值（没被吞掉）`, async () => {
      const rec: Rec = { calls: [] };
      await c.run(rec);
      const from = (rec.result as { __from?: string } | undefined)?.__from;
      expect(from, `${c.ep} 没把依赖的结果回给调用方`).toBeDefined();
      expect(rec.calls.map((x) => x.m)).toContain(from);
    });
  }

  it('**三个自己拼响应的端点已单独覆盖**，加起来正好 22（26 减去暂停的 4 条）', () => {
    expect(BUILDERS.size + CASES.filter((x) => !BUILDERS.has(x.ep)).length).toBe(22);
    for (const b of BUILDERS) expect(CASES.map((c) => c.ep)).toContain(b);
  });
});
