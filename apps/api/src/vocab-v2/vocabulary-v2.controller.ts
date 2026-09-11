import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { Public } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import {
  RequireStudentReadToken,
  RequireStudentToken,
  StudentIdentityGuard,
} from '../common/student-identity.guard';
import { VocabularyV2Service } from './vocabulary-v2.service';

function studentIdOf(req: Request): string {
  const id = (req as Request & { studentAuth?: { id?: string } }).studentAuth?.id;
  if (!id) throw new BadRequestException({ code: 'student_required' });
  return id;
}

@UseGuards(StudentIdentityGuard)
@Controller('vocab-v2')
export class VocabularyV2Controller {
  constructor(private readonly service: VocabularyV2Service) {}

  @Public()
  @Get('source-meta')
  sourceMeta() {
    return this.service.sourceMeta();
  }

  // S08：这条 GET 会**隐式写库**（profile() 用 upsert 兜底建档），所以仍是
  // 本人写、拒绝教师只读视角。服务层拆成纯读之后再换成 @RequireStudentReadToken。
  @Public()
  @RequireStudentToken()
  @Get('profile')
  profile(@Req() req: Request) {
    return this.service.profile(studentIdOf(req));
  }

  @Public()
  @RequireStudentToken()
  @Post('profile')
  updateProfile(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({
      dailyTarget: z.number().int().optional(),
      audioAccent: z.enum(['en-GB', 'en-US']).optional(),
    }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.updateProfile(studentIdOf(req), parsed.data);
  }

  @Public()
  @RequireStudentReadToken()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'user' })
  @Get('search')
  search(@Req() req: Request, @Query('q') q = '', @Query('limit') limit = '20') {
    return this.service.search(studentIdOf(req), q, Number(limit));
  }

  @Public()
  @RequireStudentReadToken()
  @Get('center')
  center(
    @Req() req: Request,
    @Query('q') q = '',
    @Query('source') source = '',
    @Query('stage') stage = '',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '30',
    @Query('article') article = '',
    @Query('topic') topic = '',
    @Query('list') list = '',
    @Query('dateFrom') dateFrom = '',
    @Query('dateTo') dateTo = '',
  ) {
    return this.service.vocabularyCenter(studentIdOf(req), {
      q,
      source,
      stage,
      page: Number(page),
      pageSize: Number(pageSize),
      article,
      topic,
      list,
      dateFrom,
      dateTo,
    });
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'user' })
  @Post('custom-test/start')
  startCustomTest(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({
      count: z.union([z.literal(5), z.literal(10), z.literal(20), z.literal('all')]),
      scope: z.enum(['all', 'week', 'weak', 'mastered', 'spelling', 'listening']).default('all'),
      sourceTitle: z.string().max(240).optional(),
    }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.startCustomTest(studentIdOf(req), parsed.data);
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'user' })
  @Post('collect')
  collect(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({
      headword: z.string().min(1).max(120),
      action: z.enum(['learn', 'known', 'lookup_only', 'later']),
      contextSentence: z.string().max(2000).optional(),
      contextTranslation: z.string().max(2000).optional(),
      sourceTitle: z.string().max(240).optional(),
      sourceRef: z.string().max(240).optional(),
      source: z.enum(['reading_lookup', 'reading_error', 'search', 'teacher_list']).optional(),
    }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.collect(studentIdOf(req), parsed.data);
  }

  @Public()
  @RequireStudentToken()
  @Post('notebook/remove')
  removeFromNotebook(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({ senseId: z.string().min(1).max(80) }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.setNotebookMembership(studentIdOf(req), parsed.data.senseId, false);
  }

  @Public()
  @RequireStudentToken()
  @Post('notebook/relearn')
  relearn(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({ senseId: z.string().min(1).max(80) }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.setNotebookMembership(studentIdOf(req), parsed.data.senseId, true);
  }

  @Public()
  @RequireStudentReadToken()
  @Get('daily')
  daily(@Req() req: Request, @Query('date') date = '') {
    const parsed = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().safeParse(date || undefined);
    if (!parsed.success) throw new BadRequestException({ code: 'bad_task_date' });
    return this.service.dailySession(studentIdOf(req), new Date(), parsed.data);
  }

  // S08：同上 —— overview() 先调 profile()，没有档案时会 upsert 建一行。
  @Public()
  @RequireStudentToken()
  @Get('overview')
  overview(@Req() req: Request) {
    return this.service.overview(studentIdOf(req));
  }

  /** 历史成绩页：已交卷的正式单词测试（2026-09-06 上线验收 P0：原来只读旧版测验表）。 */
  @Public()
  @RequireStudentReadToken()
  @Get('tests')
  tests(@Req() req: Request) {
    return this.service.listFormalTests(studentIdOf(req));
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'user' })
  @Post('daily/start')
  startDaily(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict().safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException({ code: 'bad_task_date' });
    return this.service.startDailySession(studentIdOf(req), new Date(), parsed.data.date);
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'user' })
  @Post('daily/item')
  actOnItem(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({
      sessionId: z.string().min(1).max(80),
      itemId: z.string().min(1).max(80),
      action: z.enum(['mastered', 'normal', 'hard', 'skip']),
      responseMs: z.number().int().min(0).max(3_600_000).optional(),
    }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.actOnLearningItem(
      studentIdOf(req),
      parsed.data.sessionId,
      parsed.data.itemId,
      parsed.data.action,
      parsed.data.responseMs,
    );
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'user' })
  @Post('daily/replace')
  replaceDailyItem(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({
      sessionId: z.string().min(1).max(80),
      itemId: z.string().min(1).max(80),
    }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.replaceDailyItem(studentIdOf(req), parsed.data.sessionId, parsed.data.itemId);
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'user' })
  @Post('test/start')
  startTest(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({ dailySessionId: z.string().min(1).max(80) }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.startFormalTest(studentIdOf(req), parsed.data.dailySessionId);
  }

  @Public()
  @RequireStudentReadToken()
  @Get('test')
  test(@Req() req: Request, @Query('sessionId') sessionId = '') {
    if (!sessionId) throw new BadRequestException({ code: 'v2_session_required' });
    return this.service.testSession(studentIdOf(req), sessionId);
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'user' })
  @Post('test/answer')
  answerTest(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({
      sessionId: z.string().min(1).max(80),
      itemId: z.string().min(1).max(80),
      response: z.union([z.string().max(1000), z.number().int().min(0).max(20)]),
      responseMs: z.number().int().min(0).max(3_600_000).optional(),
    }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.answerTestItem(
      studentIdOf(req),
      parsed.data.sessionId,
      parsed.data.itemId,
      parsed.data.response,
      parsed.data.responseMs,
    );
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'user' })
  @Post('test/submit')
  submitTest(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({ sessionId: z.string().min(1).max(80) }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.submitTest(studentIdOf(req), parsed.data.sessionId);
  }
}
