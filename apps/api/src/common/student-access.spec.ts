import { describe, expect, it, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { RequestMethod, type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PUBLIC_KEY } from './auth.guard';
import { StudentIdentityGuard } from './student-identity.guard';
import {
  ALLOW_TEACHER_VIEW,
  REQUIRE_STUDENT_TOKEN,
  RequireStudentReadToken,
  RequireStudentToken,
  TEACHER_VIEW_SCOPE,
} from './student-access';
import { VocabularyV2Controller } from '../vocab-v2/vocabulary-v2.controller';
import { VocabularyV2Service } from '../vocab-v2/vocabulary-v2.service';
import { LessonController } from '../lesson/lesson.controller';
import { VocabController } from '../vocab/vocab.controller';
import { MorningQuizController } from '../morning-quiz/morning-quiz.controller';
import { PushController } from '../push/push.controller';
import { WritingCheckController } from '../writing-check/writing-check.controller';
import { StudentController } from '../student/student.controller';
import { StudentWordService } from '../vocab/student-word.service';
import { VocabReviewService } from '../vocab/vocab-review.service';
import { VocabQuizService } from '../vocab/vocab-quiz.service';
import { MistakeService } from '../vocab/mistake.service';
import { VocabQuizAttemptService } from '../vocab/vocab-quiz-attempt.service';
import { VocabService } from '../vocab/vocab.service';

/**
 * S08（2026-09-11 审计）—— 「读身份」与「本人写入」分开声明。
 *
 * 守卫层的判定、装饰器的清点、以及「为什么这几条 GET 还不能放开」的证据。
 * HTTP 层的端到端覆盖在 guard-chain.e2e.spec.ts。
 */

// ─────────────────────────── 守卫判定 ───────────────────────────

class Probe {
  @RequireStudentReadToken()
  read() {}
  @RequireStudentToken()
  write() {}
}

function guardFor(payload: Record<string, unknown>) {
  const jwt = { verifyAsync: vi.fn(async () => payload) };
  const prisma = {
    user: { findUnique: vi.fn(async () => ({ role: 'student', isActive: true, archivedAt: null, studentAuthVersion: 0 })) },
  };
  return new StudentIdentityGuard(jwt as never, new Reflector(), prisma as never);
}
const ctx = (handler: Function, method: string) => {
  const req: any = { method, headers: { authorization: 'Bearer x' }, query: {}, body: {} };
  return {
    req,
    ctx: {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => handler,
      getClass: () => Probe,
    } as unknown as ExecutionContext,
  };
};
const TEACHER_VIEW = { id: 'stu-1', name: '张三', role: 'student', scope: TEACHER_VIEW_SCOPE, av: 0, actorId: 't-1' };
const SELF = { id: 'stu-1', name: '张三', role: 'student', av: 0 };

describe('S08 · StudentIdentityGuard 按「读 / 写」分开判', () => {
  it('读身份的 GET：教师只读视角放行，并标记是哪位教师', async () => {
    const { ctx: c, req } = ctx(Probe.prototype.read, 'GET');
    await expect(guardFor(TEACHER_VIEW).canActivate(c)).resolves.toBe(true);
    expect(req.studentAuth).toMatchObject({ id: 'stu-1', viaTeacherView: true, actorId: 't-1' });
  });

  it('本人写的路由：教师只读视角 403（语义没变）', async () => {
    const { ctx: c } = ctx(Probe.prototype.write, 'POST');
    await expect(guardFor(TEACHER_VIEW).canActivate(c)).rejects.toMatchObject({
      response: { code: 'teacher_view_is_read_only' },
    });
  });

  it('兜底：就算「读」被误标到 POST 上，教师只读视角照样 403', async () => {
    const { ctx: c } = ctx(Probe.prototype.read, 'POST');
    await expect(guardFor(TEACHER_VIEW).canActivate(c)).rejects.toMatchObject({
      response: { code: 'teacher_view_is_read_only' },
    });
  });

  it('学生本人：读、写都照常', async () => {
    await expect(guardFor(SELF).canActivate(ctx(Probe.prototype.read, 'GET').ctx)).resolves.toBe(true);
    await expect(guardFor(SELF).canActivate(ctx(Probe.prototype.write, 'POST').ctx)).resolves.toBe(true);
  });

  it('读身份仍然是「必须认证」：不带令牌 403 student_token_required', async () => {
    const jwt = { verifyAsync: vi.fn() };
    const g = new StudentIdentityGuard(jwt as never, new Reflector(), { user: { findUnique: vi.fn() } } as never);
    const req: any = { method: 'GET', headers: {}, query: {}, body: {} };
    const c = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => Probe.prototype.read,
      getClass: () => Probe,
    } as unknown as ExecutionContext;
    await expect(g.canActivate(c)).rejects.toMatchObject({ response: { code: 'student_token_required' } });
  });

  it('未标注的可选身份 GET（旧 vocab 读接口那一类）：教师只读视角可读 —— 它们全部核实过零写库，见下方清点', async () => {
    class Optional {
      plain() {}
    }
    const c = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => Optional.prototype.plain,
      getClass: () => Optional,
    } as unknown as ExecutionContext;
    const req: any = { method: 'GET', headers: { authorization: 'Bearer x' }, query: {}, body: {} };
    await expect(guardFor(TEACHER_VIEW).canActivate(c)).resolves.toBe(true);
    expect(req.studentAuth).toMatchObject({ viaTeacherView: true });
  });

  it('未标注的可选身份路由上的非 GET：教师只读视角一律 403（兜底）', async () => {
    class Optional {
      plain() {}
    }
    const req: any = { method: 'POST', headers: { authorization: 'Bearer x' }, query: {}, body: {} };
    const c = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => Optional.prototype.plain,
      getClass: () => Optional,
    } as unknown as ExecutionContext;
    await expect(guardFor(TEACHER_VIEW).canActivate(c)).rejects.toMatchObject({
      response: { code: 'teacher_view_is_read_only' },
    });
  });

  it('元数据形状：本人写 = true（既有扫描器按 === true 认），读身份 = "read" + 放行标记', () => {
    const r = new Reflector();
    expect(r.get(REQUIRE_STUDENT_TOKEN, Probe.prototype.write)).toBe(true);
    expect(r.get(ALLOW_TEACHER_VIEW, Probe.prototype.write)).toBeUndefined();
    expect(r.get(REQUIRE_STUDENT_TOKEN, Probe.prototype.read)).toBe('read');
    expect(r.get(ALLOW_TEACHER_VIEW, Probe.prototype.read)).toBe(true);
  });
});

