import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import { GLOBAL_GUARDS } from './global-guards';
import { AuthGuard } from './auth.guard';
import { RateLimitGuard } from './rate-limit.guard';
import { StudentIdentityGuard } from './student-identity.guard';
import { PrismaService } from './prisma.service';
import { StudentController } from '../student/student.controller';
import { StudentService } from '../student/student.service';
import { MorningQuizController } from '../morning-quiz/morning-quiz.controller';
import { MorningQuizService } from '../morning-quiz/morning-quiz.service';
import { MorningQuizExportService } from '../morning-quiz/morning-quiz-export.service';
import { MorningQuizWeeklyCron } from '../morning-quiz/morning-quiz-weekly-cron';
import { AbsenceAlertService } from '../morning-quiz/absence-alert.service';
import { ShortAnswerEvaluatorService } from '../morning-quiz/short-answer-evaluator.service';
import { VocabularyV2Controller } from '../vocab-v2/vocabulary-v2.controller';
import { VocabularyV2Service } from '../vocab-v2/vocabulary-v2.service';
import { LessonController } from '../lesson/lesson.controller';
import { LessonService } from '../lesson/lesson.service';
import { VocabController } from '../vocab/vocab.controller';
import { VocabService } from '../vocab/vocab.service';
import { StudentWordService } from '../vocab/student-word.service';
import { VocabReviewService } from '../vocab/vocab-review.service';
import { VocabQuizService } from '../vocab/vocab-quiz.service';
import { VocabTeacherService } from '../vocab/vocab-teacher.service';
import { MistakeService } from '../vocab/mistake.service';
import { PageViewService } from '../vocab/page-view.service';
import { VocabQuizAttemptService } from '../vocab/vocab-quiz-attempt.service';
import { PushController } from '../push/push.controller';
import { PushService } from '../push/push.service';
import { WritingCheckController } from '../writing-check/writing-check.controller';
import { WritingCheckService } from '../writing-check/writing-check.service';
import { StudentAuthController } from '../student-auth/student-auth.controller';
import { StudentAuthService } from '../student-auth/student-auth.service';
import { AdminRbacController } from '../admin-rbac/admin-rbac.controller';
import { AdminRbacService } from '../admin-rbac/admin-rbac.service';

/**
 * **真实守卫链**上的身份生命周期测试（2026-09-11 审计 S03 / S06 / S08）。
 *
 * 起一个真的 Nest HTTP 应用：全局守卫按 `GLOBAL_GUARDS`（与 app.module 同
 * 一份定义）注册，控制器用线上那几个真实的类，控制器上的
 * `StudentIdentityGuard` 也是真的。只有两样是假的：
 *
 *   · Prisma —— 内存假对象，记下每一次读写（「零写库」就是数它）；
 *   · 各业务服务 —— 调用即记账的替身（「到达了业务」就是看它有没有被调）。
 *     学生侧能便宜地真跑的（StudentService、VocabularyV2Service）用真的。
 *
 * **不连任何真实数据库。**
 *
 * ## 为什么要手写 design:paramtypes
 *
 * vitest 用 esbuild 转译，esbuild 不产出 `emitDecoratorMetadata`，Nest 的
 * 构造器注入拿不到参数类型。下面 `wire()` 把真实构造器的参数表补上，并用
 * `Function.length` 核对参数个数 —— 构造器改了而这里没跟上，测试当场红。
 */

const SECRET = 'guard-chain-e2e-secret';

function wire(cls: any, deps: any[]) {
  expect(cls.length, `${cls.name} 构造器参数个数变了，更新 wire()`).toBe(deps.length);
  Reflect.defineMetadata('design:paramtypes', deps, cls);
}

function wireAll() {
  wire(AuthGuard, [JwtService, Reflector, PrismaService]);
  wire(RateLimitGuard, [Reflector, JwtService]);
  wire(StudentIdentityGuard, [JwtService, Reflector, PrismaService]);
  wire(StudentController, [StudentService]);
  wire(MorningQuizController, [
    MorningQuizService, StudentService, MorningQuizExportService, MorningQuizWeeklyCron,
    AbsenceAlertService, ShortAnswerEvaluatorService, PrismaService,
  ]);
  wire(VocabularyV2Controller, [VocabularyV2Service]);
  wire(LessonController, [LessonService, PrismaService]);
  wire(VocabController, [
    VocabService, StudentWordService, VocabReviewService, VocabQuizService, VocabTeacherService,
    MistakeService, PageViewService, PrismaService, VocabQuizAttemptService,
  ]);
  wire(PushController, [PushService]);
  wire(WritingCheckController, [WritingCheckService]);
  wire(StudentAuthController, [StudentAuthService, JwtService, PrismaService]);
  wire(AdminRbacController, [AdminRbacService]);
}

