import { describe, it, expect } from 'vitest';
import { AnalyticsService } from './analytics.service';

/**
 * 审计 T02（2026-09-11）—— 旧「班级统计」的应交 / 缺交 / 均分口径。
 *
 * 原症状：
 *   · 应交 = 全班学生 × 全部 PaperAssignment。早测每天五档各一份卷，一个学生
 *     只需要做自己那一档，却按五份算 —— 模拟「应交 5 / 已交 1 / 缺交 4」。
 *   · 「平均总分（仅已批）」其实把没发布的 submitted 答卷（totalScore = 自动分）
 *     也算进去 —— marked=0 时仍显示 50% 之类的均分。
 *   · 入班日期、取消的场次、练习答卷都没有区分。
 *
 * 这里用内存假 prisma 喂 AnalyticsService.classOverview —— 不连数据库。
 * 假 prisma 总是返回完整对象图（比服务要的多），服务端必须自己在 JS 里
 * 把练习答卷等过滤掉，不能只靠 include 里的 where。
 */

type Level = 'ielts_simplified' | 'olevel_intermediate' | 'olevel' | 'ielts_light' | 'ielts_authentic';
const LEVELS: Level[] = ['ielts_simplified', 'olevel_intermediate', 'olevel', 'ielts_light', 'ielts_authentic'];

interface Student {
  id: string;
  level: Level | null;
  joinedAt?: string;
  isActive?: boolean;
  archivedAt?: string | null;
}

interface Sub {
  studentId: string;
  status: string;
  autoScore?: number | null;
  totalScore?: number | null;
  maxScore?: number;
  submitSource?: string | null;
}

interface Asg {
  id: string;
  /** 早测：场次日期 + 档位；null = 普通布置作业 */
  date?: string;
  level?: Level;
  sessionStatus?: 'scheduled' | 'active' | 'locked' | 'cancelled';
  assignedAt?: string;
  startAt?: string | null;
  dueAt?: string | null;
  max?: number;
  subs?: Sub[];
}

function fakePrisma(students: Student[], assignments: Asg[]) {
  const cls = {
    id: 'c1',
    name: 'P1',
    classCode: 'P1',
    enrollments: students.map((s) => ({
      userId: s.id,
      role: 'student',
      joinedAt: new Date(s.joinedAt ?? '2026-08-01T00:00:00.000Z'),
      user: {
        id: s.id,
        isActive: s.isActive ?? true,
        archivedAt: s.archivedAt ? new Date(s.archivedAt) : null,
        englishLevel: s.level,
      },
    })),
    assignments: assignments.map((a) => ({
      id: a.id,
      assignedAt: new Date(a.assignedAt ?? (a.date ? `${a.date}T00:00:00.000Z` : '2026-09-01T00:00:00.000Z')),
      startAt: a.startAt ? new Date(a.startAt) : null,
      dueAt: a.dueAt ? new Date(a.dueAt) : null,
      paper: { id: `paper-${a.id}`, name: `卷 ${a.id}`, totalMarksActual: a.max ?? 5 },
      morningQuizSession: a.date
        ? { date: new Date(`${a.date}T00:00:00.000Z`), level: a.level ?? 'olevel', status: a.sessionStatus ?? 'locked' }
        : null,
      submissions: (a.subs ?? []).map((s, i) => ({
        id: `${a.id}-sub-${i}`,
        studentId: s.studentId,
        status: s.status,
        autoScore: s.autoScore ?? null,
        manualScore: null,
        totalScore: s.totalScore ?? null,
        maxScore: s.maxScore ?? a.max ?? 5,
        submitSource: s.submitSource ?? 'student',
        finalSubmittedAt: s.status === 'in_progress' ? null : new Date(),
      })),
    })),
  };
  return {
    class: {
      findUnique: async ({ where }: any) => (where.id === 'c1' ? cls : null),
    },
  } as any;
}

/** 新加坡 2026-09-11 下午 —— 「今天」 */
const NOW = new Date('2026-09-11T06:00:00.000Z');

/** 一天五档各一份卷 */
function fiveLevelDay(date: string, subsByLevel: Partial<Record<Level, Sub[]>> = {}, extra: Partial<Asg> = {}): Asg[] {
  return LEVELS.map((level) => ({ id: `${date}-${level}`, date, level, subs: subsByLevel[level] ?? [], ...extra }));
}

