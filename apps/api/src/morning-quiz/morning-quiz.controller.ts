import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { StudentService } from '../student/student.service';
import { MorningQuizService } from './morning-quiz.service';

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
  ) {}

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
