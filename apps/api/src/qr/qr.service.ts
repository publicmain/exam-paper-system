import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../common/prisma.service';

export interface DecodedQrToken {
  sessionId: string;
  /** v2 静态码扫到的是哪一张分身。三段式旧码为 'original'，
   *  四段式带标签的码为标签本身。v1 轮转码不涉及，为 undefined。 */
  qrVariant?: string;
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
/** 未带标签的三段式旧码在考勤里记成这个值。 */
export const ORIGINAL_VARIANT = 'original';

/** 标签只允许小写字母数字和连字符，长度 1-16，且不能叫 'original'
 *  （那是旧码的保留名）。带点会破坏 token 的分段解析。 */
export function normaliseVariant(v?: string | null): string | undefined {
  const s = (v ?? '').trim().toLowerCase();
  if (!s) return undefined;
  if (s === ORIGINAL_VARIANT) return undefined;
  return /^[a-z0-9-]{1,16}$/.test(s) ? s : undefined;
}
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
  staticTokenForClass(classId: string, variant?: string): string {
    const v = normaliseVariant(variant);
    return v
      ? `${STATIC_TOKEN_VERSION}.${classId}.${v}.${this.staticSig(classId, v)}`
      : `${STATIC_TOKEN_VERSION}.${classId}.${this.staticSig(classId)}`;
  }

  /**
   * 同一个班可以同时存在多张**都能用**的贴墙码，靠 variant 区分。
   *
   * 用途：贴墙码固定不变，学生可以拍照带回家扫，考勤无从分辨人是否
   * 真的在墙前。换一张带新标签的贴上去、不通知学生 —— 当天扫到旧
   * 标签的，用的必然是之前拍的照片。两张码扫起来体验完全一样。
   *
   * 不带 variant 时签发的仍是三段式旧码，已印出去的墙贴继续有效。
   */
  private staticSig(classId: string, variant?: string): string {
    const secret = process.env.JWT_SECRET ?? '';
    const v = normaliseVariant(variant);
    const input = v
      ? `qr-static.${STATIC_TOKEN_VERSION}.${classId}.${v}`
      : `qr-static.${STATIC_TOKEN_VERSION}.${classId}`;
    return createHmac('sha256', secret).update(input).digest('hex').slice(0, SIG_LEN);
  }

  /**
   * Resolve the morning-quiz session a static (classId-only) QR should
   * attach to right now. A class runs up to one session per English
   * level per day; we return any one of today's as the anchor — the scan
   * page's sibling-session logic surfaces the rest for the level picker.
   *
   * "Today" = the current UTC calendar date. The attendance window opens
   * 08:30 SGT == 00:30 UTC of the SAME date, so a session dated
   * 2026-05-20 is the one a student scans on the morning of 2026-05-20.
   * Status is intentionally NOT filtered here: returning a scheduled /
   * locked session lets the downstream fetchRoster / scanQr checks emit
   * the precise `session_not_active` error with the real status, instead
   * of a vague "no session" here.
   */
  private async resolveTodaySession(classId: string): Promise<{ id: string } | null> {
    const now = new Date();
    const todayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const tomorrowUtc = new Date(todayUtc.getTime() + 86_400_000);
    const today = await this.prisma.morningQuizSession.findFirst({
      where: { classId, date: { gte: todayUtc, lt: tomorrowUtc } },
      orderBy: { level: 'asc' },
      select: { id: true },
    });
    if (today) return today;

    // 【测试】常驻测试窗（2026-08-26 教师要求）：测试班的贴墙码不受
    // 「只认当天场次」限制 —— 今天没有就退回**最近一场**。教师随时扫
    // 随时进，不必每天给测试班排课。真实班级绝不走这里：日期锚定是
    // 「扫昨天截图的码进不了今天的场」这条防线的一部分。
    const klass = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { name: true },
    });
    if (!klass?.name.startsWith('【测试】')) return null;
    return this.prisma.morningQuizSession.findFirst({
      where: { classId },
      orderBy: { date: 'desc' },
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
      // 三段 = 原始码；四段 = 带标签的分身码。两者都有效，
      // 学生扫起来没有任何差别，后台能分辨扫的是哪一张。
      if (parts.length !== 3 && parts.length !== 4) {
        throw new UnauthorizedException({ code: 'qr_malformed' });
      }
      const classId = parts[1];
      const variant = parts.length === 4 ? parts[2] : undefined;
      const providedSig = parts[parts.length - 1];
      if (!classId || providedSig.length !== SIG_LEN) {
        throw new UnauthorizedException({ code: 'qr_malformed' });
      }
      if (variant !== undefined && normaliseVariant(variant) !== variant) {
        throw new UnauthorizedException({ code: 'qr_malformed' });
      }
      const expected = this.staticSig(classId, variant);
      const a = Buffer.from(providedSig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new UnauthorizedException({ code: 'qr_invalid' });
      }
      const session = await this.resolveTodaySession(classId);
      if (!session) {
        throw new UnauthorizedException({ code: 'qr_no_session_today' });
      }
      return { sessionId: session.id, qrVariant: variant ?? ORIGINAL_VARIANT };
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
