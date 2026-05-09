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
import { CurrentUser } from '../common/current-user.decorator';
import { MorningQuizQaService } from './morning-quiz-qa.service';

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
    if (typeof body?.reason !== 'undefined' && typeof body.reason !== 'string') {
      throw new BadRequestException('reason must be a string');
    }
    return this.svc.rejectByTeacher(
      id,
      { id: user.id, role: user.role, ip: req.ip ?? null },
      body?.reason,
    );
  }
}
