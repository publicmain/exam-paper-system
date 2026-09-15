import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { isAdminOrHead } from '../common/roles';
import { assignedReadingFor, type AssignedReading } from '../vocab-v2/level-timeline';
import { isExcludedAccount, isExcludedClass, reportExclusions } from './report-exclusions';
import {
  addDays,
  buildWeeklyReport,
  dayOfWeek,
  isDateKey,
  mondayOf,
  type DayFacts,
  type StudentFacts,
} from './weekly-report';

const sgtKey = (d: Date) => new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
const utcDate = (key: string) => new Date(`${key}T00:00:00.000Z`);
const keyOf = (d: Date) => d.toISOString().slice(0, 10);

/**
 * 学习周报的查库部分（2026-09-15）。**只读** —— 这里没有任何写操作。
 *
 * 把一周里每个学生每一天整理成 `DayFacts`，交给 `buildWeeklyReport` 判断与汇总：
 *
 *   · 那天该做哪份阅读：学习总表的 `assignedReadingFor`（入班以后、按那天的档位、
 *     取消的场次没交不算）—— 与学生首页、教师「生词」页同一个口径；
 *   · 阅读得分率：只算已批完（marked / returned）的卷子；
 *   · 学词：当天 `daily_learning` 这一组；词测：当天 `formal_test`。
 *
 * 看得见谁：管理员 / 班主任全校；任课老师只看自己教的班。只列有英语课（有早测场次）、
 * 没归档、不是演示班的班级；演示 / 测试账号不算（`report-exclusions.ts`）。
 */
@Injectable()
export class LearningReportService {
  constructor(private readonly prisma: PrismaService) {}

  async visibleClasses(actor: { id: string; role: string }) {
    const rules = reportExclusions();
    const rows = await this.prisma.class.findMany({
      where: {
        archivedAt: null,
        morningQuizSessions: { some: {} },
        ...(isAdminOrHead(actor.role) ? {} : { enrollments: { some: { userId: actor.id, role: { not: 'student' } } } }),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    // 名字以「【测试】」开头的是测试班（与 attendance / lesson 服务同一个约定）
    return rows.filter((c) => !isExcludedClass(c.id, rules) && !c.name.startsWith('【测试】'));
  }

  async weekly(
    actor: { id: string; role: string },
    opts: { weekStart?: string | null; classId?: string | null },
    now = new Date(),
  ) {
    if (!isAdminOrHead(actor.role) && actor.role !== 'teacher') {
      throw new ForbiddenException({ code: 'teachers_only' });
    }
    const rules = reportExclusions();
    const today = sgtKey(now);
    const weekStart = mondayOf(opts.weekStart && isDateKey(opts.weekStart) ? opts.weekStart : today);
    const weekEnd = addDays(weekStart, 6);

    const classes = await this.visibleClasses(actor);
    const classNameOf = new Map(classes.map((c) => [c.id, c.name]));
    let scopeIds = classes.map((c) => c.id);
    if (opts.classId) {
      if (!classNameOf.has(opts.classId)) throw new ForbiddenException({ code: 'not_your_class' });
      scopeIds = [opts.classId];
    }
    const weekDays = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i));
    const base = {
      weekStart,
      weekEnd,
      today,
      scope: { classId: opts.classId ?? null, className: opts.classId ? classNameOf.get(opts.classId) ?? null : null },
      classes,
      generatedAt: now.toISOString(),
    };
    const weekdaysOnly = weekDays.filter((d) => dayOfWeek(d) >= 1 && dayOfWeek(d) <= 5);
    if (!scopeIds.length) {
      return buildWeeklyReport({ ...base, days: weekdaysOnly, students: [], excluded: { demoAccounts: 0, registeredAfter: 0 } });
    }

    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { classId: { in: scopeIds }, role: 'student', user: { archivedAt: null, isActive: true } },
      select: {
        classId: true,
        joinedAt: true,
        user: { select: { id: true, name: true, englishLevel: true, createdAt: true } },
      },
    });

    // 一个学生在两个班里只算一次（按班名排序取第一个）；测试号、这周之后才注册的不算
    let demoAccounts = 0;
    let registeredAfter = 0;
    const seen = new Set<string>();
    const cohort: typeof enrollments = [];
    for (const e of [...enrollments].sort((a, b) => (classNameOf.get(a.classId) ?? '').localeCompare(classNameOf.get(b.classId) ?? ''))) {
      if (seen.has(e.user.id)) continue;
      seen.add(e.user.id);
      if (isExcludedAccount(e.user.id, rules)) {
        demoAccounts += 1;
        continue;
      }
      if (sgtKey(e.user.createdAt) > weekEnd) {
        registeredAfter += 1;
        continue;
      }
      cohort.push(e);
    }
    const ids = cohort.map((e) => e.user.id);

    const [assignments, levelChanges, vocab] = await Promise.all([
      this.prisma.paperAssignment.findMany({
        where: {
          classId: { in: scopeIds },
          morningQuizSession: { is: { date: { gte: utcDate(weekStart), lte: utcDate(weekEnd) } } },
        },
        select: {
          id: true,
          classId: true,
          paper: { select: { name: true } },
          morningQuizSession: { select: { id: true, date: true, level: true, status: true } },
          submissions: {
            where: { studentId: { in: ids }, status: { not: 'practice' } },
            select: {
              id: true,
              studentId: true,
              status: true,
              finalSubmittedAt: true,
              submitSource: true,
              totalScore: true,
              maxScore: true,
              _count: { select: { scripts: true } },
            },
          },
        },
      }),
      this.prisma.studentLevelChange.findMany({
        where: { studentId: { in: ids } },
        orderBy: { changedAt: 'asc' },
        select: { studentId: true, fromLevel: true, toLevel: true, changedAt: true, source: true },
      }),
      this.prisma.vocabularyV2Session.findMany({
        where: {
          studentId: { in: ids },
          date: { gte: utcDate(weekStart), lte: utcDate(weekEnd) },
          sessionType: { in: ['daily_learning', 'formal_test'] },
        },
        select: { studentId: true, date: true, sessionType: true, status: true, items: { select: { status: true, isCorrect: true } } },
      }),
    ]);

