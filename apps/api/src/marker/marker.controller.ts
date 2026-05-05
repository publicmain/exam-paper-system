import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard, Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import {
  ClaimSchema,
  QueueQuerySchema,
  ReleaseSchema,
  ScoreScriptSchema,
} from './dto';
import { MarkerService } from './marker.service';

/**
 * Marker workflow controller. Whole controller is teacher/admin only —
 * students must NEVER reach any of these routes (they could read the
 * mark scheme via getSubmissionForMarker, or worse, score their own paper).
 *
 * Authz: AuthGuard at class level enforces JWT + role membership in the
 * @Roles list. The global APP_GUARD also runs but the explicit @UseGuards
 * here makes intent obvious for code review and matches papers.controller.ts.
 */
@Controller('marker')
@UseGuards(AuthGuard)
@Roles('admin', 'head_teacher', 'teacher')
export class MarkerController {
  constructor(private readonly marker: MarkerService) {}

  /** Queue: submissions awaiting marker grading. */
  @Get('queue')
  queue(@Query() query: unknown) {
    const parsed = QueueQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.marker.listQueue(parsed.data);
  }

  /** Per-submission detail (for the marker UI). */
  @Get('submissions/:id')
  detail(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    return this.marker.getSubmissionForMarker(id, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  /** Atomic claim. 409 if already held. */
  @Post('claim')
  claim(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = ClaimSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.marker.claim(parsed.data, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  /** Release claim — owner or admin. */
  @Post('release')
  release(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = ReleaseSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.marker.release(parsed.data.submissionId, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  /** Score one structured AnswerScript. */
  @Patch('scripts/:scriptId')
  scoreScript(
    @Param('scriptId') scriptId: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const parsed = ScoreScriptSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.marker.scoreScript(scriptId, parsed.data, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  /** Finalize: compute manualScore + totalScore, status='marked'. */
  @Post('finalize/:submissionId')
  finalize(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    return this.marker.finalize(submissionId, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }
}
