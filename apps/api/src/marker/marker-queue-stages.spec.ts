import { describe, it, expect, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MarkerService } from './marker.service';

/**
 * 审计 M01 / M04（2026-09-11）—— 判分队列的「阶段」与翻页。
 *
 * M01 原症状：队列只选「还有空分数主观题」的答卷。老师逐题保存到最后一题
 * 之后，答卷仍是 submitted、认领仍 active，但它从队列里消失了 —— 没有
 * 「已评分待发布」这个阶段，离开页面后就找不回发布入口。
 *
 * M04 原症状：服务端默认每页 20 份，页面不翻页；前 20 份被别人认领时，
 * 后面可认领的答卷看不到。另外排序只按 submittedAt，同一时刻交卷的
 * 答卷在 OFFSET 翻页时可能重复 / 漏掉（Postgres 对并列行不保证顺序）。
 *
 * 这里用**内存假 prisma**跑真实的 MarkerService：where 条件按 Prisma 语义
 * 在对象图上求值，并列行每次查询随机打乱（模拟 Postgres 的不确定顺序）。
 * 不连任何数据库。
 */

type Row = Record<string, any>;

// ───────────────────────── Prisma where 求值（测试用最小子集） ─────────────────────────

const OPS = new Set(['in', 'notIn', 'not', 'equals', 'some', 'none', 'every', 'is', 'isNot', 'lt', 'lte', 'gt', 'gte']);

function cmp(a: any, b: any): number {
  const x = a instanceof Date ? a.getTime() : a;
  const y = b instanceof Date ? b.getTime() : b;
  if (x == null && y == null) return 0;
  if (x == null) return -1;
  if (y == null) return 1;
  return x < y ? -1 : x > y ? 1 : 0;
}

function matchValue(actual: any, cond: any): boolean {
  if (cond === null) return actual === null || actual === undefined;
  if (cond instanceof Date) return actual instanceof Date && actual.getTime() === cond.getTime();
  if (typeof cond !== 'object') return actual === cond;
  const keys = Object.keys(cond);
  if (keys.length && keys.every((k) => OPS.has(k))) {
    return keys.every((k) => {
      const v = cond[k];
      switch (k) {
        case 'in': return v.includes(actual);
        case 'notIn': return !v.includes(actual);
        case 'equals': return matchValue(actual, v);
        case 'not': return !matchValue(actual, v);
        case 'some': return (actual ?? []).some((x: Row) => matchWhere(x, v));
        case 'none': return !(actual ?? []).some((x: Row) => matchWhere(x, v));
        case 'every': return (actual ?? []).every((x: Row) => matchWhere(x, v));
        case 'is': return actual != null && matchWhere(actual, v);
        case 'isNot': return actual == null || !matchWhere(actual, v);
        case 'lt': return cmp(actual, v) < 0;
        case 'lte': return cmp(actual, v) <= 0;
        case 'gt': return cmp(actual, v) > 0;
        case 'gte': return cmp(actual, v) >= 0;
        default: throw new Error(`unsupported op ${k}`);
      }
    });
  }
  return actual != null && matchWhere(actual, cond);
}

function matchWhere(row: Row, where: Row | undefined): boolean {
  return Object.entries(where ?? {}).every(([k, v]) => {
    if (k === 'AND') return (Array.isArray(v) ? v : [v]).every((w) => matchWhere(row, w));
    if (k === 'OR') return (v as Row[]).some((w) => matchWhere(row, w));
    if (k === 'NOT') return !(Array.isArray(v) ? v : [v]).some((w) => matchWhere(row, w));
    return matchValue(row[k], v);
  });
}

/** 并列行随机打乱后再按 orderBy 稳定排序 —— orderBy 不含唯一键时每次结果都可能不同。 */
let shuffleSeed = 7;
function rand(): number {
  shuffleSeed = (shuffleSeed * 1103515245 + 12345) % 2147483648;
  return shuffleSeed / 2147483648;
}
function orderRows(rows: Row[], orderBy: any): Row[] {
  const shuffled = rows.map((r) => ({ r, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.r);
  const specs: Array<[string, 'asc' | 'desc']> = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [])
    .flatMap((o: Row) => Object.entries(o) as Array<[string, 'asc' | 'desc']>);
  return shuffled
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      for (const [field, dir] of specs) {
        const c = cmp(a.r[field], b.r[field]);
        if (c !== 0) return dir === 'desc' ? -c : c;
      }
      return a.i - b.i;
    })
    .map((x) => x.r);
}

