import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { AttendanceStatus, EnglishLevel } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';

interface ActorCtx {
  id: string;
  role: string;
  ip: string | null;
}

interface ExportFilter {
  /** YYYY-MM-DD inclusive, school-local (Asia/Singapore +8). */
  from: string;
  /** YYYY-MM-DD inclusive. */
  to: string;
  /** Optional class filter; omit to export every class the user is allowed
   *  to see. Admin/head_teacher always sees everything. */
  classId?: string;
}

const HEADER_FILL = 'FF1E40AF'; // blue-700
const ZEBRA_FILL = 'FFF8FAFC'; // slate-50
// R15-followup-14 — status colour codes for the pivot cells. Light tint
// so a teacher can scan a row in a glance: emerald = on_time, amber =
// late, rose = absent, grey = no session that day.
const ON_TIME_FILL = 'FFD1FAE5'; // emerald-100
const LATE_FILL = 'FFFEF3C7'; // amber-100
const ABSENT_FILL = 'FFFEE2E2'; // rose-100
const NO_SESSION_FILL = 'FFF3F4F6'; // gray-100

/**
 * Excel export for the morning-quiz teacher dashboard.
 *
 * R15-followup-14 — was a 3-sheet workbook (attendance detail + score
 * detail + absence summary). Teacher feedback: "I only want to see
 * each day who was on_time / late / absent. Everything else is noise."
 *
 * New layout: ONE pivot sheet — rows = students, columns = days in
 * the export range. Cells show 按时/迟到/缺勤/— with a colour tint so
 * a teacher can spot a problem row at a glance. Summary columns on
 * the right tally each student's week (按时/迟到/缺勤 counts).
 *
 * Reads only — does not mutate any DB row. Audit-logged so we know who
 * pulled student data and when. Output is binary .xlsx; controllers
 * stream it back with the right MIME + filename.
 */
