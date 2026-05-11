import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { IpAllowlistGuard } from '../wifi-gate/ip-allowlist.guard';
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
   * @UseGuards(IpAllowlistGuard) — but the request MUST come from the
   * school's egress IP. Without this gate the QR display page would be
   * world-readable, which would let a remote attacker prefetch QR tokens
   * and phish students; the existing /scan IP gate would still reject the
   * scan, but exposing the QR feed at all is unnecessary risk.
   *
   * Net effect: open /display from a home network → 403 from this API →
   * the React page renders a "请连接学校 WiFi" message.
   */
  @Public()
  @UseGuards(IpAllowlistGuard)
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
