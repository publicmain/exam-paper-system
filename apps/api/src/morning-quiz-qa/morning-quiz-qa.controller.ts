import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { MorningQuizQaService } from './morning-quiz-qa.service';

const BatchSchema = z.object({
  action: z.enum(['approve', 'reject', 'rerun']),
  paperIds: z.array(z.string().min(1)).min(1).max(50),
  reason: z.string().max(600).optional(),
  strict: z.boolean().optional(),
});

const TEACHER_ROLES = new Set(['teacher', 'head_teacher', 'admin']);

@Controller('morning-quiz-qa')
export class MorningQuizQaController {
  constructor(private readonly svc: MorningQuizQaService) {}

  /** List papers awaiting teacher action (verdict needs_review or reject). */
  @Get('pending')
  pending(@CurrentUser() user: any) {
    if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required');
    return this.svc.listPending();
  }

  /** Drilldown: passage + questions + AI verdict + every issue. */
  @Get('papers/:id')
  detail(@Param('id') id: string, @CurrentUser() user: any) {
    if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required');
    return this.svc.getReview(id);
  }

  /** Force a re-run of the AI review (e.g. after a manual edit). Optional
   *  `strict=true` upgrades the model to Opus for a stricter pass. */
  @Post('papers/:id/review')
  rerun(
    @Param('id') id: string,
    @Body() body: { strict?: boolean } | undefined,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required');
    return this.svc.reviewPaper(
      id,
      { id: user.id, role: user.role, ip: req.ip ?? null },
      { strict: !!body?.strict },
    );
  }

  /** Teacher approves a needs_review paper for student delivery. */
  @Post('papers/:id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required');
    return this.svc.approve(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  /** Teacher discards a paper outright (status → archived). */
  @Post('papers/:id/teacher-reject')
  reject(
    @Param('id') id: string,
    @Body() body: { reason?: string } | undefined,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required');
    if (typeof body?.reason !== 'undefined' && typeof body.reason !== 'string') {
      throw new BadRequestException('reason must be a string');
    }
    return this.svc.rejectByTeacher(
      id,
      { id: user.id, role: user.role, ip: req.ip ?? null },
      body?.reason,
    );
  }

  /** U6 — batch operation across selected papers. Each paper is processed
   *  independently within the same request; per-id failures are returned
   *  as { id, ok:false, error }, never abort the rest. The controller
   *  rejects the whole request if zod validation fails (no malformed
   *  array gets through). */
  @Post('batch')
  async batch(
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!TEACHER_ROLES.has(user.role)) throw new ForbiddenException('teacher_required');
    const parsed = BatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const actor = { id: user.id, role: user.role, ip: req.ip ?? null };
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const id of parsed.data.paperIds) {
      try {
        if (parsed.data.action === 'approve') {
          await this.svc.approve(id, actor);
        } else if (parsed.data.action === 'reject') {
          await this.svc.rejectByTeacher(id, actor, parsed.data.reason);
        } else {
          await this.svc.reviewPaper(id, actor, { strict: !!parsed.data.strict });
        }
        results.push({ id, ok: true });
      } catch (e: any) {
        results.push({ id, ok: false, error: String(e?.message ?? e).slice(0, 200) });
      }
    }
    return {
      action: parsed.data.action,
      total: parsed.data.paperIds.length,
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }
}