// ───────────────────────── 内存库 ─────────────────────────

interface Db {
  users: Row[];
  classes: Row[];
  enrollments: Row[];
  papers: Row[];
  paperQuestions: Row[];
  assignments: Row[];
  submissions: Row[];
  scripts: Row[];
  claims: Row[];
}

function emptyDb(): Db {
  return { users: [], classes: [], enrollments: [], papers: [], paperQuestions: [], assignments: [], submissions: [], scripts: [], claims: [] };
}

function makePrisma(db: Db) {
  const user = (id: string) => db.users.find((u) => u.id === id) ?? null;
  const pqView = (id: string) => {
    const pq = db.paperQuestions.find((p) => p.id === id)!;
    return { ...pq, question: { questionType: pq.questionType } };
  };
  const scriptView = (s: Row) => ({ ...s, paperQuestion: pqView(s.paperQuestionId) });
  const subView = (s: Row) => {
    const a = db.assignments.find((x) => x.id === s.assignmentId)!;
    const cls = db.classes.find((c) => c.id === a.classId)!;
    return {
      ...s,
      assignment: {
        ...a,
        paper: db.papers.find((p) => p.id === a.paperId),
        class: { ...cls, enrollments: db.enrollments.filter((e) => e.classId === cls.id) },
        morningQuizSession: null,
      },
      student: user(s.studentId),
      scripts: db.scripts.filter((x) => x.submissionId === s.id).map(scriptView),
      markerAssignments: db.claims.filter((c) => c.submissionId === s.id),
    };
  };
  const writes: string[] = [];

  return {
    _writes: writes,
    classEnrollment: {
      findUnique: async ({ where }: any) => {
        const { classId, userId } = where.classId_userId;
        return db.enrollments.find((e) => e.classId === classId && e.userId === userId) ?? null;
      },
    },
    studentSubmission: {
      count: async ({ where }: any) => db.submissions.map(subView).filter((s) => matchWhere(s, where)).length,
      findMany: async ({ where, skip = 0, take, orderBy }: any) => {
        const rows = orderRows(db.submissions.map(subView).filter((s) => matchWhere(s, where)), orderBy);
        return rows.slice(skip, take == null ? undefined : skip + take);
      },
      findUnique: async ({ where }: any) => {
        const s = db.submissions.find((x) => x.id === where.id);
        return s ? subView(s) : null;
      },
      updateMany: async ({ where, data }: any) => {
        const hits = db.submissions.filter((s) => matchWhere(s, where));
        hits.forEach((s) => Object.assign(s, data));
        writes.push(`submission.updateMany:${hits.length}`);
        return { count: hits.length };
      },
    },
    answerScript: {
      findUnique: async ({ where }: any) => {
        const s = db.scripts.find((x) => x.id === where.id);
        if (!s) return null;
        const sub = db.submissions.find((x) => x.id === s.submissionId)!;
        return { ...scriptView(s), submission: { id: sub.id, status: sub.status } };
      },
      update: async ({ where, data }: any) => {
        const s = db.scripts.find((x) => x.id === where.id)!;
        Object.assign(s, data);
        writes.push(`script.update:${s.id}`);
        return { ...s };
      },
    },
    markerAssignment: {
      findMany: async ({ where }: any) =>
        db.claims
          .filter((c) => matchWhere(c, where))
          .map((c) => ({ ...c, marker: user(c.markerId) })),
      findUnique: async ({ where }: any) => {
        const c = db.claims.find((x) => x.submissionId === where.submissionId);
        return c ? { ...c, marker: user(c.markerId) } : null;
      },
      create: async ({ data }: any) => {
        if (db.claims.some((c) => c.submissionId === data.submissionId)) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        const row = { id: `claim-${db.claims.length + 1}`, claimedAt: new Date(), releasedAt: null, ...data };
        db.claims.push(row);
        writes.push(`claim.create:${data.submissionId}`);
        return { ...row };
      },
      updateMany: async ({ where, data }: any) => {
        const hits = db.claims.filter((c) => matchWhere(c, where));
        hits.forEach((c) => Object.assign(c, data));
        return { count: hits.length };
      },
      update: async ({ where, data }: any) => {
        const c = db.claims.find((x) => x.submissionId === where.submissionId)!;
        Object.assign(c, data);
        writes.push(`claim.update:${where.submissionId}:${data.status}`);
        return { ...c };
      },
    },
  } as any;
}

