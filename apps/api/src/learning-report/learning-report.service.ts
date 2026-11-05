import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { canActOnClass, isAdminOrHead } from '../common/roles';
import { loadSchoolCalendar, isTeachingDay, singaporeDate, dateOnly, nextDate, validDate } from '../common/school-calendar';
import { buildTeacherToday } from './teacher-today';
import { assignedReadingFor, type AssignedReading } from '../vocab-v2/level-timeline';
import { formalAnswerOf } from '../vocab-v2/first-answer';
import { VocabularyMasteryService } from '../vocab-v2/mastery';
import { collectionReadingSelect, collectionSessionSelect, loadCollectionV5Facts } from '../achievements/collection-v5-facts';
import { frozenIds } from '../print-materials/dictation.service';
import { readingRedoStatesForDay } from '../vocab/reading-redo';
import { dailyTestNeeded } from '../vocab-v2/unified-vocabulary-rules';
import { isExcludedAccount, isExcludedClass, reportExclusions } from './report-exclusions';
import {
  addDays,
  buildWeeklyReport,
  isDateKey,
  mondayOf,
  type DayFacts,
  type StudentFacts,
} from './weekly-report';

const sgtKey = (d: Date) => new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
const utcDate = (key: string) => new Date(`${key}T00:00:00.000Z`);
const keyOf = (d: Date) => d.toISOString().slice(0, 10);
type ReportDictationSheet = { heldOn: Date; rows: Array<{ studentId: string; status: string; senseIds: unknown; wrongSenseIds: unknown }> };

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
    const weekdaysOnly = weekDays.filter((d) => isTeachingDay(d));
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
    const loaded = await this.loadFacts(cohort, scopeIds, weekDays, today, classNameOf, false, now);
    const days = weekDays.filter((d) => isTeachingDay(d) || loaded.sessionDays.has(d));
    const lastDay = days[days.length - 1];
    const students = loaded.students.filter((student) => student.registeredOn <= lastDay).map((student) => ({ ...student, days: student.days.filter((d) => days.includes(d.date)) }));
    registeredAfter += loaded.students.length - students.length;

    return buildWeeklyReport({ ...base, days, students, excluded: { demoAccounts, registeredAfter } });
  }

  /** Shared read-only fact loader used by the weekly report and daily follow-up. */
  private async loadFacts(
    cohort: Array<{ classId: string; joinedAt: Date; user: { id: string; name: string; englishLevel: unknown; createdAt: Date } }>,
    scopeIds: string[], days: string[], today: string, classNameOf: Map<string, string>, followUps = false, now = new Date(),
  ) {
    const ids = [...new Set(cohort.map((e) => e.user.id))];
    if (!ids.length) return { students: [] as StudentFacts[], sessionDays: new Set<string>() };
    const masteryThrough = [today, days[days.length - 1]].sort()[0];
    const mastery = await new VocabularyMasteryService(this.prisma).reportForStudents(ids, days[0], masteryThrough);
    const calendar = await loadSchoolCalendar(this.prisma, ids, days[0], days[days.length - 1]);
    const [assignments, levelChanges, vocab, pending, dictation, mistakes, redos] = await Promise.all([
      this.prisma.paperAssignment.findMany({
        where: {
          classId: { in: scopeIds },
          morningQuizSession: { is: { date: { gte: utcDate(days[0]), lte: utcDate(days[days.length - 1]) } } },
        },
        select: {
          id: true,
          classId: true,
          paper: { select: { name: true, ...collectionReadingSelect.assignment.select.paper.select } },
          morningQuizSession: { select: { id: true, date: true, level: true, status: true } },
          submissions: {
            where: { studentId: { in: ids }, status: { not: 'practice' } },
            select: {
              scripts: collectionReadingSelect.scripts,
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
          date: { gte: utcDate(days[0]), lte: utcDate(days[days.length - 1]) },
          sessionType: { in: ['daily_learning', 'formal_test'] },
        },
        select: { ...collectionSessionSelect, studentId: true },
      }),
      followUps ? this.prisma.studentSubmission.findMany({
        where: { studentId: { in: ids }, status: 'submitted', finalSubmittedAt: { not: null }, submitSource: { in: ['student', 'teacher'] }, assignment: { classId: { in: scopeIds }, morningQuizSession: { is: { date: { lte: utcDate(today) } } } } },
        select: { id: true, studentId: true, scripts: { where: { awardedMarks: null, paperQuestion: { question: { questionType: { in: ['structured', 'short_answer', 'essay'] } } } }, select: { id: true } } },
      }) : Promise.resolve([] as Array<{ id: string; studentId: string; scripts: Array<{ id: string }> }>),
      followUps ? Promise.resolve([] as ReportDictationSheet[]) : this.prisma.dictationSheet.findMany({
        where: { classId: { in: scopeIds }, heldOn: { gte: utcDate(days[0]), lte: utcDate(masteryThrough) } },
        select: { heldOn: true, rows: { where: { studentId: { in: ids } }, select: { studentId: true, status: true, senseIds: true, wrongSenseIds: true } } },
      }),
      followUps ? Promise.resolve(new Map<string, number>()) : this.openReadingMistakes(ids, masteryThrough),
      followUps ? readingRedoStatesForDay(this.prisma, ids, today, calendar) : Promise.resolve(new Map<string, { target: number; progress: number }>()),
    ]);

    const scoreBySubmission = new Map<string, { status: string; totalScore: number | null; maxScore: number | null }>();
    for (const a of assignments) {
      for (const s of a.submissions) {
        scoreBySubmission.set(s.id, { status: String(s.status), totalScore: toNumber(s.totalScore), maxScore: toNumber(s.maxScore) });
      }
    }

    const students: StudentFacts[] = await Promise.all(cohort.map(async (e) => {
      const u = e.user;
      // Feed the badge's existing gates with the SAME class/week facts, no N+1 reads.
      const earnedDates = followUps ? new Set<string>() : new Set((await loadCollectionV5Facts(this.prisma, u.id, now, {
        user: { id: u.id, role: 'student' },
        readings: assignments.flatMap((a) => a.submissions.filter((s) => s.studentId === u.id).map((s) => ({
          ...s, assignment: { classId: a.classId, morningQuizSession: a.morningQuizSession, paper: a.paper },
        }))),
        sessions: vocab.filter((v) => v.studentId === u.id),
      })).fullDays.map((d) => d.sourceDate));
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
        joinedAtByClass: new Map(cohort.filter((row) => row.user.id === u.id).map((row) => [row.classId, row.joinedAt])),
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
        const paperRows = dictation.filter((s) => keyOf(s.heldOn) === date).flatMap((s) => s.rows.filter((r) => r.studentId === u.id && frozenIds(r.senseIds).length > 0));
        const entered = paperRows.filter((r) => r.status === 'entered');
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
        const daily = learnRows[0];
        const redo = date === today ? redos.get(u.id) : undefined;
        return {
          date,
          noSchoolDay: calendar.isNoSchoolDay(u.id, date),
          earnest: earnedDates.has(date),
          dictation: {
            expected: paperRows.length > 0,
            entered: paperRows.length > 0 && paperRows.every((r) => r.status === 'entered' || r.status === 'absent'),
            items: entered.reduce((n, r) => n + new Set(frozenIds(r.senseIds)).size, 0),
            correct: entered.reduce((n, r) => n + [...new Set(frozenIds(r.senseIds))].filter((id) => !frozenIds(r.wrongSenseIds).includes(id)).length, 0),
          },
          reading: r
            ? {
                assignmentId: r.assignmentId,
                submissionId: r.submission?.id ?? null,
                title: r.title,
                level: r.level,
                state: r.state,
                completed: r.completed,
                redoRequired: redo?.target ?? 0,
                redoDone: redo?.progress ?? 0,
                awaitingMarking: r.awaitingMarking,
                opened: Boolean(r.submission),
                pct: r.completed && marked && score!.totalScore != null && (score!.maxScore ?? 0) > 0 ? ((score!.totalScore ?? 0) / score!.maxScore!) * 100 : null,
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
          testRequired: daily?.status === 'completed' ? dailyTestNeeded(daily) : undefined,
          test: test
            ? { id: test.id, answered: test.items.filter((i) => i.status === 'answered').length, submitted: test.status === 'submitted', correct: test.items.filter((i) => formalAnswerOf(i).isCorrect === true).length, items: test.items.length }
            : null,
        };
      });

      return {
        pendingMarking: pending.filter((p) => p.studentId === u.id && p.scripts.length > 0).map((p) => ({ submissionId: p.id, questions: p.scripts.length })),
        id: u.id,
        name: u.name,
        classId: e.classId,
        className: classNameOf.get(e.classId) ?? '',
        level: u.englishLevel == null ? null : String(u.englishLevel),
        registeredOn: sgtKey(u.createdAt),
        mastered: mastery.mastered.get(u.id)?.size ?? 0,
        newMastered: mastery.added.get(u.id) ?? 0,
        unresolvedReading: mistakes.get(u.id) ?? 0,
        unresolvedVocabulary: mastery.unresolved.get(u.id) ?? 0,
        days: dayFacts,
      };
    }));

    return { students, sessionDays: new Set(assignments.filter((a) => a.morningQuizSession).map((a) => keyOf(a.morningQuizSession!.date))) };
  }

  private async openReadingMistakes(ids: string[], through: string) {
    const counts = new Map<string, number>();
    const cutoff = new Date(utcDate(nextDate(through, 1)).getTime() - 8 * 3600_000);
    let after: string | undefined;
    for (;;) {
      const rows = await this.prisma.mistakeEntry.findMany({ where: {
        ...(after ? { id: { gt: after } } : {}),
        studentId: { in: ids }, quizDay: { lte: through }, createdAt: { lt: cutoff },
        OR: [{ resolved: false }, { resolvedAt: { gte: cutoff } }],
      }, select: { id: true, studentId: true }, orderBy: { id: 'asc' }, take: 500 });
      for (const row of rows) counts.set(row.studentId, (counts.get(row.studentId) ?? 0) + 1);
      if (rows.length < 500) return counts;
      after = rows.at(-1)!.id;
    }
  }

  async today(actor: { id: string; role: string }, classId: string, date?: string, now = new Date()) {
    if (!await canActOnClass(this.prisma, actor, classId)) throw new ForbiddenException({ code: 'not_your_class' });
    const day = date ?? singaporeDate(now);
    if (!validDate(day)) throw new BadRequestException('日期不正确');
    const cls = await this.prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
    if (!cls) throw new NotFoundException('找不到这个班');
    const cohort = await this.prisma.classEnrollment.findMany({
      where: { classId, role: 'student', joinedAt: { lt: new Date(dateOnly(nextDate(day, 1)).getTime() - 8 * 3600_000) }, user: { archivedAt: null, isActive: true } },
      select: { classId: true, joinedAt: true, user: { select: { id: true, name: true, englishLevel: true, createdAt: true } } },
    });
    const ids = cohort.map((e) => e.user.id);
    // No fixed lookback: a long school holiday must not displace teaching days.
    const calendar = await loadSchoolCalendar(this.prisma, ids, undefined, day);
    const recentByStudent = new Map<string, string[]>();
    const selected = new Set<string>([day]);
    for (const id of ids) {
      const recent: string[] = [];
      for (let d = day; recent.length < 3; d = nextDate(d, -1)) {
        if (calendar.isTeachingDay(id, d)) { recent.push(d); selected.add(d); }
      }
      recentByStudent.set(id, recent);
    }
    const days = [...selected].sort();
    const loaded = await this.loadFacts(cohort, [classId], days, day, new Map([[classId, cls.name]]), true, now);
    const warnings = ids.length ? await this.prisma.notification.findMany({
      where: { userId: { in: ids }, type: 'effort_warning', createdAt: { gte: new Date(dateOnly(mondayOf(day)).getTime() - 8 * 3600_000), lt: new Date(dateOnly(nextDate(day, 1)).getTime() - 8 * 3600_000) } },
      select: { id: true, userId: true, title: true, body: true, createdAt: true },
    }) : [];
    const classOff = await this.prisma.classNoSchoolDay.findUnique({ where: { classId_date: { classId, date: dateOnly(day) } }, select: { id: true } });
    return buildTeacherToday({ classId, className: cls.name, date: day, classNoSchoolDay: Boolean(classOff), students: loaded.students, recentByStudent, warned: new Set(warnings.map((w) => w.userId)), warnings });
  }

}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const n = Number(v as never);
  return Number.isFinite(n) ? n : null;
}
