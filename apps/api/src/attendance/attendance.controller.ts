import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { Public } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { IpAllowlistGuard } from '../wifi-gate/ip-allowlist.guard';
import { AttendanceService } from './attendance.service';

const ScanSchema = z.object({
  qrToken: z.string().min(8).max(256),
  // Free-form typed name. Server matches it against the session class
  // roster — exact (after trim) match against User.name where role='student'
  // and enrolled in the session class. Typos are intentionally not
  // auto-corrected; the rejection error tells the student to re-check.
  studentName: z.string().trim().min(1).max(50),
  // Frontend mints this on first visit and persists in localStorage.
  // Server uses it to detect "one phone signing in as many students" —
  // any attempt to scan with a deviceUuid already used by a different
  // student in the same session is rejected.
  deviceUuid: z.string().min(8).max(64).optional(),
});

const CorrectSchema = z.object({
  sessionId: z.string(),
  studentId: z.string(),
  status: z.enum(['on_time', 'late', 'absent']),
  note: z.string().max(500).optional(),
});

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly svc: AttendanceService) {}

  /**
   * Roster lookup for the scan page. Public (no JWT) but gated by school
   * WiFi + a valid QR token, both of which prove the requester is at the
   * venue. Returns the {id, name} list of students enrolled in the QR's
   * session class so the scan page can render a name picker. The list
   * itself is mildly sensitive (real student names), but the QR-token gate
   * limits exposure to the brief active window of an in-progress session.
   */
  @Public()
  @UseGuards(IpAllowlistGuard)
  @Get('scan-roster')
  scanRoster(@Query('qrToken') qrToken?: string) {
    if (!qrToken) throw new BadRequestException('qrToken required');
    return this.svc.fetchRoster(qrToken);
  }

  /**
   * Student picks their name in the scan page and POSTs here. This route
   * is @Public() — no login required — because the school chose name-pick
   * over per-student passwords for usability. Identity proof comes from:
   *   1. School WiFi (IpAllowlistGuard)
   *   2. Live QR token (verified inside service)
   *   3. studentId being in the session's class enrollment (verified inside
   *      service)
   *   4. In-room invigilation (out of band)
   * On success the service mints a short-lived "scan token" (a JWT scoped
   * to this session, expiring at quizEnd) which the frontend stores as
   * auth_token so subsequent /morning-quiz/* calls authenticate as this
   * student via the existing AuthGuard.
   */
  @Public()
  @UseGuards(IpAllowlistGuard)
  @Post('scan')
  scan(@Body() body: unknown, @Req() req: Request) {
    const parsed = ScanSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.scanQr(
      parsed.data.qrToken,
      parsed.data.studentName,
      req.ip ?? null,
      parsed.data.deviceUuid ?? null,
      (req.headers['user-agent'] as string | undefined) ?? null,
    );
  }

  /**
   * Admin / class teacher manual override for forgot-phone / dead-battery /
   * past-cutoff edge cases. Audit-logged.
   */
  @Post('correct')
  correct(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = CorrectSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.correct(parsed.data, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  @Get('history')
  history(@Query('classId') classId: string, @Query('from') from?: string, @Query('to') to?: string) {
    if (!classId) throw new BadRequestException('classId required');
    return this.svc.historyForClass(
      classId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