// ─────────────────────────── 装饰器清点 ───────────────────────────

const CONTROLLERS = [
  VocabularyV2Controller, LessonController, VocabController, MorningQuizController,
  PushController, WritingCheckController, StudentController,
];

/**
 * 教师只读视角**实际能到达**的路由 —— 按两道守卫的真实判据推导：
 *
 *   · `@Public()` + 类上挂了 StudentIdentityGuard（新接口那一路）：
 *     GET 且不是「本人写」（mode 是 'read' 或未标注的可选身份路由）；
 *   · 非 `@Public()`（全局 AuthGuard 那一路）：GET 且显式 `@AllowTeacherView()`。
 *
 * 所以「未标注的可选身份 GET」也在清单里 —— 以后谁在这类控制器上加一个
 * 会写库的 GET 而忘了标 `@RequireStudentToken()`，这张清单当场变红。
 */
function teacherViewReachable(r: { method: string; mode: unknown; allowTv: unknown; isPublic: boolean; sig: boolean }) {
  if (r.method !== 'GET') return false;
  if (r.isPublic) return r.sig && r.mode !== true;
  return r.allowTv === true;
}

function routes() {
  const out: { key: string; method: string; mode: unknown; allowTv: unknown; isPublic: boolean; sig: boolean }[] = [];
  for (const C of CONTROLLERS) {
    const base = Reflect.getMetadata(PATH_METADATA, C) as string;
    const sig = ((Reflect.getMetadata(GUARDS_METADATA, C) ?? []) as unknown[]).includes(StudentIdentityGuard);
    for (const name of Object.getOwnPropertyNames(C.prototype)) {
      const h = (C.prototype as any)[name];
      if (typeof h !== 'function' || name === 'constructor') continue;
      const path = Reflect.getMetadata(PATH_METADATA, h);
      if (path === undefined) continue;
      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, h) as number];
      out.push({
        key: `${method} /${base ? base + '/' : ''}${path}`.replace(/\/+/g, '/').replace(/\/$/, ''),
        method,
        mode: Reflect.getMetadata(REQUIRE_STUDENT_TOKEN, h),
        allowTv: Reflect.getMetadata(ALLOW_TEACHER_VIEW, h),
        isPublic: Reflect.getMetadata(PUBLIC_KEY, h) === true,
        sig,
      });
    }
  }
  return out;
}

