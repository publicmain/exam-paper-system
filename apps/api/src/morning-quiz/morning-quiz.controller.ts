import {
  BadRequestException,
  Body,
  Controller,
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
import { Request, Response } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
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
  classIds: z.array(z.string()).min(1).max(20),
  questionsPerPaper: z.number().int().min(8).max(30).optional(),
});

const SaveAnswerSchema = z.object({
  paperQuestionId: z.string(),
  selectedOption: z.string().max(2).nullable().optional(),
  textAnswer: z.string().max(20000).nullable().optional(),
});

const SetLevelSchema = z.object({
  level: z.enum(['ielts_authentic', 'ielts_hard', 'olevel']),
});

const TEACHER_ROLES = new Set(['teacher', 'head_teacher', 'admin']);

@Controller('morning-quiz')
export class MorningQuizController {
  constructor(
    private readonly svc: MorningQuizService,
    private readonly student: StudentService,
    private readonly exportSvc: MorningQuizExportService,
    private readonly weeklyCron: MorningQuizWeeklyCron,
    private readonly absence: AbsenceAlertService,
    private readonly shortAnswer: ShortAnswerEvaluatorService,
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
    const filename = `morning-quiz-${from}-to-${to}${classId ? '-' + classId : ''}.xlsx`;
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
      { date: new Date(parsed.data.date), classId: parsed.data.classId, paperId: parsed.data.paperId },
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

  @Get('scheduled')
  scheduled(@Query('weekStart') weekStart: string) {
    if (!weekStart) throw new BadRequestException('weekStart required (YYYY-MM-DD)');
    return this.svc.listScheduled(new Date(weekStart));
  }

  /**
   * DEBUG-ONLY admin endpoint to fast-forward a session into the
   * currently-active state without waiting for the 8:30 cron. Required for
   * end-to-end smoke testing of the scan flow off-hours. Gated behind
   * `MORNING_QUIZ_DEBUG=true` env var — without it, returns 404 to keep
   * the surface area invisible in normal production.
   */
  @Patch('sessions/:id/debug-activate')
  debugActivate(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    if (process.env.MORNING_QUIZ_DEBUG !== 'true') {
      throw new NotFoundException();
    }
    if (user.role !== 'admin') {
      throw new ForbiddenException({ code: 'admin_required' });
    }
    return this.svc.debugActivateNow(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  @Patch('sessions/:id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() body: { reason?: string } | undefined,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.svc.cancelSession(
      id,
      { id: user.id, role: user.role, ip: req.ip ?? null },
      body?.reason,
    );
  }

  @Get('sessions/:id/dashboard')
  dashboard(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required');
    return this.svc.getDashboard(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  // ─────────────────── Student endpoints ───────────────────

  /** Student fetches the day's questions (shuffle applied). */
  @Get('sessions/:id')
  getSession(@Param('id') id: string, @CurrentUser() user: any) {
    if (user.role !== 'student') throw new ForbiddenException('student_only');
    return this.svc.getStudentView(id, user.id);
  }

  /** Autosave a single answer. */
  @Patch('sessions/:id/answer')
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
  check(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: any) {
    if (user.role !== 'student') throw new ForbiddenException('student_only');
    const parsed = SaveAnswerSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.checkAnswer(id, parsed.data, user.id);
  }

  /** Final submit — delegates to existing student.service so auto-grading +
   *  race-safety logic stays in one place. */
  @Post('sessions/:id/submit')
  async submit(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    if (user.role !== 'student') throw new ForbiddenException('student_only');
    const submission = await this.svc.findSubmissionForSession(id, user.id);
    if (!submission) throw new BadRequestException('no_submission_for_session');
    return this.student.finalSubmit(submission.id, {
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
    const parsed = SetLevelSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.setClassEnglishLevel(classId, parsed.data.level, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }
}