// ─────────────────────────────── 内存假库 ───────────────────────────────

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  archivedAt: Date | null;
  studentAuthVersion: number;
}

const WRITE_OPS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);

type Fixtures = Record<string, (args: any) => unknown>;

function makePrisma(users: UserRow[], fixtures: Fixtures = {}) {
  const log = { reads: [] as string[], writes: [] as string[] };
  const byId = (id: unknown) => users.find((u) => u.id === id) ?? null;
  const builtIn: Fixtures = {
    'user.findUnique': ({ where }) => byId(where?.id),
    'user.findFirst': ({ where }) => {
      const u = byId(where?.id);
      return u && u.role === 'student' && u.isActive && !u.archivedAt ? u : null;
    },
    'user.findMany': ({ where }) =>
      users
        .filter((u) => (where?.id ? u.id === where.id : true))
        .filter((u) => u.isActive && !u.archivedAt)
        .map((u) => ({ ...u, classEnrollments: [] })),
  };
  let self: any;
  const model = (name: string) =>
    new Proxy({}, {
      get(_t, op) {
        if (typeof op !== 'string' || op === 'then') return undefined;
        return async (args: any) => {
          (WRITE_OPS.has(op) ? log.writes : log.reads).push(`${name}.${op}`);
          const key = `${name}.${op}`;
          const f = fixtures[key] ?? builtIn[key];
          if (f) return f(args);
          if (op === 'findMany') return [];
          if (op === 'count') return 0;
          if (WRITE_OPS.has(op)) return { count: 0 };
          return null;
        };
      },
    });
  self = new Proxy({}, {
    get(_t, k) {
      if (k === '__log') return log;
      if (k === '$transaction') {
        return async (fn: any) => (typeof fn === 'function' ? fn(self) : Promise.all(fn));
      }
      if (typeof k !== 'string' || k === 'then' || k.startsWith('on') || k.startsWith('$')) return undefined;
      return model(k);
    },
  });
  return self as any;
}

const LIFECYCLE_HOOKS = new Set([
  'onModuleInit', 'onModuleDestroy', 'onApplicationBootstrap',
  'beforeApplicationShutdown', 'onApplicationShutdown',
]);

/** 任何方法都可调、调用即记账的业务服务替身。 */
function recorder(name: string, calls: string[]) {
  return new Proxy({}, {
    get(_t, k) {
      if (typeof k !== 'string' || k === 'then' || LIFECYCLE_HOOKS.has(k)) return undefined;
      return async () => {
        calls.push(`${name}.${k}`);
        return { ok: true, from: `${name}.${k}` };
      };
    },
  });
}

// ─────────────────────────────── 应用 ───────────────────────────────

export interface Harness {
  app: INestApplication;
  base: string;
  prisma: any;
  calls: string[];
  users: UserRow[];
  jwt: JwtService;
}

const STUDENT: UserRow = {
  id: 'stu-a', name: '学生甲', email: 'a@pilot.invalid', role: 'student',
  isActive: true, archivedAt: null, studentAuthVersion: 0,
};
const STUDENT_B: UserRow = {
  id: 'stu-b', name: '学生乙', email: 'b@pilot.invalid', role: 'student',
  isActive: true, archivedAt: null, studentAuthVersion: 0,
};
const ADMIN: UserRow = {
  id: 'adm-1', name: '管理员', email: 'adm@school.local', role: 'admin',
  isActive: true, archivedAt: null, studentAuthVersion: 0,
};

