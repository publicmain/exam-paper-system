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
 * R10 — Claude-graded fallback for short-answer items.
 *
 * Hybrid strategy: try the cheap, deterministic string-normalize match
 * FIRST. Only when the student's answer doesn't match the canonical
 * (likely a paraphrase, an extra article, a typo, or otherwise
 * semantically-equivalent-but-textually-different), call Claude with
 * a strict JSON-output rubric to decide. Caller injects the AI grader
 * so this file stays pure / testable; the morning-quiz pipeline wires
 * up ShortAnswerEvaluatorService.
 *
 * Cost / latency notes:
 *   - 0510 Q1 "Where does the green turtle get its name from?" ought to
 *     accept "fat beneath shell" / "fat beneath the shell" / "the fat
 *     beneath the shell" / "from the fat under its shell". The string
 *     match passes for the first; the rest fall through to Claude.
 *   - Per paper, expect ~3 AI calls × 6 students ≈ ~$0.10 / session,
 *     so a 5-day class run lands well under $1/week. Acceptable.
 */
export interface AiShortAnswerGrader {
  evaluate(input: {
    stem: string;
    studentAnswer: string;
    markScheme: string;
    maxMarks: number;
    /**
     * R10 follow-up — the reading passage the question is grounded on.
     * Optional because non-passage items (vocab, transformation) don't
     * have one. When present, the evaluator includes a truncated version
     * in the AI prompt so the grader can do real semantic matching for
     * tasks like matching_information ("which paragraph mentions X?")
     * and 0510 comprehension paraphrases. Without this context the AI
     * can only do shallow string-overlap checking on the answer key.
     */
    passage?: string;
  }): Promise<{ awardedMarks: number; reasoning: string; confident: boolean } | null>;
}

/**
 * Pure helper extracted from finalSubmit so the morning-quiz cron's
 * lockPastSessions branch can reuse the exact same grading rule. Three
 * supported question types:
 *
 *   1. mcq — grade against snapshotOptions[].correct.
 *
 *   2. short_answer (R10) — try normalize-then-string-compare first;
 *      on miss, optionally fall back to AI semantic match via
 *      `aiGrader`.
 *
 *   3. anything else — leave to the marker queue.
 *
 * `aiGrader` is optional. When omitted, this function behaves exactly
 * as before (string-only); existing tests pass unchanged. When
 * provided, short_answer items that fail the string match get a
 * second pass through Claude.
 */
export async function autoGradeScripts(
  scripts: Array<{
    id: string;
    selectedOption: string | null;
    textAnswer: string | null;
    paperQuestion: {
      marks: number;
      snapshotOptions: any;
      question: {
        questionType: string;
        options: any;
        answerContent: any;
        // content optional; used only to surface the question stem to
        // the AI grader so it can grade in context.
        content?: any;
      };
    };
  }>,
  aiGrader?: AiShortAnswerGrader,
): Promise<{
  autoScore: number;
  scriptUpdates: Array<{ id: string; autoCorrect: boolean; awardedMarks: number; aiReason?: string }>;
}> {
  let autoScore = 0;
  const scriptUpdates: Array<{
    id: string;
    autoCorrect: boolean;
    awardedMarks: number;
    aiReason?: string;
  }> = [];
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
      const ac = q.answerContent as { text?: unknown } | null;
      const expected = typeof ac?.text === 'string' ? ac.text : null;
      if (!expected || expected.length > 80) continue;
      const expectedN = normalizeShortAnswer(expected);
      const actualN = normalizeShortAnswer(script.textAnswer);
      if (!expectedN) continue;
      // Path 1: cheap deterministic string match.
      if (actualN !== '' && expectedN === actualN) {
        autoScore += script.paperQuestion.marks;
        scriptUpdates.push({
          id: script.id,
          autoCorrect: true,
          awardedMarks: script.paperQuestion.marks,
        });
        continue;
      }
      // Path 2: blank answer is unambiguously 0 — skip the AI call.
      if (actualN === '') {
        scriptUpdates.push({ id: script.id, autoCorrect: false, awardedMarks: 0 });
        continue;
      }
      // Path 3: string mismatch + non-empty answer → ask Claude.
      if (aiGrader) {
        const content =
          typeof q.content === 'object' && q.content !== null
            ? (q.content as Record<string, unknown>)
            : null;
        const stem = typeof content?.stem === 'string' ? (content.stem as string) : '';
        // Surface the reading passage to the AI so it can actually do
        // semantic matching for matching_information / paragraph-id
        // tasks (the answer is a single letter referring to a passage
        // paragraph — without the passage the AI is just guessing
        // whether the student wrote that letter).
        const passage = typeof content?.passage === 'string' ? (content.passage as string) : undefined;
        try {
          const verdict = await aiGrader.evaluate({
            stem,
            studentAnswer: script.textAnswer ?? '',
            markScheme: expected,
            maxMarks: script.paperQuestion.marks,
            passage,
          });
          if (verdict) {
            const awarded = Math.max(0, Math.min(script.paperQuestion.marks, verdict.awardedMarks));
            autoScore += awarded;
            scriptUpdates.push({
              id: script.id,
              autoCorrect: awarded >= script.paperQuestion.marks * 0.5,
              awardedMarks: awarded,
              aiReason: verdict.reasoning,
            });
            continue;
          }
        } catch {
          // AI grader unavailable or threw — fall through to wrong.
        }
      }
      // No AI grader available, or AI declined / errored → string mismatch
      // counts as wrong. Better to under-credit than over-credit for an
      // exam system; the post-submit "appeal" path stays open via teacher
      // manual override.
      scriptUpdates.push({ id: script.id, autoCorrect: false, awardedMarks: 0 });
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
  constructor(
    private readonly prisma: PrismaService,
    // R10 — optional Claude grader for short_answer fallback.
    // Provided when StudentModule imports MorningQuizModule's
    // ShortAnswerEvaluatorService; absent in test contexts that don't
    // wire it up, in which case autoGradeScripts stays string-only.
    private readonly aiGrader?: AiShortAnswerGrader,
  ) {}

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
                question: { select: { questionType: true, options: true, answerContent: true, content: true } },
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

    const { autoScore, scriptUpdates } = await autoGradeScripts(sub.scripts, this.aiGrader);
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
          data: {
            autoCorrect: u.autoCorrect,
            awardedMarks: u.awardedMarks,
            // R10 — when Claude graded the answer (string match missed),
            // surface the rationale on markerComment with a stable
            // [ai-grade] prefix so the result page can show it and an
            // admin can audit the AI's call. Comment is only set when
            // the AI actually weighed in.
            ...(u.aiReason ? { markerComment: `[ai-grade] ${u.aiReason}` } : {}),
          },
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
