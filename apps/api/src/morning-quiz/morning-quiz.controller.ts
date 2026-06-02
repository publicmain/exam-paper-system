import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response, Express } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { AllowHandoff, Public } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import { PrismaService } from '../common/prisma.service';
import { StudentService } from '../student/student.service';
import { AbsenceAlertService } from './absence-alert.service';
import { MorningQuizExportService } from './morning-quiz-export.service';
import { MorningQuizWeeklyCron } from './morning-quiz-weekly-cron';
import { MorningQuizService } from './morning-quiz.service';
import { ShortAnswerEvaluatorService } from './short-answer-evaluator.service';

const CreateSessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  classId: z.string(),
  paperId: z.string(),
  // R10 multi-level: a class can run multiple difficulty bands per day.
  // When the schema dropped this field, callers passing
  // `level: 'olevel'` silently fell back to the service default
  // (ielts_authentic), producing mislabeled one-off sessions. The
  // batch path (BatchGenerateSchema) already iterates over
  // ClassEnglishLevel rows itself, so it doesn't need this in its DTO.
  level: z.enum(['ielts_authentic', 'ielts_simplified', 'olevel']).optional(),
});

const BatchScheduleSchema = z.object({
  items: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        classId: z.string(),
        paperId: z.string(),
      }),
    )
    .min(1)
    .max(100),
});

const BatchGenerateSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // classIds optional: if omitted or empty, defaults to all classes with at
  // least one ClassEnglishLevel registered. Cap at 20 to keep the request
  // bounded; school-wide regen of >20 classes should batch in two calls.
  classIds: z.array(z.string()).max(20).optional(),
  questionsPerPaper: z.number().int().min(8).max(30).optional(),
  // If true, BEFORE generating, wipe any existing MorningQuizSession (and
  // cascade-wipe Paper + PaperAssignment + PaperQuestion + StudentSubmission +
  // AnswerScript) that already lives in the (weekStart..weekStart+5d) window.
  // Used when a fresh bank has been ingested and you want to regenerate
  // the week against the new content rather than waiting for LRU rotation
  // to organically work through the new picks. Destructive — also drops
  // any student submissions in that
  // window, so coordinate before invoking on a live week.
  force: z.boolean().optional(),
});

const SaveAnswerSchema = z.object({
  paperQuestionId: z.string(),
  selectedOption: z.string().max(2).nullable().optional(),
  textAnswer: z.string().max(20000).nullable().optional(),
});

const SetLevelSchema = z.object({
  level: z.enum(['ielts_authentic', 'ielts_simplified', 'olevel']),
});

const TEACHER_ROLES = new Set(['teacher', 'head_teacher', 'admin']);

/**
 * Parse `MQ_HISTORY_RATE_LIMIT` env (format `N/Ws`, default `10/60s`) into
 * the shape RateLimit() expects. Evaluated at module load — the env can't
 * change at runtime on Railway anyway, and decorators need a literal.
 * Bug 4: history-by-name and history-detail are IP-gated to school WiFi
 * but otherwise public, so a single bored student could scrape every
 * classmate's grades. Throttle per-IP. */
function parseHistoryRateLimit(): { limit: number; windowSec: number } {
  const raw = process.env.MQ_HISTORY_RATE_LIMIT?.trim();
  if (!raw) return { limit: 10, windowSec: 60 };
  const m = /^(\d+)\/(\d+)s?$/.exec(raw);
  if (!m) return { limit: 10, windowSec: 60 };
  const limit = parseInt(m[1], 10);
  const windowSec = parseInt(m[2], 10);
  if (!limit || !windowSec) return { limit: 10, windowSec: 60 };
  return { limit, windowSec };
}
const HISTORY_RATE_LIMIT = parseHistoryRateLimit();

@Controller('morning-quiz')
export class MorningQuizController {
  constructor(
    private readonly svc: MorningQuizService,
    private readonly student: StudentService,
    private readonly exportSvc: MorningQuizExportService,
    private readonly weeklyCron: MorningQuizWeeklyCron,
    private readonly absence: AbsenceAlertService,
    private readonly shortAnswer: ShortAnswerEvaluatorService,
    private readonly prisma: PrismaService,
  ) {}

  /** Admin trigger for the Sunday auto-generate cron — useful so admins
   *  can dry-run before flipping `MORNING_QUIZ_AUTO_GENERATE=true`. */
  @Post('weekly-generate/run-now')
  async weeklyGenerateNow(@CurrentUser() user: any) {
    if (user.role !== 'admin') throw new ForbiddenException({ code: 'admin_required' });
    return this.weeklyCron.runOnce();
  }