/** 已核实零写库、教师只读视角能到达的 GET —— 精确清单，多一条少一条都红。 */
const TEACHER_VIEW_READABLE = [
  'GET /vocab-v2/source-meta',
  // profile / overview：服务层拆成纯读之后放开（词汇组 620a59b；证据见本文件「服务层证据」）
  'GET /vocab-v2/profile',
  'GET /vocab-v2/overview',
  'GET /vocab-v2/search',
  'GET /vocab-v2/center',
  'GET /vocab-v2/daily',
  // VOC12 新增的按日期只读回看
  'GET /vocab-v2/daily/review',
  'GET /vocab-v2/daily/history',
  'GET /vocab-v2/tests',
  'GET /vocab-v2/test',
  'GET /lesson/today',
  'GET /vocab/quiz/attempt/current',
  'GET /vocab/quiz/attempts',
  // 旧 vocab 的可选身份读接口（未标注，教师只读视角一直能读）——
  // 零写库的证据见本文件末尾「旧 vocab 读接口」那一组
  'GET /vocab/lookup',
  'GET /vocab/words',
  'GET /vocab/due',
  'GET /vocab/lesson-cards',
  'GET /vocab/quiz',
  'GET /vocab/mistakes',
  'GET /vocab/mistakes/practice-queue',
  'GET /vocab/stats',
  'GET /morning-quiz/student-result/:sessionId',
  'GET /morning-quiz/history-by-name',
  'GET /morning-quiz/history-detail',
  'GET /morning-quiz/upcoming-for-name',
  'GET /morning-quiz/practice/:practiceSubmissionId',
  'GET /morning-quiz/history-by-name/trend',
  'GET /morning-quiz/skill-profile',
  'GET /push/config',
  'GET /writing-check/status',
  'GET /student/assignments',
  'GET /student/submissions/:id',
].sort();

/**
 * 会隐式写库的 GET：保持「本人写」，等服务层拆成纯读后再放开。
 *
 * profile / overview 原来在这里（upsert 兜底建档）；词汇组把它们拆成纯读后
 * 移进了上面的可读清单。现在词汇模块已经没有这类 GET。
 */
const IMPLICIT_WRITE_GETS: string[] = [];

describe('S08 · 装饰器清点（从控制器元数据推导）', () => {
  const all = routes();

  it('教师只读视角能到达的路由恰好是核实过的那一张清单', () => {
    const readable = all.filter(teacherViewReachable).map((r) => r.key).sort();
    expect(readable).toEqual(TEACHER_VIEW_READABLE);
  });

  it('显式标了「读」或放行标记的，全部是 GET', () => {
    for (const r of all.filter((x) => x.mode === 'read' || x.allowTv === true)) {
      expect(r.method, r.key).toBe('GET');
    }
  });

  it('所有学生写接口（非 GET 且要求令牌）仍是「本人写」', () => {
    const writes = all.filter((r) => r.method !== 'GET' && r.mode !== undefined);
    expect(writes.length).toBeGreaterThan(20);
    for (const r of writes) expect(r.mode, r.key).toBe(true);
  });

  it('隐式写库的 GET 仍是「本人写」', () => {
    for (const k of IMPLICIT_WRITE_GETS) {
      const r = all.find((x) => x.key === k);
      expect(r, k).toBeDefined();
      expect(r!.mode, k).toBe(true);
      expect(r!.allowTv, k).toBeUndefined();
    }
  });
});

// ─────────────── 证据：为什么 profile / overview 还不能放开 ───────────────