/** 旧 /student/* 与 history-detail 需要的那一份答卷（归学生甲）。 */
const SUBMISSION_FIXTURES: Fixtures = {
  'studentSubmission.findUnique': ({ where }) =>
    where?.id === 'sub-1'
      ? {
          id: 'sub-1', assignmentId: 'as-1', studentId: 'stu-a', status: 'in_progress',
          startedAt: new Date(), submittedAt: null, finalSubmittedAt: null, maxScore: 3,
          autoScore: null, manualScore: null, totalScore: null,
          student: { name: '学生甲' },
          assignment: { id: 'as-1', paperId: 'p-1', paper: { id: 'p-1', name: 'P', questions: [] }, class: null },
          scripts: [],
        }
      : null,
  'paperQuestion.findFirst': () => ({ id: 'pq-1' }),
  'answerScript.upsert': ({ create }) => ({ id: 'as-row', ...create }),
  'morningQuizSession.findUnique': () => ({ paperAssignmentId: 'as-1' }),
  'morningQuizSession.findFirst': () => ({ id: 's1' }),
};

export async function startApp(opts: { users?: UserRow[]; fixtures?: Fixtures } = {}): Promise<Harness> {
  wireAll();
  const users = (opts.users ?? [STUDENT, STUDENT_B, ADMIN]).map((u) => ({ ...u }));
  const prisma = makePrisma(users, { ...SUBMISSION_FIXTURES, ...(opts.fixtures ?? {}) });
  const calls: string[] = [];
  const rec = (name: string) => recorder(name, calls);
  const moduleRef = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: SECRET })],
    controllers: [
      StudentController, MorningQuizController, VocabularyV2Controller, LessonController,
      VocabController, PushController, WritingCheckController, StudentAuthController,
      AdminRbacController,
    ],
    providers: [
      ...GLOBAL_GUARDS.map((guard) => ({ provide: APP_GUARD, useClass: guard })),
      { provide: PrismaService, useValue: prisma },
      // 学生侧能真跑的用真的 —— 「零写库」数的是真实服务发出的写
      { provide: StudentService, useFactory: () => new StudentService(prisma) },
      {
        provide: VocabularyV2Service,
        useFactory: () => new VocabularyV2Service(prisma, rec('translator') as any),
      },
      { provide: MorningQuizService, useValue: rec('mq') },
      { provide: MorningQuizExportService, useValue: rec('mqExport') },
      { provide: MorningQuizWeeklyCron, useValue: rec('weeklyCron') },
      { provide: AbsenceAlertService, useValue: rec('absence') },
      { provide: ShortAnswerEvaluatorService, useValue: rec('shortAnswer') },
      { provide: LessonService, useValue: rec('lesson') },
      { provide: VocabService, useValue: rec('vocab') },
      { provide: StudentWordService, useValue: rec('words') },
      { provide: VocabReviewService, useValue: rec('review') },
      { provide: VocabQuizService, useValue: rec('quiz') },
      { provide: VocabTeacherService, useValue: rec('vocabTeacher') },
      { provide: MistakeService, useValue: rec('mistakes') },
      { provide: PageViewService, useValue: rec('views') },
      { provide: VocabQuizAttemptService, useValue: rec('attempts') },
      { provide: PushService, useValue: rec('push') },
      { provide: WritingCheckService, useValue: rec('writing') },
      { provide: StudentAuthService, useValue: rec('studentAuth') },
      { provide: AdminRbacService, useValue: rec('rbac') },
    ],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  // 与 main.ts 一致：只信一跳代理
  (app.getHttpAdapter().getInstance() as any).set('trust proxy', 1);
  await app.listen(0, '127.0.0.1');
  const port = (app.getHttpServer().address() as { port: number }).port;
  return {
    app,
    base: `http://127.0.0.1:${port}/api`,
    prisma,
    calls,
    users,
    jwt: new JwtService({ secret: SECRET }),
  };
}

