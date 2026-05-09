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

/**
 * Excel export for the morning-quiz teacher dashboard.
 *
 * Three sheets per workbook:
 *   1. Attendance detail   — one row per (student, day)
 *   2. Score detail        — one row per submission with mcq/total/grade
 *   3. Absence summary     — aggregated per student over the date range
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
        paperAssignment: { select: { paperId: true } },
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

    // Index lookups
    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    const submissionById = new Map(submissions.map((s) => [s.id, s]));

    // ─────── Sheet 1: Attendance detail ───────
    const s1 = wb.addWorksheet('考勤明细 Attendance', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    s1.columns = [
      { header: '学生 Student', key: 'student', width: 18 },
      { header: '班级 Class', key: 'className', width: 14 },
      { header: '日期 Date', key: 'date', width: 12 },
      { header: '状态 Status', key: 'status', width: 12 },
      { header: '扫码时间 Scan Time', key: 'scanTime', width: 20 },
      { header: '提交时间 Submitted', key: 'submittedAt', width: 20 },
    ];
    this.styleHeader(s1.getRow(1));

    for (let i = 0; i < attendances.length; i++) {
      const att = attendances[i];
      const sess = sessionById.get(att.sessionId);
      const sub = att.submissionId ? submissionById.get(att.submissionId) : null;
      s1.addRow({
        student: att.student.name,
        className: sess?.class.name ?? '—',
        date: sess?.date ? this.formatDate(sess.date) : '—',
        status: this.statusZh(att.status),
        scanTime: att.scanTime ? this.formatDateTime(att.scanTime) : '—',
        submittedAt: sub?.submittedAt ? this.formatDateTime(sub.submittedAt) : '—',
      });
      if (i % 2 === 1) {
        this.applyZebraRow(s1.getRow(i + 2));
      }
    }

    // ─────── Sheet 2: Score detail ───────
    const s2 = wb.addWorksheet('成绩明细 Scores', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    s2.columns = [
      { header: '学生 Student', key: 'student', width: 18 },
      { header: '班级 Class', key: 'className', width: 14 },
      { header: '日期 Date', key: 'date', width: 12 },
      { header: '卷子 Paper', key: 'paperId', width: 14 },
      { header: 'MCQ 分 Score', key: 'mcqScore', width: 12 },
      { header: 'MCQ 总题数', key: 'mcqTotal', width: 12 },
      { header: '正确率 %', key: 'mcqPct', width: 10 },
      { header: '总分 Total', key: 'totalMarks', width: 12 },
      { header: '等级 Grade', key: 'grade', width: 8 },
    ];
    this.styleHeader(s2.getRow(1));

    let scoreRowIndex = 2;
    for (const att of attendances) {
      if (!att.submissionId) continue;
      const sub = submissionById.get(att.submissionId);
      if (!sub) continue;
      const sess = sessionById.get(att.sessionId);
      const mcqAnswered = sub.scripts.filter((s) => s.autoCorrect !== null);
      const mcqCorrect = mcqAnswered.filter((s) => s.autoCorrect === true).length;
      const totalMarks = sub.scripts.reduce((acc, s) => acc + (s.awardedMarks ?? 0), 0);
      const pct = mcqAnswered.length > 0 ? Math.round((mcqCorrect / mcqAnswered.length) * 100) : 0;
      s2.addRow({
        student: att.student.name,
        className: sess?.class.name ?? '—',
        date: sess?.date ? this.formatDate(sess.date) : '—',
        paperId: sess?.paperAssignment.paperId ?? '—',
        mcqScore: mcqCorrect,
        mcqTotal: mcqAnswered.length,
        mcqPct: pct,
        totalMarks: Math.round(totalMarks * 10) / 10,
        grade: this.gradeBucket(pct),
      });
      if (scoreRowIndex % 2 === 0) {
        this.applyZebraRow(s2.getRow(scoreRowIndex));
      }
      scoreRowIndex++;
    }

    // ─────── Sheet 3: Absence summary ───────
    const s3 = wb.addWorksheet('缺勤汇总 Absences', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    s3.columns = [
      { header: '学生 Student', key: 'student', width: 18 },
      { header: '班级 Class', key: 'className', width: 14 },
      { header: '缺勤天数 Absent', key: 'absentDays', width: 14 },
      { header: '迟到天数 Late', key: 'lateDays', width: 14 },
      { header: '连续缺勤 Streak', key: 'streak', width: 16 },
      { header: '出勤率 % Rate', key: 'rate', width: 12 },
    ];
    this.styleHeader(s3.getRow(1));

    // Aggregate per student.
    const perStudent = new Map<
      string,
      {
        student: { id: string; name: string };
        className: string;
        present: number;
        absent: number;
        late: number;
        records: Array<{ date: Date; status: AttendanceStatus }>;
      }
    >();
    for (const att of attendances) {
      const sess = sessionById.get(att.sessionId);
      if (!sess?.date) continue;
      const cur =
        perStudent.get(att.studentId) ??
        {
          student: { id: att.student.id, name: att.student.name },
          className: sess.class.name,
          present: 0,
          absent: 0,
          late: 0,
          records: [] as Array<{ date: Date; status: AttendanceStatus }>,
        };
      cur.records.push({ date: sess.date, status: att.status });
      if (att.status === AttendanceStatus.absent) cur.absent++;
      else if (att.status === AttendanceStatus.late) cur.late++;
      else cur.present++;
      perStudent.set(att.studentId, cur);
    }

    // Compute consecutive-absent streak (longest run of absent days,
    // counting only days where the class actually had a session).
    function longestAbsentStreak(
      records: Array<{ date: Date; status: AttendanceStatus }>,
    ): number {
      const sorted = [...records].sort((a, b) => a.date.getTime() - b.date.getTime());
      let best = 0;
      let cur = 0;
      for (const r of sorted) {
        if (r.status === AttendanceStatus.absent) {
          cur++;
          if (cur > best) best = cur;
        } else {
          cur = 0;
        }
      }
      return best;
    }

    let absRow = 2;
    for (const v of perStudent.values()) {
      const total = v.present + v.absent + v.late;
      const rate = total > 0 ? Math.round(((v.present + v.late) / total) * 100) : 0;
      s3.addRow({
        student: v.student.name,
        className: v.className,
        absentDays: v.absent,
        lateDays: v.late,
        streak: longestAbsentStreak(v.records),
        rate,
      });
      if (absRow % 2 === 0) this.applyZebraRow(s3.getRow(absRow));
      absRow++;
    }

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
        students: perStudent.size,
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

  private gradeBucket(pct: number): string {
    if (pct >= 90) return 'A';
    if (pct >= 80) return 'B';
    if (pct >= 70) return 'C';
    if (pct >= 60) return 'D';
    return 'F';
  }
}