@Injectable()
export class MorningQuizExportService {
  private readonly logger = new Logger(MorningQuizExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async generateAttendanceWorkbook(filter: ExportFilter, actor: ActorCtx): Promise<Buffer> {
    if (!['admin', 'head_teacher', 'teacher'].includes(actor.role)) {
      throw new ForbiddenException({ code: 'teacher_required' });
    }

    const fromDate = new Date(`${filter.from}T00:00:00+08:00`);
    const toDate = new Date(`${filter.to}T23:59:59+08:00`);

    // Pull all the rows we need in three queries. We deliberately don't
    // join through Prisma here because the export ranges are user-driven
    // (typically 1-4 weeks) — easier to reason about row counts when each
    // table comes back independently.
    const sessions = await this.prisma.morningQuizSession.findMany({
      where: {
        date: { gte: fromDate, lte: toDate },
        ...(filter.classId ? { classId: filter.classId } : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        // Include paper.name so Sheet 2's "Paper" column shows a readable
        // label instead of the raw cuid. Round-7 H37+ user-feedback.
        paperAssignment: {
          select: {
            paperId: true,
            paper: { select: { name: true } },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { classId: 'asc' }],
    });

    const sessionIds = sessions.map((s) => s.id);
    const attendances = sessionIds.length
      ? await this.prisma.attendance.findMany({
          where: { sessionId: { in: sessionIds } },
          include: {
            student: { select: { id: true, name: true } },
          },
        })
      : [];

    const submissionIds = attendances
      .map((a) => a.submissionId)
      .filter((x): x is string => !!x);
    const submissions = submissionIds.length
      ? await this.prisma.studentSubmission.findMany({
          where: { id: { in: submissionIds } },
          include: {
            scripts: {
              select: {
                paperQuestionId: true,
                selectedOption: true,
                autoCorrect: true,
                awardedMarks: true,
              },
            },
          },
        })
      : [];

    const wb = new ExcelJS.Workbook();
    wb.creator = `morning-quiz-export by ${actor.role}`;
    wb.created = new Date();

    // Round-7 H37: empty date range used to silently produce a workbook
    // with three header-only sheets. Now we add a "READ ME" sheet that
    // makes the no-data state explicit so a teacher who downloaded the
    // wrong week sees why their workbook is empty.
    if (sessions.length === 0) {
      const empty = wb.addWorksheet('⚠️ 无数据 No Data');
      empty.columns = [{ header: '说明 / Note', key: 'note', width: 80 }];
      this.styleHeader(empty.getRow(1));
      empty.addRow({
        note:
          `导出范围: ${filter.from} → ${filter.to}` +
          (filter.classId ? `, 班级=${filter.classId}` : ''),
      });
      empty.addRow({ note: '该范围内没有任何 morning-quiz session 记录。' });
      empty.addRow({
        note: 'Possible causes: weekend-only range / class never scheduled / classId typo.',
      });
      const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
      return Buffer.from(buf);
    }

    // Index lookups
    const sessionById = new Map(sessions.map((s) => [s.id, s]));

    // R15-followup-14 — single pivot sheet: rows=students, columns=days
    // in the export range. Cells: 按时 / 迟到 / 缺勤 / — (no session).
    // Status colour tint so a teacher can scan a row visually.

    // 1) Build the set of distinct session dates within the filter range,
    //    sorted ascending. Skips weekends/no-session days automatically
    //    because we only include dates that actually have a session row.
    const dateKeys: string[] = [...new Set(sessions.map((s) => this.formatDate(s.date)))].sort();

    // 2) Build per-student aggregate: their class + a date→status map.
    //    Pull from `attendances` (only rows where the cron seeded an
    //    `absent` or where a real scan happened). A student who is
    //    enrolled but has no attendance row for a date shows as "—".
    interface PerStudent {
      studentId: string;
      name: string;
      className: string;
      byDate: Record<string, AttendanceStatus>;
      onTime: number;
      late: number;
      absent: number;
    }
    const perStudent = new Map<string, PerStudent>();
    for (const att of attendances) {
      const sess = sessionById.get(att.sessionId);
      if (!sess?.date) continue;
      const dateKey = this.formatDate(sess.date);
      const cur =
        perStudent.get(att.studentId) ??
        {
          studentId: att.student.id,
          name: att.student.name,
          className: sess.class.name,
          byDate: {} as Record<string, AttendanceStatus>,
          onTime: 0,
          late: 0,
          absent: 0,
        };
      // If two sessions on the same day (multi-level: a student can only
      // really sit one, but defensively pick the strongest signal:
      // on_time > late > absent).
      const prior = cur.byDate[dateKey];
      const score = (s: AttendanceStatus | undefined): number =>
        s === AttendanceStatus.on_time ? 3 : s === AttendanceStatus.late ? 2 : s === AttendanceStatus.absent ? 1 : 0;
      if (score(att.status) > score(prior)) {
        cur.byDate[dateKey] = att.status;
      }
      perStudent.set(att.studentId, cur);
    }
    // Recompute totals from the deduped byDate map (so a student listed in
    // two sessions on the same day doesn't get double-counted).
    for (const p of perStudent.values()) {
      p.onTime = 0;
      p.late = 0;
      p.absent = 0;
      for (const s of Object.values(p.byDate)) {
        if (s === AttendanceStatus.on_time) p.onTime++;
        else if (s === AttendanceStatus.late) p.late++;
        else if (s === AttendanceStatus.absent) p.absent++;
      }
    }

    // Sort: class then student name (so a teacher reading row-by-row sees
    // their class clustered together).
    const rows = [...perStudent.values()].sort((a, b) => {
      if (a.className !== b.className) return a.className.localeCompare(b.className);
      return a.name.localeCompare(b.name, 'zh');
    });

    // ─────── Single sheet: pivot view ───────
    const s = wb.addWorksheet('考勤 Attendance', {
      views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }],
    });
    const columns: Array<{ header: string; key: string; width: number }> = [
      { header: '学生 Student', key: 'student', width: 18 },
      { header: '班级 Class', key: 'className', width: 14 },
    ];
    for (const dk of dateKeys) {
      // Header like "2026-05-12\n周一" — date plus a Chinese weekday hint
      // so the teacher doesn't have to compute which day-of-week each
      // column is when scanning across.
      columns.push({ header: `${dk}\n${this.weekdayZh(dk)}`, key: `d_${dk}`, width: 14 });
    }
    columns.push({ header: '按时 Σ', key: 'sumOnTime', width: 8 });
    columns.push({ header: '迟到 Σ', key: 'sumLate', width: 8 });
    columns.push({ header: '缺勤 Σ', key: 'sumAbsent', width: 8 });
    s.columns = columns;
    this.styleHeader(s.getRow(1));
    s.getRow(1).height = 32;
    s.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    for (let i = 0; i < rows.length; i++) {
      const p = rows[i];
      const rowData: Record<string, string | number> = {
        student: p.name,
        className: p.className,
        sumOnTime: p.onTime,
        sumLate: p.late,
        sumAbsent: p.absent,
      };
      for (const dk of dateKeys) {
        rowData[`d_${dk}`] = this.statusShortZh(p.byDate[dk]);
      }
      const xlRow = s.addRow(rowData);
      // Colour-tint each date cell by status. ExcelJS uses 1-based column
      // indices; the first date column lives at columns.length - 3 from
      // the right (sumOnTime/Late/Absent occupy the last 3), so the
      // first date column index is 3 (after student + className).
      for (let dIdx = 0; dIdx < dateKeys.length; dIdx++) {
        const cell = xlRow.getCell(3 + dIdx);
        const st = p.byDate[dateKeys[dIdx]];
        const fill =
          st === AttendanceStatus.on_time
            ? ON_TIME_FILL
            : st === AttendanceStatus.late
            ? LATE_FILL
            : st === AttendanceStatus.absent
            ? ABSENT_FILL
            : NO_SESSION_FILL;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
      // Right-align the three summary count columns for easy scanning.
      const sumStart = 2 + dateKeys.length + 1; // 1-based: student(1) + class(2) + N dates + 1
      for (let k = 0; k < 3; k++) {
        xlRow.getCell(sumStart + k).alignment = { vertical: 'middle', horizontal: 'center' };
      }
    }

    // Total row at the bottom — per-day counts of on_time / late / absent
    // so a teacher can answer "how many late on Tuesday" at a glance.
    const totalRowData: Record<string, string | number> = {
      student: '合计 Total',
      className: `${rows.length} 人`,
      sumOnTime: rows.reduce((a, p) => a + p.onTime, 0),
      sumLate: rows.reduce((a, p) => a + p.late, 0),
      sumAbsent: rows.reduce((a, p) => a + p.absent, 0),
    };
    for (const dk of dateKeys) {
      let on = 0;
      let lt = 0;
      let ab = 0;
      for (const p of rows) {
        const st = p.byDate[dk];
        if (st === AttendanceStatus.on_time) on++;
        else if (st === AttendanceStatus.late) lt++;
        else if (st === AttendanceStatus.absent) ab++;
      }
      totalRowData[`d_${dk}`] = `按时${on} 迟${lt} 缺${ab}`;
    }
    const totalRow = s.addRow(totalRowData);
    totalRow.font = { bold: true };
    totalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }; // indigo-100
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'morning_quiz.export.attendance',
      entityType: 'MorningQuizSession',
      entityId: filter.classId ?? '*',
      ip: actor.ip,
      metadata: {
        from: filter.from,
        to: filter.to,
        classId: filter.classId ?? null,
        sessions: sessions.length,
        students: rows.length,
      },
    });

    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    return Buffer.from(buf);
  }