  /** Teacher dashboard — current consecutive-absence streaks. Populates
   *  the red badge on the dashboard. */
  @Get('absence-alerts/current')
  async absenceAlertsCurrent(@CurrentUser() user: any) {
    if (!TEACHER_ROLES.has(user.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const streaks = await this.absence.findCurrentStreaks();
    return { streaks };
  }

  /** Teacher dashboard — manually fire the daily absence-alert pass.
   *  Useful when the cron is disabled or the teacher just wants a fresh
   *  pull before lunch. */
  @Post('absence-alerts/run-now')
  async absenceAlertsRunNow(@CurrentUser() user: any) {
    if (!TEACHER_ROLES.has(user.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    return this.absence.runOnce();
  }

  /** AI-suggest scoring for a single short_answer item. Teacher-only.
   *  Body: { stem, studentAnswer, markScheme, maxMarks }. */
  @Post('ai-grade/short-answer')
  async aiGradeShortAnswer(
    @Body() body: unknown,
    @CurrentUser() user: any,
  ) {
    if (!TEACHER_ROLES.has(user.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const schema = z.object({
      stem: z.string().min(1).max(5000),
      studentAnswer: z.string().max(20000),
      markScheme: z.string().min(1).max(5000),
      maxMarks: z.number().int().min(1).max(20),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const out = await this.shortAnswer.evaluate(parsed.data);
    return out ?? { awardedMarks: null, reasoning: 'AI unavailable — manual review required', confident: false };
  }

  /** Excel attendance + score export. Streams a binary .xlsx workbook
   *  with three sheets (attendance / scores / absence summary). Filters:
   *  from / to (YYYY-MM-DD inclusive), optional classId. Restricted to
   *  teacher / head_teacher / admin. Audit-logged. */
  @Get('export/attendance')
  async exportAttendance(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('classId') classId: string | undefined,
    @CurrentUser() user: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!TEACHER_ROLES.has(user.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new BadRequestException({ code: 'invalid_date_range' });
    }
    const buf = await this.exportSvc.generateAttendanceWorkbook(
      { from, to, classId },
      { id: user.id, role: user.role, ip: req.ip ?? null },
    );
    // Sanitise classId before splicing into the Content-Disposition filename:
    // Q-string is attacker-controllable (the user pastes ?classId=…), and
    // CR/LF in the header is response-splitting; double quote breaks the
    // header itself. Strip everything that isn't a safe identifier char.
    // Round-7 agent-2 H-4.
    const safeClassId = classId ? classId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) : '';
    const filename = `morning-quiz-${from}-to-${to}${safeClassId ? '-' + safeClassId : ''}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buf.length.toString());
    res.end(buf);
  }

  // ─────────────────── Teacher / admin endpoints ───────────────────

  @Post('sessions')
  create(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = CreateSessionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.createSession(
      {
        date: new Date(parsed.data.date),
        classId: parsed.data.classId,
        paperId: parsed.data.paperId,
        level: parsed.data.level,
      },
      { id: user.id, role: user.role, ip: req.ip ?? null },
    );
  }

  @Post('batch')
  batch(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = BatchScheduleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.batchSchedule(parsed.data, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  /** AI batch — generates 5 days × N classes worth of fresh papers via the
   *  Quick Paper service, then schedules each. Each (date, class) tuple
   *  failure is recorded but doesn't stop the rest. */
  @Post('batch-generate')
  batchGenerate(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = BatchGenerateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.batchGenerateForWeek(parsed.data, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  /**
   * Bug 2 — preview the destructive impact of force-regenerate-week.
   * Used by the UI to display concrete delete counts in confirm() so
   * the operator can't accidentally wipe today's real student data.
   * Read-only; teacher+ role.
   */
  @Get('batch-generate/impact')
  batchGenerateImpact(
    @Query('weekStart') weekStart: string,
    @Query('classIds') classIdsCsv: string | undefined,
    @CurrentUser() user: any,
  ) {
    if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required');
    if (!weekStart) throw new BadRequestException({ code: 'weekStart_required' });
    const classIds = classIdsCsv ? classIdsCsv.split(',').filter(Boolean) : undefined;
    return this.svc.previewRegenerateImpact({ weekStart, classIds });
  }

  @Get('scheduled')
  scheduled(@Query('weekStart') weekStart: string) {
    if (!weekStart) throw new BadRequestException('weekStart required (YYYY-MM-DD)');
    return this.svc.listScheduled(new Date(weekStart));
  }

  /**
   * Per-class bank-health snapshot used by the schedule UI to flag
   * "this class is about to run out of unique passages". Returns the
   * registered levels for the class with totalBank / usedRecent
   * (lifetime — kept that field name for API back-compat) / remaining
   * counts. Public to authenticated teachers/admins; no student PII.
   */
  @Get('bank-stats')
  async bankStats(@Query('classId') classId: string) {
    if (!classId) throw new BadRequestException({ code: 'classId_required' });
    return { classId, stats: await this.svc.bankStatsForClass(classId) };
  }

  /**
   * DEBUG-ONLY admin endpoint to fast-forward a session into the
   * currently-active state without waiting for the 8:30 cron. Required for
   * end-to-end smoke testing of the scan flow off-hours. Gated behind
   * `MORNING_QUIZ_DEBUG=true` env var — without it, returns 404 to keep
   * the surface area invisible in normal production.
   *
   * Optional `{ atIso }` body — schedule the windows around an arbitrary
   * future time instead of NOW. Used when an admin wants a real cron-driven
   * dry-run ("the session must auto-activate at 14:00, not be jammed active
   * right now"). If `at` is in the future, status flips to `scheduled` and
   * the EVERY_MINUTE cron's activateDueSessions takes over at T-30s; if `at`
   * is now or past, status is forced `active` immediately (same as the
   * no-arg behaviour).
   */
  @Patch('sessions/:id/debug-activate')
  debugActivate(
    @Param('id') id: string,
    @Body() body: { atIso?: string } | undefined,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (process.env.MORNING_QUIZ_DEBUG !== 'true') {
      throw new NotFoundException();
    }
    if (user.role !== 'admin') {
      throw new ForbiddenException({ code: 'admin_required' });
    }
    let at: Date | undefined;
    if (typeof body?.atIso === 'string' && body.atIso.length > 0) {
      const parsed = new Date(body.atIso);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException({ code: 'bad_atIso' });
      }
      at = parsed;
    }
    return this.svc.debugActivateNow(
      id,
      { id: user.id, role: user.role, ip: req.ip ?? null },
      { at },
    );
  }

  /**
   * Inverse of debug-activate — recompute the standard 08:30 windows
   * from session.date and flip status back to `scheduled`. Used to undo
   * a dry-run before the real morning. Same gating as debug-activate
   * (MORNING_QUIZ_DEBUG=true + admin role).
   */
  @Patch('sessions/:id/revert-to-scheduled')
  revertToScheduled(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    if (process.env.MORNING_QUIZ_DEBUG !== 'true') {
      throw new NotFoundException();
    }
    if (user.role !== 'admin') {
      throw new ForbiddenException({ code: 'admin_required' });
    }
    return this.svc.revertSessionToScheduled(id, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  @Patch('sessions/:id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() body: { reason?: string } | undefined,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required');
    return this.svc.cancelSession(
      id,
      { id: user.id, role: user.role, ip: req.ip ?? null },
      body?.reason,
    );
  }

  /**
   * Wipe one student's test-run data on one session — attendance row +
   * student submission + answer scripts. Used to clean up after dry-runs
   * (teacher tested scan flow with student X off-hours; wants the morning's
   * real dashboard to start clean). The Paper / PaperAssignment / session
   * themselves stay intact so the rest of the class is unaffected.
   *
   * Teacher-role or above only. Audit-logged with deleted-row counts.
   */
  @Delete('sessions/:sessionId/student/:studentId/test-data')
  clearStudentTestData(
    @Param('sessionId') sessionId: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required');
    return this.svc.clearStudentTestData(sessionId, studentId, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  @Get('sessions/:id/dashboard')
  dashboard(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required');
    return this.svc.getDashboard(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  /**
   * Admin-only — delete every Paper (cascade: PaperAssignment +
   * MorningQuizSession + Attendance + StudentSubmission + AnswerScript)
   * whose questions came from a retired content bank. Currently scoped
   * to provenanceTag='cambridge_0510'.
   *
   * Used to clean dev-period test data that pollutes student portals
   * (e.g. attendance row dated 5/18 on a cambridge_0510 session from
   * before the May 11 switch to Singapore 1128). Irreversible — students'
   * historical scans for these papers are gone after this runs.
   */
  @Post('admin/cleanup-retired-content')
  cleanupRetired(@CurrentUser() user: any, @Req() req: Request) {
    if (user.role !== 'admin') throw new ForbiddenException({ code: 'admin_required' });
    return this.svc.cleanupRetiredContent({
      id: user.id, role: user.role, ip: req.ip ?? null,
    });
  }

  /**
   * Admin-only — wipe sessions scheduled for non-school days
   * (currently: Mon, Sat, Sun). Used after updating the generator to
   * skip Mondays — historical Mon sessions are still in the DB and
   * pollute student portals with absent rows on a day the school
   * doesn't run morning quiz. Irreversible (cascade deletes attendance,
   * submission, scripts).
   */
  @Post('admin/cleanup-non-school-days')
  cleanupNonSchoolDays(@CurrentUser() user: any, @Req() req: Request) {
    if (user.role !== 'admin') throw new ForbiddenException({ code: 'admin_required' });
    return this.svc.cleanupNonSchoolDaySessions({
      id: user.id, role: user.role, ip: req.ip ?? null,
    });
  }

  /**
   * Re-run auto-grading on every submitted submission in a session.
   * Used to recover scoring when the cron locked submissions before a
   * grader bug was fixed (e.g. the >80-char mark scheme skip bug), or
   * when ANTHROPIC_API_KEY was missing at lock time but is now set.
   * Teacher / head_teacher / admin only. Audit-logged.
   */
  @Post('sessions/:id/regrade')
  regradeSession(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required');
    return this.svc.regradeSession(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  /**
   * Aggregated dashboard for one (classId, date) — merges all 1–N
   * sessions (one per registered EnglishLevel) into a single roster.
   * Used by the schedule page's per-row "考勤 →" link. The per-session
   * dashboard endpoint above stays for direct linking / future drill-in.
   */
  @Get('classes/:classId/date/:date/dashboard')
  classDayDashboard(
    @Param('classId') classId: string,
    @Param('date') date: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required');
    return this.svc.getClassDayDashboard(classId, date, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  // ─────────────────── Student endpoints ───────────────────

  /** Student fetches the day's questions (shuffle applied). */
  @Get('sessions/:id')
  @AllowHandoff()
  getSession(@Param('id') id: string, @CurrentUser() user: any) {
    if (user.role !== 'student') throw new ForbiddenException('student_only');
    return this.svc.getStudentView(id, user.id);
  }

  /** Autosave a single answer. */
  @Patch('sessions/:id/answer')
  @AllowHandoff()
  saveAnswer(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: any) {
    if (user.role !== 'student') throw new ForbiddenException('student_only');
    const parsed = SaveAnswerSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.saveAnswer(id, parsed.data, user.id);
  }

  /** Server-authoritative practice-mode check. Returns correctness for a
   *  single answer ONLY if the student has already submitted (or the quiz
   *  window has closed). Used by the practice-review UI; never accessible
   *  during the live test, so a client-side `?mode=practice` URL trick
   *  can't unlock answers. */
  @Post('sessions/:id/check')
  @AllowHandoff()
  check(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: any) {
    if (user.role !== 'student') throw new ForbiddenException('student_only');
    const parsed = SaveAnswerSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.checkAnswer(id, parsed.data, user.id);
  }

  /** Final submit — delegates to existing student.service so auto-grading +
   *  race-safety logic stays in one place. */
  @Post('sessions/:id/submit')
  @AllowHandoff()
  async submit(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    if (user.role !== 'student') throw new ForbiddenException('student_only');
    const submission = await this.svc.findSubmissionForSession(id, user.id);
    if (!submission) throw new BadRequestException('no_submission_for_session');
    // R15-followup-20 — deferAi: grade MCQ inline (instant), but skip the
    // Claude short-answer call. The 09:00 lockPastSessions cron runs ONE
    // batched AI sweep for the whole cohort, so 30 students submitting at
    // once can't fan out into ~200 concurrent Claude calls.
    return this.student.finalSubmit(
      submission.id,
      { id: user.id, role: user.role, ip: req.ip ?? null },
      { deferAi: true },
    );
  }

  /** F3 — student post-submit result page payload.
   *  Returns score breakdown + per-question student answer + correct
   *  answer + explanation. Server enforces the "submitted-or-window-
   *  closed" gate; pre-submit calls return 403 result_locked_until_submit. */
  @Get('student-result/:sessionId')
  studentResult(@Param('sessionId') sessionId: string, @CurrentUser() user: any) {
    if (user.role !== 'student') throw new ForbiddenException('student_only');
    return this.svc.getStudentResult(sessionId, user.id);
  }

  /**
   * R10 followup — student-self-service: look up ALL past submissions
   * by name. Public route (no JWT — the scan flow's scanToken expires
   * with quizEnd, so a student can't reuse it to check yesterday's
   * score). Rate-limited per IP; the threat model matches the existing
   * scan flow (anyone can pick any name from the roster — names are
   * not a secret within the school).
   *
   * Returns submitted/graded papers only — in-progress and never-
   * scanned-in sessions are filtered out so the page reads as
   * "exams I've actually taken".
   */
  @Public()
  @RateLimit({ limit: HISTORY_RATE_LIMIT.limit, windowSec: HISTORY_RATE_LIMIT.windowSec, scope: 'ip' })
  @Get('history-by-name')
  async historyByName(
    @Query('name') rawName?: string,
    @Query('studentId') studentIdFilter?: string,
  ) {
    const name = (rawName ?? '').trim();
    if (!name) throw new BadRequestException({ code: 'name_required' });
    if (name.length > 50) throw new BadRequestException({ code: 'name_too_long' });
    // Bug 9: filter out soft-deleted/withdrawn students. They should not
    // appear in name lookups; the PII of a withdrawn student must not leak.
    // R15-Bug B (production 2026-05-12): also filter out PHANTOM students —
    // role='student' rows that have ZERO class enrollments. These can leak
    // in via (a) failed transfer where old enrollment was deleted but the
    // new one never created, (b) leftover test fixtures, (c) admin
    // imported a roster CSV but forgot to assign a class. Showing them
    // in the disambig picker confused real students ("which 李永轩 am I?"
    // — they're me but unregistered) and clicking the ghost row threw
    // 500 from downstream history/dashboard queries that assume the
    // student is in a class. The Prisma `some` predicate forces at
    // least one student-role enrollment.
    const allCandidates = await this.prisma.user.findMany({
      where: {
        name: name,
        role: 'student',
        isActive: true,
        // R15-Audit#2: require an active (non-archived) class enrollment.
        // Filters phantom ghosts AND archived-class-only students.
        classEnrollments: {
          some: { role: 'student', class: { archivedAt: null } },
        },
      },
      select: {
        id: true,
        name: true,
        // R15-Audit#3 — same-name same-class candidates render visually
        // identical rows. Include the school-assigned email local-part
        // so the UI can show a disambiguator hint ("s003@…") that
        // students can verify against their own school email.
        email: true,
        classEnrollments: {
          where: { role: 'student', class: { archivedAt: null } },
          select: { class: { select: { id: true, name: true, classCode: true } } },
        },
      },
    });
    if (allCandidates.length === 0) {
      throw new NotFoundException({ code: 'student_not_found', typed: name });
    }
    // Bug 5 — same-name disambiguation. If the lookup matches multiple
    // students AND the caller didn't specify which one (via ?studentId=),
    // return a 200 with `needDisambiguation: true` and the list of
    // candidates so the UI can prompt the student to pick. Once they
    // pick, the page re-fetches with studentId locked in.
    // Bug 3: if studentIdFilter is set but doesn't match any candidate
    // for this name, we MUST NOT silently fall back to the merged set
    // of all same-name students — that would leak everyone's history.
    // Throw 404 instead. (A bogus studentId from a curious user, or a
    // stale bookmark after a student was renamed/withdrawn, are both
    // expected sources.)
    if (studentIdFilter) {
      const matched = allCandidates.filter((c) => c.id === studentIdFilter);
      if (matched.length === 0) {
        throw new NotFoundException({
          code: 'student_not_found',
          message: 'no candidate matches studentId for this name',
        });
      }
    }
    const candidates =
      studentIdFilter
        ? allCandidates.filter((c) => c.id === studentIdFilter)
        : allCandidates;
    if (allCandidates.length > 1 && !studentIdFilter) {
      // R15-Audit#3 — when two same-name candidates also share their
      // class (siblings, transfer-in collision, etc.), the picker rows
      // are visually identical. Surface a short disambiguator derived
      // from the email local-part (the school-assigned identifier
      // students recognize: e.g. "s003"). Fall back to the last 4
      // chars of studentId for non-school emails.
      const localPart = (email: string | null | undefined): string => {
        if (!email) return '';
        const at = email.indexOf('@');
        return at > 0 ? email.slice(0, at) : email;
      };
      return {
        needDisambiguation: true,
        candidates: allCandidates.map((c) => ({
          studentId: c.id,
          name: c.name,
          hint: localPart(c.email) || c.id.slice(-4),
          classes: c.classEnrollments.map((e) => ({
            id: e.class.id, name: e.class.name, classCode: e.class.classCode,
          })),
        })),
      };
    }
    const studentIds = candidates.map((c) => c.id);
    // Submissions (exam history).
    // Includes status='practice' so the student can revisit their practice
    // attempts. Stats/trend/wrong-rate endpoints continue to filter
    // practice OUT — this is the ONE place we want them visible because
    // the student-portal flow is "did the practice, want to see the
    // result again". Without this row, the student gets dumped on a
    // history page that doesn't show what they just did, which is
    // exactly the UX complaint we just fixed.
    const submissions = await this.prisma.studentSubmission.findMany({
      where: {
        studentId: { in: studentIds },
        OR: [
          { status: { in: ['submitted', 'graded', 'returned', 'marked'] } },
          // R15-followup-7: practice rows are "real history" once they've
          // been graded (autoScore set). The submittedAt timestamp is the
          // ideal flag for newly-created practice rows, but the legacy
          // pre-fix data has autoScore set + submittedAt null — accept
          // either signal so old practice attempts don't disappear after
          // the migration. Fresh clones with no answers (autoScore=null)
          // still get filtered.
          { status: 'practice', autoScore: { not: null } },
        ],
      },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true, autoScore: true, manualScore: true, totalScore: true,
        maxScore: true, submittedAt: true, status: true,
        assignment: {
          select: {
            id: true,
            paper: { select: { id: true, name: true } },
            class: { select: { id: true, name: true, classCode: true } },
          },
        },
      },
    });
    const assignmentIds = submissions.map((s) => s.assignment.id);
    const sessionsByAsgmt = await this.prisma.morningQuizSession.findMany({
      where: { paperAssignmentId: { in: assignmentIds }, status: { not: 'cancelled' } },
      select: { id: true, paperAssignmentId: true, date: true, level: true },
    });
    const sessByAssignment = new Map<string, any>();
    for (const s of sessionsByAsgmt) {
      if (!sessByAssignment.has(s.paperAssignmentId)) sessByAssignment.set(s.paperAssignmentId, s);
    }
    // Attendance history — separate from submissions because a student
    // can have an attendance row (scan or absent) without ever submitting,
    // and conversely a "late scan + no answer" still appears on the
    // attendance side. Pull all attendances for these student IDs.
    // Filter to attendances on past-or-today sessions only. A student
    // portal is a record of what HAPPENED, not what's coming up. Future-
    // dated absent rows are inevitable noise: dev "batch-generate the
    // next week" + 「立即激活」 testing populates Attendance rows on
    // session.date=next-Monday even though the actual quiz hasn't
    // happened yet, and dedupe-by-date can't filter them because
    // session.date IS in the future. Cut them off at "today's end".
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);
    const rawAttendances = await this.prisma.attendance.findMany({
      where: {
        studentId: { in: studentIds },
        session: { date: { lte: todayEnd } },
      },
      orderBy: { scanTime: 'desc' },
      select: {
        id: true, status: true, scanTime: true, source: true,
        correctedNote: true,
        session: {
          select: {
            id: true, date: true, level: true,
            class: { select: { id: true, name: true } },
            paperAssignment: { select: { paper: { select: { name: true } } } },
          },
        },
      },
    });
    // Dedupe by date: the cron's lockOne inserts an `absent` row for
    // every enrolled student × every session, so a student in a class
    // with 3 levels who picks one level on a given day still ends up
    // with 2 spurious absent rows (the levels they didn't pick) plus
    // 1 real row. From the student's POV those absent rows are noise
    // ("you missed 强 and 中" — but they were never expected to take
    // both). Collapse to one row per date, keeping the highest-priority
    // status (on_time > late > absent). Each kept row carries the level
    // the student actually picked when there's a real scan; otherwise
    // any of the spurious absent rows (they're equivalent for display).
    const PRIORITY: Record<string, number> = { on_time: 3, late: 2, absent: 1 };
    const byDate = new Map<string, (typeof rawAttendances)[number]>();
    for (const a of rawAttendances) {
      // Date column is @db.Date — JS Date at UTC midnight. Group by
      // YYYY-MM-DD slice for stable bucketing regardless of tz shift.
      const day = new Date(a.session.date).toISOString().slice(0, 10);
      const existing = byDate.get(day);
      if (!existing) {
        byDate.set(day, a);
        continue;
      }
      const newP = PRIORITY[a.status] ?? 0;
      const oldP = PRIORITY[existing.status] ?? 0;
      if (
        newP > oldP ||
        (newP === oldP && (a.scanTime?.getTime() ?? 0) > (existing.scanTime?.getTime() ?? 0))
      ) {
        byDate.set(day, a);
      }
    }
    const attendances = Array.from(byDate.values()).sort((a, b) => {
      const ad = new Date(a.session.date).getTime();
      const bd = new Date(b.session.date).getTime();
      return bd - ad; // newest first
    });
    return {
      student: {
        name,
        matchedCount: candidates.length,
        classes: Array.from(
          new Set(candidates.flatMap((c) => c.classEnrollments.map((e) => e.class.name))),
        ),
      },
      submissions: submissions.map((s) => {
        const sess = sessByAssignment.get(s.assignment.id);
        return {
          submissionId: s.id,
          sessionId: sess?.id ?? null,
          date: sess?.date ?? null,
          level: sess?.level ?? null,
          paperName: s.assignment.paper.name,
          className: s.assignment.class.name,
          autoScore: s.autoScore,
          totalScore: s.totalScore ?? s.autoScore,
          maxScore: s.maxScore,
          submittedAt: s.submittedAt,
          status: s.status,
        };
      }),
      attendances: attendances.map((a) => ({
        id: a.id,
        sessionId: a.session.id,
        date: a.session.date,
        level: a.session.level,
        className: a.session.class.name,
        paperName: a.session.paperAssignment.paper.name,
        status: a.status,
        scanTime: a.scanTime,
        source: a.source,
        correctedNote: a.correctedNote,
      })),
    };
  }

  /**
   * Per-submission per-question detail for a student — public route,
   * rate-limited, name-matched. Lets students re-open their morning-quiz
   * result from /my-history without needing to be logged in (the scan
   * flow's session token expires, so the existing /student/result/:id
   * page is useless for "check last week's answers").
   *
   * Security:
   *   - Name match: the typed name MUST exactly equal the submission's
   *     student.name. Otherwise a curious student could enumerate
   *     submissionIds and read other students' answers.
   *   - Per-IP rate limit caps an enumeration loop.
   *   - No identifying info beyond the submission (no roster, no other
   *     students' data).
   */
  @Public()
  @RateLimit({ limit: HISTORY_RATE_LIMIT.limit, windowSec: HISTORY_RATE_LIMIT.windowSec, scope: 'ip' })
  @Get('history-detail')
  async historyDetail(
    @Query('submissionId') submissionId?: string,
    @Query('name') rawName?: string,
  ) {
    const name = (rawName ?? '').trim();
    if (!submissionId) throw new BadRequestException({ code: 'submission_id_required' });
    if (!name) throw new BadRequestException({ code: 'name_required' });
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      select: {
        studentId: true,
        assignmentId: true,
        student: { select: { name: true } },
      },
    });
    if (!sub) throw new NotFoundException({ code: 'submission_not_found' });
    if (sub.student.name !== name) {
      // Vague message — don't leak whether the submission exists.
      throw new ForbiddenException({ code: 'name_mismatch' });
    }
    // Find the matching MorningQuizSession (1:1 with PaperAssignment in
    // normal flow; pick the first non-cancelled if multiple exist).
    const session = await this.prisma.morningQuizSession.findFirst({
      where: { paperAssignmentId: sub.assignmentId, status: { not: 'cancelled' } },
      select: { id: true },
    });
    if (!session) throw new NotFoundException({ code: 'no_session_for_submission' });
    return this.svc.getStudentResult(session.id, sub.studentId);
  }

  // ─────────────────── F2 — Today's upcoming quiz by name ───────────────────

  /**
   * Wave-2 F2 — public lookup of upcoming morning-quiz sessions for one
   * named student. Rate-limited, same shape as /history-by-name (incl.
   * same-name disambig flow). Used by the student-portal landing page
   * to show "your next quiz is in <class> at 08:30".
   */
  @Public()
  @RateLimit({ limit: HISTORY_RATE_LIMIT.limit, windowSec: HISTORY_RATE_LIMIT.windowSec, scope: 'ip' })
  @Get('upcoming-for-name')
  async upcomingForName(
    @Query('name') rawName?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.svc.upcomingForName(rawName ?? '', studentId);
  }

  // ─────────────────── F10 — AI-grade appeals ───────────────────

  /** Public — student files an appeal against an AI-graded item.
   *  Rate-limited (5/60s). Name+studentId disambig matches
   *  /history-by-name. */
  @Public()
  @RateLimit({ limit: 5, windowSec: 60, scope: 'ip' })
  @Post('appeals')
  async createAppeal(@Body() body: unknown, @Req() req: Request) {
    const schema = z.object({
      submissionId: z.string().min(1),
      paperQuestionId: z.string().optional(),
      message: z.string().min(1).max(4000),
      studentName: z.string().min(1).max(50),
      studentId: z.string().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.createAppeal(parsed.data, req.ip ?? null);
  }

  /** Teacher / head_teacher / admin — paginated appeal queue. */
  @Get('appeals')
  async listAppeals(
    @Query('status') status: string | undefined,
    @Query('classId') classId: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.svc.listAppeals(
      { id: user.id, role: user.role, ip: req.ip ?? null },
      {
        status,
        classId,
        page: page ? parseInt(page, 10) : undefined,
        pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      },
    );
  }

  /** Teacher / head_teacher / admin — accept or reject an appeal. */
  @Post('appeals/:id/resolve')
  async resolveAppeal(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const schema = z.object({
      accept: z.boolean(),
      note: z.string().max(4000).optional(),
      scoreOverride: z.number().nullable().optional(),
      paperQuestionId: z.string().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.resolveAppeal(
      id,
      { id: user.id, role: user.role, ip: req.ip ?? null },
      {
        accept: parsed.data.accept,
        note: parsed.data.note,
        scoreOverride: parsed.data.scoreOverride ?? null,
        paperQuestionId: parsed.data.paperQuestionId,
      },
    );
  }

  // ─────────────────── F13 — Fuzzy student search ───────────────────

  /** Teacher / head_teacher / admin — case-insensitive substring match
   *  on User.name + User.email within one class. ASCII for now; pinyin
   *  via opencc / pinyin-pro is deferred to a follow-up. */
  @Get('classes/:classId/students/search')
  async searchStudents(
    @Param('classId') classId: string,
    @Query('q') q: string | undefined,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.svc.searchStudentsInClass(classId, q ?? '', {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  // ─────────────────── F15 — Question retraction ───────────────────

  /** Teacher / head_teacher / admin — mark a paper question retracted.
   *  If awardAllStudents=true, also rewrite every existing submission's
   *  script for this question to full marks and recompute autoScore. */
  @Post('papers/:paperId/retract-question')
  async retractQuestion(
    @Param('paperId') paperId: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const schema = z.object({
      paperQuestionId: z.string().min(1),
      reason: z.string().min(1).max(1000),
      awardAllStudents: z.boolean(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.retractQuestion(paperId, parsed.data, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  // ─────────────────── F16 — Practice mode ───────────────────

  /** Public — start a fresh practice attempt from an old submission.
   *  Rate-limited; name+studentId scoped. */
  @Public()
  @RateLimit({ limit: HISTORY_RATE_LIMIT.limit, windowSec: HISTORY_RATE_LIMIT.windowSec, scope: 'ip' })
  @Post('practice/:submissionId')
  async startPractice(
    @Param('submissionId') submissionId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const schema = z.object({
      studentName: z.string().min(1).max(50),
      studentId: z.string().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.startPractice(submissionId, parsed.data, req.ip ?? null);
  }

  /** Public — fetch a practice paper for replay. Rate-limited;
   *  name+studentId scoped. Body via Query for GET. */
  @Public()
  @RateLimit({ limit: HISTORY_RATE_LIMIT.limit, windowSec: HISTORY_RATE_LIMIT.windowSec, scope: 'ip' })
  @Get('practice/:practiceSubmissionId')
  async getPractice(
    @Param('practiceSubmissionId') practiceSubmissionId: string,
    @Query('name') name: string | undefined,
    @Query('studentId') studentId: string | undefined,
  ) {
    if (!name) throw new BadRequestException({ code: 'name_required' });
    return this.svc.getPractice(practiceSubmissionId, {
      studentName: name,
      studentId,
    });
  }

  /** Public — submit a practice attempt. Saves answers + auto-grades
   *  but DOES NOT mark the submission as 'submitted' or fire
   *  score_ready. Stats endpoints exclude status='practice'. */
  @Public()
  @RateLimit({ limit: HISTORY_RATE_LIMIT.limit, windowSec: HISTORY_RATE_LIMIT.windowSec, scope: 'ip' })
  @Post('practice/:practiceSubmissionId/submit')
  async submitPractice(
    @Param('practiceSubmissionId') practiceSubmissionId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const schema = z.object({
      studentName: z.string().min(1).max(50),
      studentId: z.string().optional(),
      answers: z
        .array(
          z.object({
            paperQuestionId: z.string().min(1),
            selectedOption: z.string().max(2).nullable().optional(),
            textAnswer: z.string().max(20000).nullable().optional(),
          }),
        )
        .max(200),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.submitPractice(practiceSubmissionId, parsed.data, req.ip ?? null);
  }

  // ─────────────────── F17 — Score trend ───────────────────

  /** Public — N-week trend of avg score per (week, level) for one student.
   *  Rate-limited; reuses /history-by-name disambig. */
  @Public()
  @RateLimit({ limit: HISTORY_RATE_LIMIT.limit, windowSec: HISTORY_RATE_LIMIT.windowSec, scope: 'ip' })
  @Get('history-by-name/trend')
  async historyTrend(
    @Query('name') name: string | undefined,
    @Query('studentId') studentId: string | undefined,
    @Query('weeks') weeks: string | undefined,
  ) {
    const w = weeks ? parseInt(weeks, 10) : undefined;
    return this.svc.historyTrendByName(name ?? '', studentId, w);
  }

  // ─────────────────── F18 — Wrong-rate stats ───────────────────

  /** Teacher / head_teacher / admin — per-question wrong rate for one
   *  paper. Excludes practice submissions. */
  @Get('papers/:paperId/wrong-rate')
  async paperWrongRate(
    @Param('paperId') paperId: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.svc.paperWrongRate(paperId, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  // ─────────────────── Class English level (admin) ───────────────────

  @Patch('classes/:classId/english-level')
  setLevel(
    @Param('classId') classId: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!['admin', 'head_teacher'].includes(user.role)) {
      throw new ForbiddenException({ code: 'admin_required' });
    }
    const parsed = SetLevelSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.setClassEnglishLevel(classId, parsed.data.level, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  /** R10 multi-level — drop a band from a class. Pre-multi-level there
   *  was no remove path because the upsert overwrote the single bound
   *  level. */
  @Delete('classes/:classId/english-level/:level')
  removeLevel(
    @Param('classId') classId: string,
    @Param('level') level: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!['admin', 'head_teacher'].includes(user.role)) {
      throw new ForbiddenException({ code: 'admin_required' });
    }
    const parsed = SetLevelSchema.safeParse({ level });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.removeClassEnglishLevel(classId, parsed.data.level, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }
}