function makeService(prisma: any) {
  const studentWords = { harvestFromSubmission: async () => ({ added: 0, candidates: 0 }) } as any;
  const mistakes = { collectFromSubmission: async () => ({ added: 0 }) } as any;
  return new MarkerService(prisma, studentWords, mistakes);
}

// ───────────────────────── 场景搭建 ─────────────────────────

const TEACHER_A = { id: 't-a', role: 'teacher', ip: null };
const TEACHER_B = { id: 't-b', role: 'teacher', ip: null };
const OUTSIDER = { id: 't-x', role: 'teacher', ip: null };

function seedClass(db: Db) {
  db.users.push(
    { id: 't-a', name: '甲老师', email: 'a@school', role: 'teacher' },
    { id: 't-b', name: '乙老师', email: 'b@school', role: 'teacher' },
    { id: 't-x', name: '别班老师', email: 'x@school', role: 'teacher' },
  );
  db.classes.push({ id: 'c1', name: 'P1', classCode: 'P1' });
  db.enrollments.push(
    { classId: 'c1', userId: 't-a', role: 'class_teacher' },
    { classId: 'c1', userId: 't-b', role: 'subject_teacher' },
  );
  db.papers.push({ id: 'p1', name: '阅读卷', totalMarksActual: 5 });
  db.paperQuestions.push(
    { id: 'pq-mcq', paperId: 'p1', marks: 1, questionType: 'mcq' },
    { id: 'pq-sa1', paperId: 'p1', marks: 2, questionType: 'short_answer' },
    { id: 'pq-sa2', paperId: 'p1', marks: 2, questionType: 'short_answer' },
  );
  db.assignments.push({ id: 'a1', classId: 'c1', paperId: 'p1' });
}

/** 一份已交卷答卷：MCQ 已自动判，两道主观题待批。 */
function seedSubmission(db: Db, n: number, submittedAt: Date) {
  const id = `sub-${String(n).padStart(3, '0')}`;
  const studentId = `stu-${n}`;
  db.users.push({ id: studentId, name: `学生${n}`, email: `${studentId}@x`, role: 'student' });
  db.enrollments.push({ classId: 'c1', userId: studentId, role: 'student' });
  db.submissions.push({
    id, assignmentId: 'a1', studentId, status: 'submitted', submittedAt,
    finalSubmittedAt: submittedAt, autoScore: 1, manualScore: null, totalScore: 1, maxScore: 5,
  });
  db.scripts.push(
    { id: `${id}-mcq`, submissionId: id, paperQuestionId: 'pq-mcq', awardedMarks: 1, markedById: null, markerComment: null },
    { id: `${id}-sa1`, submissionId: id, paperQuestionId: 'pq-sa1', awardedMarks: null, markedById: null, markerComment: null },
    { id: `${id}-sa2`, submissionId: id, paperQuestionId: 'pq-sa2', awardedMarks: null, markedById: null, markerComment: null },
  );
  return id;
}

let db: Db;
beforeEach(() => {
  db = emptyDb();
  seedClass(db);
  shuffleSeed = 7;
});

// ───────────────────────── M01 ─────────────────────────

