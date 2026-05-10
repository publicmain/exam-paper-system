import { describe, it, expect, vi } from 'vitest';
import { TeacherTodoService } from './teacher-todo.service';

/**
 * R10-Track2 — verify the teacher-todo dashboard now delegates the
 * "consecutive absent students" count to AbsenceAlertService instead of
 * carrying its own diverging implementation. Round-9 found a 35 vs 0
 * mismatch between the two surfaces; this test pins them together.
 */

function fakePrisma(): any {
  return {
    paper: { findMany: vi.fn().mockResolvedValue([]) },
    answerScript: { findMany: vi.fn().mockResolvedValue([]) },
    morningQuizSession: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

describe('TeacherTodoService.findConsecutiveAbsents (R10-Track2)', () => {
  it('returns the same shape AbsenceAlertService.findCurrentStreaks returns, mapped to summary', async () => {
    const absence: any = {
      findCurrentStreaks: vi.fn().mockResolvedValue([
        {
          studentId: 'u1', studentName: 'Alice',
          classId: 'c1', className: 'G11',
          consecutiveDays: 5,
          firstAbsentDate: '2026-04-30', lastAbsentDate: '2026-05-08',
        },
      ]),
    };
    const svc = new TeacherTodoService(fakePrisma(), absence);
    const out = await svc.today();
    expect(absence.findCurrentStreaks).toHaveBeenCalled();
    expect(out.consecutiveAbsentStudents).toEqual([
      { studentId: 'u1', studentName: 'Alice', streakDays: 5, lastAbsentDate: '2026-05-08' },
    ]);
    expect(out.summary.consecutiveAbsentStudents).toBe(1);
  });

  it('returns empty (zero count) when AbsenceAlertService returns empty — fixes 35-vs-0 mismatch', async () => {
    const absence: any = {
      findCurrentStreaks: vi.fn().mockResolvedValue([]),
    };
    const svc = new TeacherTodoService(fakePrisma(), absence);
    const out = await svc.today();
    expect(out.consecutiveAbsentStudents).toEqual([]);
    expect(out.summary.consecutiveAbsentStudents).toBe(0);
  });

  it('does NOT call prisma.user.findMany or prisma.attendance.findMany — algo is fully delegated', async () => {
    const prisma = fakePrisma();
    // user / attendance must not be on the prisma surface for this path.
    prisma.user = { findMany: vi.fn() };
    prisma.attendance = { findMany: vi.fn() };
    const absence: any = { findCurrentStreaks: vi.fn().mockResolvedValue([]) };
    const svc = new TeacherTodoService(prisma, absence);
    await svc.today();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.attendance.findMany).not.toHaveBeenCalled();
  });
});
