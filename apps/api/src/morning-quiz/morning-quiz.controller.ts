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
  Res,  UseGuards,
} from '@nestjs/common';
import { Request, Response, Express } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { AllowHandoff, Public } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import {
  AllowTeacherView,
  RequireStudentReadToken,
  RequireStudentToken,
  StudentIdentityGuard,
  type RequestWithStudentAuth,
} from '../common/student-identity.guard';
import { authenticatedStudentWhere, studentNotEligible } from '../common/authenticated-student';
import { identityOf } from '../common/student-identity-input';
import { PrismaService } from '../common/prisma.service';
import { StudentService } from '../student/student.service';
import { AbsenceAlertService } from './absence-alert.service';
import { MorningQuizExportService } from './morning-quiz-export.service';
import { MorningQuizWeeklyCron } from './morning-quiz-weekly-cron';
import {
  MorningQuizService,
  answersReleased,
  deterministicallyGraded,
  isMakeupWindowOpen,
  scoresReleased,
} from './morning-quiz.service';
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
  /** P8.5：客户端按题单调递增的序号。服务端据此拒绝乱序到达的旧请求。 */
  clientSeq: z.number().int().nonnegative().optional(),
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

/**
 * S02（2026-09-11 审计）：按姓名解析的旧读 / 练习接口，身份一律取令牌。
 *
 * 守卫（`@RequireStudentReadToken` / `@RequireStudentToken`）已经核对过查询串 /
 * 请求体里的 name、studentId 与令牌一致。但**同名**时「姓名一致」这一条对
 * 冒名者也成立 —— 服务层按姓名找人，找到两个就把两个候选连同班级一起返回。
 * 所以这里把 studentId **强制**设成令牌里的 id：服务层只会解析出令牌本人，
 * 不会列候选、不会按姓名合并出别人的数据。
 *
 * 姓名：调用方给了就用（守卫已确认与令牌一致），没给（新学生端只带 Bearer）
 * 就用令牌里的。无令牌（绕过守卫的直接调用）在调任何服务之前拒绝。
 */
function tokenBoundIdentity(req: Request, rawName?: string): { name: string; studentId: string } {
  const auth = (req as RequestWithStudentAuth).studentAuth;
  if (!auth) throw new ForbiddenException({ code: 'student_token_required' });
  const name = (rawName ?? '').trim() || auth.name;
  return { name, studentId: auth.id };
}

/**
 * 学生身份（2026-08-25 复审 P0）：本 controller 同时服务教师端与学生端。
 * StudentIdentityGuard 只做两件事 —— 带学生 token 时校验它与请求声明的
 * 姓名一致、标了 @RequireStudentToken 的路由必须带 token。教师端方法
 * 不带学生 token，不受影响。
 */
