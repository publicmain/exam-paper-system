import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceStatus,
  EnglishLevel,
  MorningQuizStatus,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { QuickPaperInput, QuickPaperService } from '../ai/quick-paper.service';
import { PrismaService } from '../common/prisma.service';
import { ShuffleService } from '../shuffle/shuffle.service';

interface ActorCtx {
  id: string;
  role: string;
  ip: string | null;
}

export interface CreateSessionInput {
  date: Date; // y-m-d in school timezone — service derives the windows
  classId: string;
  paperId: string;
}

export interface BatchScheduleInput {
  /** Sunday-night-style batch: list of (date, class, paper) tuples to wire. */
  items: Array<{ date: string; classId: string; paperId: string }>;
}

const ATTENDANCE_START_LOCAL = '08:30:00';
const ATTENDANCE_END_LOCAL = '08:32:00';
const LATE_CUTOFF_LOCAL = '08:50:00';
const QUIZ_END_LOCAL = '09:00:00';

/**
 * Combine a y-m-d and a hh:mm:ss string in school local time (assumed
 * Asia/Singapore = UTC+8) into a UTC Date. We avoid pulling a tz library
 * for this single use; the offset is hard-coded but adjustable via the
 * MORNING_QUIZ_TZ_OFFSET_MIN env var if the school ever moves.
 */
function combineLocal(dateOnlyIso: string, timeLocal: string, tzOffsetMin = 8 * 60): Date {
  const [h, m, s] = timeLocal.split(':').map(Number);
  // dateOnlyIso = "2026-05-12"
  const [y, mo, d] = dateOnlyIso.split('-').map(Number);
  // Build UTC ms then subtract the tz offset to land on the "local" wall clock.
  const utcMs = Date.UTC(y, mo - 1, d, h, m, s ?? 0) - tzOffsetMin * 60_000;
  return new Date(utcMs);
}

@Injectable()
export class MorningQuizService {
  private readonly logger = new Logger('MorningQuizService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly shuffle: ShuffleService,
    private readonly quickPaper: QuickPaperService,
  ) {}

