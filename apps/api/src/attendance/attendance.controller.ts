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
import { CurrentUser } from '../common/current-user.decorator';
import { IpAllowlistGuard } from '../wifi-gate/ip-allowlist.guard';
import { AttendanceService } from './attendance.service';

const ScanSchema = z.object({ qrToken: z.string().min(8).max(256) });

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
   * Student scans the big-screen QR. IpAllowlistGuard runs first (gate 1 —
   * must be on school WiFi). Remaining four gates run inside the service.
   */
  @UseGuards(IpAllowlistGuard)
  @Post('scan')
  scan(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = ScanSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.scanQr(parsed.data.qrToken, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
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
