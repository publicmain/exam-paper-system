import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../common/prisma.service';

export interface DecodedQrToken {
  sessionId: string;
  /** Only present for v1 rotating tokens — the rotation window the token
   *  was minted in. Absent for v2 static tokens, which carry no timestamp. */
  windowStartMs?: number;
}

const TOKEN_VERSION = 'v1';
// v2 — permanent, printable QR. Encodes only the classId (no timestamp,
// no per-session secret) so it can be generated for any class far in
// advance, printed once, and stuck on a wall. The scan-time session is
// resolved by (classId, today's date). See `staticTokenForClass` /
// the v2 branch of `verify`.
const STATIC_TOKEN_VERSION = 'v2';
const SIG_LEN = 16;
// Tolerance window after a QR token's rotation window ends, during which
// the server still accepts the token. The display rotates every
// qrRotationSeconds (default 15s), but a student takes some seconds to
// (a) lift their phone, (b) trigger the scan, (c) tap into the page,
// (d) type their name + level. Real-world latency between "QR shown" and
// "scan API call" is commonly 30–60s on a busy morning. The original
// 30s tolerance + 15s window = 45s total acceptance, which was clipping
// legit scans and surfacing as "二维码失效" to students.
//
// 60s + 15s = 75s total acceptance — still tight enough to reject any
// QR screenshot saved from the previous day, but forgiving enough to let
// a slow first-time user (or one fumbling with the level picker) finish
// scanning before the token expires.
const TOLERANCE_MS = 60_000;

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
  async currentToken(sessionId: string): Promise<{
    token: string;
    expiresAt: number;
    /** Session lifecycle state — `scheduled` means the QR is shown but
     *  attendance won't be accepted until the cron flips it to `active`
     *  (T-30s before attendanceStart). Used by the display page to show
     *  a "waiting for tomorrow" overlay instead of a bare QR overnight. */
    sessionStatus: string;
    /** ISO timestamp of when attendance scan becomes valid. Lets the
     *  display page render a live countdown for the overnight workflow. */
    attendanceStart: string;
  }> {
    const session = await this.prisma.morningQuizSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        qrSecret: true,
        qrRotationSeconds: true,
        status: true,
        attendanceStart: true,
      },
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
    return {
      token,
      expiresAt: windowStart + rotateMs + TOLERANCE_MS,
      sessionStatus: session.status,
      attendanceStart: session.attendanceStart.toISOString(),
    };
  }

  /**
   * Build the permanent, printable QR token for a class. Format:
   *   v2.<classId>.<hmac16>
   *
   * No timestamp and no per-session secret — so this token is identical
   * every day and can be generated months ahead, printed once, and stuck
   * on a wall. No overnight laptop / projector needed.
   *
   * Signed with JWT_SECRET (domain-separated input so it can't collide
   * with an actual JWT) purely as an anti-garbage check — the classId
   * itself is not a secret (it's literally printed in public), the HMAC
   * just lets `verify` reject a hand-typed bogus token fast. Real
   * attendance integrity rests on the unchanged downstream gates:
   * attendance time window, roster membership, deviceUuid de-dup, and
   * in-room invigilation.
   *
   * Caveat: if JWT_SECRET is ever rotated, every printed v2 QR stops
   * verifying and must be reprinted. Acceptable — secret rotation is rare
   * and operationally loud.
   */
  staticTokenForClass(classId: string): string {
    return `${STATIC_TOKEN_VERSION}.${classId}.${this.staticSig(classId)}`;
  }

  private staticSig(classId: string): string {
    const secret = process.env.JWT_SECRET ?? '';
    return createHmac('sha256', secret)
      .update(`qr-static.${STATIC_TOKEN_VERSION}.${classId}`)
      .digest('hex')
      .slice(0, SIG_LEN);
  }

  /**
   * Resolve the morning-quiz session a static (classId-only) QR should
   * attach to right now. A class runs up to one session per English
   * level per day; we return any one of today's as the anchor — the scan
   * page's sibling-session logic surfaces the rest for the level picker.
   *
   * "Today" must be computed in the SCHOOL's wall-clock timezone (SGT),
   * not in UTC. The session's `date` column is the SGT calendar date
   * (because attendanceStart is 08:30 SGT, whose UTC instant 00:30 UTC
   * rounds to the SGT day in the @db.Date column). If we used UTC,
   * any student scanning before 08:00 SGT (= midnight UTC) would have
   * `now.getUTCDate()` return YESTERDAY, the query would return
   * yesterday's locked session, and fetchRoster would fire
   * `session_not_active` → the student sees "早测已结束" while
   * standing at the wall an hour before quiz time. This is the
   * 2026-05-26 "极个别学生" report — the few students who arrived
   * 07:30–07:55 SGT (the UTC midnight crossover window) and hit the
   * bug; the cohort that arrived 08:00+ saw the correct session.
   *
   * Status is intentionally NOT filtered here: returning a scheduled /
   * locked session lets the downstream fetchRoster / scanQr checks emit
   * the precise `session_not_active` error with the real status, instead
   * of a vague "no session" here.
   */
  private async resolveTodaySession(classId: string): Promise<{ id: string } | null> {
    const tzOffMin = Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60);
    const now = new Date();
    // Shift into the school's local timezone, then take that date.
    const localNow = new Date(now.getTime() + tzOffMin * 60_000);
    const todayLocalAsUtc = new Date(
      Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()),
    );
    const tomorrowLocalAsUtc = new Date(todayLocalAsUtc.getTime() + 86_400_000);
    return this.prisma.morningQuizSession.findFirst({
      where: { classId, date: { gte: todayLocalAsUtc, lt: tomorrowLocalAsUtc } },
      orderBy: { level: 'asc' },
      select: { id: true },
    });
  }

  /**
   * Verify and decode a QR token. Throws UnauthorizedException with a precise
   * error code on failure; returns the decoded payload on success.
   *
   * Two token families are accepted:
   *   v1.<windowStartMs>.<hmac>.<sessionId>  — rotating, on-screen QR
   *   v2.<classId>.<hmac>                    — static, printable QR
   */
  async verify(rawToken: string): Promise<DecodedQrToken> {
    const parts = rawToken.split('.');

    // ── v2 static token ────────────────────────────────────────────────
    if (parts[0] === STATIC_TOKEN_VERSION) {
      if (parts.length !== 3) {
        throw new UnauthorizedException({ code: 'qr_malformed' });
      }
      const [, classId, providedSig] = parts;
      if (!classId || providedSig.length !== SIG_LEN) {
        throw new UnauthorizedException({ code: 'qr_malformed' });
      }
      const expected = this.staticSig(classId);
      const a = Buffer.from(providedSig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new UnauthorizedException({ code: 'qr_invalid' });
      }
      const session = await this.resolveTodaySession(classId);
      if (!session) {
        throw new UnauthorizedException({ code: 'qr_no_session_today' });
      }
      return { sessionId: session.id };
    }

    // ── v1 rotating token ──────────────────────────────────────────────
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