export async function call(
  h: Harness,
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; ip?: string } = {},
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${h.base}${path}`, {
    method,
    headers: {
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(opts.ip ? { 'x-forwarded-for': opts.ip } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* 非 JSON 原样 */
  }
  return { status: res.status, body };
}

const sign = (h: Harness, payload: Record<string, unknown>, expiresIn: string | number = '30d') =>
  h.jwt.signAsync(payload, { expiresIn });

/** 学生本人的 30 天令牌（与 login 同构）。 */
const studentToken = (h: Harness, u: UserRow = STUDENT, av = 0) =>
  sign(h, { id: u.id, email: u.email, role: 'student', name: u.name, av });
/** 扫码签发的当天令牌（不带 av）。 */
const scanToken = (h: Harness, u: UserRow = STUDENT) =>
  sign(h, { id: u.id, email: u.email, role: 'student', name: u.name }, 3600);
/** 发卷 handoff 窄凭证。 */
const handoffToken = (h: Harness, sessionId: string, u: UserRow = STUDENT) =>
  sign(h, { id: u.id, email: u.email, role: 'student', name: u.name, scope: 'mq_handoff', mqs: sessionId }, 3600);
/** 教师「以学生视角查看」的只读令牌。 */
const teacherViewToken = (h: Harness, u: UserRow = STUDENT) =>
  sign(
    h,
    { id: u.id, email: u.email, role: 'student', name: u.name, scope: 'teacher_view', av: 0, actorId: 'tch-1' },
    '15m',
  );

function reset(h: Harness) {
  h.calls.length = 0;
  h.prisma.__log.reads.length = 0;
  h.prisma.__log.writes.length = 0;
  for (const u of h.users) {
    const orig = [STUDENT, STUDENT_B, ADMIN].find((x) => x.id === u.id);
    if (orig) Object.assign(u, orig);
  }
}

// ─────────────────────────────── 路由清单 ───────────────────────────────

type Route = { method: string; path: string; body?: unknown; label?: string };

/** 旧接口（全局 AuthGuard 那一路）上的学生写操作。 */
const LEGACY_WRITES: Route[] = [
  { method: 'POST', path: '/student/submissions', body: { assignmentId: 'as-1' } },
  { method: 'PATCH', path: '/student/submissions/sub-1/scripts', body: { paperQuestionId: 'pq-1', selectedOption: 'A' } },
  { method: 'POST', path: '/student/submissions/sub-1/submit' },
  { method: 'POST', path: '/morning-quiz/sessions/s1/open', body: {} },
  { method: 'PATCH', path: '/morning-quiz/sessions/s1/answer', body: { paperQuestionId: 'pq-1', selectedOption: 'A' } },
  { method: 'POST', path: '/morning-quiz/sessions/s1/check', body: { paperQuestionId: 'pq-1', selectedOption: 'A' } },
  { method: 'POST', path: '/morning-quiz/sessions/s1/submit', body: { final: true } },
];

/** 新接口（@Public + StudentIdentityGuard 那一路）上的学生写操作。 */
const NEW_WRITES: Route[] = [
  { method: 'POST', path: '/morning-quiz/appeals', body: { submissionId: 'sub-1', message: 'x' } },
  { method: 'POST', path: '/vocab-v2/profile', body: { dailyTarget: 10 } },
  { method: 'POST', path: '/vocab-v2/custom-test/start', body: { count: 5 } },
  { method: 'POST', path: '/vocab-v2/collect', body: { headword: 'apple', action: 'learn' } },
  { method: 'POST', path: '/vocab-v2/notebook/remove', body: { senseId: 'x' } },
  { method: 'POST', path: '/vocab-v2/notebook/relearn', body: { senseId: 'x' } },
  { method: 'POST', path: '/vocab-v2/daily/start', body: {} },
  { method: 'POST', path: '/vocab-v2/daily/item', body: { sessionId: 's', itemId: 'i', action: 'normal' } },
  { method: 'POST', path: '/vocab-v2/daily/replace', body: { sessionId: 's', itemId: 'i' } },
  { method: 'POST', path: '/vocab-v2/test/start', body: { dailySessionId: 'd' } },
  { method: 'POST', path: '/vocab-v2/test/answer', body: { sessionId: 's', itemId: 'i', response: 'a' } },
  { method: 'POST', path: '/vocab-v2/test/submit', body: { sessionId: 's' } },
  { method: 'POST', path: '/lesson/start', body: {} },
  { method: 'POST', path: '/lesson/vocab-taught', body: { headword: 'apple', cursor: 1 } },
  { method: 'POST', path: '/lesson/vocab-replace', body: { headword: 'apple', cursor: 1 } },
  { method: 'POST', path: '/lesson/vocab-test/defer', body: {} },
  { method: 'POST', path: '/lesson/vocab-cursor', body: { cursor: 1 } },
  { method: 'POST', path: '/vocab/words', body: { word: 'apple' } },
  { method: 'POST', path: '/vocab/review', body: { headword: 'apple', rating: 'good' } },
  { method: 'POST', path: '/vocab/quiz/attempt/start', body: {} },
  { method: 'POST', path: '/vocab/quiz/attempt/submit', body: {} },
  {
    method: 'POST',
    path: '/push/subscribe',
    body: { endpoint: 'https://push.example.invalid/x', keys: { p256dh: 'p', auth: 'a' } },
  },
  { method: 'POST', path: '/push/unsubscribe', body: { endpoint: 'https://push.example.invalid/x' } },
  { method: 'POST', path: '/writing-check', body: { text: 'This is a sentence to check.' } },
  { method: 'POST', path: '/student-auth/change-pin', body: { oldPin: '271828', newPin: '314159' } },
];

/** 已核实**零写库**的 GET —— 教师只读视角可以读（S08）。 */
const READ_ONLY_GETS: Route[] = [
  { method: 'GET', path: '/vocab-v2/search?q=ab' },
  { method: 'GET', path: '/vocab-v2/center' },
  { method: 'GET', path: '/vocab-v2/daily' },
  { method: 'GET', path: '/vocab-v2/tests' },
  { method: 'GET', path: '/lesson/today' },
  { method: 'GET', path: '/vocab/quiz/attempts' },
  { method: 'GET', path: '/vocab/quiz/attempt/current' },
  { method: 'GET', path: '/writing-check/status' },
  { method: 'GET', path: '/push/config' },
  { method: 'GET', path: '/morning-quiz/history-by-name' },
  { method: 'GET', path: '/morning-quiz/history-detail?submissionId=sub-1' },
  { method: 'GET', path: '/morning-quiz/student-result/s1' },
  { method: 'GET', path: '/student/assignments' },
  { method: 'GET', path: '/student/submissions/sub-1' },
  { method: 'GET', path: '/student-auth/me' },
];

/**
 * 会**隐式写库**的 GET —— 教师只读视角必须继续拒绝，直到服务层拆成真正
 * 的只读查询（交给词汇组 / 主线，见台账「留给其他组的端点」）。
 */
const IMPLICIT_WRITE_GETS: Route[] = [
  { method: 'GET', path: '/vocab-v2/profile', label: 'profile() 用 upsert 兜底建档' },
  { method: 'GET', path: '/vocab-v2/overview', label: 'overview() 调 profile() → upsert' },
  { method: 'GET', path: '/morning-quiz/sessions/s1', label: 'getStudentView() → shuffle.getOrCreate 建乱序表' },
];

const title = (r: Route) => `${r.method} ${r.path.split('?')[0]}`;

// ═══════════════════════════════ S03 ═══════════════════════════════

describe('S03 —— 新旧接口统一令牌生命周期（真实守卫链）', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startApp();
  });
  afterAll(async () => {
    await h.app.close();
  });
  beforeEach(() => reset(h));

  it('正常学生不受误伤：旧接口能保存、新接口能读写、me 能读', async () => {
    const t = await studentToken(h);
    const save = await call(h, 'PATCH', '/student/submissions/sub-1/scripts', {
      token: t,
      body: { paperQuestionId: 'pq-1', selectedOption: 'A' },
    });
    expect(save.status, JSON.stringify(save.body)).toBe(200);
    expect(h.prisma.__log.writes).toContain('answerScript.upsert');
    const answer = await call(h, 'PATCH', '/morning-quiz/sessions/s1/answer', {
      token: t,
      body: { paperQuestionId: 'pq-1', selectedOption: 'A' },
    });
    expect(answer.status).toBe(200);
    expect(h.calls).toContain('mq.saveAnswer');
    const center = await call(h, 'GET', '/vocab-v2/center', { token: t });
    expect(center.status).toBe(200);
    const me = await call(h, 'GET', '/student-auth/me', { token: t });
    expect(me.status).toBe(200);
    expect(h.calls).toContain('studentAuth.me');
  });

  const REVOCATIONS: Array<[string, (u: UserRow) => void]> = [
    ['教师重置密码 / 学生改密码（版本号递增）', (u) => { u.studentAuthVersion += 1; }],
    ['后台停用', (u) => { u.isActive = false; }],
    ['归档', (u) => { u.archivedAt = new Date(); }],
  ];

  for (const [event, mutate] of REVOCATIONS) {
    describe(`${event}之后，旧令牌处处失效`, () => {
      const probes: Route[] = [
        ...LEGACY_WRITES,
        { method: 'GET', path: '/student/submissions/sub-1' },
        { method: 'GET', path: '/student/assignments' },
        { method: 'GET', path: '/morning-quiz/sessions/s1' },
        { method: 'GET', path: '/morning-quiz/student-result/s1' },
        { method: 'GET', path: '/vocab-v2/center' },
        { method: 'POST', path: '/vocab-v2/collect', body: { headword: 'apple', action: 'learn' } },
        { method: 'GET', path: '/lesson/today' },
        { method: 'GET', path: '/student-auth/me' },
      ];
      for (const r of probes) {
        it(`${title(r)} → 403 token_revoked，且业务一次都没被调、零写库`, async () => {
          const t = await studentToken(h);
          mutate(h.users.find((u) => u.id === STUDENT.id)!);
          const res = await call(h, r.method, r.path, { token: t, body: r.body });
          expect(res.status, JSON.stringify(res.body)).toBe(403);
          expect(res.body).toMatchObject({ code: 'token_revoked' });
          expect(h.calls).toEqual([]);
          expect(h.prisma.__log.writes).toEqual([]);
        });
      }
    });
  }

  it('扫码当天票（不带 av）：账号停用后在旧答题接口上同样失效', async () => {
    const t = await scanToken(h);
    h.users.find((u) => u.id === STUDENT.id)!.isActive = false;
    const res = await call(h, 'PATCH', '/morning-quiz/sessions/s1/answer', {
      token: t,
      body: { paperQuestionId: 'pq-1', selectedOption: 'A' },
    });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'token_revoked' });
    expect(h.calls).toEqual([]);
  });

  it('扫码当天票（不带 av）：账号归档后在新接口（StudentIdentityGuard 那一路）同样失效', async () => {
    const t = await scanToken(h);
    h.users.find((u) => u.id === STUDENT.id)!.archivedAt = new Date();
    const res = await call(h, 'GET', '/vocab/quiz/attempts', { token: t });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'token_revoked' });
    expect(h.calls).toEqual([]);
  });

  describe('限场次的 mq_handoff 窄凭证', () => {
    it('在自己那一场上照常能答题（不误伤）', async () => {
      const t = await handoffToken(h, 's1');
      const res = await call(h, 'PATCH', '/morning-quiz/sessions/s1/answer', {
        token: t,
        body: { paperQuestionId: 'pq-1', selectedOption: 'A' },
      });
      expect(res.status).toBe(200);
      expect(h.calls).toContain('mq.saveAnswer');
    });

    it('换一场、或打别的接口 → 403 handoff_scope_restricted', async () => {
      const t = await handoffToken(h, 's1');
      const other = await call(h, 'PATCH', '/morning-quiz/sessions/s2/answer', {
        token: t,
        body: { paperQuestionId: 'pq-1' },
      });
      expect(other.status).toBe(403);
      const legacy = await call(h, 'GET', '/student/submissions/sub-1', { token: t });
      expect(legacy.status).toBe(403);
      expect(h.calls).toEqual([]);
    });

    it('账号停用后，已经发出去的 handoff 票也失效', async () => {
      const t = await handoffToken(h, 's1');
      h.users.find((u) => u.id === STUDENT.id)!.isActive = false;
      const res = await call(h, 'PATCH', '/morning-quiz/sessions/s1/answer', {
        token: t,
        body: { paperQuestionId: 'pq-1' },
      });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'token_revoked' });
      expect(h.calls).toEqual([]);
    });
  });

  describe('教职工令牌同样受停用 / 归档 / 改角色约束（S04 的「现有会话」）', () => {
    const adminToken = () =>
      sign(h, { id: ADMIN.id, email: ADMIN.email, role: 'admin', name: ADMIN.name }, '7d');

    it('启用中的管理员能进后台', async () => {
      const res = await call(h, 'GET', '/admin-rbac/users', { token: await adminToken() });
      expect(res.status).toBe(200);
      expect(h.calls).toContain('rbac.listUsers');
    });

    const STAFF_EVENTS: Array<[string, (u: UserRow) => void]> = [
      ['停用', (u) => { u.isActive = false; }],
      ['归档', (u) => { u.archivedAt = new Date(); }],
      ['降级为教师', (u) => { u.role = 'teacher'; }],
    ];
    for (const [event, mutate] of STAFF_EVENTS) {
      it(`${event}之后，手里 7 天的旧令牌 → 401 token_revoked`, async () => {
        const t = await adminToken();
        mutate(h.users.find((u) => u.id === ADMIN.id)!);
        const res = await call(h, 'GET', '/admin-rbac/users', { token: t });
        expect(res.status).toBe(401);
        expect(res.body).toMatchObject({ code: 'token_revoked' });
        expect(h.calls).toEqual([]);
      });
    }
  });

  it('一次请求只查一次账号状态（AuthGuard 与 StudentIdentityGuard 共用结果）', async () => {
    const t = await studentToken(h);
    await call(h, 'GET', '/morning-quiz/student-result/s1', { token: t });
    expect(h.prisma.__log.reads.filter((r: string) => r === 'user.findUnique')).toHaveLength(1);
  });
});

describe('S03 —— 教师只读视角：所有写操作拒绝且零写库', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startApp();
  });
  afterAll(async () => {
    await h.app.close();
  });
  beforeEach(() => reset(h));

  for (const r of [...LEGACY_WRITES, ...NEW_WRITES]) {
    it(`${title(r)} → 403 teacher_view_is_read_only，业务零调用、零写库`, async () => {
      const t = await teacherViewToken(h);
      const res = await call(h, r.method, r.path, { token: t, body: r.body });
      expect(res.status, JSON.stringify(res.body)).toBe(403);
      expect(res.body).toMatchObject({ code: 'teacher_view_is_read_only' });
      expect(h.calls).toEqual([]);
      expect(h.prisma.__log.writes).toEqual([]);
    });
  }

  it('教师只读视角同样受撤销约束：学生版本号变了，视角令牌也失效', async () => {
    const t = await teacherViewToken(h);
    h.users.find((u) => u.id === STUDENT.id)!.studentAuthVersion = 5;
    const res = await call(h, 'GET', '/vocab-v2/center', { token: t });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'token_revoked' });
  });
});

// ═══════════════════════════════ S08 ═══════════════════════════════

describe('S08 —— 读身份与本人写入分开：教师只读视角能浏览零写库的 GET', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startApp();
  });
  afterAll(async () => {
    await h.app.close();
  });
  beforeEach(() => reset(h));

  for (const r of READ_ONLY_GETS) {
    it(`${title(r)} → 教师只读视角可读（2xx），全程零写库`, async () => {
      const t = await teacherViewToken(h);
      const res = await call(h, r.method, r.path, { token: t });
      expect(res.status, JSON.stringify(res.body)).toBeGreaterThanOrEqual(200);
      expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
      expect(h.prisma.__log.writes).toEqual([]);
    });
  }

  for (const r of IMPLICIT_WRITE_GETS) {
    it(`${title(r)}（${r.label}）→ 仍拒绝教师只读视角，零写库`, async () => {
      const t = await teacherViewToken(h);
      const res = await call(h, r.method, r.path, { token: t });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ code: 'teacher_view_is_read_only' });
      expect(h.calls).toEqual([]);
      expect(h.prisma.__log.writes).toEqual([]);
    });
  }

  it('学生本人读这些 GET 照常（没有因为拆分而多挡一道）', async () => {
    const t = await studentToken(h);
    for (const r of [...READ_ONLY_GETS, ...IMPLICIT_WRITE_GETS]) {
      const res = await call(h, r.method, r.path, { token: t });
      expect(res.status, `${title(r)} ${JSON.stringify(res.body)}`).toBeLessThan(300);
    }
  });

  it('不带令牌：@Public 那一路读身份的 GET 一律 403 student_token_required', async () => {
    const publicReads = READ_ONLY_GETS.filter(
      (x) =>
        !x.path.startsWith('/student/') &&
        !x.path.startsWith('/morning-quiz/student-result') &&
        !x.path.startsWith('/student-auth'),
    );
    for (const r of publicReads) {
      const res = await call(h, r.method, r.path);
      expect(res.status, title(r)).toBe(403);
      expect(res.body).toMatchObject({ code: 'student_token_required' });
    }
    expect(h.calls).toEqual([]);
  });
});