function recordingPrisma() {
  const writes: string[] = [];
  const WRITE = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
  const prisma: any = new Proxy({}, {
    get(_t, model) {
      if (typeof model !== 'string' || model === 'then') return undefined;
      if (model === '$transaction') return async (fn: any) => fn(prisma);
      return new Proxy({}, {
        get(_t2, op) {
          if (typeof op !== 'string' || op === 'then') return undefined;
          return async () => {
            if (WRITE.has(op)) writes.push(`${model}.${op}`);
            if (op === 'upsert') return { studentId: 's', dailyTarget: 10 };
            if (op === 'findMany') return [];
            return null;
          };
        },
      });
    },
  });
  return { prisma, writes };
}

describe('S08 · 服务层证据（真实 VocabularyV2Service + 记账假库）', () => {
  it('profile() / overview() 已拆成纯读：没有档案也不建 —— 所以这两条 GET 放开给教师只读视角', async () => {
    for (const run of [
      (svc: VocabularyV2Service) => svc.profile('s'),
      (svc: VocabularyV2Service) => svc.overview('s'),
    ]) {
      const { prisma, writes } = recordingPrisma();
      await run(new VocabularyV2Service(prisma, {} as any));
      expect(writes).toEqual([]);
    }
  });

  it('search / center / daily / tests / test / source-meta 一行都不写 —— 所以放开给教师只读视角', async () => {
    const { prisma, writes } = recordingPrisma();
    const svc = new VocabularyV2Service(prisma, {} as any);
    await svc.search('s', 'ab');
    await svc.vocabularyCenter('s', {});
    await svc.dailySession('s');
    await svc.listFormalTests('s');
    await svc.testSession('s', 'x').catch(() => undefined); // 不存在 → 400，照样零写
    svc.sourceMeta();
    expect(writes).toEqual([]);
  });
});

describe('S08 · 旧 vocab 读接口（未标注的可选身份 GET）零写库的证据', () => {
  // 假库：学生资格查询返回一个在读学生，其余读返回空。真实服务照常跑，
  // 只要任何一条路径发出 create / update / upsert / delete，就记下来。
  function recordingVocabPrisma() {
    const writes: string[] = [];
    const WRITE = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
    const prisma: any = new Proxy({}, {
      get(_t, model) {
        if (typeof model !== 'string' || model === 'then') return undefined;
        if (model === '$transaction') return async (fn: any) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn));
        if (model === '$queryRaw') return async () => [];
        return new Proxy({}, {
          get(_t2, op) {
            if (typeof op !== 'string' || op === 'then') return undefined;
            return async () => {
              if (WRITE.has(op)) writes.push(`${model}.${op}`);
              if (model === 'user' && (op === 'findFirst' || op === 'findUnique')) return { id: 's', name: '张三' };
              if (model === 'user' && op === 'findMany') {
                return [{ id: 's', name: '张三', classEnrollments: [{ class: { id: 'c', name: 'C', classCode: 'C' } }] }];
              }
              if (op === 'findMany' || op === 'groupBy') return [];
              if (op === 'count') return 0;
              return null;
            };
          },
        });
      },
    });
    return { prisma, writes };
  }

  it('lookup / words / due / lesson-cards / quiz / mistakes / practice-queue / stats / attempts 一行都不写', async () => {
    const { prisma, writes } = recordingVocabPrisma();
    const vocab = new VocabService(prisma);
    const words = new StudentWordService(prisma, vocab);
    const review = new VocabReviewService(prisma, words);
    const quiz = new VocabQuizService(prisma, words, review);
    const mistakes = new MistakeService(prisma);
    const attempts = new VocabQuizAttemptService(prisma, words, quiz);
    const who = { studentName: '', authStudentId: 's' };
    await vocab.lookup('apple');
    await words.listWords(who);
    await review.due(who);
    await review.lessonCards(who);
    await review.stats(who);
    await quiz.buildQuiz({ ...who } as any);
    await mistakes.listForStudent('s');
    await mistakes.practiceQueue('s');
    await attempts.current(who);
    await attempts.history(who);
    expect(writes).toEqual([]);
  });
});
