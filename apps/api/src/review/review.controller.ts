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
const BulkApproveSchema = z.object({
  filter: z.object({
    repoId: z.string().optional(),
    syllabusCode: z.string().regex(/^[\w-]+$/).optional(),
    source: z.enum(['past_paper', 'ai_generated', 'school_upload']).optional(),
  }).default({}),
  qualityGate: z.object({
    minMarks: z.number().int().min(1).max(50).default(1),
    maxMarks: z.number().int().min(1).max(50).default(30),
    minStemLength: z.number().int().min(0).max(10000).default(80),
    minLetterCount: z.number().int().min(0).max(10000).default(30),
    requireMarkIndicator: z.boolean().default(true),
    requireType: z.boolean().default(true),
  }).default({}),
  dryRun: z.boolean().default(false),
  limit: z.number().int().min(1).max(1000).default(500),
});

const BackfillComponentsSchema = z.object({
  syllabusCode: z.string().regex(/^[\w-]+$/).optional(),
  limit: z.number().int().min(1).max(5000).default(1000),
  dryRun: z.boolean().default(false),
});

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

  /**
   * Bulk-approve all pending_review items matching `filter` whose stem
   * passes `qualityGate`. Replaces the manual click-by-click approval
   * loop with a single call so a `/schedule` cron can finish ingestion
   * without operator intervention. Returns a per-item disposition so
   * the operator can audit what was approved vs skipped.
   */
  @Post('bulk-approve')
  bulkApprove(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = BulkApproveSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.review.bulkApprove(parsed.data, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  /** One-shot backfill of `componentId` on already-approved Questions
   *  whose component came out null (typically because the original
   *  approve flow predated the semantic 9709 mapping in 62db09c).
   *  Idempotent: re-running on a clean DB updates nothing. */
  @Post('backfill-components')
  backfillComponents(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = BackfillComponentsSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.review.backfillApprovedComponents(parsed.data, { id: user.id, role: user.role, ip: req.ip ?? null });
  }
}
