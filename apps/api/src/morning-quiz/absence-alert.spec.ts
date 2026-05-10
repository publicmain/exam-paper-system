import { describe, it, expect, vi } from 'vitest';
import { AbsenceAlertService } from './absence-alert.service';

/** R10-Track2 — pin the "current streak only" semantics that distinguish
 *  this from the bespoke teacher-todo implementation we just deleted. */

function svcWithSessions(sessions: any[]): AbsenceAlertService {
  const prisma: any = {
    morningQuizSession: { findMany: vi.fn().mockResolvedValue(sessions) },
    auditLog: { findFirst: vi.fn() },
  };
  return new AbsenceAlertService(prisma, {} as any, {} as any);
}

function makeSession(date: string, classId: string, attendances: Array<{ studentId: string; status: 'on_time' | 'late' | 'absent'; name: string }>) {
  return {
    classId,
    date: new Date(date + 'T00:00:00Z'),
    class: { id: classId, name: 'G11' },
    attendances: attendances.map((a) => ({
      studentId: a.studentId,
      status: a.status,
      student: { id: a.studentId, name: a.name },
    })),
  };
}

describe('AbsenceAlertService.findCurrentStreaks (R10-Track2 semantics)', () => {
  it('flags a student with 3 consecutive absent sessions reaching the most recent', async () => {
    const sessions = [
      makeSession('2026-05-06', 'c1', [{ studentId: 'u1', name: 'A', status: 'absent' }]),
      makeSession('2026-05-07', 'c1', [{ studentId: 'u1', name: 'A', status: 'absent' }]),
      makeSession('2026-05-08', 'c1', [{ studentId: 'u1', name: 'A', status: 'absent' }]),
    ];
    const svc = svcWithSessions(sessions);
    const out = await svc.findCurrentStreaks(3, new Date('2026-05-09T00:00:00Z'));
    expect(out).toHaveLength(1);
    expect(out[0].consecutiveDays).toBe(3);
    expect(out[0].studentId).toBe('u1');
  });

  it('does NOT flag a student who came back present on the most recent day (current-streak semantics)', async () => {
    const sessions = [
      makeSession('2026-05-06', 'c1', [{ studentId: 'u1', name: 'A', status: 'absent' }]),
      makeSession('2026-05-07', 'c1', [{ studentId: 'u1', name: 'A', status: 'absent' }]),
      makeSession('2026-05-08', 'c1', [{ studentId: 'u1', name: 'A', status: 'absent' }]),
      makeSession('2026-05-09', 'c1', [{ studentId: 'u1', name: 'A', status: 'on_time' }]),
    ];
    const svc = svcWithSessions(sessions);
    const out = await svc.findCurrentStreaks(3, new Date('2026-05-10T00:00:00Z'));
    expect(out).toEqual([]);
  });

  it('does NOT flag a student below threshold', async () => {
    const sessions = [
      makeSession('2026-05-08', 'c1', [{ studentId: 'u1', name: 'A', status: 'absent' }]),
      makeSession('2026-05-09', 'c1', [{ studentId: 'u1', name: 'A', status: 'absent' }]),
    ];
    const svc = svcWithSessions(sessions);
    const out = await svc.findCurrentStreaks(3, new Date('2026-05-10T00:00:00Z'));
    expect(out).toEqual([]);
  });

  it('returns empty list when there are no recent sessions (e.g. school not yet in session)', async () => {
    // This is the actual production state observed in round-9: future sessions
    // scheduled, no past sessions in the 14-day window → 0 streaks.
    const svc = svcWithSessions([]);
    const out = await svc.findCurrentStreaks(3, new Date('2026-05-10T00:00:00Z'));
    expect(out).toEqual([]);
  });

  it('weekends/holidays are implicitly excluded — only days with sessions count', async () => {
    // Only Mon/Tue/Wed have sessions; Sat/Sun have no rows. Algorithm walks
    // session list, so weekends never enter the streak calculation.
    const sessions = [
      makeSession('2026-05-04', 'c1', [{ studentId: 'u1', name: 'A', status: 'absent' }]), // Mon
      makeSession('2026-05-05', 'c1', [{ studentId: 'u1', name: 'A', status: 'absent' }]), // Tue
      makeSession('2026-05-06', 'c1', [{ studentId: 'u1', name: 'A', status: 'absent' }]), // Wed
      // Thu/Fri no session (national holiday) — gap is OK
    ];
    const svc = svcWithSessions(sessions);
    const out = await svc.findCurrentStreaks(3, new Date('2026-05-10T00:00:00Z'));
    expect(out).toHaveLength(1);
    expect(out[0].consecutiveDays).toBe(3);
  });
});
