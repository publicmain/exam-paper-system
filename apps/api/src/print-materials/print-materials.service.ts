import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { canActOnClass } from '../common/roles';
import { levelLabel, levelsByOrder } from '../morning-quiz/level-registry';
import { buildReadingPrint, buildWordsPrint, type PrintWord, type ReadingPrint } from './print-model';

/**
 * 打印材料（2026-09-22）：全部只读。
 *
 *   · 学生：自己班某一场阅读（不带答案）、自己某一天的单词。
 *   · 老师：一个班某一天 —— 每个档位一份阅读（可带答案），每个学生一份当天的单词
 *     （每个人的词按自己的档位和进度推，各不相同，没法全班共用一张）。
 *   · 老师：一个班一整周（2026-09-29，庞校长要的早读默写）—— 每个学生周一到周五的词
 *     合成一份，按天分组；当天 App 正式单词测试里答错过的词标出来，默写时重点写。
 *     只能印已经排过词的日子：每天的词是当天早上才按进度排的。
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const QUESTION_SELECT = {
  sortOrder: true,
  marks: true,
  snapshotContent: true,
  snapshotOptions: true,
  snapshotAnswer: true,
  overrideContent: true,
  overrideAnswer: true,
  question: { select: { questionType: true } },
} as const;

type QuestionRow = {
  sortOrder: number;
  marks: number;
  snapshotContent: unknown;
  snapshotOptions: unknown;
  snapshotAnswer: unknown;
  overrideContent: unknown;
  overrideAnswer: unknown;
  question: { questionType: string };
};

function toRows(questions: QuestionRow[]) {
  return questions.map((q) => ({
    sortOrder: q.sortOrder,
    marks: q.marks,
    questionType: q.question.questionType,
    content: q.overrideContent ?? q.snapshotContent,
    snapshotOptions: q.snapshotOptions,
    answer: q.overrideAnswer ?? q.snapshotAnswer,
  }));
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const dailySessionKey = (studentId: string, date: string) => `v2:${studentId}:${date}:daily`;
const DAY_MS = 86_400_000;

/** 周一（新加坡日期）→ 这一周的周一到周五。传进来的不是周一就报错，免得印错周。 */
export function teachingWeek(monday: string): string[] {
  if (!DATE_RE.test(monday)) throw new BadRequestException({ code: 'invalid_date' });
  const start = new Date(`${monday}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || dayKey(start) !== monday) throw new BadRequestException({ code: 'invalid_date' });
  if (start.getUTCDay() !== 1) throw new BadRequestException({ code: 'not_monday' });
  return Array.from({ length: 5 }, (_, i) => dayKey(new Date(start.getTime() + i * DAY_MS)));
}

export interface ReadingSheet {
  sessionId: string;
  date: string;
  level: string;
  levelLabel: string;
  reading: ReadingPrint;
}

@Injectable()
export class PrintMaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 学生：自己所在班的一场阅读，不带答案。 */
  async studentReading(studentId: string, sessionId: string): Promise<ReadingSheet & { className: string }> {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        date: true,
        level: true,
        class: { select: { name: true, enrollments: { where: { userId: studentId, role: 'student' }, select: { userId: true } } } },
        paperAssignment: { select: { paper: { select: { questions: { orderBy: { sortOrder: 'asc' }, select: QUESTION_SELECT } } } } },
      },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    if (!session.class.enrollments.length) throw new ForbiddenException({ code: 'not_enrolled' });
    const questions = (session.paperAssignment?.paper?.questions ?? []) as QuestionRow[];
    return {
      sessionId: session.id,
      date: dayKey(session.date),
      level: String(session.level ?? ''),
      levelLabel: session.level ? levelLabel(String(session.level)) : '',
      className: session.class.name,
      reading: buildReadingPrint(toRows(questions), { withAnswers: false }),
    };
  }

  /** 学生：自己某一天（新加坡日期）的每日新词。那天没有任务就是空列表。 */
  async studentWords(studentId: string, date: string): Promise<{ date: string; words: PrintWord[] }> {
    if (!DATE_RE.test(date)) throw new BadRequestException({ code: 'invalid_date' });
    const session = await this.prisma.vocabularyV2Session.findUnique({
      where: { sessionKey: dailySessionKey(studentId, date) },
      select: { items: { select: { position: true, contentSnapshot: true } } },
    });
    return { date, words: buildWordsPrint(session?.items ?? []) };
  }

  /** 老师：一个班某一天的全部打印材料。 */
  async classDay(actor: { id: string; role: string }, classId: string, date: string, withAnswers: boolean) {
    if (!DATE_RE.test(date)) throw new BadRequestException({ code: 'invalid_date' });
    if (!(await canActOnClass(this.prisma, actor, classId))) throw new ForbiddenException({ code: 'class_forbidden' });
    const cls = await this.prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true } });
    if (!cls) throw new NotFoundException({ code: 'class_not_found' });

    const sessions = await this.prisma.morningQuizSession.findMany({
      where: { classId, date: new Date(`${date}T00:00:00.000Z`) },
      select: {
        id: true,
        date: true,
        level: true,
        paperAssignment: { select: { paper: { select: { questions: { orderBy: { sortOrder: 'asc' }, select: QUESTION_SELECT } } } } },
      },
    });
    const order = levelsByOrder().map(String);
    const readings: ReadingSheet[] = sessions
      .filter((s) => (s.paperAssignment?.paper?.questions?.length ?? 0) > 0)
      .map((s) => ({
        sessionId: s.id,
        date: dayKey(s.date),
        level: String(s.level ?? ''),
        levelLabel: s.level ? levelLabel(String(s.level)) : '',
        reading: buildReadingPrint(toRows(s.paperAssignment!.paper!.questions as QuestionRow[]), { withAnswers }),
      }))
      .sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));

    const students = await this.classStudents(classId);
    const daily = students.length
      ? await this.prisma.vocabularyV2Session.findMany({
          where: { sessionKey: { in: students.map((s) => dailySessionKey(s.id, date)) } },
          select: { studentId: true, items: { select: { position: true, contentSnapshot: true } } },
        })
      : [];
    const byStudent = new Map(daily.map((d) => [d.studentId, d.items]));

    return {
      classId: cls.id,
      className: cls.name,
      date,
      withAnswers,
      readings,
      students: students.map((s) => ({
        name: s.name,
        level: s.englishLevel ? String(s.englishLevel) : null,
        levelLabel: s.englishLevel ? levelLabel(String(s.englishLevel)) : null,
        words: buildWordsPrint(byStudent.get(s.id) ?? []),
      })),
    };
  }

  /** 老师：一个班一整周（周一到周五）每个学生的单词，按天分组，标出当天正式单词测试里答错过的词。 */
  async classWeek(actor: { id: string; role: string }, classId: string, monday: string) {
    const dates = teachingWeek(monday);
    if (!(await canActOnClass(this.prisma, actor, classId))) throw new ForbiddenException({ code: 'class_forbidden' });
    const cls = await this.prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true } });
    if (!cls) throw new NotFoundException({ code: 'class_not_found' });

    const students = await this.classStudents(classId);
    const keys = students.flatMap((s) => dates.map((date) => dailySessionKey(s.id, date)));
    const daily = keys.length
      ? await this.prisma.vocabularyV2Session.findMany({
          where: { sessionKey: { in: keys } },
          select: { sessionKey: true, status: true, items: { select: { position: true, contentSnapshot: true, senseId: true } } },
        })
      : [];
    const formal = daily.length
      ? await this.prisma.vocabularyV2Session.findMany({
          where: { sessionKey: { in: daily.map((d) => `${d.sessionKey}:formal`) } },
          select: { sessionKey: true, items: { select: { senseId: true, isCorrect: true } } },
        })
      : [];
    const itemsByKey = new Map(daily.map((d) => [d.sessionKey, d.items]));
    // 系统每天早上照样给每个学生排词；学生那天没在 App 里学完（考试日、缺勤），纸上要看得出来
    const learnedByKey = new Map(daily.map((d) => [d.sessionKey, d.status === 'completed']));
    const wrongByKey = new Map(
      formal.map((f) => [
        f.sessionKey.replace(/:formal$/, ''),
        new Set(f.items.filter((it) => it.isCorrect === false).map((it) => it.senseId)),
      ]),
    );

    return {
      classId: cls.id,
      className: cls.name,
      from: dates[0],
      to: dates[dates.length - 1],
      dates,
      students: students.map((s) => {
        const days = dates
          .map((date) => {
            const key = dailySessionKey(s.id, date);
            return {
              date,
              learned: learnedByKey.get(key) ?? false,
              words: buildWordsPrint(itemsByKey.get(key) ?? [], wrongByKey.get(key) ?? new Set()),
            };
          })
          .filter((d) => d.words.length > 0);
        return {
          name: s.name,
          level: s.englishLevel ? String(s.englishLevel) : null,
          levelLabel: s.englishLevel ? levelLabel(String(s.englishLevel)) : null,
          days,
          total: days.reduce((n, d) => n + d.words.length, 0),
          testWrong: days.reduce((n, d) => n + d.words.filter((w) => w.testWrong).length, 0),
        };
      }),
    };
  }

  /** 班里在读的学生，按姓名排序。 */
  private async classStudents(classId: string) {
    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { classId, role: 'student', user: { isActive: true, archivedAt: null } },
      select: { user: { select: { id: true, name: true, englishLevel: true } } },
    });
    return enrollments.map((e) => e.user).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  }
}