  // ───────────── helpers ─────────────

  private styleHeader(row: ExcelJS.Row) {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    row.alignment = { vertical: 'middle', horizontal: 'left' };
    row.height = 22;
  }

  private applyZebraRow(row: ExcelJS.Row) {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_FILL } };
    });
  }

  private formatDate(d: Date): string {
    // YYYY-MM-DD school-local
    const local = new Date(d.getTime() + 8 * 60 * 60_000);
    return local.toISOString().slice(0, 10);
  }

  private formatDateTime(d: Date): string {
    const local = new Date(d.getTime() + 8 * 60 * 60_000);
    return local.toISOString().slice(0, 19).replace('T', ' ');
  }

  private statusZh(s: AttendanceStatus): string {
    if (s === AttendanceStatus.on_time) return '在线 Present';
    if (s === AttendanceStatus.late) return '迟到 Late';
    if (s === AttendanceStatus.absent) return '缺席 Absent';
    return String(s);
  }

  /** R15-followup-14 — compact 2-char Chinese label for the pivot cells.
   *  "—" for days without an attendance row (no session OR student wasn't
   *  enrolled in this class on that date). */
  private statusShortZh(s: AttendanceStatus | undefined): string {
    if (s === AttendanceStatus.on_time) return '按时';
    if (s === AttendanceStatus.late) return '迟到';
    if (s === AttendanceStatus.absent) return '缺勤';
    return '—';
  }

  /** R15-followup-14 — Chinese weekday hint for the date column header.
   *  Takes "YYYY-MM-DD" school-local and returns 周一/周二/.../周日. */
  private weekdayZh(dateKey: string): string {
    const d = new Date(`${dateKey}T00:00:00+08:00`);
    const labels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return labels[d.getUTCDay()] ?? '';
  }

  private gradeBucket(pct: number): string {
    if (pct >= 90) return 'A';
    if (pct >= 80) return 'B';
    if (pct >= 70) return 'C';
    if (pct >= 60) return 'D';
    return 'F';
  }
}
