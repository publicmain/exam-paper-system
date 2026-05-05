import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateTestCaseDto, SubmitCodeDto, SupportedLanguageT } from './dto';

interface ActorCtx {
  id: string;
  role: string;
  ip?: string | null;
}

const ROLES_TEACHER = new Set(['admin', 'head_teacher', 'teacher']);

/**
 * Mapping from our language slugs to judge0 language ids. These ids are
 * the official judge0 IDE-1.13 ids; if a deployment uses a different
 * fork, override at runtime via JUDGE0_LANG_OVERRIDES env (JSON).
 *
 * If you add a new entry here, also add it to the SupportedLanguage zod
 * enum in dto.ts so the controller will accept it.
 */
const DEFAULT_LANGUAGE_TO_JUDGE0_ID: Record<SupportedLanguageT, number> = {
  python: 71, // Python 3.8
  javascript: 63, // Node 12.14
  java: 62, // Java OpenJDK 13
  cpp: 54, // C++ GCC 9
  c: 50, // C GCC 9
  // No native judge0 id for Cambridge pseudocode; we ship the student's
  // source as Python and trust the teacher to write test cases that
  // work with our pseudocode-to-python conventions. The conversion
  // happens upstream of judge0; here we just label it.
  pseudocode: 71,
};

/**
 * Code grader service. Two halves:
 *
 *   - Test-case management (teacher): list / create / delete cases attached
 *     to a Question. Hidden cases are filtered out for student requests
 *     (controller passes the role through).
 *
 *   - Submission run (student): GIVEN { paperQuestionId, language,
 *     sourceCode }, look up the student's AnswerScript, run each test
 *     case via judge0 (or the local stub), aggregate to
 *     CodeSubmissionResult, and mirror the awardedMarks back onto
 *     AnswerScript so the existing marker / grading pipeline picks it up
 *     without changes.
 *
 * Stub mode:
 *   When process.env.JUDGE0_URL is unset we never make a network call.
 *   The stub passes the FIRST test case if sourceCode is non-empty, fails
 *   the rest, and tags result.meta = { stub: true }. This is deliberately
 *   pessimistic — we want stub-mode results to look like a partially
 *   working program so the rest of the pipeline (marker UI, totals) can
 *   be exercised end-to-end without a real judge0 deployment.
 *
 *   To run a real judge0:
 *     - Self-hosted: docker pull judge0/judge0 (see judge0 docs)
 *     - Hosted: RapidAPI judge0-ce
 *     - Set JUDGE0_URL=https://your-judge0.example.com
 *     - Optionally set JUDGE0_AUTH_TOKEN for X-Auth-Token header
 *     - Optionally set JUDGE0_RAPIDAPI_KEY + JUDGE0_RAPIDAPI_HOST
 */
@Injectable()
export class CodegraderService {
  private readonly logger = new Logger('CodegraderService');

  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // Test case management (teacher)
  // ------------------------------------------------------------------

  /**
   * Add a test case to a question.
   * Validates that adding it would not push sum(marksPerCase) above
   * Question.marks — keeps the codeable portion within the question's
   * advertised mark allocation.
   */
  async addTestCase(questionId: string, body: CreateTestCaseDto, actor: ActorCtx) {
    if (!ROLES_TEACHER.has(actor.role)) {
      throw new ForbiddenException('teacher / head_teacher / admin only');
    }
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException('question not found');

    const existing = await (this.prisma as any).codeQuestionTestCase.findMany({
      where: { questionId },
      select: { marksPerCase: true },
    });
    const currentMarks = existing.reduce((s: number, c: { marksPerCase: number }) => s + c.marksPerCase, 0);
    if (currentMarks + body.marksPerCase > question.marks) {
      throw new BadRequestException(
        `sum(marksPerCase) ${currentMarks + body.marksPerCase} would exceed question.marks ${question.marks}`,
      );
    }

    return (this.prisma as any).codeQuestionTestCase.create({
      data: {
        questionId,
        stdin: body.stdin,
        expectedStdout: body.expectedStdout,
        marksPerCase: body.marksPerCase,
        hidden: body.hidden,
        label: body.label ?? null,
        sortOrder: body.sortOrder,
      },
    });
  }

