import { describe, expect, it, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { MorningQuizController } from './morning-quiz.controller';
import { StudentIdentityGuard } from '../common/student-identity.guard';
import { REQUIRE_STUDENT_TOKEN } from '../common/student-access';
import { RATE_LIMIT_KEY } from '../common/rate-limit.guard';

/**
 * S02（2026-09-11 审计）—— 旧历史接口不再把**姓名**当授权凭据。
 *
 * 修之前：`GET /morning-quiz/history-by-name?name=…` 与
 * `GET /morning-quiz/history-detail?submissionId=…&name=…` 是 @Public 的，
 * 不带令牌时按姓名查人、按姓名比对归属。知道同学姓名 = 能读他的成绩；
 * 同名时还把候选的班级、邮箱前缀列出来。
 *
 * 修之后：
 *   · 无令牌 → **在查任何学生之前**统一 403 `student_token_required`；
 *   · 身份只来自验签后的令牌，按 id 校验归属；
 *   · A 带自己的令牌去问 B 的姓名 / 编号 → 守卫 403 `identity_mismatch`，
 *     响应里只有错误码，没有候选、班级或成绩；
 *   · A 去读 B 的答卷 → 与「不存在」同一个 404，不给存在性信号。
 *
 * 这里全部用内存假对象，不连库。
 */

const A = { id: 'stu-a', name: '学生甲' };
const B = { id: 'stu-b', name: '学生乙' };

type Rec = { m: string; args: unknown[] }[];

function mockDep(rec: Rec, name: string) {
  return new Proxy({}, {
    get(_t, k) {
      if (typeof k !== 'string' || k === 'then') return undefined;
      return vi.fn(async (...args: unknown[]) => {
        rec.push({ m: `${name}.${k}`, args });
        return { __from: `${name}.${k}` };
      });
    },
  }) as never;
}

function mockPrisma(rec: Rec, results: Record<string, unknown> = {}) {
  return new Proxy({}, {
    get(_t, model) {
      if (typeof model !== 'string' || model === 'then') return undefined;
      return new Proxy({}, {
        get(_t2, op) {
          if (typeof op !== 'string' || op === 'then') return undefined;
          return vi.fn(async (...args: unknown[]) => {
            rec.push({ m: `prisma.${model}.${op}`, args });
            const key = `${model}.${op}`;
            return key in results ? results[key] : null;
          });
        },
      });
    },
  }) as never;
}

function build(rec: Rec, results: Record<string, unknown> = {}) {
  return new MorningQuizController(
    mockDep(rec, 'svc'), mockDep(rec, 'student'), mockDep(rec, 'exportSvc'),
    mockDep(rec, 'weeklyCron'), mockDep(rec, 'absence'), mockDep(rec, 'shortAnswer'),
    mockPrisma(rec, results),
  );
}

const anonReq = () => ({ query: {}, body: {}, headers: {} }) as unknown as Request;
const authedReq = (who = A) =>
  ({ studentAuth: { id: who.id, name: who.name }, query: {}, body: {}, headers: {} }) as unknown as Request;

const B_SUBMISSION = {
  'studentSubmission.findUnique': { studentId: B.id, assignmentId: 'as-b', student: { name: B.name } },
  'morningQuizSession.findFirst': { id: 'sess-b' },
};

describe('S02 · 无令牌在查学生之前统一拒绝', () => {
  it('history-by-name：无令牌 + 任意姓名 → 403 student_token_required，一次库都没查', async () => {
    const rec: Rec = [];
    await expect(build(rec).historyByName(anonReq(), B.name)).rejects.toMatchObject({
      status: 403,
      response: { code: 'student_token_required' },
    });
    expect(rec).toEqual([]);
  });

  it('history-by-name：无令牌、无姓名 → 同一个 403（不再是 400 name_required）', async () => {
    const rec: Rec = [];
    await expect(build(rec).historyByName(anonReq())).rejects.toMatchObject({
      response: { code: 'student_token_required' },
    });
    expect(rec).toEqual([]);
  });

  it('history-detail：无令牌 + 答卷号 + 姓名 → 403 student_token_required，一次库都没查', async () => {
    const rec: Rec = [];
    await expect(build(rec, B_SUBMISSION).historyDetail(anonReq(), 'sub-b', B.name)).rejects.toMatchObject({
      status: 403,
      response: { code: 'student_token_required' },
    });
    expect(rec).toEqual([]);
  });

  it('两条路由都标了「读身份」：守卫层就要求令牌（教师只读视角可读）', () => {
    const r = new Reflector();
    for (const h of [MorningQuizController.prototype.historyByName, MorningQuizController.prototype.historyDetail]) {
      expect(r.get(REQUIRE_STUDENT_TOKEN, h)).toBe('read');
    }
  });

  it('同类的按姓名匿名读（trend / skill-profile / upcoming-for-name / practice 回看）也要求令牌', () => {
    const r = new Reflector();
    for (const h of [
      MorningQuizController.prototype.historyTrend,
      MorningQuizController.prototype.skillProfile,
      MorningQuizController.prototype.upcomingForName,
      MorningQuizController.prototype.getPractice,
    ]) {
      expect(r.get(REQUIRE_STUDENT_TOKEN, h), h.name).toBe('read');
    }
  });
});

describe('S02 · A 用 B 的姓名 / 编号读不到 B', () => {
  function guardWithToken(who = A) {
    const jwt = { verifyAsync: vi.fn(async () => ({ id: who.id, name: who.name, role: 'student', av: 0 })) };
    const prisma = {
      user: { findUnique: vi.fn(async () => ({ role: 'student', isActive: true, archivedAt: null, studentAuthVersion: 0 })) },
    };
    return new StudentIdentityGuard(jwt as never, new Reflector(), prisma as never);
  }
  const ctxFor = (req: unknown, handler: Function) =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => handler,
      getClass: () => MorningQuizController,
    }) as unknown as ExecutionContext;

  it('A 的令牌 + ?name=B → 403 identity_mismatch，错误体只有错误码', async () => {
    const req = { headers: { authorization: 'Bearer a' }, query: { name: B.name }, body: {} };
    const err = await guardWithToken()
      .canActivate(ctxFor(req, MorningQuizController.prototype.historyByName))
      .catch((e) => e);
    expect(err.getResponse()).toEqual({ code: 'identity_mismatch' });
  });

  it('A 的令牌 + ?studentId=B → 403 identity_mismatch', async () => {
    const req = { headers: { authorization: 'Bearer a' }, query: { studentId: B.id }, body: {} };
    const err = await guardWithToken()
      .canActivate(ctxFor(req, MorningQuizController.prototype.historyByName))
      .catch((e) => e);
    expect(err.getResponse()).toEqual({ code: 'identity_mismatch' });
  });

  it('A 带自己的令牌读 B 的答卷 → 404 submission_not_found（与不存在同一个回答），不碰结果服务', async () => {
    const rec: Rec = [];
    const err = await build(rec, B_SUBMISSION).historyDetail(authedReq(A), 'sub-b').catch((e) => e);
    expect(err.status).toBe(404);
    expect(err.getResponse()).toEqual({ code: 'submission_not_found' });
    expect(rec.map((c) => c.m)).not.toContain('svc.getStudentResult');
  });

  it('不存在的答卷号 → 同一个 404，同一个错误体', async () => {
    const rec: Rec = [];
    const err = await build(rec).historyDetail(authedReq(A), 'nope').catch((e) => e);
    expect(err.status).toBe(404);
    expect(err.getResponse()).toEqual({ code: 'submission_not_found' });
  });

  it('B 带自己的令牌读自己的答卷 → 照常交给结果服务（按规则出分出答案）', async () => {
    const rec: Rec = [];
    await build(rec, B_SUBMISSION).historyDetail(authedReq(B), 'sub-b');
    const c = rec.find((x) => x.m === 'svc.getStudentResult');
    expect(c?.args).toEqual(['sess-b', B.id]);
  });

  it('history-by-name 带令牌时只按令牌 id 查，永不按姓名查、永不返回同名候选', async () => {
    const rec: Rec = [];
    const out = (await build(rec, {
      'user.findMany': [{ id: A.id, name: A.name, email: 'a@x', classEnrollments: [] }],
      'studentSubmission.findMany': [],
      'morningQuizSession.findMany': [],
    }).historyByName(authedReq(A), A.name)) as Record<string, unknown>;
    const where = (rec.find((c) => c.m === 'prisma.user.findMany')!.args[0] as { where: Record<string, unknown> }).where;
    expect(where.id).toBe(A.id);
    expect(where).not.toHaveProperty('name');
    expect(out).not.toHaveProperty('needDisambiguation');
    expect(out).not.toHaveProperty('candidates');
  });
});

