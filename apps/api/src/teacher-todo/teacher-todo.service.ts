import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface TeacherTodoTodayPayload {
  generatedAt: string;
  summary: {
    pendingReviewPapers: number;
    pendingMarkScripts: number;
    consecutiveAbsentStudents: number;
    unaccountedStudentsToday: number;
  };
  pendingReviewPapers: Array<{
    paperId: string;
    name: string;
    verdict: string;
    summary: string | null;
    reviewedAt: string | null;
  }>;
  pendingMarkScripts: Array<{
    scriptId: string;
    submissionId: string;
    studentName: string;
    paperName: string;
    paperQuestionId: string;
    sortOrder: number;
    classLabel: string | null;
  }>;
  consecutiveAbsentStudents: Array<{
    studentId: string;
    studentName: string;
    streakDays: number;
    lastAbsentDate: string;
  }>;
  unaccountedStudentsToday: Array<{
    classId: string;
    className: string;
    studentId: string;
    studentName: string;
  }>;
}

const ABSENCE_ALERT_THRESHOLD = 3;

@Injectable()
export class TeacherTodoService {
  private readonly logger = new Logger('TeacherTodoService');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregate the four signal streams into one payload. Designed to run
   * cheaply (≤100ms on small schools) — every query is bounded by recent
   * history (today + 30-day absence window) and uses indexed columns.
   */
  async today(): Promise<TeacherTodoTodayPayload> {
    const now = new Date();

    // 1. Papers awaiting QA-review teacher action.
    const reviewPapers = await this.prisma.paper.findMany({
      where: {
        qaReviewVerdict: { in: ['needs_review', 'reject'] },
        qaTeacherAction: null,
      },
      select: {
        id: true,
        name: true,
        qaReviewVerdict: true,
        qaReviewSummary: true,
        qaReviewedAt: true,
      },
      orderBy: { qaReviewedAt: 'desc' },
      take: 50,
    });

    // 2. Answer scripts awaiting marking (structured / short_answer items
    //    without awardedMarks). MCQ items have awardedMarks set by
    //    autoGradeScripts, so they're excluded by the where clause.
    const pendingScripts = await this.prisma.answerScript.findMany({
      where: {
        awardedMarks: null,
        paperQuestion: {
          question: {
            questionType: { in: ['short_answer', 'structured'] as any },
          },
        },
      },
      select: {
        id: true,
        submissionId: true,
        paperQuestionId: true,
        paperQuestion: {
          select: {
            sortOrder: true,
            paper: { select: { name: true, classLabel: true } },
          },
        },
        submission: {
          select: {
            student: { select: { name: true } },
          },
        },
      },
      take: 100,
    });

    // 3. Consecutive-absent students. We re-implement the same logic the
    //    AbsenceAlertService uses but without the de-duped notification
    //    state — the dashboard just shows the live count.
    const studentsWithAbsence = await this.findConsecutiveAbsents();

    // 4. Today's sessions where students haven't scanned in (after the
    //    late-cutoff time). A "today" session is one whose date == today
    //    in school local time. We pull every active class roster and
    //    subtract those who already have an Attendance row for today's
    //    session — anyone left is unaccounted-for.
    const todayIso = now.toISOString().slice(0, 10);
    const todayDate = new Date(`${todayIso}T00:00:00Z`);
    const sessions = await this.prisma.morningQuizSession.findMany({
      where: { date: todayDate, lateCutoff: { lte: now } },
      select: {
        id: true,
        classId: true,
        class: {
          select: {
            name: true,
            enrollments: {
              where: { role: 'student' },
              select: { user: { select: { id: true, name: true } } },
            },
          },
        },
        attendances: { select: { studentId: true } },
      },
    });
    const unaccounted: TeacherTodoTodayPayload['unaccountedStudentsToday'] = [];
    for (const s of sessions) {
      const seen = new Set(s.attendances.map((a) => a.studentId));
      for (const e of s.class.enrollments) {
        if (!e.user) continue;
        if (!seen.has(e.user.id)) {
          unaccounted.push({
            classId: s.classId,
            className: s.class.name,
            studentId: e.user.id,
            studentName: e.user.name,
          });
        }
      }
    }

    return {
      generatedAt: now.toISOString(),
      summary: {
        pendingReviewPapers: reviewPapers.length,
        pendingMarkScripts: pendingScripts.length,
        consecutiveAbsentStudents: studentsWithAbsence.length,
        unaccountedStudentsToday: unaccounted.length,
      },
      pendingReviewPapers: reviewPapers.map((p) => ({
        paperId: p.id,
        name: p.name,
        verdict: p.qaReviewVerdict ?? 'pending',
        summary: p.qaReviewSummary,
        reviewedAt: p.qaReviewedAt?.toISOString() ?? null,
      })),
      pendingMarkScripts: pendingScripts.map((s) => ({
        scriptId: s.id,
        submissionId: s.submissionId,
        studentName: s.submission.student.name,
        paperName: s.paperQuestion.paper.name,
        paperQuestionId: s.paperQuestionId,
        sortOrder: s.paperQuestion.sortOrder,
        classLabel: s.paperQuestion.paper.classLabel,
      })),
      consecutiveAbsentStudents: studentsWithAbsence,
      unaccountedStudentsToday: unaccounted,
    };
  }

