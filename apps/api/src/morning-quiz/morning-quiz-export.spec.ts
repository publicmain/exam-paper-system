import { describe, it, expect, vi } from 'vitest';
import * as ExcelJS from 'exceljs';
import { MorningQuizExportService } from './morning-quiz-export.service';

/** Black-box test of the workbook generator. We stub PrismaService with
 *  hand-crafted rows and read the resulting xlsx back in to assert on
 *  cells. Round-7 H37 + paperId-label + absent-F polish. */

function fakePrisma(over: {
  sessions?: any[];
  attendances?: any[];
  submissions?: any[];
}): any {
  const sessions = over.sessions ?? [];
  const attendances = over.attendances ?? [];
  const submissions = over.submissions ?? [];
  return {
    morningQuizSession: {
      findMany: vi.fn().mockResolvedValue(sessions),
    },
    attendance: {
      findMany: vi.fn().mockResolvedValue(attendances),
    },
    studentSubmission: {
      findMany: vi.fn().mockResolvedValue(submissions),
    },
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

describe('MorningQuizExportService', () => {
  it('emits a "no data" sheet when the range has zero sessions (H37)', async () => {
    const svc = new MorningQuizExportService(fakePrisma({}) as any, fakeAudit());
    const buf = await svc.generateAttendanceWorkbook(
      { from: '2026-05-04', to: '2026-05-09' },
      ACTOR,
    );
    const wb = await workbookFromBuffer(buf);
    expect(wb.worksheets.length).toBe(1);
    expect(wb.worksheets[0].name).toContain('No Data');
    // Header + 3 explanation rows.
    expect(wb.worksheets[0].rowCount).toBeGreaterThanOrEqual(2);
  });

  it('Sheet 2 Paper column shows paper.name not the cuid', async () => {
    const sess = {
      id: 'sess-1',
      date: new Date('2026-05-05T00:00:00+08:00'),
      classId: 'c1',
      class: { id: 'c1', name: 'Form 5B' },
      paperAssignment: {
        paperId: 'paper-cuid-abcdef',
        paper: { name: 'Morning Quiz IELTS/8/T1/P1 (2026-05-05)' },
      },
    };
    const sub = {
      id: 'sub-1',
      submittedAt: new Date('2026-05-05T00:35:00+08:00'),
      scripts: [{ paperQuestionId: 'pq1', selectedOption: 'A', autoCorrect: true, awardedMarks: 1 }],
    };
    const att = {
      sessionId: 'sess-1',
      submissionId: 'sub-1',
      studentId: 'u-stu',
      status: 'on_time',
      scanTime: new Date('2026-05-05T00:30:00+08:00'),
      student: { id: 'u-stu', name: 'Alice' },
    };
    const svc = new MorningQuizExportService(
      fakePrisma({ sessions: [sess], attendances: [att], submissions: [sub] }) as any,
      fakeAudit(),
    );
    const buf = await svc.generateAttendanceWorkbook(
      { from: '2026-05-04', to: '2026-05-09' },
      ACTOR,
    );
    const wb = await workbookFromBuffer(buf);
    const scores = wb.getWorksheet('成绩明细 Scores');
    if (!scores) throw new Error('Scores sheet missing');
    // Header row + 1 data row.
    const row = scores.getRow(2);
    const paperCell = row.getCell(4).value;
    expect(String(paperCell)).toContain('Morning Quiz IELTS/8/T1/P1');
    expect(String(paperCell)).not.toContain('paper-cuid');
  });

  it('does NOT emit a 0/0/F row in Scores for absent students', async () => {
    const sess = {
      id: 'sess-2',
      date: new Date('2026-05-06T00:00:00+08:00'),
      classId: 'c1',
      class: { id: 'c1', name: 'Form 5B' },
      paperAssignment: { paperId: 'p2', paper: { name: 'p2' } },
    };
    // submission row exists but student was marked absent (rare but
    // possible if attendance was corrected after they walked out).
    const sub = { id: 'sub-2', submittedAt: null, scripts: [] };
    const att = {
      sessionId: 'sess-2',
      submissionId: 'sub-2',
      studentId: 'u-bob',
      status: 'absent',
      scanTime: null,
      student: { id: 'u-bob', name: 'Bob' },
    };
    const svc = new MorningQuizExportService(
      fakePrisma({ sessions: [sess], attendances: [att], submissions: [sub] }) as any,
      fakeAudit(),
    );
    const buf = await svc.generateAttendanceWorkbook(
      { from: '2026-05-04', to: '2026-05-09' },
      ACTOR,
    );
    const wb = await workbookFromBuffer(buf);
    const scores = wb.getWorksheet('成绩明细 Scores');
    if (!scores) throw new Error('Scores sheet missing');
    // Only the header row should remain.
    expect(scores.rowCount).toBe(1);
  });

  it('shows — not F for an attended-but-empty submission', async () => {
    const sess = {
      id: 'sess-3',
      date: new Date('2026-05-07T00:00:00+08:00'),
      classId: 'c1',
      class: { id: 'c1', name: 'Form 5B' },
      paperAssignment: { paperId: 'p3', paper: { name: 'p3' } },
    };
    const sub = { id: 'sub-3', submittedAt: new Date(), scripts: [] };
    const att = {
      sessionId: 'sess-3',
      submissionId: 'sub-3',
      studentId: 'u-carol',
      status: 'on_time',
      scanTime: new Date(),
      student: { id: 'u-carol', name: 'Carol' },
    };
    const svc = new MorningQuizExportService(
      fakePrisma({ sessions: [sess], attendances: [att], submissions: [sub] }) as any,
      fakeAudit(),
    );
    const buf = await svc.generateAttendanceWorkbook(
      { from: '2026-05-04', to: '2026-05-09' },
      ACTOR,
    );
    const wb = await workbookFromBuffer(buf);
    const scores = wb.getWorksheet('成绩明细 Scores');
    if (!scores) throw new Error('Scores sheet missing');
    // Header + 1 row.
    const row = scores.getRow(2);
    const grade = row.getCell(9).value;
    expect(String(grade)).toBe('—');
  });
});
