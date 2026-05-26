import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QrController } from './qr.controller';

/**
 * r15-followup-27 — lock the "no silent fall-through to tomorrow" rule.
 *
 * Before the fix, /qr/current?classId=X filtered today's session by
 * `status IN (active, scheduled)`. A `cancelled` or `locked` today
 * session would be skipped, and the controller would happily return
 * TOMORROW's scheduled QR. Students scanning the displayed QR at 08:40
 * landed on tomorrow's session and saw `session_not_active` — the
 * confusing "早测窗口尚未开启或已结束" message on 2026-05-26.
 *
 * The fix: prefer today's session regardless of status whenever
 * today.quizEnd is still in the future. The display page renders the
 * right overlay from session.status (cancelled / locked / scheduled).
 *
 * These specs pin that contract.
 */
describe('QrController /current — today vs tomorrow selection', () => {
  let prisma: any;
  let qr: any;
  let ctl: QrController;

  beforeEach(() => {
    // Freeze "now" so test dates are deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-26T00:40:00Z')); // SGT 08:40
    qr = {
      currentToken: vi.fn().mockImplementation((id: string) =>
        Promise.resolve({ token: `tok:${id}`, sessionStatus: 'whatever', attendanceStart: '', expiresAt: 0 }),
      ),
    };
    prisma = { morningQuizSession: { findFirst: vi.fn(), findUnique: vi.fn() } };
    ctl = new QrController(prisma, qr);
  });
  afterEach(() => vi.useRealTimers());

  // Build a session row with sensible defaults.
  function sess(over: Partial<any>): any {
    return {
      id: 'sess_default',
      classId: 'cls_X',
      date: new Date('2026-05-26T00:00:00Z'),
      status: 'active',
      quizEnd: new Date('2026-05-26T01:00:00Z'), // SGT 09:00
      level: 'ielts_authentic',
      ...over,
    };
  }

  it('returns today active session as expected (happy path)', async () => {
    const today = sess({ id: 'sess_today', status: 'active' });
    prisma.morningQuizSession.findFirst.mockResolvedValueOnce(today); // todays
    await ctl.current('cls_X', undefined);
    expect(qr.currentToken).toHaveBeenCalledWith('sess_today');
  });

  it('returns today cancelled session — does NOT fall through to tomorrow', async () => {
    const today = sess({ id: 'sess_today', status: 'cancelled' });
    prisma.morningQuizSession.findFirst.mockResolvedValueOnce(today);
    await ctl.current('cls_X', undefined);
    expect(qr.currentToken).toHaveBeenCalledWith('sess_today');
    expect(prisma.morningQuizSession.findFirst).toHaveBeenCalledTimes(1); // never asked for tomorrow
  });

  it('returns today locked-but-quizEnd-future session — defensive, no fall through', async () => {
    const today = sess({
      id: 'sess_today',
      status: 'locked',
      // Pathological: locked even though quizEnd is still future. Bug or
      // manual admin tweak. We MUST still return today's session so the
      // display can show "已结束" instead of silently advancing the QR.
      quizEnd: new Date('2026-05-26T01:00:00Z'),
    });
    prisma.morningQuizSession.findFirst.mockResolvedValueOnce(today);
    await ctl.current('cls_X', undefined);
    expect(qr.currentToken).toHaveBeenCalledWith('sess_today');
  });

  it('falls through to tomorrow when today does NOT exist', async () => {
    const tomorrow = sess({
      id: 'sess_tomorrow',
      status: 'scheduled',
      date: new Date('2026-05-27T00:00:00Z'),
      quizEnd: new Date('2026-05-27T01:00:00Z'),
    });
    prisma.morningQuizSession.findFirst
      .mockResolvedValueOnce(null) // todays
      .mockResolvedValueOnce(tomorrow); // tomorrows
    await ctl.current('cls_X', undefined);
    expect(qr.currentToken).toHaveBeenCalledWith('sess_tomorrow');
  });

  it('falls through to tomorrow when today exists but quizEnd has passed', async () => {
    // Advance "now" to 09:15 SGT — past today's 09:00 quizEnd.
    vi.setSystemTime(new Date('2026-05-26T01:15:00Z'));
    const today = sess({ id: 'sess_today', status: 'locked' });
    const tomorrow = sess({
      id: 'sess_tomorrow',
      status: 'scheduled',
      date: new Date('2026-05-27T00:00:00Z'),
      quizEnd: new Date('2026-05-27T01:00:00Z'),
    });
    prisma.morningQuizSession.findFirst
      .mockResolvedValueOnce(today)
      .mockResolvedValueOnce(tomorrow);
    await ctl.current('cls_X', undefined);
    expect(qr.currentToken).toHaveBeenCalledWith('sess_tomorrow');
  });

  it('throws no_session_today_or_tomorrow when both windows are empty', async () => {
    prisma.morningQuizSession.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    await expect(ctl.current('cls_X', undefined)).rejects.toBeInstanceOf(NotFoundException);
  });
});