    // 周一到周五总是显示；周末只有排了课才显示
    const sessionDays = new Set(assignments.filter((a) => a.morningQuizSession).map((a) => keyOf(a.morningQuizSession!.date)));
    const days = weekDays.filter((d) => (dayOfWeek(d) >= 1 && dayOfWeek(d) <= 5) || sessionDays.has(d));
    // 这周最后一个有课日之后才注册的（比如周日注册）：这周本来就没有他的事，不算进来
    const lastDay = days[days.length - 1];
    const lateIds = new Set(cohort.filter((e) => sgtKey(e.user.createdAt) > lastDay).map((e) => e.user.id));
    registeredAfter += lateIds.size;

    const scoreBySubmission = new Map<string, { status: string; totalScore: number | null; maxScore: number | null }>();
    for (const a of assignments) {
      for (const s of a.submissions) {
        scoreBySubmission.set(s.id, { status: String(s.status), totalScore: toNumber(s.totalScore), maxScore: toNumber(s.maxScore) });
      }
    }

    const students: StudentFacts[] = cohort.filter((e) => !lateIds.has(e.user.id)).map((e) => {
      const u = e.user;
      const assigned = assignedReadingFor({
        rows: assignments
          .filter((a) => a.morningQuizSession)
          .map((a) => {
            const sub = a.submissions.find((s) => s.studentId === u.id) ?? null;
            return {
              assignmentId: a.id,
              classId: a.classId,
              title: a.paper?.name ?? null,
              session: {
                id: a.morningQuizSession!.id,
                date: a.morningQuizSession!.date,
                level: String(a.morningQuizSession!.level),
                status: String(a.morningQuizSession!.status),
              },
              submission: sub
                ? { id: sub.id, status: String(sub.status), finalSubmittedAt: sub.finalSubmittedAt, submitSource: sub.submitSource, scripts: sub._count.scripts }
                : null,
            };
          }),
        joinedAtByClass: new Map([[e.classId, e.joinedAt]]),
        changes: levelChanges
          .filter((c) => c.studentId === u.id)
          .map((c) => ({ ...c, fromLevel: c.fromLevel == null ? null : String(c.fromLevel), toLevel: String(c.toLevel) })),
        currentLevel: u.englishLevel == null ? null : String(u.englishLevel),
        todayKey: today,
      });
      const readingByDay = new Map<string, AssignedReading[]>();
      for (const r of assigned) readingByDay.set(r.date, [...(readingByDay.get(r.date) ?? []), r]);
      const mine = vocab.filter((v) => v.studentId === u.id);

      const dayFacts: DayFacts[] = days.map((date) => {
        // 同一天两份（改档后把当天的卷子按新档又做了一遍）：交了的优先；都交了取最后交的那份
        const r =
          [...(readingByDay.get(date) ?? [])].sort(
            (a, b) =>
              Number(b.completed) - Number(a.completed) ||
              (b.submission?.finalSubmittedAt?.getTime() ?? 0) - (a.submission?.finalSubmittedAt?.getTime() ?? 0),
          )[0] ?? null;
        const score = r?.submission ? scoreBySubmission.get(r.submission.id) : undefined;
        const marked = Boolean(score && (score.status === 'marked' || score.status === 'returned'));
        const learnRows = mine.filter((v) => v.sessionType === 'daily_learning' && keyOf(v.date) === date);
        const testRows = mine.filter((v) => v.sessionType === 'formal_test' && keyOf(v.date) === date);
        const test = testRows.find((v) => v.status === 'submitted') ?? testRows[0] ?? null;
        return {
          date,
          reading: r
            ? {
                title: r.title,
                level: r.level,
                state: r.state,
                completed: r.completed,
                awaitingMarking: r.awaitingMarking,
                opened: Boolean(r.submission),
                pct: r.completed && marked && score!.maxScore ? Math.round(((score!.totalScore ?? 0) / score!.maxScore) * 100) : null,
                submittedAt: r.submission?.finalSubmittedAt ? r.submission.finalSubmittedAt.toISOString() : null,
              }
            : null,
          learning: learnRows.length
            ? {
                completed: learnRows.some((v) => v.status === 'completed'),
                itemsDone: Math.max(...learnRows.map((v) => v.items.filter((i) => i.status === 'completed').length)),
                items: Math.max(...learnRows.map((v) => v.items.length)),
              }
            : null,
          test: test
            ? { submitted: test.status === 'submitted', correct: test.items.filter((i) => i.isCorrect === true).length, items: test.items.length }
            : null,
        };
      });

      return {
        id: u.id,
        name: u.name,
        classId: e.classId,
        className: classNameOf.get(e.classId) ?? '',
        level: u.englishLevel == null ? null : String(u.englishLevel),
        registeredOn: sgtKey(u.createdAt),
        days: dayFacts,
      };
    });

    return buildWeeklyReport({ ...base, days, students, excluded: { demoAccounts, registeredAfter } });
  }
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const n = Number(v as never);
  return Number.isFinite(n) ? n : null;
}
