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

    const enrollments = await this.prisma.classEnrollment.findMany({
      where: { classId, role: 'student', user: { isActive: true, archivedAt: null } },
      select: { user: { select: { id: true, name: true, englishLevel: true } } },
    });
    const students = enrollments.map((e) => e.user).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
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
}
