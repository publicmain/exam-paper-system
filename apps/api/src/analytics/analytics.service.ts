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

  /**
   * GET /analytics/class/:classId/overview —— 旧导航「班级统计」。
   *
   * 口径（2026-09-11 审计 T02 重写；与新教师总览 vocab-v2 teacherClassProgress 对齐）：
   *
   * 「格子」= (学生, 布置) 这一对需要计入统计的组合。只统计**在读**的学生
   * （isActive 且未归档）。
   *
   * 早测（有 MorningQuizSession 的布置）—— 每个学生每天**只欠一份**：
   *   · 那天他在任一档交过 / 开过正式答卷（非 practice）→ 就是那一份（按当时
   *     冻结的那一档，之后改难度不改历史）；取消的场次上已有的答卷照样留档计入；
   *   · 那天没开过任何一份 → 欠的是**他所在难度**那一档的那一份，前提是：
   *     场次没取消、日期在入班当天到今天（新加坡日）之间、他选了难度且那天
   *     这一档确实有卷。都不满足就不欠（不是 0 分，也不是缺交）。
   *     （库里没有难度变更历史；没开过卷的日子只能按现在的难度归到哪一份卷，
   *     但每天应交恒为 1，改难度不会让总应交 / 缺交数变多。）
   *
   * 普通布置作业（没有场次，旧产品面）—— 保留「全班都要交」的原口径，只补两条：
   *   · 截止（没有截止就按布置时间）早于入班时间的，不欠；
   *   · 还没到 startAt 的，不欠。
   *   已有正式答卷的一律计入。
   *
   * 每个格子的状态：
   *   已交      —— submitted / marked / returned，且不是系统自动收卷
   *   自动收卷  —— submitSource=system_eod：学生没交，系统替他定住；计入缺交，单列数量
   *   进行中    —— in_progress
   *   缺交      —— 没有正式答卷（practice 不算）
   *
   * 均分：
   *   · 平均自动分 —— 已交卷的自动分（老师内部参考）
   *   · 平均总分（仅已发布）—— 只取 marked / returned；未发布的 submitted 答卷
   *     totalScore 只是自动分，不进这个均分（旧口径 marked=0 时仍显示均分）。
   */
  async classOverview(classId: string, now: Date = new Date()): Promise<ClassOverviewDto> {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        enrollments: {
          where: { role: 'student' },
          select: {
            userId: true,
            joinedAt: true,
            user: { select: { id: true, isActive: true, archivedAt: true, englishLevel: true } },
          },
        },
        assignments: {
          include: {
            paper: { select: { id: true, name: true, totalMarksActual: true } },
            morningQuizSession: { select: { date: true, level: true, status: true } },
            submissions: {
              where: { status: { not: 'practice' } },
              select: {
                id: true,
                studentId: true,
                status: true,
                autoScore: true,
                manualScore: true,
                totalScore: true,
                maxScore: true,
                submitSource: true,
              },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });
    if (!cls) throw new NotFoundException('class not found');

    const today = sgtDayKey(now);
    const students = (cls.enrollments as any[])
      .filter((e) => e.user?.isActive !== false && !e.user?.archivedAt)
      .map((e) => ({
        id: e.userId as string,
        joinedAt: e.joinedAt ? new Date(e.joinedAt) : null,
        joinedDay: e.joinedAt ? sgtDayKey(new Date(e.joinedAt)) : null,
        level: (e.user?.englishLevel ?? null) as string | null,
      }));

    type Sub = {
      studentId: string;
      status: string;
      autoScore: number | null;
      totalScore: number | null;
      submitSource?: string | null;
    };
    const assignments = (cls.assignments as any[]).map((a) => {
      const session = a.morningQuizSession as { date: Date; level: string; status: string } | null;
      // 防御：include 里已经排除了 practice，这里再滤一遍（旧库 / 测试桩可能不按 where 返回）
      const subs: Sub[] = (a.submissions ?? []).filter((s: Sub) => s.status !== 'practice');
      const byStudent = new Map<string, Sub>();
      for (const s of subs) {
        // 同一学生同一布置理论上只有一份正式答卷（partial unique）；万一有多份，已交优先
        const prev = byStudent.get(s.studentId);
        if (!prev || rankSub(s) > rankSub(prev)) byStudent.set(s.studentId, s);
      }
      return {
        raw: a,
        max: a.paper?.totalMarksActual || 0,
        day: session ? new Date(session.date).toISOString().slice(0, 10) : null,
        level: session?.level ?? null,
        cancelled: session?.status === 'cancelled',
        byStudent,
      };
    });

    // 早测按日期分组：学生这一天在哪一份上有正式答卷
    const mqByDay = new Map<string, typeof assignments>();
    for (const a of assignments) {
      if (!a.day) continue;
      const list = mqByDay.get(a.day) ?? [];
      list.push(a);
      mqByDay.set(a.day, list);
    }

    // 算出每个布置上要计入的学生
    const cellsByAssignment = new Map<string, Array<{ studentId: string; sub: Sub | null }>>();
    for (const a of assignments) cellsByAssignment.set(a.raw.id, []);
    const push = (assignmentId: string, studentId: string, sub: Sub | null) =>
      cellsByAssignment.get(assignmentId)!.push({ studentId, sub });

    for (const st of students) {
      // 早测：逐日
      for (const [day, list] of mqByDay) {
        const started = list.filter((a) => a.byStudent.has(st.id));
        if (started.length > 0) {
          for (const a of started) push(a.raw.id, st.id, a.byStudent.get(st.id)!);
          continue;
        }
        if (day > today) continue; // 还没到
        if (st.joinedDay && day < st.joinedDay) continue; // 入班前
        if (!st.level) continue; // 没选难度：无法确定哪一份
        const own = list.find((a) => a.level === st.level && !a.cancelled);
        if (own) push(own.raw.id, st.id, null);
      }
      // 普通布置作业：原口径（全班都要交），补入班时间与开始时间
      for (const a of assignments) {
        if (a.day) continue;
        const sub = a.byStudent.get(st.id) ?? null;
        if (sub) {
          push(a.raw.id, st.id, sub);
          continue;
        }
        const startAt: Date | null = a.raw.startAt ? new Date(a.raw.startAt) : null;
        if (startAt && startAt.getTime() > now.getTime()) continue;
        const deadline: Date | null = a.raw.dueAt ? new Date(a.raw.dueAt) : a.raw.assignedAt ? new Date(a.raw.assignedAt) : null;
        if (st.joinedAt && deadline && deadline.getTime() < st.joinedAt.getTime()) continue;
        push(a.raw.id, st.id, null);
      }
    }

    const totals = {
      expectedSubmissions: 0,
      submitted: 0,
      marked: 0,
      inProgress: 0,
      missing: 0,
      autoCollected: 0,
      awaitingPublish: 0,
    };
    const autoPcts: number[] = [];
    const totalPcts: number[] = [];

    const perPaper = assignments.map((a) => {
      const cells = cellsByAssignment.get(a.raw.id) ?? [];
      let pSubmitted = 0;
      let pMarked = 0;
      let pMissing = 0;
      let pInProgress = 0;
      const pAuto: number[] = [];
      const pTotal: number[] = [];
      for (const { sub } of cells) {
        totals.expectedSubmissions += 1;
        const state = cellState(sub);
        if (state === 'missing' || state === 'auto_collected') {
          pMissing += 1;
          totals.missing += 1;
          if (state === 'auto_collected') totals.autoCollected += 1;
          continue;
        }
        if (state === 'in_progress') {
          pInProgress += 1;
          totals.inProgress += 1;
          continue;
        }
        // 已交
        pSubmitted += 1;
        totals.submitted += 1;
        if (sub!.autoScore != null) {
          pAuto.push(sub!.autoScore);
          if (a.max > 0) autoPcts.push((sub!.autoScore / a.max) * 100);
        }
        if (state === 'published') {
          pMarked += 1;
          totals.marked += 1;
          if (sub!.totalScore != null) {
            pTotal.push(sub!.totalScore);
            if (a.max > 0) totalPcts.push((sub!.totalScore / a.max) * 100);
          }
        } else {
          totals.awaitingPublish += 1;
        }
      }
      return {
        paperId: a.raw.paper.id,
        paperName: a.raw.paper.name,
        assignmentId: a.raw.id,
        date: a.day,
        level: a.level,
        cancelled: a.cancelled,
        studentsExpected: cells.length,
        submitted: pSubmitted,
        marked: pMarked,
        missing: pMissing,
        inProgress: pInProgress,
        meanAutoScore: pAuto.length ? mean(pAuto) : null,
        meanTotalScore: pTotal.length ? mean(pTotal) : null,
        maxScore: a.max,
      };
    });

    return {
      classId: cls.id,
      className: cls.name,
      classCode: cls.classCode,
      studentCount: students.length,
      paperCount: cls.assignments.length,
      totals,
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

/** 新加坡自然日（UTC+8，无夏令时）YYYY-MM-DD。 */
function sgtDayKey(d: Date): string {
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

type CellState = 'missing' | 'auto_collected' | 'in_progress' | 'awaiting_publish' | 'published';

/** 一个格子的状态。见 classOverview 的口径说明。 */
function cellState(
  sub: { status: string; submitSource?: string | null } | null,
): CellState {
  if (!sub) return 'missing';
  if (sub.status === 'in_progress') return 'in_progress';
  if (sub.submitSource === 'system_eod') return 'auto_collected';
  if (sub.status === 'marked' || sub.status === 'returned') return 'published';
  if (sub.status === 'submitted') return 'awaiting_publish';
  return 'missing';
}

/** 同一格子有多份正式答卷时取哪一份（已发布 > 待发布 > 进行中 > 自动收卷）。 */
function rankSub(sub: { status: string; submitSource?: string | null }): number {
  switch (cellState(sub)) {
    case 'published':
      return 4;
    case 'awaiting_publish':
      return 3;
    case 'in_progress':
      return 2;
    case 'auto_collected':
      return 1;
    default:
      return 0;
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
