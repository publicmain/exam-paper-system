import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../common/prisma.service';

export interface DecodedQrToken {
  sessionId: string;
  windowStartMs: number;
}

const TOKEN_VERSION = 'v1';
const SIG_LEN = 16;
const TOLERANCE_MS = 30_000;

@Injectable()
export class QrService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build the QR token shown on the big screen. Format:
   *   v1.<windowStartMs>.<hmac16>.<sessionId>
   * Each window is `qrRotationSeconds` long; the QR rotates that often, but
   * any window's token is also accepted up to TOLERANCE_MS after its end so
   * a student scanning at the boundary still gets through.
   */
  async currentToken(sessionId: string): Promise<{ token: string; expiresAt: number }> {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      select: { id: true, qrSecret: true, qrRotationSeconds: true, status: true },
    });
    if (!session) throw new NotFoundException('session_not_found');

    const rotateMs = session.qrRotationSeconds * 1000;
    const now = Date.now();
    const windowStart = Math.floor(now / rotateMs) * rotateMs;
    const sig = createHmac('sha256', session.qrSecret)
      .update(`${session.id}.${windowStart}`)
      .digest('hex')
      .slice(0, SIG_LEN);
    const token = `${TOKEN_VERSION}.${windowStart}.${sig}.${session.id}`;
    return { token, expiresAt: windowStart + rotateMs + TOLERANCE_MS };
  }

  /**
   * Verify and decode a QR token. Throws UnauthorizedException with a precise
   * error code on failure; returns the decoded payload on success.
   */
  async verify(rawToken: string): Promise<DecodedQrToken> {
    const parts = rawToken.split('.');
    if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) {
      throw new UnauthorizedException({ code: 'qr_malformed' });
    }
    const [, windowStartStr, providedSig, sessionId] = parts;
    const windowStart = Number(windowStartStr);
    if (!Number.isFinite(windowStart)) {
      throw new UnauthorizedException({ code: 'qr_malformed' });
    }
    if (providedSig.length !== SIG_LEN) {
      throw new UnauthorizedException({ code: 'qr_malformed' });
    }

    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      select: { id: true, qrSecret: true, qrRotationSeconds: true },
    });
    if (!session) {
      throw new UnauthorizedException({ code: 'qr_session_not_found' });
    }

    const rotateMs = session.qrRotationSeconds * 1000;
    const now = Date.now();
    if (now > windowStart + rotateMs + TOLERANCE_MS) {
      throw new UnauthorizedException({ code: 'qr_expired' });
    }
    if (now < windowStart - TOLERANCE_MS) {
      // Future window — clock-skew or replay attempt. Reject.
      throw new UnauthorizedException({ code: 'qr_from_future' });
    }

    const expected = createHmac('sha256', session.qrSecret)
      .update(`${session.id}.${windowStart}`)
      .digest('hex')
      .slice(0, SIG_LEN);
    const a = Buffer.from(providedSig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException({ code: 'qr_invalid' });
    }
    return { sessionId, windowStartMs: windowStart };
  }
}