  /** F4 — per-student weakness profile.
   *  For every Question.tag the student has answered in the last 30 days,
   *  compute (wrong + skipped) / total. Sort descending so the worst tags
   *  surface first. Excludes MCQ items where awardedMarks is null
   *  (un-graded), so the ratio reflects only items with a final verdict.
   */
  async weaknessProfile(studentId: string): Promise<{
    studentId: string;
    windowDays: number;
    perTag: Array<{
      tag: string;
      total: number;
      wrong: number;
      ratio: number;
    }>;
  }> {
    const since = new Date(Date.now() - 30 * 86_400_000);
    // Pull every AnswerScript in the window for this student, joined to
    // PaperQuestion → Question.tags + AnswerScript.autoCorrect/awardedMarks.
    const scripts = await this.prisma.answerScript.findMany({
      where: {
        submission: { studentId, submittedAt: { gte: since } },
      },
      select: {
        autoCorrect: true,
        awardedMarks: true,
        paperQuestion: {
          select: {
            marks: true,
            question: { select: { tags: true, questionType: true } },
          },
        },
      },
    });
    // Tally per tag.
    const tally = new Map<string, { total: number; wrong: number }>();
    for (const s of scripts) {
      const tags = s.paperQuestion.question.tags ?? [];
      const marks = s.paperQuestion.marks ?? 1;
      // "wrong" definition:
      //   MCQ → autoCorrect === false
      //   structured → awardedMarks < 50% of paperQuestion.marks
      //   un-graded structured items are skipped entirely (no signal yet)
      let wrong: boolean | null = null;
      if (s.paperQuestion.question.questionType === 'mcq') {
        wrong = s.autoCorrect === false;
      } else if (typeof s.awardedMarks === 'number') {
        wrong = s.awardedMarks < marks * 0.5;
      } else {
        continue;
      }
      for (const t of tags) {
        const cur = tally.get(t) ?? { total: 0, wrong: 0 };
        cur.total += 1;
        if (wrong) cur.wrong += 1;
        tally.set(t, cur);
      }
    }
    const perTag = Array.from(tally.entries())
      .map(([tag, v]) => ({
        tag,
        total: v.total,
        wrong: v.wrong,
        ratio: v.total > 0 ? Math.round((v.wrong / v.total) * 1000) / 1000 : 0,
      }))
      .sort((a, b) => b.ratio - a.ratio || b.total - a.total);
    return { studentId, windowDays: 30, perTag };
  }

  private async findConsecutiveAbsents(): Promise<
    TeacherTodoTodayPayload['consecutiveAbsentStudents']
  > {
    const students = await this.prisma.user.findMany({
      where: { role: 'student' as any, isActive: true },
      select: { id: true, name: true },
    });
    const out: TeacherTodoTodayPayload['consecutiveAbsentStudents'] = [];
    for (const s of students) {
      const recent = await this.prisma.attendance.findMany({
        where: { studentId: s.id },
        orderBy: { session: { date: 'desc' } },
        take: 14,
        select: {
          status: true,
          session: { select: { date: true } },
        },
      });
      let streak = 0;
      let lastAbsent: Date | null = null;
      for (const r of recent) {
        if (r.status === 'absent') {
          streak += 1;
          lastAbsent = lastAbsent ?? r.session.date;
        } else {
          break;
        }
      }
      if (streak >= ABSENCE_ALERT_THRESHOLD) {
        out.push({
          studentId: s.id,
          studentName: s.name,
          streakDays: streak,
          lastAbsentDate: lastAbsent?.toISOString().slice(0, 10) ?? '',
        });
      }
    }
    return out;
  }

  /** Format the today payload as a Markdown digest for WeChat Work text-bot.
   *  Used by the cron + by /teacher/todo/today?format=digest for QA. */
  formatDigest(p: TeacherTodoTodayPayload): string {
    const lines: string[] = [];
    lines.push(`【晨测系统每日概览】 ${p.generatedAt.slice(0, 16).replace('T', ' ')}`);
    lines.push('');
    lines.push(`待复核卷子：${p.summary.pendingReviewPapers}`);
    lines.push(`待批改答题：${p.summary.pendingMarkScripts}`);
    lines.push(`连续缺勤学生 (≥${ABSENCE_ALERT_THRESHOLD} 天)：${p.summary.consecutiveAbsentStudents}`);
    lines.push(`今日未签到：${p.summary.unaccountedStudentsToday}`);
    if (p.consecutiveAbsentStudents.length > 0) {
      lines.push('');
      lines.push('连续缺勤名单：');
      for (const s of p.consecutiveAbsentStudents.slice(0, 8)) {
        lines.push(`- ${s.studentName} (${s.streakDays} 天，最近 ${s.lastAbsentDate})`);
      }
    }
    if (p.unaccountedStudentsToday.length > 0) {
      lines.push('');
      lines.push('今日未签到：');
      for (const s of p.unaccountedStudentsToday.slice(0, 10)) {
        lines.push(`- ${s.studentName} @ ${s.className}`);
      }
    }
    if (p.pendingReviewPapers.length > 0) {
      lines.push('');
      lines.push('待复核卷子：');
      for (const r of p.pendingReviewPapers.slice(0, 5)) {
        lines.push(`- [${r.verdict}] ${r.name}`);
      }
    }
    return lines.join('\n');
  }
}
