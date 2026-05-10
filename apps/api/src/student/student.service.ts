import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { redactSnapshotForStudent } from '../morning-quiz/morning-quiz.service';

interface ActorCtx { id: string; role: string; ip?: string | null }

/**
 * Normalize a free-text answer for case/whitespace/punctuation-insensitive
 * comparison. Used by autoGradeScripts to grade IELTS-style short_answer
 * questions where the canonical answer is a 1–3 word string (matching
 * headings "ii", matching paragraphs "D", sentence completion "pendulum
 * clock", diagram labels "escape wheel"). Conservative — doesn't strip
 * articles or do fuzzy matching, so a misspelling is still wrong.
 */
function normalizeShortAnswer(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .trim()
    .toLowerCase()
    // collapse internal whitespace runs to a single space so "pendulum  clock"
    // and "pendulum clock" compare equal
    .replace(/\s+/g, ' ')
    // strip surrounding punctuation people sometimes type (e.g. "D." or "(d)"
    // or "ii)") — only at the boundaries, never inside the answer
    .replace(/^[.,;:!?()[\]{}"'`、，。；：（）「」]+/, '')
    .replace(/[.,;:!?()[\]{}"'`、，。；：（）「」]+$/, '');
}

/**
 * Pure helper extracted from finalSubmit so the morning-quiz cron's
 * lockPastSessions branch can reuse the exact same grading rule. Two
 * supported question types:
 *
 *   1. mcq — grade against snapshotOptions[].correct (per-paper snapshot,
 *      falls back to live question.options if the snapshot is null).
 *      Compares snapshotOption.key === script.selectedOption.
 *
 *   2. short_answer (R10) — grade against question.answerContent.text
 *      using a normalize-then-string-compare rule. Designed for IELTS
 *      reading where every short_answer has a deterministic 1–3 word
 *      key (matching headings, summary completion, diagram labels).
 *      Skipped if answerContent.text is missing or longer than 80 chars
 *      (long free-form answers aren't safe to auto-grade and still go
 *      to the marker queue).
 *
 * Anything that doesn't fit those two paths produces no scriptUpdate
 * entry and the script keeps autoCorrect=null → marker queue.
 */
export function autoGradeScripts(
  scripts: Array<{
    id: string;
    selectedOption: string | null;
    textAnswer: string | null;
    paperQuestion: {
      marks: number;
      snapshotOptions: any;
      question: { questionType: string; options: any; answerContent: any };
    };
  }>,
): {
  autoScore: number;
  scriptUpdates: Array<{ id: string; autoCorrect: boolean; awardedMarks: number }>;
} {
  let autoScore = 0;
  const scriptUpdates: Array<{ id: string; autoCorrect: boolean; awardedMarks: number }> = [];
  for (const script of scripts) {
    const q = script.paperQuestion.question;
    if (q.questionType === 'mcq') {
      const opts = (script.paperQuestion.snapshotOptions ?? q.options ?? []) as Array<{
        key: string;
        correct: boolean;
      }>;
      const correctOpt = Array.isArray(opts) ? opts.find((o) => o.correct) : null;
      const isCorrect = correctOpt?.key === script.selectedOption;
      const awarded = isCorrect ? script.paperQuestion.marks : 0;
      autoScore += awarded;
      scriptUpdates.push({ id: script.id, autoCorrect: isCorrect, awardedMarks: awarded });
      continue;
    }
    if (q.questionType === 'short_answer') {
      // R10: extend auto-grading to IELTS short_answer. The canonical
      // answer lives on Question.answerContent.text — never on snapshot
      // (snapshot redaction strips correct keys for student fetches).
      const ac = q.answerContent as { text?: unknown } | null;
      const expected = typeof ac?.text === 'string' ? ac.text : null;
      // Skip long / free-form answers — those are essay-shaped and the
      // marker should still see them. The IELTS bank we operate on uses
      // 1–3 word answers (≤ 30 chars in practice); 80 is a generous cap.
      if (!expected || expected.length > 80) continue;
      const expectedN = normalizeShortAnswer(expected);
      const actualN = normalizeShortAnswer(script.textAnswer);
      if (!expectedN) continue;
      const isCorrect = expectedN === actualN && actualN !== '';
      const awarded = isCorrect ? script.paperQuestion.marks : 0;
      autoScore += awarded;
      scriptUpdates.push({ id: script.id, autoCorrect: isCorrect, awardedMarks: awarded });
      continue;
    }
    // structured / unknown: leave to marker.
  }
  return { autoScore, scriptUpdates };
}

/**
 * Student-side workflow:
 *   1. Teacher calls POST /api/papers/:paperId/assign with { classId, dueAt? }.
 *      Creates a PaperAssignment.
 *   2. Student GETs /api/student/assignments — list of papers waiting / open / closed.
 *   3. Student POSTs /api/student/submissions { assignmentId } — opens a
 *      StudentSubmission row, status=in_progress.
 *   4. Student PATCHes /api/student/submissions/:id/scripts — autosave answers
 *      while taking the paper. Each PATCH upserts an AnswerScript per question.
 *   5. Student POSTs /api/student/submissions/:id/submit — final submit.
 *      MCQ answers auto-graded immediately; structured items wait for marker.
 *   6. Marker workflow lives in a separate Block 2 epic (spawned task).
 *
 * Security note: student responses never include `markScheme`, `answerContent`,
 * or the `correct` flag on options. PapersController and QuestionsController
 * are teacher-only, so the only path students can reach is via this service —
 * which redacts on the way out (see `redactForStudent`).
 */
@Injectable()
export class StudentService {
  private readonly logger = new Logger('StudentService');
  constructor(private readonly prisma: PrismaService) {}

  /** Teacher creates a PaperAssignment binding a paper to a class. */
  async assignPaperToClass(
    paperId: string,
    body: { classId: string; startAt?: string | null; dueAt?: string | null; durationMin?: number | null },
    actor: ActorCtx,
  ) {
    const paper = await this.prisma.paper.findUnique({ where: { id: paperId } });
    if (!paper) throw new NotFoundException('paper not found');
    const cls = await this.prisma.class.findUnique({ where: { id: body.classId } });
    if (!cls) throw new NotFoundException('class not found');
    return this.prisma.paperAssignment.create({
      data: {
        paperId,
        classId: body.classId,
        assignedById: actor.id,
        startAt: body.startAt ? new Date(body.startAt) : null,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        durationMin: body.durationMin ?? null,
        status: body.startAt && new Date(body.startAt) > new Date() ? 'scheduled' : 'open',
      },
    });
  }

  /** Lists assignments visible to a given student (only classes they're enrolled in). */
  async listAssignmentsForStudent(studentId: string) {
    const assignments = await this.prisma.paperAssignment.findMany({
      where: { class: { enrollments: { some: { userId: studentId, role: 'student' } } } },
      include: {
        paper: { select: { id: true, name: true, subjectId: true, durationMin: true, totalMarksActual: true } },
        class: { select: { id: true, name: true, classCode: true } },
        submissions: { where: { studentId } },
      },
      orderBy: { assignedAt: 'desc' },
    });
    // Each assignment carries either 0 or 1 submission for this student.
    return assignments.map(a => ({
      ...a,
      mySubmission: a.submissions[0] ?? null,
      submissions: undefined,
    }));
  }

  /** Open or resume a submission for the student. Idempotent: already-existing
   *  submission row is returned as-is. */
  async openSubmission(assignmentId: string, student: ActorCtx) {
    const assignment = await this.prisma.paperAssignment.findUnique({
      where: { id: assignmentId },
      include: { class: { include: { enrollments: { where: { userId: student.id } } } } },
    });
    if (!assignment) throw new NotFoundException('assignment not found');
    const enrolled = assignment.class.enrollments.some(e => e.role === 'student');
    if (!enrolled) throw new ForbiddenException('not enrolled in this class');
    if (assignment.dueAt && assignment.dueAt < new Date()) {
      throw new ForbiddenException('assignment is closed');
    }
    const existing = await this.prisma.studentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
    });
    if (existing) return existing;
    const paper = await this.prisma.paper.findUnique({ where: { id: assignment.paperId } });
    return this.prisma.studentSubmission.create({
      data: {
        assignmentId,
        studentId: student.id,
        maxScore: paper?.totalMarksActual ?? 0,
      },
    });
  }

  /** Save / overwrite a single AnswerScript for a (submission, paperQuestion) pair.
   *
   *  Validates that the paperQuestionId actually belongs to the assignment's paper.
   *  Without this check, a student who guesses a valid pq id from a DIFFERENT
   *  paper could write a row bound to that foreign question, polluting their
   *  submission and (worse) leaking the existence / structure of other papers.
   *  Also turns the prior Prisma FK-violation 500 (on a totally bogus id) into
   *  a clean 404. */
  async saveScript(
    submissionId: string,
    body: { paperQuestionId: string; selectedOption?: string | null; textAnswer?: string | null },
    student: ActorCtx,
  ) {
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      include: { assignment: { select: { paperId: true } } },
    });
    if (!sub) throw new NotFoundException('submission not found');
    if (sub.studentId !== student.id) throw new ForbiddenException('not your submission');
    if (sub.status !== 'in_progress') {
      throw new BadRequestException(`submission is ${sub.status}; cannot edit`);
    }
    const pq = await this.prisma.paperQuestion.findFirst({
      where: { id: body.paperQuestionId, paperId: sub.assignment.paperId },
      select: { id: true },
    });
    if (!pq) throw new NotFoundException('paperQuestion does not belong to this submission\'s paper');

    return this.prisma.answerScript.upsert({
      where: { submissionId_paperQuestionId: { submissionId, paperQuestionId: body.paperQuestionId } },
      create: {
        submissionId,
        paperQuestionId: body.paperQuestionId,
        selectedOption: body.selectedOption ?? null,
        textAnswer: body.textAnswer ?? null,
      },
      update: {
        selectedOption: body.selectedOption ?? null,
        textAnswer: body.textAnswer ?? null,
      },
    });
  }

  /** Final submit: locks the submission, auto-grades MCQ, leaves structured
   *  questions for the marker.
   *
   *  Race-safe: uses a conditional `updateMany` with `status='in_progress'` in
   *  the WHERE clause as the row-level lock. If two concurrent requests hit
   *  this endpoint, exactly one's updateMany sees count===1 (winner) and the
   *  other sees count===0 (loser, gets 400). Without this guard, both
   *  requests' read-then-update windows overlap and both write 'submitted'
   *  with slightly different `submittedAt` timestamps (T5-1). */
  async finalSubmit(submissionId: string, student: ActorCtx) {
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: { select: { paper: { select: { totalMarksActual: true } } } },
        // R10: pull question.answerContent so autoGradeScripts can grade
        // short_answer items against the canonical text answer.
        scripts: {
          include: {
            paperQuestion: {
              include: {
                question: { select: { questionType: true, options: true, answerContent: true } },
              },
            },
          },
        },
      },
    });
    if (!sub) throw new NotFoundException('submission not found');
    if (sub.studentId !== student.id) throw new ForbiddenException('not your submission');
    if (sub.status !== 'in_progress') {
      throw new BadRequestException(`submission already ${sub.status}`);
    }

    const { autoScore, scriptUpdates } = autoGradeScripts(sub.scripts);
    // R10-fix: back-fill maxScore on submit too. Older submissions created by
    // attendance.scanQr before the maxScore-from-paper fix landed had
    // maxScore=0, which surfaced as "3 / 1 = 300%" on the result page (the
    // front-end falls back to 1 when max is 0). Authoritative answer is the
    // paper.totalMarksActual at submit time.
    const correctMax = sub.assignment?.paper?.totalMarksActual ?? sub.maxScore;

    // Wrap the conditional flip + per-script writes in a single transaction
    // so a crash mid-loop can't leave the submission in `submitted` status
    // while half the scripts still have null autoCorrect / awardedMarks
    // (round-7 D2 / A3). The conditional updateMany still acts as the
    // row-level lock — losing racers see claim.count===0 and we throw
    // before any script write fires.
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.studentSubmission.updateMany({
        where: { id: submissionId, status: 'in_progress' },
        data: {
          submittedAt: new Date(),
          status: 'submitted',
          autoScore,
          maxScore: correctMax,
        },
      });
      if (claim.count === 0) {
        throw new BadRequestException('submission already submitted');
      }
      for (const u of scriptUpdates) {
        await tx.answerScript.update({
          where: { id: u.id },
          data: { autoCorrect: u.autoCorrect, awardedMarks: u.awardedMarks },
        });
      }
      return tx.studentSubmission.findUnique({ where: { id: submissionId } });
    });
  }

  /** Student fetches their own submission. Returned shape includes the FULL
   *  paper structure (so the take-paper UI doesn't need to call the
   *  teacher-only /api/papers/:id endpoint), but all answer-key data is
   *  redacted out: no `markScheme`, no `answerContent`, no `correct` flag on
   *  options or snapshotOptions. */
  async getOwnSubmission(submissionId: string, student: ActorCtx) {
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          include: {
            class: { select: { id: true, name: true, classCode: true } },
            paper: {
              include: {
                questions: {
                  orderBy: { sortOrder: 'asc' },
                  include: { question: { include: { assets: true } } },
                },
              },
            },
          },
        },
        scripts: { include: { paperQuestion: { include: { question: { include: { assets: true } } } } } },
      },
    });
    if (!sub) throw new NotFoundException('submission not found');
    if (sub.studentId !== student.id) throw new ForbiddenException('not your submission');
    return this.redactForStudent(sub);
  }

  /** Strip every answer-key field off questions / options / snapshotOptions
   *  before sending to a student. Keeps stem, assets, marks, displayIndex,
   *  and option text/keys — i.e. exactly what's needed to render the paper. */
  private redactForStudent(sub: any) {
    const stripOptions = (opts: any) => {
      if (!Array.isArray(opts)) return opts;
      return opts.map((o: any) => ({ key: o?.key, text: o?.text }));
    };
    const stripQuestion = (q: any) => {
      if (!q) return q;
      const { markScheme, answerContent, options, ...rest } = q;
      return { ...rest, options: stripOptions(options) };
    };
    const stripPq = (pq: any) => {
      if (!pq) return pq;
      const { snapshotOptions, snapshotContent, ...rest } = pq;
      // Use the morning-quiz whitelist redactor so any new answer-key field
      // ever added to snapshotContent (correctOption / correctAnswer /
      // exampleAnswer / explanation / solution / …) is dropped by default.
      // The previous omit-list only stripped markScheme + answerContent and
      // leaked round-3 C1 here on the post-submit replay path.
      const safeSnapshot = redactSnapshotForStudent(snapshotContent);
      return {
        ...rest,
        snapshotContent: safeSnapshot,
        snapshotOptions: stripOptions(snapshotOptions),
        question: stripQuestion(rest.question),
      };
    };
    const paper = sub.assignment?.paper;
    const safePaper = paper ? {
      ...paper,
      questions: (paper.questions ?? []).map(stripPq),
    } : paper;
    return {
      ...sub,
      assignment: sub.assignment ? { ...sub.assignment, paper: safePaper } : sub.assignment,
      scripts: (sub.scripts ?? []).map((s: any) => ({ ...s, paperQuestion: stripPq(s.paperQuestion) })),
    };
  }
}
