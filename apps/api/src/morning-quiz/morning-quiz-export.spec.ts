import { describe, it, expect, vi } from 'vitest';
import * as ExcelJS from 'exceljs';
import { MorningQuizExportService } from './morning-quiz-export.service';

/**
 * R15-followup-14 — teacher fed back that the old 3-sheet workbook
 * (考勤明细 / 成绩明细 / 缺勤汇总) was confusing. New layout: ONE
 * pivot sheet, rows=students, columns=days, cell=按时/迟到/缺勤/—
 * with colour tint and a per-student week summary on the right.
 *
 * These tests pin the new shape so a future refactor doesn't quietly
 * revert it.
 */

function fakePrisma(over: {
  sessions?: any[];
  attendances?: any[];
  submissions?: any[];
}): any {
  const sessions = over.sessions ?? [];
  const attendances = over.attendances ?? [];
  const submissions = over.submissions ?? [];
  return {
    morningQuizSession: { findMany: vi.fn().mockResolvedValue(sessions) },
    attendance: { findMany: vi.fn().mockResolvedValue(attendances) },
    studentSubmission: { findMany: vi.fn().mockResolvedValue(submissions) },
  };
}

function fakeAudit() {
  return { log: vi.fn().mockResolvedValue(undefined) } as any;
}

const ACTOR = { id: 'u-teacher', role: 'teacher', ip: null };

async function workbookFromBuffer(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  return wb;
}

function makeSession(id: string, dateLocal: string, klass = 'Form 5B') {
  return {
    id,
    date: new Date(`${dateLocal}T00:00:00+08:00`),
    classId: 'c1',
    class: { id: 'c1', name: klass },
    paperAssignment: { paperId: 'p1', paper: { name: 'p1' } },
  };
}

function makeAttendance(over: {
  sessionId: string;
  studentId: string;
  studentName: string;
  status: 'on_time' | 'late' | 'absent';
}) {
  return {
    sessionId: over.sessionId,
    submissionId: null,
    studentId: over.studentId,
    status: over.status,
    scanTime: null,
    student: { id: over.studentId, name: over.studentName },
  };
}