describe('M01 —— 最后一题保存后仍能找回「已评分待发布」', () => {
  it('逐题保存完最后一题：答卷离开「批改中」，进入「已评分待发布」，认领仍在', async () => {
    const subId = seedSubmission(db, 1, new Date('2026-09-10T01:00:00Z'));
    const prisma = makePrisma(db);
    const svc = makeService(prisma);

    await svc.claim({ submissionId: subId }, TEACHER_A);
    let q = await svc.listQueue({ stage: 'in_progress' } as any, TEACHER_A);
    expect(q.items.map((i: any) => i.id)).toEqual([subId]);
    expect(q.items[0].stage).toBe('in_progress');

    await svc.scoreScript(`${subId}-sa1`, { awardedMarks: 2, markerComment: '两点都答到' }, TEACHER_A);
    await svc.scoreScript(`${subId}-sa2`, { awardedMarks: 1, markerComment: null }, TEACHER_A);

    // 默认口径（还要判分的）里它确实不在了 —— 这没问题；
    const needs = await svc.listQueue({} as any, TEACHER_A);
    expect(needs.items).toHaveLength(0);
    // 但「已评分待发布」阶段必须能找回它（刷新 / 重登就是再调一次这个接口）。
    const ready = await svc.listQueue({ stage: 'ready' } as any, TEACHER_A);
    expect(ready.items.map((i: any) => i.id)).toEqual([subId]);
    expect(ready.items[0]).toMatchObject({ stage: 'ready', status: 'submitted', ungradedCount: 0, structuredCount: 2 });
    expect(ready.items[0].claim).toMatchObject({ status: 'active', markerId: TEACHER_A.id });
    expect(ready.stageCounts).toEqual({ awaiting: 0, in_progress: 0, ready: 1 });
  });

  it('发布只发生一次：发布后状态 marked、认领释放、各阶段计数归零；再发布被拒绝且不再写库', async () => {
    const subId = seedSubmission(db, 1, new Date('2026-09-10T01:00:00Z'));
    const prisma = makePrisma(db);
    const svc = makeService(prisma);
    await svc.claim({ submissionId: subId }, TEACHER_A);
    await svc.scoreScript(`${subId}-sa1`, { awardedMarks: 2 }, TEACHER_A);
    await svc.scoreScript(`${subId}-sa2`, { awardedMarks: 2 }, TEACHER_A);

    const out = await svc.finalize(subId, TEACHER_A);
    expect(out).toMatchObject({ status: 'marked', autoScore: 1, manualScore: 4, totalScore: 5 });
    expect(db.claims[0]).toMatchObject({ status: 'released' });

    const writesBefore = prisma._writes.length;
    await expect(svc.finalize(subId, TEACHER_A)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma._writes.length).toBe(writesBefore);

    const open = await svc.listQueue({ stage: 'open' } as any, TEACHER_A);
    expect(open.total).toBe(0);
    expect(open.stageCounts).toEqual({ awaiting: 0, in_progress: 0, ready: 0 });
  });

  it('全部由自动判分给了分、尚未发布的答卷也在「已评分待发布」—— 学生还看不到成绩，不能凭空消失', async () => {
    const subId = seedSubmission(db, 1, new Date('2026-09-10T01:00:00Z'));
    db.scripts.filter((s) => s.submissionId === subId && s.paperQuestionId !== 'pq-mcq').forEach((s) => { s.awardedMarks = 0; });
    const svc = makeService(makePrisma(db));
    const ready = await svc.listQueue({ stage: 'ready' } as any, TEACHER_A);
    expect(ready.items.map((i: any) => i.id)).toEqual([subId]);
    expect(ready.items[0].markerGradedCount).toBe(0);
  });

  it('别班老师看不到任何阶段的答卷（班级边界不因新阶段放开）', async () => {
    seedSubmission(db, 1, new Date('2026-09-10T01:00:00Z'));
    const svc = makeService(makePrisma(db));
    for (const stage of ['awaiting', 'in_progress', 'ready', 'open']) {
      const q = await svc.listQueue({ stage } as any, OUTSIDER);
      expect(q.total).toBe(0);
    }
  });
});

// ───────────────────────── M04 ─────────────────────────