describe('T02 —— 应交按学生实际分配的那一份算', () => {
  it('五档齐发、该生只分到 O-Level 标准那一份且已做：应交 1 / 已交 1 / 缺交 0', async () => {
    const svc = new AnalyticsService(
      fakePrisma([{ id: 's1', level: 'olevel' }], fiveLevelDay('2026-09-10', { olevel: [{ studentId: 's1', status: 'marked', autoScore: 2, totalScore: 3 }] })),
    );
    const o = await svc.classOverview('c1', NOW);
    expect(o.totals).toMatchObject({ expectedSubmissions: 1, submitted: 1, marked: 1, missing: 0, inProgress: 0 });
    const own = o.perPaper.find((p) => p.assignmentId === '2026-09-10-olevel')!;
    expect(own).toMatchObject({ studentsExpected: 1, submitted: 1, missing: 0 });
    for (const p of o.perPaper.filter((x) => x.assignmentId !== '2026-09-10-olevel')) {
      expect(p).toMatchObject({ studentsExpected: 0, submitted: 0, missing: 0 });
    }
  });

  it('没做的那天只欠自己那一档的一份，不是五份', async () => {
    const svc = new AnalyticsService(fakePrisma([{ id: 's1', level: 'ielts_light' }], fiveLevelDay('2026-09-10')));
    const o = await svc.classOverview('c1', NOW);
    expect(o.totals).toMatchObject({ expectedSubmissions: 1, submitted: 0, missing: 1 });
    expect(o.perPaper.find((p) => p.assignmentId === '2026-09-10-ielts_light')!.missing).toBe(1);
  });

  it('开始过的任务按当时那一份算：做的是基础档、现在改到了标准档，那天仍然是 1/1/0（不因改档变欠）', async () => {
    const svc = new AnalyticsService(
      fakePrisma(
        [{ id: 's1', level: 'olevel' }],
        fiveLevelDay('2026-09-09', { ielts_simplified: [{ studentId: 's1', status: 'marked', autoScore: 1, totalScore: 2 }] }),
      ),
    );
    const o = await svc.classOverview('c1', NOW);
    expect(o.totals).toMatchObject({ expectedSubmissions: 1, submitted: 1, missing: 0 });
  });

  it('后入班的学生不欠入班前的任务；入班当天起才算', async () => {
    const days = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'];
    const asg = days.flatMap((d) =>
      fiveLevelDay(d, d === '2026-09-09' ? { olevel: [{ studentId: 's-late', status: 'submitted', autoScore: 1, totalScore: 1 }] } : {}),
    );
    // 新加坡 09-09 早上 08:00 入班（UTC 09-09 00:00）
    const svc = new AnalyticsService(fakePrisma([{ id: 's-late', level: 'olevel', joinedAt: '2026-09-09T00:00:00.000Z' }], asg));
    const o = await svc.classOverview('c1', NOW);
    expect(o.totals).toMatchObject({ expectedSubmissions: 2, submitted: 1, missing: 1 });
  });

  it('已取消的场次不欠；还没到日期的场次不欠；已交过的取消场次保留为已交', async () => {
    const asg: Asg[] = [
      { id: 'cancel-empty', date: '2026-09-08', level: 'olevel', sessionStatus: 'cancelled' },
      { id: 'cancel-done', date: '2026-09-09', level: 'olevel', sessionStatus: 'cancelled', subs: [{ studentId: 's1', status: 'marked', autoScore: 2, totalScore: 4 }] },
      { id: 'future', date: '2026-09-14', level: 'olevel', sessionStatus: 'scheduled' },
    ];
    const svc = new AnalyticsService(fakePrisma([{ id: 's1', level: 'olevel' }], asg));
    const o = await svc.classOverview('c1', NOW);
    expect(o.totals).toMatchObject({ expectedSubmissions: 1, submitted: 1, missing: 0 });
    expect(o.perPaper.find((p) => p.assignmentId === 'cancel-empty')).toMatchObject({ studentsExpected: 0, missing: 0, cancelled: true });
    expect(o.perPaper.find((p) => p.assignmentId === 'future')).toMatchObject({ studentsExpected: 0, missing: 0 });
  });

  it('练习答卷不算正式交卷；系统自动收卷算未交（单列数量），不计入已交', async () => {
    const asg: Asg[] = [
      { id: 'd1', date: '2026-09-08', level: 'olevel', subs: [{ studentId: 's1', status: 'practice', autoScore: 5, totalScore: 5 }] },
      { id: 'd2', date: '2026-09-09', level: 'olevel', subs: [{ studentId: 's1', status: 'marked', autoScore: 1, totalScore: 1, submitSource: 'system_eod' }] },
    ];
    const svc = new AnalyticsService(fakePrisma([{ id: 's1', level: 'olevel' }], asg));
    const o = await svc.classOverview('c1', NOW);
    expect(o.totals).toMatchObject({ expectedSubmissions: 2, submitted: 0, missing: 2, autoCollected: 1 });
    expect(o.meanTotalScorePct).toBeNull();
  });

  it('停用 / 归档的学生不计入应交', async () => {
    const svc = new AnalyticsService(
      fakePrisma(
        [
          { id: 's1', level: 'olevel' },
          { id: 's-off', level: 'olevel', isActive: false },
          { id: 's-arch', level: 'olevel', archivedAt: '2026-09-01T00:00:00.000Z' },
        ],
        [{ id: 'd1', date: '2026-09-10', level: 'olevel' }],
      ),
    );
    const o = await svc.classOverview('c1', NOW);
    expect(o.studentCount).toBe(1);
    expect(o.totals.expectedSubmissions).toBe(1);
  });
});