  /**
   * List test cases for a question. Students get only `hidden=false`
   * rows AND only the public-safe fields — no expectedStdout (that's the
   * answer key, leaking it would defeat the test).
   */
  async listTestCases(questionId: string, actor: ActorCtx) {
    const isTeacher = ROLES_TEACHER.has(actor.role);
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException('question not found');

    const where: { questionId: string; hidden?: boolean } = { questionId };
    if (!isTeacher) where.hidden = false;

    const rows = await (this.prisma as any).codeQuestionTestCase.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    if (isTeacher) return rows;

    // Redact for students: drop expectedStdout. Keep stdin & label so
    // the student can see "given input X, your program should print Y".
    return rows.map((r: { id: string; stdin: string; marksPerCase: number; hidden: boolean; label: string | null; sortOrder: number }) => ({
      id: r.id,
      stdin: r.stdin,
      marksPerCase: r.marksPerCase,
      hidden: r.hidden,
      label: r.label,
      sortOrder: r.sortOrder,
    }));
  }

  /** Delete a test case. Teacher-only. */
  async deleteTestCase(id: string, actor: ActorCtx) {
    if (!ROLES_TEACHER.has(actor.role)) {
      throw new ForbiddenException('teacher / head_teacher / admin only');
    }
    const existing = await (this.prisma as any).codeQuestionTestCase.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('test case not found');
    await (this.prisma as any).codeQuestionTestCase.delete({ where: { id } });
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Submission (student)
  // ------------------------------------------------------------------

  /**
   * Run student's source code against every test case for the question
   * pointed to by paperQuestionId. Persists / upserts CodeSubmissionResult
   * and mirrors awardedMarks onto the AnswerScript.
   *
   * The student must own the submission. We enforce that by joining
   * AnswerScript -> StudentSubmission -> studentId.
   */
  async submit(body: SubmitCodeDto, actor: ActorCtx) {
    if (actor.role !== 'student') {
      throw new ForbiddenException('student-only route');
    }

    const pq = await this.prisma.paperQuestion.findUnique({
      where: { id: body.paperQuestionId },
      include: { question: true },
    });
    if (!pq) throw new NotFoundException('paperQuestion not found');

    // Find the AnswerScript for this student + paperQuestion. We require
    // the script to already exist — student opens the submission first
    // via the regular /student/submissions flow and saves source via
    // saveScript (textAnswer = code). codegrader/submit then judges it.
    const script = await this.prisma.answerScript.findFirst({
      where: {
        paperQuestionId: body.paperQuestionId,
        submission: { studentId: actor.id },
      },
      include: { submission: true },
    });
    if (!script) {
      throw new NotFoundException('no answer script — open the submission and save your code first');
    }

    const cases = await (this.prisma as any).codeQuestionTestCase.findMany({
      where: { questionId: pq.questionId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (cases.length === 0) {
      throw new BadRequestException('no test cases for this question — ask your teacher to add some');
    }

    const runResult = await this.runAgainstCases(body.language, body.sourceCode, cases);

    // Sum marks for passed cases.
    let awarded = 0;
    let passed = 0;
    for (let i = 0; i < cases.length; i++) {
      if (runResult.perCase[i]?.passed) {
        awarded += cases[i].marksPerCase;
        passed += 1;
      }
    }

    const meta: Record<string, unknown> = {
      perCase: runResult.perCase,
    };
    if (runResult.stub) meta.stub = true;
    if (runResult.error) meta.error = runResult.error;
    if (runResult.judge0Tokens) meta.judge0Tokens = runResult.judge0Tokens;

    // Upsert CodeSubmissionResult (one row per AnswerScript).
    const result = await (this.prisma as any).codeSubmissionResult.upsert({
      where: { answerScriptId: script.id },
      create: {
        answerScriptId: script.id,
        language: body.language,
        sourceCode: body.sourceCode,
        stdout: truncate(runResult.lastStdout, 8192),
        stderr: truncate(runResult.lastStderr, 8192),
        runtimeMs: runResult.totalRuntimeMs,
        passedCases: passed,
        totalCases: cases.length,
        awardedMarks: awarded,
        meta,
      },
      update: {
        language: body.language,
        sourceCode: body.sourceCode,
        stdout: truncate(runResult.lastStdout, 8192),
        stderr: truncate(runResult.lastStderr, 8192),
        runtimeMs: runResult.totalRuntimeMs,
        passedCases: passed,
        totalCases: cases.length,
        awardedMarks: awarded,
        meta,
      },
    });

    // Mirror awardedMarks onto the AnswerScript so the existing
    // submission-total / marker queue picks it up unchanged. We also
    // snapshot the source into textAnswer if it isn't already there
    // — keeps the marker UI consistent for non-code questions.
    await this.prisma.answerScript.update({
      where: { id: script.id },
      data: {
        awardedMarks: awarded,
        textAnswer: body.sourceCode,
        // autoCorrect mirrors "all cases passed" — surfaced in the
        // student-take review screen.
        autoCorrect: passed === cases.length,
      },
    });

    return result;
  }

  /**
   * Get a CodeSubmissionResult by AnswerScript id.
   * Students can only read their own; teachers can read anyone's.
   */
  async getResult(scriptId: string, actor: ActorCtx) {
    const script = await this.prisma.answerScript.findUnique({
      where: { id: scriptId },
      include: { submission: true },
    });
    if (!script) throw new NotFoundException('script not found');

    const isTeacher = ROLES_TEACHER.has(actor.role);
    if (!isTeacher && script.submission.studentId !== actor.id) {
      throw new ForbiddenException('not your submission');
    }

    const result = await (this.prisma as any).codeSubmissionResult.findUnique({
      where: { answerScriptId: scriptId },
    });
    if (!result) throw new NotFoundException('no code result for this script');
    return result;
  }

  // ------------------------------------------------------------------
  // Runner (judge0 or stub)
  // ------------------------------------------------------------------

  private async runAgainstCases(
    language: SupportedLanguageT,
    sourceCode: string,
    cases: Array<{ stdin: string; expectedStdout: string }>,
  ): Promise<RunResult> {
    const judge0Url = process.env.JUDGE0_URL;
    if (!judge0Url) {
      return this.runStub(sourceCode, cases);
    }
    try {
      return await this.runJudge0(judge0Url, language, sourceCode, cases);
    } catch (err) {
      this.logger.error(`judge0 run failed: ${(err as Error).message}`);
      // Fall back to stub but tag the error so the dashboard shows a
      // "judge0 unreachable" banner instead of silently passing.
      const stubResult = this.runStub(sourceCode, cases);
      stubResult.error = `judge0 fallback: ${(err as Error).message}`;
      return stubResult;
    }
  }

  /**
   * Stub runner. Mimics the shape of the real judge0 path:
   *   - Pass case 0 if sourceCode has any non-whitespace.
   *   - All others fail.
   *   - Mark stub: true so the UI can show a "judge0 not configured" badge.
   *
   * This is intentionally not "pass everything" so any test that asserts
   * passed === totalCases will catch a misconfigured prod judge0 url.
   */
  private runStub(
    sourceCode: string,
    cases: Array<{ stdin: string; expectedStdout: string }>,
  ): RunResult {
    const trimmed = sourceCode.trim();
    const perCase = cases.map((c, i) => ({
      caseIndex: i,
      passed: i === 0 && trimmed.length > 0,
      runtimeMs: 1,
      stdout: i === 0 && trimmed.length > 0 ? c.expectedStdout : '',
      stderr: '',
    }));
    return {
      perCase,
      totalRuntimeMs: cases.length,
      lastStdout: perCase[perCase.length - 1]?.stdout ?? '',
      lastStderr: '',
      stub: true,
    };
  }

  /**
   * Real judge0 runner. Uses the synchronous /submissions?wait=true
   * endpoint per case — simpler than the async token-poll loop and the
   * test cases here are short enough that the wait is bounded. If
   * judge0 deployment doesn't allow wait=true, set
   * JUDGE0_USE_BATCH=true and we fall through to the batch endpoint
   * (TODO — not implemented yet, throws clearly).
   *
   * Auth headers we set:
   *   - X-Auth-Token (self-hosted judge0)
   *   - X-RapidAPI-Key + X-RapidAPI-Host (judge0 on RapidAPI)
   */
  private async runJudge0(
    baseUrl: string,
    language: SupportedLanguageT,
    sourceCode: string,
    cases: Array<{ stdin: string; expectedStdout: string }>,
  ): Promise<RunResult> {
    if (process.env.JUDGE0_USE_BATCH === 'true') {
      throw new Error('JUDGE0_USE_BATCH not implemented — use synchronous wait=true mode');
    }

    const langOverrides = parseLangOverrides(process.env.JUDGE0_LANG_OVERRIDES);
    const langId = langOverrides[language] ?? DEFAULT_LANGUAGE_TO_JUDGE0_ID[language];
    if (!langId) throw new Error(`no judge0 language id for ${language}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.JUDGE0_AUTH_TOKEN) headers['X-Auth-Token'] = process.env.JUDGE0_AUTH_TOKEN;
    if (process.env.JUDGE0_RAPIDAPI_KEY) {
      headers['X-RapidAPI-Key'] = process.env.JUDGE0_RAPIDAPI_KEY;
      headers['X-RapidAPI-Host'] = process.env.JUDGE0_RAPIDAPI_HOST ?? new URL(baseUrl).host;
    }

    const perCase: PerCaseResult[] = [];
    const tokens: string[] = [];
    let totalRuntimeMs = 0;
    let lastStdout = '';
    let lastStderr = '';

    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      const body = {
        source_code: sourceCode,
        language_id: langId,
        stdin: c.stdin,
        expected_output: c.expectedStdout,
      };

      // wait=true makes judge0 block until the run finishes; result is
      // returned in the same response. base64=false to avoid encode/decode.
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/submissions?base64_encoded=false&wait=true`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`judge0 ${res.status}: ${text.slice(0, 500)}`);
      }
      const json: Judge0Response = await res.json();
      if (json.token) tokens.push(json.token);

      const stdout = json.stdout ?? '';
      const stderr = json.stderr ?? json.compile_output ?? '';
      const runtimeMs = Math.round((parseFloat(json.time ?? '0') || 0) * 1000);
      // judge0 status.id 3 = Accepted. Anything else is a fail. We *also*
      // double-check with our own normalised string compare to defend
      // against trailing-newline weirdness in some judge0 builds.
      const accepted = json.status?.id === 3 || normalise(stdout) === normalise(c.expectedStdout);

      perCase.push({
        caseIndex: i,
        passed: accepted,
        runtimeMs,
        stdout,
        stderr,
      });
      totalRuntimeMs += runtimeMs;
      lastStdout = stdout;
      lastStderr = stderr;
    }

    return {
      perCase,
      totalRuntimeMs,
      lastStdout,
      lastStderr,
      stub: false,
      judge0Tokens: tokens,
    };
  }
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

interface PerCaseResult {
  caseIndex: number;
  passed: boolean;
  runtimeMs: number;
  stdout: string;
  stderr: string;
}

interface RunResult {
  perCase: PerCaseResult[];
  totalRuntimeMs: number;
  lastStdout: string;
  lastStderr: string;
  stub: boolean;
  error?: string;
  judge0Tokens?: string[];
}

interface Judge0Response {
  token?: string;
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  status?: { id: number; description: string };
  time?: string | null;
}

function normalise(s: string | null | undefined): string {
  return (s ?? '').replace(/\r\n/g, '\n').replace(/\s+$/g, '');
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) + '\n…(truncated)' : s;
}

function parseLangOverrides(raw: string | undefined): Partial<Record<SupportedLanguageT, number>> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
