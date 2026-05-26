import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { QrService } from './qr.service';

/**
 * Static (v2) printable-QR coverage. The v2 token encodes only a classId
 * + an HMAC, carries no timestamp, and never rotates — so it can be
 * printed once and stuck on a wall. These tests pin:
 *   - the token shape,
 *   - that a freshly-minted token verifies and resolves today's session,
 *   - that any tamper (signature OR classId swap) is rejected,
 *   - the precise error codes the scan page branches on.
 */
describe('QrService — v2 static printable QR', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-for-qr-spec';
  });

  function svc(todaySession: { id: string } | null) {
    const prisma: any = {
      morningQuizSession: {
        findFirst: vi.fn().mockResolvedValue(todaySession),
      },
    };
    return new QrService(prisma);
  }

  async function codeOf(p: Promise<unknown>): Promise<string> {
    try {
      await p;
      return '<no-throw>';
    } catch (e: any) {
      const r = typeof e.getResponse === 'function' ? e.getResponse() : e.response;
      return r?.code ?? '<no-code>';
    }
  }

  it('mints a v2.<classId>.<hmac16> token', () => {
    const token = svc(null).staticTokenForClass('cls_abc');
    expect(token).toMatch(/^v2\.cls_abc\.[0-9a-f]{16}$/);
  });

  it('is stable — same class always yields the same token (printable)', () => {
    const a = svc(null).staticTokenForClass('cls_abc');
    const b = svc(null).staticTokenForClass('cls_abc');
    expect(a).toBe(b);
  });

  it('verify accepts a freshly-minted token and resolves today\'s session', async () => {
    const s = svc({ id: 'sess_today' });
    const decoded = await s.verify(s.staticTokenForClass('cls_abc'));
    expect(decoded.sessionId).toBe('sess_today');
    // v2 carries no rotation window.
    expect(decoded.windowStartMs).toBeUndefined();
  });

  it('rejects a tampered signature with qr_invalid', async () => {
    const s = svc({ id: 'sess_today' });
    const token = s.staticTokenForClass('cls_abc');
    const tampered = token.slice(0, -1) + (token.endsWith('0') ? '1' : '0');
    expect(await codeOf(s.verify(tampered))).toBe('qr_invalid');
  });

  it('rejects a classId swap — sig was bound to the original class', async () => {
    const s = svc({ id: 'sess_today' });
    const token = s.staticTokenForClass('cls_AAA');
    const swapped = token.replace('cls_AAA', 'cls_BBB');
    expect(await codeOf(s.verify(swapped))).toBe('qr_invalid');
  });

  it('rejects a malformed v2 token (wrong part count) with qr_malformed', async () => {
    const s = svc({ id: 'x' });
    expect(await codeOf(s.verify('v2.onlytwo'))).toBe('qr_malformed');
  });

  it('throws qr_no_session_today when the class has no session today', async () => {
    const s = svc(null);
    expect(await codeOf(s.verify(s.staticTokenForClass('cls_abc')))).toBe(
      'qr_no_session_today',
    );
  });
});

/**
 * r15-followup-28 — the 2026-05-26 "极个别学生" timezone bug. Sessions
 * are dated by SGT calendar day. `resolveTodaySession` previously used
 * `now.getUTCDate()` to build the query range, so any student scanning
 * BEFORE 08:00 SGT (= midnight UTC) hit yesterday's range and landed
 * on yesterday's locked session → fetchRoster fired session_not_active
 * → "早测已结束" while they were standing at the wall at 07:50 SGT.
 *
 * These specs freeze the system clock at the crossover boundary and
 * verify the query range matches the SGT day, not the UTC day.
 */
describe('QrService — resolveTodaySession SGT/UTC crossover', () => {
  afterEach(() => vi.useRealTimers());

  function captureRangeSvc(): { svc: QrService; rangeArg: () => any } {
    let captured: any = null;
    const prisma: any = {
      morningQuizSession: {
        findFirst: vi.fn().mockImplementation((args: any) => {
          captured = args;
          return Promise.resolve({ id: 'sess_dummy' });
        }),
      },
    };
    return { svc: new QrService(prisma), rangeArg: () => captured };
  }

  it('07:55 SGT (= 23:55 UTC prev day) queries against SGT today, not UTC yesterday', async () => {
    // Real wall clock: 2026-05-26 07:55 SGT
    // UTC equivalent: 2026-05-25 23:55 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T23:55:00Z'));

    const { svc, rangeArg } = captureRangeSvc();
    await svc.verify(svc.staticTokenForClass('cls_X'));
    const r = rangeArg();
    expect(r.where.date.gte.toISOString()).toBe('2026-05-26T00:00:00.000Z'); // SGT today
    expect(r.where.date.lt.toISOString()).toBe('2026-05-27T00:00:00.000Z');  // SGT tomorrow
  });

  it('08:40 SGT (= 00:40 UTC same day) queries against the same SGT date', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T00:40:00Z'));

    const { svc, rangeArg } = captureRangeSvc();
    await svc.verify(svc.staticTokenForClass('cls_X'));
    const r = rangeArg();
    expect(r.where.date.gte.toISOString()).toBe('2026-05-26T00:00:00.000Z');
    expect(r.where.date.lt.toISOString()).toBe('2026-05-27T00:00:00.000Z');
  });

  it('23:30 SGT (= 15:30 UTC same day) still rolls to that SGT date (not next)', async () => {
    // Edge: late night, SGT date is still 5/26, UTC is also 5/26 (since
    // 15:30 UTC < 16:00 UTC = SGT midnight). Both agree — query SGT 5/26.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T15:30:00Z'));

    const { svc, rangeArg } = captureRangeSvc();
    await svc.verify(svc.staticTokenForClass('cls_X'));
    const r = rangeArg();
    expect(r.where.date.gte.toISOString()).toBe('2026-05-26T00:00:00.000Z');
  });

  it('00:30 SGT (= 16:30 UTC prev day) rolls to NEW SGT day (not prev UTC)', async () => {
    // Just past midnight SGT. UTC is still 5/25 16:30. Without the fix,
    // we'd query SGT 5/25; with the fix we correctly query SGT 5/26.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T16:30:00Z'));

    const { svc, rangeArg } = captureRangeSvc();
    await svc.verify(svc.staticTokenForClass('cls_X'));
    const r = rangeArg();
    expect(r.where.date.gte.toISOString()).toBe('2026-05-26T00:00:00.000Z');
  });
});
