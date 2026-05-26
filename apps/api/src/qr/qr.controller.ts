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

    // r15-followup-27 — DO NOT silently fall through to tomorrow while
    // today's window is still notionally live. The previous behaviour
    //   status: { in: ['active', 'scheduled'] }
    // would skip today's session whenever it was `cancelled` or `locked`
    // and project tomorrow's QR instead. Students standing at the wall
    // 08:40 still scan (the "明早" overlay is 70% white + blur, but QR
    // codes punch through with 15% error correction), land on tomorrow's
    // scheduled session, and see "早测窗口尚未开启或已结束" — the exact
    // confusing report we received on 2026-05-26.
    //
    // New rule:
    //   1. Look at today's session FIRST regardless of status. If it
    //      exists AND its quizEnd is still in the future, return it; the
    //      display page renders the right overlay from session.status
    //      (scheduled → countdown, cancelled → "已取消", locked
    //      shouldn't happen yet because quizEnd > now).
    //   2. Only if today has no session, OR today's quizEnd has passed,
    //      fall through to a *scheduled* tomorrow session for the
    //      overnight-projector workflow.
    //
    // Multi-level classes: pick the session whose level sorts first
    // (ielts_authentic < ielts_simplified < olevel). The scan page's
    // sibling-picker surfaces the rest, so a single QR still covers all
    // bands.
    const now = new Date();
    const today = startOfTodayUtc();
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const dayAfterTomorrow = new Date(today.getTime() + 2 * 86_400_000);

    const todaysSession = await this.prisma.morningQuizSession.findFirst({
      where: { classId, date: { gte: today, lt: tomorrow } },
      orderBy: { level: 'asc' },
    });
    if (todaysSession && todaysSession.quizEnd > now) {
      return this.qr.currentToken(todaysSession.id);
    }

    const tomorrowsSession = await this.prisma.morningQuizSession.findFirst({
      where: {
        classId,
        date: { gte: tomorrow, lt: dayAfterTomorrow },
        status: { in: ['active', 'scheduled'] },
      },
      orderBy: { level: 'asc' },
    });
    if (!tomorrowsSession) throw new NotFoundException('no_session_today_or_tomorrow');
    return this.qr.currentToken(tomorrowsSession.id);
  }

  /**
   * Static, printable QR token for a class.
   *
   * @Public — same rationale as /current: the QR-display surface runs
   * anonymously. The returned token is meant to be printed in public, so
   * it isn't a secret; the endpoint just hands back what /qr-print renders.
   *
   * Unlike /current this token never changes — print it once, stick it on
   * a wall, and the morning scan resolves to that day's session at scan
   * time. No overnight laptop / projector.
   */
  @Public()
  @Get('static')
  async static(@Query('classId') classId?: string) {
    if (!classId) throw new BadRequestException('classId required');
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true },
    });
    if (!cls) throw new NotFoundException('class_not_found');
    return {
      classId: cls.id,
      className: cls.name,
      token: this.qr.staticTokenForClass(cls.id),
    };
  }
}

/**
 * The SGT (school timezone) calendar day represented as the UTC instant
 * at SGT midnight. Sessions are dated by SGT day (attendanceStart 08:30
 * SGT → SGT-dated DATE column), so "today" must be the school's day, not
 * the server's UTC day. See r15-followup-28: the previous UTC version
 * silently shifted "today" by one day for any caller invoked between
 * 00:00 SGT and 08:00 SGT (= the UTC-midnight crossover window).
 */
function startOfTodayUtc(): Date {
  const tzOffMin = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
  const localNow = new Date(Date.now() + tzOffMin * 60_000);
  return new Date(
    Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()),
  );
}
