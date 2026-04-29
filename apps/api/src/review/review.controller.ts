import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { ReviewService } from './review.service';

const UpdateSchema = z.object({
  questionNumber: z.string().nullable().optional(),
  rawExtractedText: z.string().nullable().optional(),
  suggestedType: z.enum(['mcq', 'short_answer', 'structured', 'essay']).nullable().optional(),
  suggestedMarks: z.number().int().min(1).max(50).nullable().optional(),
  suggestedDifficulty: z.number().int().min(1).max(5).nullable().optional(),
  suggestedTopicCode: z.string().nullable().optional(),
  reviewNotes: z.string().nullable().optional(),
});
const RejectSchema = z.object({ reason: z.string().min(1).max(500).optional() });

@Controller('review/items')
@Roles('admin', 'head_teacher')
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  @Get()
  list(
    @Query('repoId') repoId?: string,
    @Query('syllabusCode') syllabusCode?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.review.list({
      repoId,
      syllabusCode,
      status,
      source,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.review.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.review.update(id, parsed.data as any, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    return this.review.approve(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = RejectSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.review.reject(id, parsed.data.reason, { id: user.id, role: user.role, ip: req.ip ?? null });
  }
}
