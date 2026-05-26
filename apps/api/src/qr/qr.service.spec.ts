import { describe, it, expect, vi, beforeAll } from 'vitest';
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
