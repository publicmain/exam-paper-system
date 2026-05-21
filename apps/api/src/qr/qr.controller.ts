import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { Public } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { QrService } from './qr.service';

@Controller('qr')
export class QrController {
  constructor(private readonly prisma: PrismaService, private readonly qr: QrService) {}

  /**
   * Big-screen poll endpoint.
   *
   * @Public — no JWT required (the venue laptop runs anonymously, the
   * Display page just opens the URL).
   *
   * The QR token this returns is short-lived (rotates every
   * qrRotationSeconds) and only useful while the session is `active`,
   * so the QR feed being reachable off-network is low-risk: a scan
   * still has to pass QR freshness + roster + attendance-window checks,
   * and in-room invigilation is the real backstop.
   */
  @Public()
  @Get('current')
  async current(@Query('classId') classId?: string, @Query('sessionId') sessionId?: string) {
    if (sessionId) {
      const s = await this.prisma.morningQuizSession.findUnique({ where: { id: sessionId } });
      if (!s) throw new NotFoundException('session_not_found');
      return this.qr.currentToken(sessionId);
    }
    if (!classId) throw new BadRequestException('classId or sessionId required');

    // Look ahead 48h: pick today's session if still serviceable
    // (status active or scheduled), otherwise auto-fall-through to
    // tomorrow's. Lets a venue laptop be left running overnight pointed
    // at /display?classId=X — the QR for tomorrow morning's quiz appears
    // as soon as today's session locks (or right away after the previous
    // day's session is done), no re-opening required.
    //
    // Order by date asc so today wins if it's still scheduled/active;
    // only fall through to tomorrow when today is past (locked).
    const today = startOfTodayUtc();
    const dayAfterTomorrow = new Date(today.getTime() + 2 * 86_400_000);
    const session = await this.prisma.morningQuizSession.findFirst({
      where: {
        classId,
        date: { gte: today, lt: dayAfterTomorrow },
        status: { in: ['active', 'scheduled'] },
      },
      orderBy: { date: 'asc' },
    });
    if (!session) throw new NotFoundException('no_session_today_or_tomorrow');
    return this.qr.currentToken(session.id);
  }
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