  async createSession(input: CreateSessionInput, actor: ActorCtx) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }

    const dateIso = input.date.toISOString().slice(0, 10);
    const tzOff = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    const attendanceStart = combineLocal(dateIso, ATTENDANCE_START_LOCAL, tzOff);
    const attendanceEnd = combineLocal(dateIso, ATTENDANCE_END_LOCAL, tzOff);
    const lateCutoff = combineLocal(dateIso, LATE_CUTOFF_LOCAL, tzOff);
    const quizEnd = combineLocal(dateIso, QUIZ_END_LOCAL, tzOff);

    const cls = await this.prisma.class.findUnique({
      where: { id: input.classId },
      select: { id: true },
    });
    if (!cls) throw new NotFoundException({ code: 'class_not_found' });

    const paper = await this.prisma.paper.findUnique({
      where: { id: input.paperId },
      select: { id: true, totalMarksActual: true },
    });
    if (!paper) throw new NotFoundException({ code: 'paper_not_found' });

    // Bind paper → class via PaperAssignment (1:1). Reuse existing if present;
    // otherwise create. dueAt aligned with quizEnd so existing student.service
    // already-closed gate triggers naturally at 09:00.
    const assignment = await this.prisma.paperAssignment.upsert({
      where: { paperId_classId: { paperId: input.paperId, classId: input.classId } },
      update: { dueAt: quizEnd, startAt: attendanceStart },
      create: {
        paperId: input.paperId,
        classId: input.classId,
        assignedById: actor.id,
        dueAt: quizEnd,
        startAt: attendanceStart,
        durationMin: 30,
        status: 'scheduled',
      },
    });

    // Conflict detection: same (date, class) already has a session?
    const existing = await this.prisma.morningQuizSession.findUnique({
      where: { date_classId: { date: attendanceStart, classId: input.classId } },
    });
    if (existing) {
      throw new ConflictException({
        code: 'session_already_exists',
        sessionId: existing.id,
      });
    }

    const session = await this.prisma.morningQuizSession.create({
      data: {
        date: attendanceStart,
        classId: input.classId,
        paperAssignmentId: assignment.id,
        attendanceStart,
        attendanceEnd,
        lateCutoff,
        quizStart: attendanceStart,
        quizEnd,
        qrSecret: randomBytes(16).toString('hex'),
        status: MorningQuizStatus.scheduled,
        scheduledById: actor.id,
      },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.session.create',
      entityType: 'MorningQuizSession',
      entityId: session.id,
      ip: actor.ip,
      metadata: { date: dateIso, classId: input.classId, paperId: input.paperId },
    });

    return session;
  }

  /**
   * Sunday-night batch. Loops items and creates one session per (date, class,
   * paper). Each item runs in its own try/catch so a single conflict doesn't
   * abort the whole week. Returns a per-item result array the UI can render.
   */
  async batchSchedule(input: BatchScheduleInput, actor: ActorCtx) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const results: Array<
      | { ok: true; index: number; sessionId: string }
      | { ok: false; index: number; code: string; detail?: unknown }
    > = [];

    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      try {
        const session = await this.createSession(
          { date: new Date(item.date), classId: item.classId, paperId: item.paperId },
          actor,
        );
        results.push({ ok: true, index: i, sessionId: session.id });
      } catch (e: any) {
        const detail = typeof e?.response === 'object' ? e.response : e?.message;
        const code = (e?.response?.code as string) ?? 'unknown_error';
        results.push({ ok: false, index: i, code, detail });
      }
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.batch_schedule',
      entityType: 'MorningQuizSession',
      entityId: '(batch)',
      ip: actor.ip,
      metadata: {
        total: input.items.length,
        ok: results.filter((r) => r.ok).length,
        fail: results.filter((r) => !r.ok).length,
      },
    });

    return { results };
  }

  /**
   * AI batch — Sunday-night-style. For each weekday × class, look up the
   * class's English level, call QuickPaperService to author a fresh paper,
   * then create a MorningQuizSession bound to it. Each tuple runs in its
   * own try/catch so a single Anthropic timeout doesn't kill the week.
   */
  async batchGenerateForWeek(
    input: { weekStart: string; classIds: string[]; questionsPerPaper?: number },
    actor: ActorCtx,
  ) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const monday = new Date(input.weekStart);
    if (Number.isNaN(monday.getTime())) {
      throw new BadRequestException({ code: 'bad_week_start' });
    }
    const targetCount = input.questionsPerPaper ?? 18;

    const dates: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday.getTime() + i * 86_400_000);
      dates.push(d.toISOString().slice(0, 10));
    }

    type Outcome =
      | { ok: true; date: string; classId: string; sessionId: string; paperId: string }
      | { ok: false; date: string; classId: string; code: string; detail?: string };
    const outcomes: Outcome[] = [];

    for (const dateIso of dates) {
      for (const classId of input.classIds) {
        try {
          // Idempotent — skip if a session already exists for (date, class).
          const existingSession = await this.prisma.morningQuizSession.findUnique({
            where: { date_classId: { date: new Date(dateIso), classId } },
          });
          if (existingSession) {
            outcomes.push({
              ok: false,
              date: dateIso,
              classId,
              code: 'session_already_exists',
              detail: existingSession.id,
            });
            continue;
          }

          const levelRow = await this.prisma.classEnglishLevel.findUnique({
            where: { classId },
          });
          if (!levelRow) {
            outcomes.push({ ok: false, date: dateIso, classId, code: 'class_level_not_set' });
            continue;
          }

          const qpInput = this.levelToQuickPaperInput(levelRow.level, dateIso, targetCount);
          const generated = await this.quickPaper.generate(qpInput, actor);

          const session = await this.createSession(
            { date: new Date(dateIso), classId, paperId: generated.paperId },
            actor,
          );
          outcomes.push({
            ok: true,
            date: dateIso,
            classId,
            sessionId: session.id,
            paperId: generated.paperId,
          });
        } catch (e: any) {
          const code = (e?.response?.code as string) ?? e?.message ?? 'unknown_error';
          outcomes.push({ ok: false, date: dateIso, classId, code: String(code).slice(0, 100) });
        }
      }
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.batch_generate',
      entityType: 'MorningQuizSession',
      entityId: '(batch)',
      ip: actor.ip,
      metadata: {
        weekStart: input.weekStart,
        classCount: input.classIds.length,
        ok: outcomes.filter((o) => o.ok).length,
        fail: outcomes.filter((o) => !o.ok).length,
      },
    });
    return { outcomes };
  }

  private levelToQuickPaperInput(
    level: EnglishLevel,
    dateIso: string,
    targetCount: number,
  ): QuickPaperInput {
    // Distribute targetCount across the topic mix per level. Keep MVP simple —
    // even split with rounding adjustments. 18 default → ~4 topics × 4-5 each.
    const split = (codes: string[]): Array<{ code: string; count: number }> => {
      const base = Math.floor(targetCount / codes.length);
      const rem = targetCount - base * codes.length;
      return codes.map((c, i) => ({ code: c, count: base + (i < rem ? 1 : 0) }));
    };

    if (level === 'ielts_authentic') {
      return {
        syllabusCode: 'IELTS',
        topics: split(['IR.1', 'IR.2', 'IR.4', 'IR.6']),
        difficulty: 3,
        durationMin: 30,
        includeDiagrams: false,
        paperName: `Morning Quiz IELTS-Auth ${dateIso}`,
        multiPart: false,
      };
    }
    if (level === 'ielts_hard') {
      return {
        syllabusCode: 'IELTS',
        topics: split(['IR.2', 'IR.3', 'IR.4', 'IR.5', 'IR.7']),
        difficulty: 5,
        durationMin: 30,
        includeDiagrams: false,
        paperName: `Morning Quiz IELTS-Hard ${dateIso}`,
        multiPart: false,
      };
    }
    // olevel
    return {
      syllabusCode: '1123',
      topics: split(['EL.1', 'EL.2', 'EL.4', 'EL.5']),
      difficulty: 2,
      durationMin: 30,
      includeDiagrams: false,
      paperName: `Morning Quiz O-Level ${dateIso}`,
      multiPart: false,
    };
  }

  /** Look at a week's worth of scheduled sessions for the calendar UI. */
  async listScheduled(weekStart: Date) {
    const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
    return this.prisma.morningQuizSession.findMany({
      where: { date: { gte: weekStart, lt: weekEnd } },
      include: {
        class: { select: { id: true, name: true } },
        paperAssignment: { include: { paper: { select: { id: true, name: true, totalMarksActual: true } } } },
      },
      orderBy: [{ date: 'asc' }, { class: { name: 'asc' } }],
    });
  }

  /**
   * Cancel — used both by teacher UI and by the holiday admin toggle. Sets
   * status=cancelled so cron skips it; existing attendance rows untouched.
   */
  async cancelSession(sessionId: string, actor: ActorCtx, reason?: string) {
    if (!['teacher', 'head_teacher', 'admin'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const before = await this.prisma.morningQuizSession.findUnique({ where: { id: sessionId } });
    if (!before) throw new NotFoundException({ code: 'session_not_found' });

    const after = await this.prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: { status: MorningQuizStatus.cancelled },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.session.cancel',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
      ip: actor.ip,
      diff: { before: { status: before.status }, after: { status: after.status } },
      metadata: { reason: reason ?? null },
    });
    return after;
  }

  /**
   * Get the paper for the student, with shuffle applied. Caller must have
   * confirmed there's an Attendance row (i.e. they passed scanQr earlier).
   */
  async getStudentView(sessionId: string, studentId: string) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      include: { paperAssignment: { select: { paperId: true, id: true } } },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    if (session.status === MorningQuizStatus.cancelled) {
      throw new BadRequestException({ code: 'session_cancelled' });
    }

    // Confirm the student has an Attendance row (gate: only scanned-in
    // students can fetch the paper; manual_correction also qualifies).
    const att = await this.prisma.attendance.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId } },
    });
    if (!att || att.status === AttendanceStatus.absent) {
      throw new ForbiddenException({ code: 'no_attendance_record' });
    }

    const paperId = session.paperAssignment.paperId;
    const paperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId },
      orderBy: { sortOrder: 'asc' },
      include: {
        question: { select: { id: true, questionType: true } },
      },
    });

    const map = await this.shuffle.getOrCreate(studentId, paperId);
    const ordered = this.shuffle.applyToPaper(paperQuestions, map);

    // Relabel option keys A/B/C/D so the student's choices map cleanly to
    // displayed letters; the original `key` values are preserved separately
    // in the shuffle map for reverse-mapping at save time.
    const delivered = ordered.map((pq) => {
      if (pq.question.questionType !== 'mcq') return pq;
      const opts = (pq.snapshotOptions as Array<{ key: string; text: string }> | null) ?? [];
      const relabeled = opts.map((opt, i) => ({
        ...opt,
        key: String.fromCharCode(65 + i),
      }));
      return { ...pq, snapshotOptions: relabeled };
    });

    return {
      sessionId: session.id,
      attendanceId: att.id,
      submissionId: att.submissionId,
      quizEnd: session.quizEnd,
      paperQuestions: delivered.map((pq) => ({
        id: pq.id,
        sortOrder: pq.sortOrder,
        marks: pq.marks,
        snapshotContent: pq.snapshotContent,
        snapshotOptions: pq.snapshotOptions,
        questionType: pq.question.questionType,
      })),
    };
  }

  /**
   * Save an answer, reverse-mapping any displayed-key for shuffled MCQs back
   * to the original key before delegating to the standard AnswerScript upsert.
   */
  async saveAnswer(
    sessionId: string,
    body: { paperQuestionId: string; selectedOption?: string | null; textAnswer?: string | null },
    studentId: string,
  ) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      include: { paperAssignment: { select: { id: true, paperId: true } } },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    const now = new Date();
    if (now > session.quizEnd) throw new BadRequestException({ code: 'quiz_window_closed' });

    const submission = await this.prisma.studentSubmission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: session.paperAssignmentId,
          studentId,
        },
      },
    });
    if (!submission) throw new NotFoundException({ code: 'no_submission' });
    if (submission.status !== 'in_progress') {
      throw new BadRequestException({ code: 'submission_locked', status: submission.status });
    }

    const pq = await this.prisma.paperQuestion.findFirst({
      where: { id: body.paperQuestionId, paperId: session.paperAssignment.paperId },
      include: { question: { select: { questionType: true } } },
    });
    if (!pq) throw new NotFoundException({ code: 'paper_question_mismatch' });

    let selectedOption = body.selectedOption ?? null;
    if (pq.question.questionType === 'mcq' && selectedOption) {
      const map = await this.shuffle.getOrCreate(studentId, session.paperAssignment.paperId);
      const displayedIdx = selectedOption.charCodeAt(0) - 65;
      const originalIdx = this.shuffle.unmapOptionIndex(map, pq.id, displayedIdx);
      if (originalIdx === null) {
        // No shuffle for this question — store as-is. (Unusual edge case.)
      } else {
        const opts = (pq.snapshotOptions as Array<{ key: string }> | null) ?? [];
        if (originalIdx < opts.length) {
          selectedOption = opts[originalIdx].key;
        }
      }
    }

    return this.prisma.answerScript.upsert({
      where: {
        submissionId_paperQuestionId: {
          submissionId: submission.id,
          paperQuestionId: pq.id,
        },
      },
      create: {
        submissionId: submission.id,
        paperQuestionId: pq.id,
        selectedOption,
        textAnswer: body.textAnswer ?? null,
      },
      update: {
        selectedOption,
        textAnswer: body.textAnswer ?? null,
      },
    });
  }

  async setClassEnglishLevel(classId: string, level: EnglishLevel, actor: ActorCtx) {
    if (!['admin', 'head_teacher'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'admin_required' });
    }
    const upserted = await this.prisma.classEnglishLevel.upsert({
      where: { classId },
      create: { classId, level, effectiveFrom: new Date() },
      update: { level, effectiveFrom: new Date() },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.class_level.set',
      entityType: 'ClassEnglishLevel',
      entityId: upserted.id,
      ip: actor.ip,
      metadata: { classId, level },
    });
    return upserted;
  }

  /**
   * DEBUG ONLY — gated behind MORNING_QUIZ_DEBUG=true. Fast-forwards a
   * session into "currently active" state by overwriting time windows to
   * NOW + standard offsets and flipping status to active. Used for off-hours
   * end-to-end smoke testing of the scan flow. Audit-logged.
   */
  async debugActivateNow(sessionId: string, actor: ActorCtx) {
    const before = await this.prisma.morningQuizSession.findUnique({ where: { id: sessionId } });
    if (!before) throw new NotFoundException({ code: 'session_not_found' });
    const now = new Date();
    const after = await this.prisma.morningQuizSession.update({
      where: { id: sessionId },
      data: {
        attendanceStart: new Date(now.getTime() - 30_000),
        attendanceEnd: new Date(now.getTime() + 2 * 60_000),
        lateCutoff: new Date(now.getTime() + 20 * 60_000),
        quizStart: new Date(now.getTime() - 30_000),
        quizEnd: new Date(now.getTime() + 30 * 60_000),
        status: MorningQuizStatus.active,
      },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.debug_activate',
      entityType: 'MorningQuizSession',
      entityId: sessionId,
      ip: actor.ip,
      diff: {
        before: { status: before.status, attendanceStart: before.attendanceStart },
        after: { status: after.status, attendanceStart: after.attendanceStart },
      },
    });
    return after;
  }

  /** Find the StudentSubmission tied to (session, student) — used by the
   *  controller's submit endpoint to delegate to the canonical
   *  student.service.finalSubmit. */
  async findSubmissionForSession(sessionId: string, studentId: string) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      select: { paperAssignmentId: true },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    return this.prisma.studentSubmission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId: session.paperAssignmentId,
          studentId,
        },
      },
    });
  }

  async getDashboard(sessionId: string) {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      include: {
        class: { select: { id: true, name: true } },
        paperAssignment: { include: { paper: { select: { id: true, name: true, totalMarksActual: true } } } },
        attendances: {
          include: {
            student: { select: { id: true, name: true } },
            submission: { select: { id: true, autoScore: true, totalScore: true, submittedAt: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });

    const counts = { on_time: 0, late: 0, absent: 0 };
    for (const a of session.attendances) counts[a.status]++;

    return {
      session: {
        id: session.id,
        date: session.date,
        status: session.status,
        class: session.class,
        paper: session.paperAssignment.paper,
      },
      counts,
      attendances: session.attendances,
    };
  }
}
