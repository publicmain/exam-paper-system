import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthGuard, Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { WatermarkService } from './watermark.service';

/**
 * Per-student paper watermarking endpoints.
 *
 * Authz model:
 *   - Issue / download / revoke: teacher / head_teacher / admin. Issuing a
 *     watermark is a print-prep action a class teacher does for their own
 *     class, so it would be wrong to gate the whole controller to admin.
 *   - lookup: ADMIN ONLY. This is the forensic endpoint — given a token
 *     scraped off a leaked PDF, it returns the student's identity. We do
 *     NOT want a regular teacher to be able to enumerate which student
 *     received any given token. Method-level @Roles('admin') overrides the
 *     class-level @Roles below.
 *
 * Security note: GET /watermark/download is also auth-required. We do not
 * make the token URL public — even though the token is opaque, we don't
 * want anyone with the URL to be able to fetch the PDF. (The watermarked
 * PDF still contains the paper content; if the token leaks WITHOUT the PDF,
 * we don't want it to be redeemable.) Defense in depth.
 */
@Controller('watermark')
@UseGuards(AuthGuard)
@Roles('admin', 'head_teacher', 'teacher')
export class WatermarkController {
  constructor(private readonly service: WatermarkService) {}

  /** Get-or-create a token for (paperId, studentId). Returns { token, downloadUrl }. */
  @Post('papers/:paperId/student/:studentId/token')
  async issue(
    @Param('paperId') paperId: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    if (!paperId || !studentId) throw new BadRequestException('paperId and studentId required');
    return this.service.issueToken(paperId, studentId, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  /**
   * Download the watermarked PDF.
   *
   * Returns 410 if the token has been revoked (handled in service via
   * GoneException). Returns 404 for unknown tokens. Returns 500 with a
   * clear message if pdf-lib isn't installed (see MERGE_INSTRUCTIONS).
   */
  @Get('download')
  async download(@Query('token') token: string, @Res() res: Response) {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('token query param required');
    }
    const { buffer, filename } = await this.service.download(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // No-cache: each download reflects current revocation state.
    res.setHeader('Cache-Control', 'no-store');
    res.send(buffer);
  }

  /** Revoke a token by id. Admin only — same trust level as lookup. */
  @Post('tokens/:id/revoke')
  @Roles('admin')
  async revoke(@Param('id') id: string) {
    return this.service.revoke(id);
  }

  /**
   * Forensic lookup — given a token, return who it was issued to.
   * ADMIN ONLY. Method-level @Roles overrides the class-level list above.
   */
  @Get('lookup')
  @Roles('admin')
  async lookup(@Query('token') token: string) {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('token query param required');
    }
    return this.service.lookup(token);
  }
}
