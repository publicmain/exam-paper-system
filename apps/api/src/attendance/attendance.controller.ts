import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { Public } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { isTeacherOrAbove } from '../common/roles';
import { AttendanceService } from './attendance.service';

const ScanSchema = z.object({
  qrToken: z.string().min(8).max(256),
  // Free-form typed name. Server matches it against the session class
  // roster — exact (after trim) match against User.name where role='student'
  // and enrolled in the session class. Typos are intentionally not
  // auto-corrected; the rejection error tells the student to re-check.
  studentName: z.string().trim().min(1).max(50),
  // Frontend mints this on first visit and persists in localStorage.
  // REQUIRED: without this gate one curl loop with the same valid QR token
  // could sign in 30 students (no per-student password). Charset locked
  // down to UUID v4 + the documented "fallback-…" form so a proxy can't
  // synthesise unique-looking strings to defeat the duplicate-device check.
  deviceUuid: z
    .string()
    .min(8)
    .max(64)
    .regex(/^([0-9a-fA-F-]{8,64}|fallback-[0-9a-z]{8,64})$/),
  // R10 multi-level — when the QR is shared across difficulty bands
  // (one QR per class+day, students pick their own band), the scan
  // page sends the picked sessionId here. The server validates the
  // override belongs to the SAME (classId, date) as the QR's session,
  // so a student can't tamper into another class's quiz. When unset,
  // the QR's own sessionId is used (single-band fallback).
  sessionIdOverride: z.string().min(8).max(80).optional(),
});

const CorrectSchema = z.object({
  sessionId: z.string(),
  studentId: z.string(),
  status: z.enum(['on_time', 'late', 'absent']),
  note: z.string().max(500).optional(),
});

/**
 * F7 — bulk attendance correction. One session, one status, N students.
 * Bounded at 200 IDs so a stray request can't bulk-mutate a whole year.
 */
const CorrectBulkSchema = z.object({
  sessionId: z.string(),
  studentIds: z.array(z.string()).min(1).max(200),
  status: z.enum(['on_time', 'late', 'absent']),
  note: z.string().max(500),
});

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly svc: AttendanceService) {}

  /**
   * Roster lookup for the scan page. Public (no JWT) — gated by a valid,
   * live QR token. Returns the {id, name} list of students enrolled in
   * the QR's session class so the scan page can render a name picker.
   * The list is mildly sensitive (real student names), but the QR-token
   * gate plus the session-must-be-active check (in fetchRoster) limit
   * exposure to the brief active window of an in-progress session.
   */
  @Public()
  @Get('scan-roster')
  scanRoster(@Query('qrToken') qrToken?: string) {
    if (!qrToken) throw new BadRequestException('qrToken required');
    return this.svc.fetchRoster(qrToken);
  }

  /**
   * Student picks their name in the scan page and POSTs here. This route
   * is @Public() — no login required — because the school chose name-pick
   * over per-student passwords for usability. Identity proof comes from:
   *   1. Live QR token (verified inside service — HMAC + freshness)
   *   2. studentId being in the session's class enrollment (verified inside
   *      service)
   *   3. The session being `status=active` within the attendance window
   *   4. In-room invigilation (out of band)
   * On success the service mints a short-lived "scan token" (a JWT scoped
   * to this session, expiring at quizEnd) which the frontend stores as
   * auth_token so subsequent /morning-quiz/* calls authenticate as this
   * student via the existing AuthGuard.
   */
  /** 30 scan attempts / minute / IP. Caps a curl-loop trying to spam
   *  scans without hurting the legitimate flood at 8:30am (peaks around
   *  5/sec for ~30 students). H9. */
  @Public()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'ip' })
  @Post('scan')
  scan(@Body() body: unknown, @Req() req: Request) {
    const parsed = ScanSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.scanQr(
      parsed.data.qrToken,
      parsed.data.studentName,
      req.ip ?? null,
      parsed.data.deviceUuid,
      (req.headers['user-agent'] as string | undefined) ?? null,
      parsed.data.sessionIdOverride ?? null,
    );
  }

  /**
   * Admin / class teacher manual override for forgot-phone / dead-battery /
   * past-cutoff edge cases. Audit-logged.
   *
   * AuthZ: teacher-or-above (admin / head_teacher / teacher). Service-layer
   * already verifies the same allowlist — this controller-level check is a
   * defence-in-depth guard so a future contributor can't accidentally leave
   * the surface open by skipping the service call.
   */
  @Post('correct')
  correct(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    if (!isTeacherOrAbove(user?.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const parsed = CorrectSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.correct(parsed.data, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  /**
   * F7 — bulk variant of `correct`. Iterates the same single-row logic
   * sequentially (not Promise.all) so a partial failure leaves a
   * predictable prefix corrected + a clean `errors[]` for the rest.
   * Each row goes through manual_correction + its own audit event.
   */
  @Post('correct-bulk')
  correctBulk(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    if (!isTeacherOrAbove(user?.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    const parsed = CorrectBulkSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.correctBulk(parsed.data, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  /**
   * Attendance history for a class. Teacher-or-above only — without this,
   * any logged-in student could enumerate the historical attendance of every
   * class in the school by guessing classIds.
   */
  @Get('history')
  history(
    @Query('classId') classId: string,
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!isTeacherOrAbove(user?.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }
    if (!classId) throw new BadRequestException('classId required');
    return this.svc.historyForClass(
      { id: user.id, role: user.role, ip: null },
      classId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