@UseGuards(StudentIdentityGuard)
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
  /**
   * 打开补考窗口 —— 早上无故缺席的学生中午来补（学校 2026-08 新政）。
   *
   * 教师可用（canActOnClass 在 service 里查），不是 debug 端点：
   * 2026-08-13 第一次补考是拿 debug-activate 开的，那个东西会把正式
   * 场次的时间窗整体挪走，早上的考勤记录跟着一起失真。
   */
  @Post('sessions/:id/makeup/open')
  openMakeup(
    @Param('id') id: string,
    @Body() body: { minutes?: number } | undefined,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const minutes = Number(body?.minutes ?? 30);
    if (!Number.isFinite(minutes)) {
      throw new BadRequestException({ code: 'bad_minutes' });
    }
    return this.svc.openMakeupWindow(
      id,
      { id: user.id, role: user.role, ip: req.ip ?? null },
      { minutes },
    );
  }

  /** 手动关闭补考窗口。 */
  @Post('sessions/:id/makeup/close')
  closeMakeup(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    return this.svc.closeMakeupWindow(id, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

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
  @Post('sessions/:id/open')
  @AllowHandoff()
  async openSession(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (user.role !== 'student') throw new ForbiddenException('student_only');
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id },
      select: { paperAssignmentId: true },
    });
    if (!session) throw new NotFoundException({ code: 'session_not_found' });
    return this.student.openSubmission(session.paperAssignmentId, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

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

  /** 交卷 —— 委托给 student.service，自动判分和竞态处理只保留一份实现。
   *
   *  body.final（2026-08-20 第二作答窗）：
   *    true / 省略 —— 最终提交。公布答案，放弃 16:00-17:30 回来改的权利。
   *    false —— 暂存提交。学生下午还能回来改，在此之前看不到答案。
   *  省略时默认 true，保证既有客户端（老版本前端、e2e 脚本）语义不变。 */
  @Post('sessions/:id/submit')
  @AllowHandoff()
  async submit(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request,
    @Body() body?: { final?: boolean },
  ) {
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
      { deferAi: true, final: body?.final !== false },
    );
  }

  /** F3 — student post-submit result page payload.
   *  Returns score breakdown + per-question student answer + correct
   *  answer + explanation. Server enforces the "submitted-or-window-
   *  closed" gate; pre-submit calls return 403 result_locked_until_submit. */
  // S08：getStudentResult() 纯读取（只 findUnique / findFirst / findMany）——
  // 教师只读视角可读。答题页 GET sessions/:id **不在此列**：getStudentView()
  // 会 shuffle.getOrCreate 建乱序表，是隐式写。
  @AllowTeacherView()
  @Get('student-result/:sessionId')
  studentResult(@Param('sessionId') sessionId: string, @CurrentUser() user: any) {
    if (user.role !== 'student') throw new ForbiddenException('student_only');
    return this.svc.getStudentResult(sessionId, user.id);
  }

  /**
   * 学生自己的阅读历史（已交 / 已判 / 练习）。
   *
   * ## S02（2026-09-11 审计）：姓名不再是授权凭据
   *
   * 这里原来是 @Public 的「输姓名查成绩」：不带令牌时按姓名找人，同名时
   * 还把候选的班级、邮箱前缀列出来 —— 知道同学姓名就能读他的成绩。
   *
   * 现在**只认验签后的学生令牌**（`@RequireStudentReadToken()`：学生本人或
   * 教师只读视角；本接口零写库）。无令牌在查任何学生之前就被守卫 403
   * `student_token_required`；handler 里再兜一层，直接调用也一样拒。
   * 查询串里的 `name` / `studentId` 只为旧客户端兼容而保留：守卫已核对
   * 它们与令牌一致（不一致 403 `identity_mismatch`），这里**不拿它们查人**。
   *
   * Returns submitted/graded papers only — in-progress and never-
   * scanned-in sessions are filtered out so the page reads as
   * "exams I've actually taken".
   */
  // S06：这一组现在都必须带令牌 —— 按已验证的学生分桶，全校共用出口 IP 不再
  // 互相 429；没令牌 / 令牌无效的请求在限流守卫里仍落 IP 桶。
  @Public()
  @RequireStudentReadToken()
  @RateLimit({ limit: HISTORY_RATE_LIMIT.limit, windowSec: HISTORY_RATE_LIMIT.windowSec, scope: 'user' })
  @Get('history-by-name')
  async historyByName(
    @Req() req: Request,
    @Query('name') rawName?: string,
    @Query('studentId') studentIdFilter?: string,
  ) {
    const auth = (req as RequestWithStudentAuth).studentAuth;
    // S02：无令牌，在查任何学生之前拒绝（守卫已拒；这里防直接调用）
    if (!auth) throw new ForbiddenException({ code: 'student_token_required' });
    // 旧客户端可能还带着 name / studentId —— 守卫已确认它们与令牌一致，
    // 这里只认令牌里的 id，不再拿它们查人、不再消歧。
    void rawName;
    void studentIdFilter;
    // 已认证路径：令牌里有确定的 id —— 不查姓名、不消歧、不给近似姓名建议、
    // 不列同名候选。资格谓词与 vocab / morning-quiz 服务层共用同一份定义
    // （启用、未归档、在读于未归档班级；幽灵学生与已退学的都进不来）。
    const candidates = await this.prisma.user.findMany({
      where: authenticatedStudentWhere(auth.id),
      select: {
        id: true,
        name: true,
        email: true,
        classEnrollments: {
          where: { role: 'student', class: { archivedAt: null } },
          select: { class: { select: { id: true, name: true, classCode: true } } },
        },
      },
    });
    if (candidates.length === 0) throw studentNotEligible();
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
        maxScore: true, submittedAt: true, status: true, finalSubmittedAt: true,
        assignment: {
          select: {
            id: true,
            paper: { select: { id: true, name: true } },
            class: { select: { id: true, name: true, classCode: true } },
          },
        },
        // 分数发布前给学生看「客观题 6 / 6」的小计要用（2026-09-05 盲测）。
        scripts: {
          select: {
            awardedMarks: true, autoCorrect: true, markedById: true, markerComment: true,
            paperQuestion: { select: { marks: true, question: { select: { questionType: true } } } },
          },
        },
      },
    });
    const assignmentIds = submissions.map((s) => s.assignment.id);
    const sessionsByAsgmt = await this.prisma.morningQuizSession.findMany({
      where: { paperAssignmentId: { in: assignmentIds }, status: { not: 'cancelled' } },
      // makeupStart/End = 第二作答窗（2026-08-20 后的语义），列表页用它
      // 判断「这场现在还能不能回去改」
      select: {
        id: true, paperAssignmentId: true, date: true, level: true,
        makeupStart: true, makeupEnd: true,
      },
    });
    const sessByAssignment = new Map<string, any>();
    for (const s of sessionsByAsgmt) {
      if (!sessByAssignment.has(s.paperAssignmentId)) sessByAssignment.set(s.paperAssignmentId, s);
    }
    // NOTE: attendance is deliberately NOT returned here. Students may see
    // their own scores only — on-time / late / absent is teacher-facing.
    // Removing it from the payload (not just the UI) means it can't be read
    // out of the network response either. Teachers use the class dashboards;
    // parents use the separate token-gated /api/parent/portal.
    // 阶段 5A 更正 —— 回显的姓名取**按令牌 id 查出来的那一行**，不是查询串，
    // 也不是令牌里的 `auth.name`（令牌签发之后姓名可能改过）。
    const displayName = candidates[0]?.name ?? '';
    return {
      student: {
        name: displayName,
        matchedCount: candidates.length,
        classes: Array.from(
          new Set(candidates.flatMap((c) => c.classEnrollments.map((e) => e.class.name))),
        ),
      },
      submissions: submissions.map((s) => {
        const sess = sessByAssignment.get(s.assignment.id);
        // 2026-08-14 新政：分数等人工判分定稿（marked）才下发。未定稿时
        // totalScore 只是 MCQ 部分分，学生会当成最终分数 —— 服务端置空，
        // 前端据 scoresPending 显示「已交 · 待批改」。
        const released = scoresReleased(s.status);
        // 第二作答窗（2026-08-20）：暂存提交的答卷学生今天还能回来改，
        // 列表页必须能一眼看出来 —— 否则他只看到「待批改」，不知道自己
        // 其实还有一次机会。answersPending 就是那把钥匙。
        const answersPending = !answersReleased({
          status: s.status,
          finalSubmittedAt: s.finalSubmittedAt,
        });
        return {
          submissionId: s.id,
          answersPending,
          // 这一场此刻是否还能回去继续答（第二窗开着且我没最终交卷）
          reopenable:
            answersPending &&
            !!sess &&
            isMakeupWindowOpen(
              { makeupStart: sess.makeupStart, makeupEnd: sess.makeupEnd },
              new Date(),
            ),
          sessionId: sess?.id ?? null,
          date: sess?.date ?? null,
          level: sess?.level ?? null,
          paperName: s.assignment.paper.name,
          className: s.assignment.class.name,
          autoScore: released ? s.autoScore : null,
          totalScore: released ? s.totalScore ?? s.autoScore : null,
          maxScore: s.maxScore,
          submittedAt: s.submittedAt,
          status: s.status,
          scoresPending: !released,
          // 已确定性判出的小计（MCQ + 精确匹配的短答）；只在最终提交后给。
          releasedScore: (() => {
            if (answersPending) return null;
            let earned = 0; let max = 0; let count = 0;
            for (const sc of s.scripts) {
              const det = deterministicallyGraded({
                questionType: sc.paperQuestion.question.questionType,
                awardedMarks: sc.awardedMarks,
                autoCorrect: sc.autoCorrect,
                markedById: sc.markedById,
                markerComment: sc.markerComment,
              });
              if (!det) continue;
              earned += sc.awardedMarks ?? 0; max += sc.paperQuestion.marks; count += 1;
            }
            return count > 0 ? { earned, max, count } : null;
          })(),
        };
      }),
    };
  }

  /**
   * 一份阅读答卷的逐题回顾（学生本人 / 教师只读视角）。
   *
   * ## S02（2026-09-11 审计）：归属只按令牌 id 校验
   *
   * 原来是 @Public 的「答卷号 + 姓名」：姓名对上就给看。姓名不是秘密，
   * 答卷号又会出现在分享的链接里，于是「知道名字 + 拿到一个链接」就能读
   * 别人的答案与得分。
   *
   * 现在只认验签后的令牌；无令牌在查答卷之前就拒。不是本人的答卷与不存在
   * 的答卷**回同一个 404**，不给存在性信号。分数与答案放不放，仍由
   * getStudentResult 按「最终提交 / 判分定稿」两道门决定。
   */
  @Public()
  @RequireStudentReadToken()
  @RateLimit({ limit: HISTORY_RATE_LIMIT.limit, windowSec: HISTORY_RATE_LIMIT.windowSec, scope: 'user' })
  @Get('history-detail')
  async historyDetail(
    @Req() req: Request,
    @Query('submissionId') submissionId?: string,
    @Query('name') rawName?: string,
  ) {
    const auth = (req as RequestWithStudentAuth).studentAuth;
    // S02：无令牌，在查任何答卷之前拒绝（守卫已拒；这里防直接调用）
    if (!auth) throw new ForbiddenException({ code: 'student_token_required' });
    // 旧客户端可能还带着 name —— 守卫已确认它与令牌一致，这里不拿它比归属。
    void rawName;
    if (!submissionId) throw new BadRequestException({ code: 'submission_id_required' });
    const sub = await this.prisma.studentSubmission.findUnique({
      where: { id: submissionId },
      select: { studentId: true, assignmentId: true },
    });
    // 不存在 与 不是你的 —— 同一个回答
    if (!sub || sub.studentId !== auth.id) {
      throw new NotFoundException({ code: 'submission_not_found' });
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
   * Wave-2 F2 — lookup of upcoming morning-quiz sessions for one
   * named student. Rate-limited, same shape as /history-by-name (incl.
   * same-name disambig flow). Used by the student-portal landing page
   * to show "your next quiz is in <class> at 08:30".
   *
   * S02（2026-09-11）：与 history-by-name 同类的「按姓名匿名读」—— 现在必须
   * 带令牌，且守卫核对查询串里的姓名 / 编号与令牌一致。
   */
  @Public()
  @RequireStudentReadToken()
  @RateLimit({ limit: HISTORY_RATE_LIMIT.limit, windowSec: HISTORY_RATE_LIMIT.windowSec, scope: 'user' })
  @Get('upcoming-for-name')
  async upcomingForName(@Req() req: Request, @Query('name') rawName?: string) {
    // 查询串里的 studentId 由守卫核对（与令牌不一致 → 403），这里不用它
    const who = tokenBoundIdentity(req, rawName);
    return this.svc.upcomingForName(who.name, who.studentId);
  }

  // ─────────────────── F10 — AI-grade appeals ───────────────────

  /** Public — student files an appeal against an AI-graded item.
   *  Rate-limited (5/60s). Name+studentId disambig matches
   *  /history-by-name. */
  @Public()
  @RateLimit({ limit: 5, windowSec: 60, scope: 'ip' })
  @RequireStudentToken()
  @Post('appeals')
  async createAppeal(@Body() body: unknown, @Req() req: Request) {
    const schema = z.object({
      submissionId: z.string().min(1),
      paperQuestionId: z.string().optional(),
      message: z.string().min(1).max(4000),
      studentName: z.string().min(1).max(50).optional(),
      studentId: z.string().optional(),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.createAppeal(
      { ...parsed.data, ...identityOf(req, parsed.data.studentName, parsed.data.studentId) },
      req.ip ?? null,
    );
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
   *  Rate-limited; name+studentId scoped.
   *  S02：studentId 强制取令牌（同名时不返回候选）；S06：按学生限流。 */
  @Public()
  @RateLimit({ limit: HISTORY_RATE_LIMIT.limit, windowSec: HISTORY_RATE_LIMIT.windowSec, scope: 'user' })
  @RequireStudentToken()
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
    const who = tokenBoundIdentity(req, parsed.data.studentName);
    return this.svc.startPractice(
      submissionId,
      { ...parsed.data, studentName: who.name, studentId: who.studentId },
      req.ip ?? null,
    );
  }

  /** Fetch a practice paper for replay. Rate-limited;
   *  name+studentId scoped. Body via Query for GET.
   *  S02：必须带令牌（守卫核对姓名 / 编号与令牌一致）；纯读取，教师只读视角可读。 */
  @Public()
  @RequireStudentReadToken()
  @RateLimit({ limit: HISTORY_RATE_LIMIT.limit, windowSec: HISTORY_RATE_LIMIT.windowSec, scope: 'user' })
  @Get('practice/:practiceSubmissionId')
  async getPractice(
    @Param('practiceSubmissionId') practiceSubmissionId: string,
    @Req() req: Request,
    @Query('name') name: string | undefined,
  ) {
    // S02：身份取令牌；查询串里的 studentId 由守卫核对，这里不用它
    const who = tokenBoundIdentity(req, name);
    return this.svc.getPractice(practiceSubmissionId, {
      studentName: who.name,
      studentId: who.studentId,
    });
  }

  /** Public — submit a practice attempt. Saves answers + auto-grades
   *  but DOES NOT mark the submission as 'submitted' or fire
   *  score_ready. Stats endpoints exclude status='practice'. */
  @Public()
  @RateLimit({ limit: HISTORY_RATE_LIMIT.limit, windowSec: HISTORY_RATE_LIMIT.windowSec, scope: 'user' })
  @RequireStudentToken()
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
    const who = tokenBoundIdentity(req, parsed.data.studentName);
    return this.svc.submitPractice(
      practiceSubmissionId,
      { ...parsed.data, studentName: who.name, studentId: who.studentId },
      req.ip ?? null,
    );
  }

  // ─────────────────── F17 — Score trend ───────────────────

  /** N-week trend of avg score per (week, level) for one student.
   *  Rate-limited; reuses /history-by-name disambig.
   *  S02：成绩数据，不能凭姓名匿名读 —— 必须带令牌，守卫核对姓名 / 编号与令牌一致。 */
  @Public()
  @RequireStudentReadToken()
  @RateLimit({ limit: HISTORY_RATE_LIMIT.limit, windowSec: HISTORY_RATE_LIMIT.windowSec, scope: 'user' })
  @Get('history-by-name/trend')
  async historyTrend(
    @Req() req: Request,
    @Query('name') name: string | undefined,
    @Query('studentId') _studentId: string | undefined,
    @Query('weeks') weeks: string | undefined,
  ) {
    // S02：身份取令牌；查询串里的 studentId 由守卫核对，这里不用它
    const who = tokenBoundIdentity(req, name);
    const w = weeks ? parseInt(weeks, 10) : undefined;
    return this.svc.historyTrendByName(who.name, who.studentId, w);
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
  // ─────────────────── 2.0 技能画像 ───────────────────
  // 立项依据见 skill-profile.service.ts 顶部注释：每道题本来就存了 taskType，
  // 但系统从未按它聚合，学生只看到一个总分、老师不知道该重讲什么。

  /** 学生自查：我哪类题弱。与 history-by-name 同一套姓名解析与限流。
   *  S02：各题型正确率也是成绩 —— 必须带令牌，守卫核对姓名 / 编号与令牌一致。 */
  @Public()
  @RequireStudentReadToken()
  @RateLimit({ limit: HISTORY_RATE_LIMIT.limit, windowSec: HISTORY_RATE_LIMIT.windowSec, scope: 'user' })
  @Get('skill-profile')
  async skillProfile(
    @Req() req: Request,
    @Query('name') rawName?: string,
    @Query('studentId') _studentIdFilter?: string,
    @Query('days') days?: string,
  ) {
    // S02：身份取令牌；查询串里的 studentId 由守卫核对，这里不用它
    const who = tokenBoundIdentity(req, rawName);
    if (who.name.length > 50) throw new BadRequestException({ code: 'name_too_long' });
    return this.svc.skillProfileByName(who.name, who.studentId, {
      windowDays: days ? Math.min(Math.max(parseInt(days, 10) || 60, 7), 365) : undefined,
    });
  }

  /** 教师端：班级题型热图 + 该重讲什么。需登录且是自己的班。 */
  @Get('classes/:classId/skill-profile')
  async classSkillProfile(
    @Param('classId') classId: string,
    @CurrentUser() user: any,
    @Query('days') days?: string,
  ) {
    return this.svc.classSkillProfile(
      classId,
      { id: user.id, role: user.role },
      { windowDays: days ? Math.min(Math.max(parseInt(days, 10) || 30, 7), 365) : undefined },
    );
  }
}
