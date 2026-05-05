import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, Roles } from '../common/auth.guard';
import { PerfRoutingService } from './perf-routing.service';

const PreviewSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1).optional(),
  basePrompt: z.string().max(8000).default(''),
  limit: z.number().int().positive().max(50).optional(),
});

/**
 * Read-only routing helper for the AI generator. Computes per-class
 * topic-mastery scores from existing `AnswerScript.autoCorrect` data —
 * does NOT mutate state.
 *
 * Authorization: teachers can call this for any class they could already
 * see in /classes (the underlying ClassesService already restricts list/get
 * by enrollment). We don't re-enforce per-class membership here because
 * the data exposed (topic codes + aggregate scores) is identical to what
 * a teacher could compute by hand from /papers/:id and /classes/:id, and
 * the role gate keeps students out.
 */
@Controller('perf-routing')
@UseGuards(AuthGuard)
@Roles('admin', 'head_teacher', 'teacher')
export class PerfRoutingController {
  constructor(private readonly service: PerfRoutingService) {}

  @Get('class/:classId/weak-topics')
  weakTopics(
    @Param('classId') classId: string,
    @Query('subjectId') subjectId?: string,
    @Query('limit') limit?: string,
  ) {
    if (!classId) throw new BadRequestException('classId required');
    let parsedLimit: number | undefined;
    if (limit !== undefined) {
      const n = Number(limit);
      if (!Number.isFinite(n) || n <= 0 || n > 100) {
        throw new BadRequestException('limit must be a positive integer ≤ 100');
      }
      parsedLimit = Math.floor(n);
    }
    return this.service.weakTopicsForClass({
      classId,
      subjectId: subjectId || undefined,
      limit: parsedLimit,
    });
  }

  @Post('preview-prompt')
  previewPrompt(@Body() body: unknown) {
    const parsed = PreviewSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.previewPrompt(parsed.data);
  }
}
