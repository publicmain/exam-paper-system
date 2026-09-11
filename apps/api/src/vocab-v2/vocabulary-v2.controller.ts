import { BadRequestException, Body, Controller, Get, Header, Post, Query, Req, StreamableFile, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { Public } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import { RequireStudentToken, StudentIdentityGuard } from '../common/student-identity.guard';
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
  @RequireStudentToken()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
  @Get('search')
  search(@Req() req: Request, @Query('q') q = '', @Query('limit') limit = '20') {
    return this.service.search(studentIdOf(req), q, Number(limit));
  }

  @Public()
  @RequireStudentToken()
  @Get('center')
  center(
    @Req() req: Request,
    @Query('q') q = '',
    @Query('source') source = '',
    @Query('stage') stage = '',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '30',
    // UI03：「加载更多」用上一次返回的 nextCursor，中途移出也不跳不重
    @Query('cursor') cursor = '',
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
      cursor: cursor || undefined,
      article,
      topic,
      list,
      dateFrom,
      dateTo,
    });
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'ip' })
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

  /** VOC10：退出自助练习 —— 删掉这份临时会话（已经没了也算成功）。 */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'ip' })
  @Post('custom-test/cancel')
  cancelCustomTest(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({ sessionId: z.string().min(1).max(80) }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.cancelCustomTest(studentIdOf(req), parsed.data.sessionId);
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
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
      // UI02 / VOC05：按钮绑定显示中的那条词义；与 headword 对不上会被拒绝
      senseId: z.string().min(1).max(80).optional(),
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

  /** VOC13：「重新加入我的单词」—— 只恢复成员关系，不开始教学、不算新词。 */
  @Public()
  @RequireStudentToken()
  @Post('notebook/restore')
  restore(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({ senseId: z.string().min(1).max(80) }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.restoreToNotebook(studentIdOf(req), parsed.data.senseId);
  }

  /** 旧名字（VOC13 之前）。保留给还没更新的前端，做的是「重新加入」。 */
  @Public()
  @RequireStudentToken()
  @Post('notebook/relearn')
  relearn(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({ senseId: z.string().min(1).max(80) }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.restoreToNotebook(studentIdOf(req), parsed.data.senseId);
  }

  @Public()
  @RequireStudentToken()
  @Get('daily')
  daily(@Req() req: Request, @Query('date') date = '') {
    const parsed = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().safeParse(date || undefined);
    if (!parsed.success) throw new BadRequestException({ code: 'bad_task_date' });
    return this.service.dailySession(studentIdOf(req), new Date(), parsed.data);
  }

  /** VOC12：按日期只读回看那天冻结的学习卡（背一背）与正式卷指针；不生成任何东西。 */
  @Public()
  @RequireStudentToken()
  @Get('daily/review')
  dailyReview(@Req() req: Request, @Query('date') date = '') {
    const parsed = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().safeParse(date || undefined);
    if (!parsed.success) throw new BadRequestException({ code: 'bad_task_date' });
    return this.service.reviewDailySession(studentIdOf(req), new Date(), parsed.data);
  }

  /** VOC12：做过的每日学习任务，按日期倒序（「按日期回看」入口）。只读。 */
  @Public()
  @RequireStudentToken()
  @Get('daily/history')
  dailyHistory(@Req() req: Request, @Query('limit') limit = '30') {
    return this.service.dailyHistory(studentIdOf(req), new Date(), Number(limit));
  }

  @Public()
  @RequireStudentToken()
  @Get('overview')
  overview(@Req() req: Request) {
    return this.service.overview(studentIdOf(req));
  }

  /** 历史成绩页：已交卷的正式单词测试（2026-09-06 上线验收 P0：原来只读旧版测验表）。 */
  @Public()
  @RequireStudentToken()
  @Get('tests')
  tests(@Req() req: Request) {
    return this.service.listFormalTests(studentIdOf(req));
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'ip' })
  @Post('daily/start')
  startDaily(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict().safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException({ code: 'bad_task_date' });
    return this.service.startDailySession(studentIdOf(req), new Date(), parsed.data.date);
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
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
  @RateLimit({ limit: 60, windowSec: 60, scope: 'ip' })
  @Post('daily/replace')
  replaceDailyItem(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({
      sessionId: z.string().min(1).max(80),
      itemId: z.string().min(1).max(80),
      // VOC02：屏幕上那张卡的词义。带上它，重试 / 双击不会把刚换上来的新词也标会。
      expectedSenseId: z.string().min(1).max(80).optional(),
    }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.replaceDailyItem(studentIdOf(req), parsed.data.sessionId, parsed.data.itemId, {
      expectedSenseId: parsed.data.expectedSenseId,
    });
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'ip' })
  @Post('test/start')
  startTest(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({ dailySessionId: z.string().min(1).max(80) }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.startFormalTest(studentIdOf(req), parsed.data.dailySessionId);
  }

  @Public()
  @RequireStudentToken()
  @Get('test')
  test(@Req() req: Request, @Query('sessionId') sessionId = '') {
    if (!sessionId) throw new BadRequestException({ code: 'v2_session_required' });
    return this.service.testSession(studentIdOf(req), sessionId);
  }

  /**
   * 听写题音频（VOC04）：只凭 sessionId + itemId 取，URL 里没有单词。
   * 前端用带令牌的 fetch 取回 blob 再播放；不缓存。
   */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
  @Get('test/audio')
  @Header('Cache-Control', 'no-store')
  async testAudio(@Req() req: Request, @Query('sessionId') sessionId = '', @Query('itemId') itemId = '') {
    if (!sessionId || !itemId) throw new BadRequestException({ code: 'v2_session_required' });
    const audio = await this.service.testItemAudio(studentIdOf(req), sessionId, itemId);
    return new StreamableFile(audio.bytes, { type: audio.contentType });
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
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
  @RateLimit({ limit: 30, windowSec: 60, scope: 'ip' })
  @Post('test/submit')
  submitTest(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({ sessionId: z.string().min(1).max(80) }).strict().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.submitTest(studentIdOf(req), parsed.data.sessionId);
  }
}
