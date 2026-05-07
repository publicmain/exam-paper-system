import { BadRequestException, Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { Public } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { QrService } from './qr.service';

@Controller('qr')
export class QrController {
  constructor(private readonly prisma: PrismaService, private readonly qr: QrService) {}

  /**
   * Big-screen poll endpoint. Public so the display page can be opened without
   * a teacher login. Caller passes ?classId= to disambiguate when multiple
   * classes share a venue. We resolve to the (today, class, status=active)
   * session and emit its current rolling token.
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

    const today = startOfTodayUtc();
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const session = await this.prisma.morningQuizSession.findFirst({
      where: { classId, date: { gte: today, lt: tomorrow }, status: { in: ['active', 'scheduled'] } },
      orderBy: { date: 'desc' },
    });
    if (!session) throw new NotFoundException('no_session_today');
    return this.qr.currentToken(session.id);
  }
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
