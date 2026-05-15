import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { redactSnapshotForStudent } from '../morning-quiz/morning-quiz.service';
import { WechatNotifyService } from '../wechat-notify/wechat-notify.service';

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
    // R15-followup-11 — hyphens and en-dashes mean "join two words" in
    // IELTS mark schemes. Students commonly write the hyphen as a plain
    // space ("self confidence" for the schemed "self-confidence") or
    // omit it entirely ("selfconfidence"). All three should match.
    // Normalising to a single space + collapsing the whitespace run a
    // step later catches both written-with-space and written-with-hyphen
    // cases. The "omit hyphen" case still falls through to AI grading.
    .replace(/[-–—]/g, ' ')
    // R15-followup-11 — straight + curly apostrophes are noise in
    // short-answer space ("narrator's" vs "narrators" vs "narrator").
    // Stripping them in both expected + actual brings the cheap path
    // a higher hit rate without false positives — the AI grader still
    // owns the "is meaning preserved" judgement.
    .replace(/[''`'']/g, '')
    // collapse internal whitespace runs to a single space so "pendulum  clock"
    // and "pendulum clock" compare equal
    .replace(/\s+/g, ' ')
    // strip surrounding punctuation people sometimes type (e.g. "D." or "(d)"
    // or "ii)") — only at the boundaries, never inside the answer
    .replace(/^[.,;:!?()[\]{}"`、，。；：（）「」]+/, '')
    .replace(/[.,;:!?()[\]{}"`、，。；：（）「」]+$/, '');
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
      // R15-followup-10 — snapshotContent surfaces `acceptedKeys: string[]`
      // for "either-order" MCQ pairs (e.g. IELTS Q18 & Q19 in either order
      // accept B or C). Optional and backwards-compatible — when absent or
      // empty, grading falls back to the single `options[].correct` flag.
      snapshotContent?: any;
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
  scriptUpdates: Array<{
    id: string;
    // null = AI failed / no verdict → leave to marker queue (R15-followup-11)
    autoCorrect: boolean | null;
    awardedMarks: number | null;
    aiReason?: string;
  }>;
}> {
  let autoScore = 0;
  const scriptUpdates: Array<{
    id: string;
    autoCorrect: boolean | null;
    awardedMarks: number | null;
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
      // R15-followup-10 — "either order" MCQ pairs. IELTS Reading
      // commonly tags two adjacent questions with mark schemes like
      //   Q18 & Q19 in either order; accepts B or C
      // i.e. either student answer is valid for either question, so
      // long as both letters appear across the pair. The naive
      // `correctOpt.key === selectedOption` check rejects the swap
      // (Q18=C, Q19=B) and gives a real student a 0 on Q19 even though
      // they got the underlying comprehension right.
      //
      // Authoritative source: snapshotContent.acceptedKeys: string[]
      // (or the more verbose alias `acceptableOptionKeys`). When the
      // ingest pipeline writes either field with multiple keys, the
      // grader accepts any of them. Falls back to the single
      // `correctOpt` when those fields are absent (backwards-compatible
      // with every other question type / older imports).
      const sc =
        typeof (script.paperQuestion as any).snapshotContent === 'object'
          ? ((script.paperQuestion as any).snapshotContent as Record<string, unknown>)
          : null;
      const accepted = (() => {
        if (!sc) return null;
        for (const field of ['acceptedKeys', 'acceptableOptionKeys', 'acceptOptions']) {
          const v = sc[field];
          if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
            return v as string[];
          }
        }
        return null;
      })();
      // R15-followup-14 — MCQ grader fallback chain.
      //
      // Previous behaviour: only honoured `correctOpt = opts.find(correct: true)`.
      // Cambridge IELTS classification + matching_information ingests store
      // the canonical answer key in `snapshotContent.correctOption` /
      // `snapshotContent.correctAnswer` instead of marking one option as
      // `correct: true` (the options are a SHARED bank across multiple
      // questions, so the per-row "correct" flag would be ambiguous).
      // Without this fallback the grader saw `correctOpt === undefined` for
      // every such question and marked every student's pick wrong — even
      // when they picked the right letter. On 2026-05-14 morning quiz the
      // IELTS section's classification block (Q23-Q26) graded an entire
      // class to 0 despite the history-detail UI showing "✓ 正确" because
      // historyDetail already had the same fallback chain. This aligns
      // grader logic with historyDetail (morning-quiz.service.ts:2430).
      let canonicalCorrectKey: string | null = correctOpt?.key ?? null;
      if (!canonicalCorrectKey && sc) {
        for (const field of ['correctOption', 'correctAnswer']) {
          const v = sc[field];
          if (typeof v === 'string' && v.length > 0 && v.length <= 8) {
            canonicalCorrectKey = v;
            break;
          }
        }
      }
      // Final defensive fallback — Question.answerContent.text (1-letter
      // short answers like "ii" / "B" that some legacy ingests use).
      if (!canonicalCorrectKey) {
        const ac = (q as any).answerContent as { text?: unknown } | null;
        if (typeof ac?.text === 'string' && ac.text.length <= 8) {
          canonicalCorrectKey = ac.text;
        }
      }
      const selected = script.selectedOption;
      const isCorrect = accepted && accepted.length > 0
        ? accepted.includes(selected ?? '')
        : canonicalCorrectKey != null && canonicalCorrectKey === selected;
      const awarded = isCorrect ? script.paperQuestion.marks : 0;
      autoScore += awarded;
      scriptUpdates.push({ id: script.id, autoCorrect: isCorrect, awardedMarks: awarded });
      continue;
    }
    if (q.questionType === 'short_answer') {
      const ac = q.answerContent as { text?: unknown } | null;
      const expected = typeof ac?.text === 'string' ? ac.text : null;
      if (!expected) continue;
      const expectedN = normalizeShortAnswer(expected);
      const actualN = normalizeShortAnswer(script.textAnswer);
      if (!expectedN) continue;
      // Path 1: cheap deterministic string match — only meaningful for
      // SHORT canonical answers (IELTS 1-3 words: "ii", "pendulum clock",
      // a single letter). For longer mark schemes (OLEVEL §B prose
      // answers, 100+ chars) string match will essentially never hit,
      // and trying anyway is just wasted compute. Gate this path on
      // expected.length <= 80.
      //
      // Bug history: the gate used to be `if (expected.length > 80) continue`
      // which SKIPPED THE ENTIRE FUNCTION for long mark schemes — neither
      // the blank→0 path nor the AI path ran. Result: every student answer
      // on every long-mark-scheme question stayed un-graded (Marks UI
      // showed empty, awardedMarks=null). Fixed by gating only Path 1 on
      // length and letting Paths 2+3 run regardless of mark scheme length.
      if (expected.length <= 80 && actualN !== '' && expectedN === actualN) {
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
      // Path 3: string mismatch (or long mark scheme) + non-empty answer
      // → ask Claude. Long mark schemes are exactly where AI shines, so
      // routing them here is the whole point of the AI fallback.
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
        // R15-followup-11 — separate "AI says wrong" from "AI failed to
        // answer". The previous catch-all `try/catch → push 0` masked
        // upstream failures (Anthropic 429s during the 08:00 quiz peak,
        // network blips, JSON parse errors) as "student answered wrong".
        // Outcome: an entire class's short-answer items could silently
        // grade 0 if the Claude API hiccuped, and the only signal was
        // students complaining. Now we tag AI failures with aiReason and
        // leave the script with autoCorrect=null + no auto-zero, so the
        // marker queue picks them up for human review and admins can
        // run a re-grade once the upstream issue clears.
        let verdict: { awardedMarks: number; reasoning?: string } | null | undefined = undefined;
        let aiError: string | null = null;
        try {
          verdict = await aiGrader.evaluate({
            stem,
            studentAnswer: script.textAnswer ?? '',
            markScheme: expected,
            maxMarks: script.paperQuestion.marks,
            passage,
          });
        } catch (e: any) {
          aiError = String(e?.message ?? e ?? 'unknown').slice(0, 240);
        }
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
        if (aiError) {
          // Leave script ungraded — autoCorrect stays null in DB, marker
          // queue surfaces it for human review, and the regrade endpoint
          // can retry once the upstream blip clears. Awarding 0 silently
          // here is what landed an entire morning quiz at 0% during a
          // Claude 429.
          scriptUpdates.push({
            id: script.id,
            autoCorrect: null as any,
            awardedMarks: null as any,
            aiReason: `[AI-ERROR] ${aiError}`,
          });
          continue;
        }
        // verdict === null (AI returned no decision) — treat as needs-human-review.
        scriptUpdates.push({
          id: script.id,
          autoCorrect: null as any,
          awardedMarks: null as any,
          aiReason: '[AI-NO-VERDICT] AI grader returned no decision',
        });
        continue;
      }
      // No AI grader available → string mismatch counts as wrong. This
      // path is hit only when MorningQuizModule didn't wire the grader
      // (e.g. test fixtures); production always has it.
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
    // F3 — optional WeChat notifier. When wired (via StudentModule
    // factory), finalSubmit fires `score_ready` after the autoScore tx
    // commits. Left optional so existing test fixtures that build a
    // StudentService directly (without a notifier) keep working, and
    // because the same module factory is also imported by other teams
    // in parallel — they'll add the 3rd inject arg as part of their
    // wiring. Until then, score_ready still fires from
    // morning-quiz.cron.lockOne (which DOES inject the notifier).
    @Optional() private readonly notify?: WechatNotifyService,
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
    // R14 — the (assignmentId, studentId) @@unique was dropped to let
    // practice mode coexist with the real submission. Switch to findFirst
    // filtering out 'practice' rows; non-practice uniqueness is enforced
    // by always-resume-or-create semantics here.
    const existing = await this.prisma.studentSubmission.findFirst({
      where: {
        assignmentId,
        studentId: student.id,
        status: { not: 'practice' },
      },
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
        assignment: {
          select: {
            paperId: true,
            paper: { select: { totalMarksActual: true, name: true } },
          },
        },
        // F3: pull the student's display name so the score_ready payload
        // can deep-link `/my-history?name=<encodeURIComponent(name)>` and
        // render a useful WeChat card body.
        student: { select: { name: true } },
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

    // R10 follow-up — backfill blank AnswerScripts before grading. When a
    // student doesn't interact with a paperQuestion at all, no AnswerScript
    // row exists, and the result page renders that question as "○ 待批改"
    // (pending teacher review) instead of "✗ 答错 / 0 marks". That defeats
    // the morning-quiz feature's "near-zero teacher load" goal — every
    // unanswered MCQ across the class would hit the manual-review queue.
    //
    // Insert an empty placeholder AnswerScript for any paperQuestion the
    // student left untouched, with selectedOption=null + textAnswer=null.
    // autoGradeScripts grades these as autoCorrect=false / awardedMarks=0
    // via the same paths that handle blank answers (mcq missed key,
    // short_answer empty string).
    const allPaperQuestions = await this.prisma.paperQuestion.findMany({
      where: { paperId: sub.assignment.paperId },
      include: {
        question: { select: { questionType: true, options: true, answerContent: true, content: true } },
      },
    });
    const seen = new Set(sub.scripts.map((s) => s.paperQuestionId));
    const newBlanks = allPaperQuestions.filter((pq) => !seen.has(pq.id));
    if (newBlanks.length > 0) {
      // createMany then re-fetch so we have ids to grade against. Skip
      // duplicates as a belt-and-braces guard against a concurrent autosave
      // racing this insert (the unique (submissionId, paperQuestionId)
      // constraint would otherwise throw).
      await this.prisma.answerScript.createMany({
        data: newBlanks.map((pq) => ({
          submissionId,
          paperQuestionId: pq.id,
          selectedOption: null,
          textAnswer: null,
        })),
        skipDuplicates: true,
      });
      const fresh = await this.prisma.answerScript.findMany({
        where: { submissionId, paperQuestionId: { in: newBlanks.map((pq) => pq.id) } },
        include: {
          paperQuestion: {
            include: {
              question: { select: { questionType: true, options: true, answerContent: true, content: true } },
            },
          },
        },
      });
      sub.scripts.push(...(fresh as typeof sub.scripts));
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
    const result = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.studentSubmission.updateMany({
        where: { id: submissionId, status: 'in_progress' },
        data: {
          submittedAt: new Date(),
          status: 'submitted',
          autoScore,
          // R15-Audit#3 — totalScore was left NULL after autoGrade so
          // the marker view (which reads totalScore directly) showed
          // empty. Student-facing portal fell back to autoScore so
          // students saw the right number, but marker + parent dashboards
          // were degraded. Mirror finalSubmit's convention:
          // totalScore = autoScore + (manualScore ?? 0). manualScore
          // is null at first submit so it just equals autoScore.
          totalScore: autoScore,
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

    // F3 — fire `score_ready` AFTER the tx commits (so a notification
    // never lands while the row is still mid-flight). Dedup: if the cron
    // already auto-submitted this submission earlier today and emitted
    // score_ready, don't fire a second copy when a teacher manually
    // regrades. Lookup is per-submissionId on the JSON payload.
    if (this.notify) {
      try {
        const studentName = sub.student?.name ?? '';
        const paperName = sub.assignment?.paper?.name ?? '';
        const prismaAny = this.prisma as any;
        const already = await prismaAny.notificationLog.findFirst({
          where: {
            event: 'score_ready',
            payload: { path: ['submissionId'], equals: submissionId },
          },
          select: { id: true },
        });
        if (!already) {
          await this.notify.fire('score_ready', {
            submissionId,
            studentId: student.id,
            studentName,
            paperName,
            autoScore: result?.autoScore ?? null,
            maxScore: correctMax,
            submittedAt: (result?.submittedAt ?? new Date()).toISOString(),
            resultUrl: `/my-history?name=${encodeURIComponent(studentName)}`,
          });
        }
      } catch (e: any) {
        this.logger.warn(`score_ready notify failed: ${e?.message ?? e}`);
      }
    }

    return result;
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