describe('MorningQuizExportService — R15-followup-14 pivot view', () => {
  it('emits a "no data" sheet when the range has zero sessions', async () => {
    const svc = new MorningQuizExportService(fakePrisma({}) as any, fakeAudit());
    const buf = await svc.generateAttendanceWorkbook(
      { from: '2026-05-04', to: '2026-05-09' },
      ACTOR,
    );
    const wb = await workbookFromBuffer(buf);
    expect(wb.worksheets.length).toBe(1);
    expect(wb.worksheets[0].name).toContain('No Data');
  });

  it('produces exactly ONE sheet named "考勤 Attendance" — no Score/Absence sheets', async () => {
    const svc = new MorningQuizExportService(
      fakePrisma({
        sessions: [makeSession('s1', '2026-05-12')],
        attendances: [
          makeAttendance({ sessionId: 's1', studentId: 'u-a', studentName: 'Alice', status: 'on_time' }),
        ],
      }) as any,
      fakeAudit(),
    );
    const buf = await svc.generateAttendanceWorkbook(
      { from: '2026-05-12', to: '2026-05-15' },
      ACTOR,
    );
    const wb = await workbookFromBuffer(buf);
    expect(wb.worksheets.length).toBe(1);
    expect(wb.worksheets[0].name).toContain('考勤');
    // The old score / absence sheet names must NOT appear.
    const names = wb.worksheets.map((w) => w.name);
    expect(names.find((n) => /成绩|Scores/.test(n))).toBeUndefined();
    expect(names.find((n) => /缺勤汇总|Absences/.test(n))).toBeUndefined();
  });

  it('one row per student, one column per distinct session date, cells show 按时/迟到/缺勤/—', async () => {
    const sessions = [
      makeSession('s-mon', '2026-05-12'),
      makeSession('s-tue', '2026-05-13'),
      makeSession('s-wed', '2026-05-14'),
    ];
    const attendances = [
      // Alice: on_time Mon, late Tue, absent Wed
      makeAttendance({ sessionId: 's-mon', studentId: 'u-a', studentName: 'Alice', status: 'on_time' }),
      makeAttendance({ sessionId: 's-tue', studentId: 'u-a', studentName: 'Alice', status: 'late' }),
      makeAttendance({ sessionId: 's-wed', studentId: 'u-a', studentName: 'Alice', status: 'absent' }),
      // Bob: on_time all 3 days
      makeAttendance({ sessionId: 's-mon', studentId: 'u-b', studentName: 'Bob', status: 'on_time' }),
      makeAttendance({ sessionId: 's-tue', studentId: 'u-b', studentName: 'Bob', status: 'on_time' }),
      makeAttendance({ sessionId: 's-wed', studentId: 'u-b', studentName: 'Bob', status: 'on_time' }),
    ];
    const svc = new MorningQuizExportService(
      fakePrisma({ sessions, attendances }) as any,
      fakeAudit(),
    );
    const buf = await svc.generateAttendanceWorkbook(
      { from: '2026-05-12', to: '2026-05-15' },
      ACTOR,
    );
    const wb = await workbookFromBuffer(buf);
    const sheet = wb.worksheets[0];

    // Header row has student + class + 3 dates + 3 summary cols = 8 cols.
    const header = sheet.getRow(1);
    expect(String(header.getCell(1).value)).toContain('学生');
    expect(String(header.getCell(2).value)).toContain('班级');
    expect(String(header.getCell(3).value)).toContain('2026-05-12');
    expect(String(header.getCell(4).value)).toContain('2026-05-13');
    expect(String(header.getCell(5).value)).toContain('2026-05-14');
    expect(String(header.getCell(6).value)).toContain('按时');
    expect(String(header.getCell(7).value)).toContain('迟到');
    expect(String(header.getCell(8).value)).toContain('缺勤');

    // Row 2 = Alice (sorted by name within class). Cells 3-5 = 按时/迟到/缺勤.
    const alice = sheet.getRow(2);
    expect(String(alice.getCell(1).value)).toBe('Alice');
    expect(String(alice.getCell(3).value)).toBe('按时');
    expect(String(alice.getCell(4).value)).toBe('迟到');
    expect(String(alice.getCell(5).value)).toBe('缺勤');
    expect(Number(alice.getCell(6).value)).toBe(1); // on_time count
    expect(Number(alice.getCell(7).value)).toBe(1); // late count
    expect(Number(alice.getCell(8).value)).toBe(1); // absent count

    // Row 3 = Bob. All on_time.
    const bob = sheet.getRow(3);
    expect(String(bob.getCell(1).value)).toBe('Bob');
    expect(String(bob.getCell(3).value)).toBe('按时');
    expect(Number(bob.getCell(6).value)).toBe(3);

    // Row 4 = 合计 Total row with per-day breakdown.
    const total = sheet.getRow(4);
    expect(String(total.getCell(1).value)).toContain('合计');
    expect(String(total.getCell(3).value)).toContain('按时2');
    expect(String(total.getCell(4).value)).toContain('迟1');
    expect(String(total.getCell(5).value)).toContain('缺1');
  });

  it('cells get colour fills by status (on_time/late/absent/no-session)', async () => {
    const sessions = [makeSession('s-mon', '2026-05-12')];
    const attendances = [
      makeAttendance({ sessionId: 's-mon', studentId: 'u-a', studentName: 'Alice', status: 'on_time' }),
      makeAttendance({ sessionId: 's-mon', studentId: 'u-b', studentName: 'Bob', status: 'late' }),
      makeAttendance({ sessionId: 's-mon', studentId: 'u-c', studentName: 'Carol', status: 'absent' }),
    ];
    const svc = new MorningQuizExportService(
      fakePrisma({ sessions, attendances }) as any,
      fakeAudit(),
    );
    const buf = await svc.generateAttendanceWorkbook(
      { from: '2026-05-12', to: '2026-05-12' },
      ACTOR,
    );
    const wb = await workbookFromBuffer(buf);
    const sheet = wb.worksheets[0];

    const aliceCell: any = sheet.getRow(2).getCell(3);
    const bobCell: any = sheet.getRow(3).getCell(3);
    const carolCell: any = sheet.getRow(4).getCell(3);
    expect(aliceCell.fill?.fgColor?.argb).toBe('FFD1FAE5'); // emerald
    expect(bobCell.fill?.fgColor?.argb).toBe('FFFEF3C7'); // amber
    expect(carolCell.fill?.fgColor?.argb).toBe('FFFEE2E2'); // rose
  });

  it('dedupes multi-level same-day attendance (student can only sit one band)', async () => {
    // Same student on the same calendar day has two attendance rows (rare —
    // happens when a class registers multiple English bands and an admin
    // accidentally creates both attendance rows for one student). The
    // strongest signal should win: on_time > late > absent.
    const sessions = [
      makeSession('s-auth', '2026-05-12', 'G11 IELTS'),
      makeSession('s-simp', '2026-05-12', 'G11 IELTS'),
    ];
    const attendances = [
      makeAttendance({ sessionId: 's-auth', studentId: 'u-x', studentName: 'X', status: 'absent' }),
      makeAttendance({ sessionId: 's-simp', studentId: 'u-x', studentName: 'X', status: 'on_time' }),
    ];
    const svc = new MorningQuizExportService(
      fakePrisma({ sessions, attendances }) as any,
      fakeAudit(),
    );
    const buf = await svc.generateAttendanceWorkbook(
      { from: '2026-05-12', to: '2026-05-12' },
      ACTOR,
    );
    const wb = await workbookFromBuffer(buf);
    const sheet = wb.worksheets[0];
    // Row 2 = X. Column layout with 1 date column:
    //   1=学生, 2=班级, 3=date, 4=按时Σ, 5=迟到Σ, 6=缺勤Σ
    expect(String(sheet.getRow(2).getCell(3).value)).toBe('按时');
    expect(Number(sheet.getRow(2).getCell(4).value)).toBe(1); // on_time count
    expect(Number(sheet.getRow(2).getCell(6).value)).toBe(0); // absent count = 0 (deduped away)
  });
});