describe('M04 —— 45 份答卷翻页不重不漏，前 20 被锁仍能找到可认领的', () => {
  function seed45(sameInstant = true) {
    const ids: string[] = [];
    for (let i = 1; i <= 45; i++) {
      // 同一时刻交卷（9:00 自动收卷就是这样），并列行的顺序由数据库决定
      const at = sameInstant ? new Date('2026-09-10T01:00:00Z') : new Date(Date.UTC(2026, 8, 10, 1, i));
      ids.push(seedSubmission(db, i, at));
    }
    return ids;
  }

  it('每页 20：三页 20/20/5，合起来正好 45 个不同的答卷；总数与页数正确', async () => {
    const ids = seed45(true);
    const svc = makeService(makePrisma(db));
    const seen: string[] = [];
    const sizes: number[] = [];
    for (const page of [1, 2, 3]) {
      const q = await svc.listQueue({ page, pageSize: 20 } as any, TEACHER_A);
      expect(q.total).toBe(45);
      expect(q.pageCount).toBe(3);
      sizes.push(q.items.length);
      seen.push(...q.items.map((i: any) => i.id));
    }
    expect(sizes).toEqual([20, 20, 5]);
    expect(new Set(seen).size).toBe(45);
    expect([...seen].sort()).toEqual([...ids].sort());
  });

  it('前 20 份被乙老师认领：甲老师在「待批」里第一页就能看到后面 25 份并认领成功', async () => {
    const ids = seed45(false);
    const svc = makeService(makePrisma(db));
    for (const id of ids.slice(0, 20)) await svc.claim({ submissionId: id }, TEACHER_B);

    const p1 = await svc.listQueue({ stage: 'awaiting', page: 1, pageSize: 20 } as any, TEACHER_A);
    expect(p1.total).toBe(25);
    expect(p1.pageCount).toBe(2);
    expect(p1.items).toHaveLength(20);
    expect(p1.items.every((i: any) => i.claim == null && i.stage === 'awaiting')).toBe(true);
    expect(p1.items[0].id).toBe(ids[20]);
    const p2 = await svc.listQueue({ stage: 'awaiting', page: 2, pageSize: 20 } as any, TEACHER_A);
    expect(p2.items.map((i: any) => i.id)).toEqual(ids.slice(40));

    const claimed = await svc.claim({ submissionId: p1.items[0].id }, TEACHER_A);
    expect(claimed).toMatchObject({ status: 'active', markerId: TEACHER_A.id });

    const counts = (await svc.listQueue({ stage: 'awaiting' } as any, TEACHER_A)).stageCounts;
    expect(counts).toEqual({ awaiting: 24, in_progress: 21, ready: 0 });
    // 「批改中」一栏能看到别人的认领，但不会混进「待批」
    const inProg = await svc.listQueue({ stage: 'in_progress', pageSize: 50 } as any, TEACHER_A);
    expect(inProg.total).toBe(21);
  });

  it('保存、发布后总数和页数随之变化，最后一页被清空时页数回落', async () => {
    const ids = seed45(false);
    const svc = makeService(makePrisma(db));
    // 把最后 5 份判完并发布 —— 第三页原本只有这 5 份
    for (const id of ids.slice(40)) {
      await svc.claim({ submissionId: id }, TEACHER_A);
      await svc.scoreScript(`${id}-sa1`, { awardedMarks: 1 }, TEACHER_A);
      await svc.scoreScript(`${id}-sa2`, { awardedMarks: 1 }, TEACHER_A);
    }
    let q = await svc.listQueue({ page: 3, pageSize: 20 } as any, TEACHER_A);
    expect(q.total).toBe(40);
    expect(q.pageCount).toBe(2);
    expect(q.items).toHaveLength(0);
    expect(q.stageCounts.ready).toBe(5);

    for (const id of ids.slice(40)) await svc.finalize(id, TEACHER_A);
    q = await svc.listQueue({ stage: 'ready' } as any, TEACHER_A);
    expect(q.total).toBe(0);
    expect(q.stageCounts).toEqual({ awaiting: 40, in_progress: 0, ready: 0 });
  });

  it('排序带唯一键兜底（submittedAt 并列时按 id），翻页结果可复现', async () => {
    seed45(true);
    const svc = makeService(makePrisma(db));
    const a = (await svc.listQueue({ page: 2, pageSize: 20 } as any, TEACHER_A)).items.map((i: any) => i.id);
    const b = (await svc.listQueue({ page: 2, pageSize: 20 } as any, TEACHER_A)).items.map((i: any) => i.id);
    expect(a).toEqual(b);
  });
});

describe('M04 —— 阶段参数校验', () => {
  it('stage 只接受约定的几个值', async () => {
    const { QueueQuerySchema } = await import('./dto');
    expect(QueueQuerySchema.safeParse({ stage: 'ready' }).success).toBe(true);
    expect(QueueQuerySchema.safeParse({ stage: 'published' }).success).toBe(false);
    expect(QueueQuerySchema.safeParse({ page: '3', pageSize: '20' }).data).toMatchObject({ page: 3, pageSize: 20 });
  });
});