describe('T02 —— 「仅已批」均分只算已发布成绩', () => {
  it('没有已发布成绩时平均总分为空（旧口径会把未发布答卷的自动分当总分，显示 40%）', async () => {
    const svc = new AnalyticsService(
      fakePrisma(
        [{ id: 's1', level: 'olevel' }, { id: 's2', level: 'olevel' }],
        [{ id: 'd1', date: '2026-09-10', level: 'olevel', subs: [{ studentId: 's1', status: 'submitted', autoScore: 2, totalScore: 2 }] }],
      ),
    );
    const o = await svc.classOverview('c1', NOW);
    expect(o.totals).toMatchObject({ expectedSubmissions: 2, submitted: 1, marked: 0, missing: 1, awaitingPublish: 1 });
    expect(o.meanTotalScorePct).toBeNull();
    expect(o.perPaper[0].meanTotalScore).toBeNull();
    // 自动分均值仍可看（老师内部参考），只算已交卷的
    expect(o.meanAutoScorePct).toBe(40);
  });

  it('已发布与未发布混合：平均总分只取已发布的那份', async () => {
    const svc = new AnalyticsService(
      fakePrisma(
        [{ id: 's1', level: 'olevel' }, { id: 's2', level: 'olevel' }],
        [
          {
            id: 'd1',
            date: '2026-09-10',
            level: 'olevel',
            max: 10,
            subs: [
              { studentId: 's1', status: 'marked', autoScore: 4, totalScore: 8 },
              { studentId: 's2', status: 'submitted', autoScore: 2, totalScore: 2 },
            ],
          },
        ],
      ),
    );
    const o = await svc.classOverview('c1', NOW);
    expect(o.meanTotalScorePct).toBe(80);
    expect(o.perPaper[0]).toMatchObject({ marked: 1, submitted: 2, meanTotalScore: 8 });
  });
});

describe('T02 —— 旧系统的普通布置作业按产品范围保留原口径', () => {
  it('非早测的普通作业：入班后布置的全班都欠；入班前已截止的不欠；还没开始的不欠', async () => {
    const asg: Asg[] = [
      { id: 'hw-open', assignedAt: '2026-09-02T00:00:00.000Z', dueAt: '2026-09-20T00:00:00.000Z' },
      { id: 'hw-closed-before-join', assignedAt: '2026-08-01T00:00:00.000Z', dueAt: '2026-08-05T00:00:00.000Z' },
      { id: 'hw-not-started', assignedAt: '2026-09-10T00:00:00.000Z', startAt: '2026-09-15T00:00:00.000Z' },
    ];
    const svc = new AnalyticsService(
      fakePrisma(
        [{ id: 's1', level: 'olevel', joinedAt: '2026-08-20T00:00:00.000Z' }, { id: 's2', level: null, joinedAt: '2026-08-20T00:00:00.000Z' }],
        asg.map((a) => (a.id === 'hw-open' ? { ...a, subs: [{ studentId: 's1', status: 'marked', autoScore: 3, totalScore: 3 }] } : a)),
      ),
    );
    const o = await svc.classOverview('c1', NOW);
    expect(o.perPaper.find((p) => p.assignmentId === 'hw-open')).toMatchObject({ studentsExpected: 2, submitted: 1, missing: 1 });
    expect(o.perPaper.find((p) => p.assignmentId === 'hw-closed-before-join')).toMatchObject({ studentsExpected: 0, missing: 0 });
    expect(o.perPaper.find((p) => p.assignmentId === 'hw-not-started')).toMatchObject({ studentsExpected: 0, missing: 0 });
  });
});
