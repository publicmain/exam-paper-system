import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { QualityFeedbackService, SignalType } from './quality-feedback.service';

const SignalSchema = z.object({
  signalType: z.enum([
    'approved',
    'rejected',
    'edited',
    'answered_correct',
    'answered_wrong',
    'skipped',
  ]),
  meta: z.record(z.string(), z.any()).optional(),
});

/**
 * AI question quality feedback. Whole controller is teacher/admin only —
 * students must never reach this surface. Manual signal logging is
 * exposed on POST .../signal so internal services (review, marker,
 * student auto-grade) can call it via injected service OR via HTTP for
 * cross-process callers (e.g. a future external grader). The integrator
 * is expected to wire the in-process callsites listed in
 * MERGE_INSTRUCTIONS.md.
 */
@Controller('quality')
@Roles('admin', 'head_teacher', 'teacher')
export class QualityFeedbackController {
  constructor(private readonly service: QualityFeedbackService) {}

  @Post('question/:questionId/signal')
  logSignal(
    @Param('questionId') questionId: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
  ) {
    const parsed = SignalSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.logSignal(
      questionId,
      parsed.data.signalType as SignalType,
      { id: user?.id ?? null, role: user?.role ?? null },
      parsed.data.meta,
    );
  }

  @Get('question/:questionId/score')
  questionScore(@Param('questionId') questionId: string) {
    return this.service.questionScore(questionId);
  }

  @Get('topic/:topicId/leaderboard')
  topicLeaderboard(
    @Param('topicId') topicId: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Math.max(1, Math.min(50, Number(limit) || 10)) : 10;
    return this.service.topicLeaderboard(topicId, n);
  }

  @Get('ai-prompt-suggestions')
  aiPromptSuggestions(@Query('topicId') topicId?: string) {
    if (!topicId) throw new BadRequestException('topicId is required');
    return this.service.aiPromptSuggestions(topicId);
  }
}
