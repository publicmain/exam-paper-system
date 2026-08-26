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

  function svc(
    todaySession: { id: string } | null,
    opts: { className?: string; latestSession?: { id: string } | null } = {},
  ) {
    // findFirst 第一次调用 = 今天的场次；测试班回退时的第二次调用 =
    // 最近一场（2026-08-26 常驻测试窗）
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(todaySession)
      .mockResolvedValue(opts.latestSession ?? null);
    const prisma: any = {
      morningQuizSession: { findFirst },
      class: {
        findUnique: vi.fn().mockResolvedValue({ name: opts.className ?? 'G11 真实班' }),
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

  // ── 【测试】常驻测试窗（2026-08-26）──

  it('测试班今天没场次 → 回退最近一场（教师随时能进）', async () => {
    const s = svc(null, { className: '【测试】作业功能测试班', latestSession: { id: 'sess_old' } });
    const decoded: any = await s.verify(s.staticTokenForClass('cls_test'));
    expect(decoded.sessionId).toBe('sess_old');
  });

  it('**真实班级绝不回退** —— 日期锚定是防重放的防线', async () => {
    // 学生拍昨天的码截图，今天没场次时绝不能落到昨天那场
    const s = svc(null, { className: 'G11 IELTS', latestSession: { id: 'sess_old' } });
    expect(await codeOf(s.verify(s.staticTokenForClass('cls_real')))).toBe(
      'qr_no_session_today',
    );
  });

  it('测试班今天有场次 → 用今天的，不碰回退', async () => {
    const s = svc({ id: 'sess_today' }, { className: '【测试】作业功能测试班', latestSession: { id: 'sess_old' } });
    const decoded: any = await s.verify(s.staticTokenForClass('cls_test'));
    expect(decoded.sessionId).toBe('sess_today');
  });
});
