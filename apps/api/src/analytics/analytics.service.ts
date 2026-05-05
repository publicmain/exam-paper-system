import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  ClassOverviewDto,
  StudentHistoryDto,
  TopicMasteryDto,
  WrongAnswerDashboardDto,
  WrongAnswerRowDto,
} from './dto';

/**
 * Read-only aggregates over StudentSubmission + AnswerScript.
 *
 * No mutations are performed here — every method is a pure SELECT, and we
 * never touch tables outside the student-submission graph.  The service is
 * intentionally chatty: it issues a small number of Prisma calls per
 * endpoint and assembles the response in JS, which keeps the SQL surface
 * small and lets us reuse Prisma's relation include semantics.
 *
 * Authorization is handled at the controller layer; this service trusts its
 * caller and returns whatever it's asked for.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /analytics/class/:classId/overview */
  async classOverview(classId: string): Promise<ClassOverviewDto> {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        enrollments: {
          where: { role: 'student' },
          select: { userId: true },
        },
        assignments: {
          include: {
            paper: { select: { id: true, name: true, totalMarksActual: true } },
            submissions: {
              select: {
                id: true,
                studentId: true,
                status: true,
                autoScore: true,
                manualScore: true,
                totalScore: true,
                maxScore: true,
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });
    if (!cls) throw new NotFoundException('class not found');

    const studentIds = new Set(cls.enrollments.map(e => e.userId));
    const studentCount = studentIds.size;
    const paperCount = cls.assignments.length;

    let expected = 0;
    let submitted = 0;
    let marked = 0;
    let inProgress = 0;
    let missing = 0;
    const autoScores: number[] = [];
    const totalScores: number[] = [];

    const perPaper = cls.assignments.map(a => {
      const subsByStudent = new Map(a.submissions.map(s => [s.studentId, s]));
      let pSubmitted = 0;
      let pMarked = 0;
      let pMissing = 0;
      const pAuto: number[] = [];
      const pTotal: number[] = [];

      for (const sid of studentIds) {
        expected += 1;
        const s = subsByStudent.get(sid);
        if (!s) {
          missing += 1;
          pMissing += 1;
          continue;
        }
        if (s.status === 'in_progress') {
          inProgress += 1;
          continue;
        }
        if (s.status === 'submitted' || s.status === 'marked' || s.status === 'returned') {
          submitted += 1;
          pSubmitted += 1;
          if (s.autoScore != null) {
            autoScores.push(s.autoScore);
            pAuto.push(s.autoScore);
          }
        }
        if (s.status === 'marked' || s.status === 'returned') {
          marked += 1;
          pMarked += 1;
          if (s.totalScore != null) {
            totalScores.push(s.totalScore);
            pTotal.push(s.totalScore);
          }
        }
      }

      const maxScore = a.paper.totalMarksActual || 0;
      return {
        paperId: a.paper.id,
        paperName: a.paper.name,
        assignmentId: a.id,
        studentsExpected: studentCount,
        submitted: pSubmitted,
        marked: pMarked,
        missing: pMissing,
        meanAutoScore: pAuto.length ? mean(pAuto) : null,
        meanTotalScore: pTotal.length ? mean(pTotal) : null,
        maxScore,
      };
    });

    // Mean as percentage of paper max — averaged across (student, paper)
    // cells.  Each score's denominator is its own paper's totalMarksActual,
    // so we compute pct per cell then average those.
    const autoPcts: number[] = [];
    const totalPcts: number[] = [];
    for (const a of cls.assignments) {
      const max = a.paper.totalMarksActual || 0;
      if (max <= 0) continue;
      for (const s of a.submissions) {
        if (s.autoScore != null) autoPcts.push((s.autoScore / max) * 100);
        if (s.totalScore != null) totalPcts.push((s.totalScore / max) * 100);
      }
    }

    return {
      classId: cls.id,
      className: cls.name,
      classCode: cls.classCode,
      studentCount,
      paperCount,
      totals: {
        expectedSubmissions: expected,
        submitted,
        marked,
        inProgress,
        missing,
      },
      meanAutoScorePct: autoPcts.length ? round1(mean(autoPcts)) : null,
      meanTotalScorePct: totalPcts.length ? round1(mean(totalPcts)) : null,
      perPaper,
    };
  }

  /** GET /analytics/paper/:paperId/wrong-answers */
  async paperWrongAnswers(paperId: string): Promise<WrongAnswerDashboardDto> {
    const paper = await this.prisma.paper.findUnique({
      where: { id: paperId },
      select: { id: true, name: true },
    });
    if (!paper) throw new NotFoundException('paper not found');

    const pqs = await this.prisma.paperQuestion.findMany({
      where: { paperId },
      orderBy: { sortOrder: 'asc' },
      include: {
        question: {
          select: {
            id: true,
            content: true,
            questionType: true,
            options: true,
          },
        },
        scripts: {
          // Only count scripts attached to a submission that has been
          // submitted (or beyond) — drafts/in-progress shouldn't pollute
          // the dashboard.
          where: {
            submission: { status: { in: ['submitted', 'marked', 'returned'] } },
          },
          select: {
            id: true,
            selectedOption: true,
            textAnswer: true,
            autoCorrect: true,
            awardedMarks: true,
          },
        },
      },
    });

    // Total submissions for the paper = distinct submitted submissions
    // across this paper's assignments.  We compute via the assignment
    // graph since submissions don't link to paper directly.
    const totalSubmissions = await this.prisma.studentSubmission.count({
      where: {
        assignment: { paperId },
        status: { in: ['submitted', 'marked', 'returned'] },
      },
    });

    const rows: WrongAnswerRowDto[] = pqs.map(pq => {
      const total = pq.scripts.length;
      let answered = 0;
      let correct = 0;
      let markedNonZero = 0;
      let markedTotal = 0;
      const wrongOpt: Record<string, number> = {};

      for (const s of pq.scripts) {
        const hasAnswer = s.selectedOption != null || (s.textAnswer != null && s.textAnswer.trim().length > 0);
        if (hasAnswer) answered += 1;
        if (s.autoCorrect === true) correct += 1;
        if (s.autoCorrect === false && s.selectedOption) {
          wrongOpt[s.selectedOption] = (wrongOpt[s.selectedOption] ?? 0) + 1;
        }
        if (s.awardedMarks != null) {
          markedTotal += 1;
          if (s.awardedMarks > 0) markedNonZero += 1;
        }
      }

      // Find top distractor (most-picked wrong option)
      let topDistractor: WrongAnswerRowDto['topDistractor'] = null;
      const wrongEntries = Object.entries(wrongOpt);
      if (wrongEntries.length > 0) {
        wrongEntries.sort((a, b) => b[1] - a[1]);
        const [key, count] = wrongEntries[0];
        const opts = (pq.question.options ?? []) as Array<{ key: string; text: string }>;
        const opt = Array.isArray(opts) ? opts.find(o => o?.key === key) : null;
        topDistractor = { key, count, text: opt?.text ?? null };
      }

      const isMcq = pq.question.questionType === 'mcq';
      const stemSnippet = extractStemSnippet(pq.question.content) ?? extractStemSnippet(pq.snapshotContent);

      return {
        paperQuestionId: pq.id,
        questionId: pq.question.id,
        sortOrder: pq.sortOrder,
        questionType: pq.question.questionType,
        marks: pq.marks,
        stemSnippet,
        totalSubmissions: total,
        answered,
        unanswered: total - answered,
        correct: isMcq ? correct : null,
        pctCorrect: isMcq && total > 0 ? round1((correct / total) * 100) : null,
        topDistractor,
        pctMarkedNonZero: markedTotal > 0 ? round1((markedNonZero / markedTotal) * 100) : null,
      };
    });

    // Sort worst-first by pctCorrect (nulls / non-MCQ go to the bottom).
    rows.sort((a, b) => {
      if (a.pctCorrect == null && b.pctCorrect == null) return a.sortOrder - b.sortOrder;
      if (a.pctCorrect == null) return 1;
      if (b.pctCorrect == null) return -1;
      return a.pctCorrect - b.pctCorrect;
    });

    return {
      paperId: paper.id,
      paperName: paper.name,
      totalSubmissions,
      rows,
    };
  }

  /** GET /analytics/class/:classId/topic-mastery?paperId=X */
  async classTopicMastery(classId: string, paperId?: string): Promise<TopicMasteryDto> {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { id: true },
    });
    if (!cls) throw new NotFoundException('class not found');

    // Pull every script from every (this class, [optional paper]) submission
    // along with its question's primary topic.
    const scripts = await this.prisma.answerScript.findMany({
      where: {
        submission: {
          status: { in: ['submitted', 'marked', 'returned'] },
          assignment: {
            classId,
            ...(paperId ? { paperId } : {}),
          },
        },
      },
      select: {
        autoCorrect: true,
        selectedOption: true,
        paperQuestion: {
          select: {
            question: {
              select: {
                id: true,
                questionType: true,
                primaryTopicId: true,
                primaryTopic: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
      },
    });

    // Group by topic
    type Bucket = {
      topicId: string | null;
      topicCode: string | null;
      topicName: string;
      questionIds: Set<string>;
      mcqAttempts: number;
      mcqCorrect: number;
    };
    const buckets = new Map<string, Bucket>();
    const keyOf = (tid: string | null) => tid ?? '__untagged__';

    for (const s of scripts) {
      const q = s.paperQuestion.question;
      const t = q.primaryTopic;
      const k = keyOf(t?.id ?? null);
      let b = buckets.get(k);
      if (!b) {
        b = {
          topicId: t?.id ?? null,
          topicCode: t?.code ?? null,
          topicName: t?.name ?? '(uncategorised)',
          questionIds: new Set<string>(),
          mcqAttempts: 0,
          mcqCorrect: 0,
        };
        buckets.set(k, b);
      }
      b.questionIds.add(q.id);
      if (q.questionType === 'mcq') {
        b.mcqAttempts += 1;
        if (s.autoCorrect === true) b.mcqCorrect += 1;
      }
    }

    const topics = [...buckets.values()]
      .map(b => ({
        topicId: b.topicId,
        topicCode: b.topicCode,
        topicName: b.topicName,
        questionCount: b.questionIds.size,
        mcqAttempts: b.mcqAttempts,
        mcqCorrect: b.mcqCorrect,
        pctCorrect: b.mcqAttempts > 0 ? round1((b.mcqCorrect / b.mcqAttempts) * 100) : null,
      }))
      // Sort by lowest mastery first, putting null (no MCQ data) last.
      .sort((a, b) => {
        if (a.pctCorrect == null && b.pctCorrect == null) return a.topicName.localeCompare(b.topicName);
        if (a.pctCorrect == null) return 1;
        if (b.pctCorrect == null) return -1;
        return a.pctCorrect - b.pctCorrect;
      });

    return { classId, paperId: paperId ?? null, topics };
  }

  /** GET /analytics/student/:studentId/history
   *
   *  See MERGE_INSTRUCTIONS.md — for now this returns the full history for
   *  any teacher / admin caller.  A tighter "teacher-of-class" check is
   *  documented as future work; the controller still gates by role
   *  (teacher / head_teacher / admin) so students can't read each other.
   */
  async studentHistory(studentId: string): Promise<StudentHistoryDto> {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!student) throw new NotFoundException('student not found');

    const submissions = await this.prisma.studentSubmission.findMany({
      where: { studentId },
      orderBy: { startedAt: 'desc' },
      include: {
        assignment: {
          include: {
            paper: { select: { id: true, name: true } },
            class: { select: { id: true, name: true } },
          },
        },
      },
    });

    return {
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      submissions: submissions.map(s => ({
        submissionId: s.id,
        assignmentId: s.assignmentId,
        paperId: s.assignment.paper.id,
        paperName: s.assignment.paper.name,
        className: s.assignment.class.name,
        classId: s.assignment.class.id,
        status: s.status,
        submittedAt: s.submittedAt,
        autoScore: s.autoScore,
        manualScore: s.manualScore,
        totalScore: s.totalScore,
        maxScore: s.maxScore,
      })),
    };
  }
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Best-effort stem-snippet extractor.  Question.content is JSON of unknown
 *  shape (we don't enforce it at the ORM layer), so try the obvious fields
 *  and fall back to JSON.stringify-truncate. */
function extractStemSnippet(content: unknown): string {
  const max = 120;
  if (!content) return '';
  if (typeof content === 'string') return truncate(content, max);
  if (typeof content === 'object') {
    const c = content as any;
    if (typeof c.stem === 'string') return truncate(c.stem, max);
    if (typeof c.text === 'string') return truncate(c.text, max);
    if (typeof c.body === 'string') return truncate(c.body, max);
    try {
      return truncate(JSON.stringify(c), max);
    } catch {
      return '';
    }
  }
  return '';
}

function truncate(s: string, n: number): string {
  const trimmed = s.replace(/\s+/g, ' ').trim();
  return trimmed.length > n ? trimmed.slice(0, n - 1) + '…' : trimmed;
}