describe('S02 · 同类的按姓名读：身份一律取令牌，同名时不给候选', () => {
  // A 与 C 同名。守卫只能核对「查询串里的姓名 == 令牌里的姓名」—— 同名时这
  // 一条对 A 永远成立。所以控制器必须把 studentId **强制**设成令牌里的 id，
  // 服务层才不会走「同名 → 返回候选（含班级）」那一支，也不会按姓名合并。
  const SAME = '同名同学';
  const reqOf = (id: string) =>
    ({ studentAuth: { id, name: SAME }, query: {}, body: {}, headers: {}, ip: '10.0.0.1' }) as unknown as Request;

  function lastCall(rec: Rec, m: string) {
    const c = [...rec].reverse().find((x) => x.m === m);
    expect(c, `${m} 没被调`).toBeDefined();
    return c!;
  }

  it('trend：只带姓名 → 服务层拿到的是令牌里的 id', async () => {
    const rec: Rec = [];
    await (build(rec) as any).historyTrend(reqOf('stu-a'), SAME, undefined, '8');
    const c = lastCall(rec, 'svc.historyTrendByName');
    expect(c.args[0]).toBe(SAME);
    expect(c.args[1]).toBe('stu-a');
    expect(c.args[2]).toBe(8);
  });

  it('skill-profile：只带姓名 → 服务层拿到的是令牌里的 id', async () => {
    const rec: Rec = [];
    await (build(rec) as any).skillProfile(reqOf('stu-a'), SAME, undefined, undefined);
    const c = lastCall(rec, 'svc.skillProfileByName');
    expect(c.args[1]).toBe('stu-a');
  });

  it('upcoming-for-name：只带姓名 → 服务层拿到的是令牌里的 id', async () => {
    const rec: Rec = [];
    await (build(rec) as any).upcomingForName(reqOf('stu-a'), SAME);
    const c = lastCall(rec, 'svc.upcomingForName');
    expect(c.args).toEqual([SAME, 'stu-a']);
  });

  it('upcoming-for-name：不带姓名（新学生端只带 Bearer）→ 用令牌里的姓名与 id', async () => {
    const rec: Rec = [];
    await (build(rec) as any).upcomingForName(reqOf('stu-a'));
    expect(lastCall(rec, 'svc.upcomingForName').args).toEqual([SAME, 'stu-a']);
  });

  it('practice 回看 / 开练 / 交练：服务层拿到的都是令牌里的 id', async () => {
    const rec: Rec = [];
    const c = build(rec) as any;
    await c.getPractice('ps-1', reqOf('stu-a'), SAME, undefined);
    expect(lastCall(rec, 'svc.getPractice').args[1]).toEqual({ studentName: SAME, studentId: 'stu-a' });
    await c.startPractice('sub-1', { studentName: SAME }, reqOf('stu-a'));
    expect(lastCall(rec, 'svc.startPractice').args[1]).toMatchObject({ studentName: SAME, studentId: 'stu-a' });
    await c.submitPractice('ps-1', { studentName: SAME, answers: [] }, reqOf('stu-a'));
    expect(lastCall(rec, 'svc.submitPractice').args[1]).toMatchObject({ studentName: SAME, studentId: 'stu-a' });
  });

  it('直接调用（绕过守卫）且无令牌 → 403 student_token_required，服务一次都没调', async () => {
    const rec: Rec = [];
    const c = build(rec) as any;
    for (const run of [
      () => c.historyTrend(anonReq(), SAME, undefined, undefined),
      () => c.skillProfile(anonReq(), SAME, undefined, undefined),
      () => c.upcomingForName(anonReq(), SAME),
      () => c.getPractice('ps-1', anonReq(), SAME, undefined),
    ]) {
      await expect(run()).rejects.toMatchObject({ response: { code: 'student_token_required' } });
    }
    expect(rec).toEqual([]);
  });
});

describe('S02 + S06 · 历史这一组改为按「已验证的学生」限流', () => {
  // 全校共用一个出口 IP。默认 10 次 / 分钟的 IP 桶意味着一个班同时打开成绩页
  // 就会互相 429。这一组现在都必须带令牌，所以按用户分桶；没令牌 / 令牌无效
  // 的请求在限流守卫里仍落 IP 桶（见 rate-limit.guard）。
  it('history-by-name / history-detail / upcoming / practice / trend / skill-profile 都是 user scope', () => {
    const r = new Reflector();
    for (const h of [
      MorningQuizController.prototype.historyByName,
      MorningQuizController.prototype.historyDetail,
      MorningQuizController.prototype.upcomingForName,
      MorningQuizController.prototype.startPractice,
      MorningQuizController.prototype.getPractice,
      MorningQuizController.prototype.submitPractice,
      MorningQuizController.prototype.historyTrend,
      MorningQuizController.prototype.skillProfile,
    ]) {
      expect(r.get(RATE_LIMIT_KEY, h), h.name).toMatchObject({ scope: 'user' });
    }
  });
});
