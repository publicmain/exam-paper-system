import { Injectable, Logger } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma.service';
import { WechatNotifyService } from '../wechat-notify/wechat-notify.service';

export interface ConsecutiveAbsence {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  consecutiveDays: number;
  firstAbsentDate: string; // YYYY-MM-DD
  lastAbsentDate: string;
}

const STREAK_THRESHOLD = 3;
/** Don't re-alert about the same student within this window — gives the
 *  student time to come back without daily nag. Bumping the streak by
 *  one more day DOES re-alert (different consecutiveDays in payload). */
const ALERT_DEDUP_DAYS = 7;

/**
 * Detect students who have been absent ≥ 3 consecutive scheduled-quiz
 * days and surface them via:
 *   1. wechat-notify event `consecutive_absent`
 *   2. AuditLog row (action = 'absence_alert.fired') for dedup
 *   3. Returned list — used by the teacher dashboard's red badge.
 *
 * Run daily by AbsenceAlertCron at 09:30. Idempotent — calling twice on
 * the same day fires zero alerts the second time.
 */
@Injectable()
export class AbsenceAlertService {
  private readonly logger = new Logger('AbsenceAlertService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: WechatNotifyService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Find every student with a current consecutive-absent streak ≥ threshold.
   * "Current" means the most recent session for their class is in their
   * streak. A student who was absent 3 days ago but came back yesterday
   * is NOT flagged.
   */
  async findCurrentStreaks(
    threshold = STREAK_THRESHOLD,
    asOf: Date = new Date(),
  ): Promise<ConsecutiveAbsence[]> {
    // Pull recent sessions (look-back of threshold + 4 = e.g. 7 days
    // of quiz days = ~10 calendar days) for every class.
    const lookbackDays = (threshold + 4) * 2; // calendar-day buffer for weekends
    const fromDate = new Date(asOf);
    fromDate.setDate(asOf.getDate() - lookbackDays);

    const sessions = await this.prisma.morningQuizSession.findMany({
      where: { date: { gte: fromDate, lte: asOf } },
      include: {
        attendances: {
          include: { student: { select: { id: true, name: true } } },
        },
        class: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    });

    // Group by (classId, studentId) → ordered records.
    type Rec = { date: Date; status: AttendanceStatus; studentName: string; className: string; classId: string };
    const perStudent = new Map<string, Rec[]>();
    for (const s of sessions) {
      for (const a of s.attendances) {
        const key = `${s.classId}::${a.studentId}`;
        const arr = perStudent.get(key) ?? [];
        arr.push({
          date: s.date,
          status: a.status,
          studentName: a.student.name,
          className: s.class.name,
          classId: s.classId,
        });
        perStudent.set(key, arr);
      }
    }

    const out: ConsecutiveAbsence[] = [];
    for (const [key, records] of perStudent.entries()) {
      records.sort((a, b) => a.date.getTime() - b.date.getTime());
      // Walk backwards from the most recent — count consecutive
      // absent rows. Stop at first present/late.
      let streak = 0;
      let lastAbsent: Date | null = null;
      let firstAbsent: Date | null = null;
      for (let i = records.length - 1; i >= 0; i--) {
        const r = records[i];
        if (r.status === AttendanceStatus.absent) {
          streak++;
          if (!lastAbsent) lastAbsent = r.date;
          firstAbsent = r.date;
        } else {
          break;
        }
      }
      if (streak >= threshold && lastAbsent && firstAbsent) {
        const studentId = key.split('::')[1];
        const last = records[records.length - 1];
        out.push({
          studentId,
          studentName: last.studentName,
          classId: last.classId,
          className: last.className,
          consecutiveDays: streak,
          firstAbsentDate: this.iso(firstAbsent),
          lastAbsentDate: this.iso(lastAbsent),
        });
      }
    }
    return out;
  }

  /**
   * Run one alert pass: find streaks, dedup against recent AuditLog,
   * notify via WeChat for new ones, return the full set + count of
   * actually-fired alerts.
   */
  async runOnce(): Promise<{
    streaks: ConsecutiveAbsence[];
    fired: number;
    skippedDedup: number;
  }> {
    const streaks = await this.findCurrentStreaks();
    const dedupSince = new Date(Date.now() - ALERT_DEDUP_DAYS * 24 * 3600 * 1000);
    let fired = 0;
    let skipped = 0;
    for (const s of streaks) {
      // Dedup: same student + same streak length within window.
      const recent = await this.prisma.auditLog.findFirst({
        where: {
          action: 'absence_alert.fired',
          entityType: 'User',
          entityId: s.studentId,
          createdAt: { gte: dedupSince },
        },
        orderBy: { createdAt: 'desc' },
      });
      const lastStreak =
        (recent?.metadata as any)?.consecutiveDays ?? 0;
      if (recent && lastStreak >= s.consecutiveDays) {
        skipped++;
        continue;
      }

      try {
        await this.notify.fire('consecutive_absent', {
          studentId: s.studentId,
          studentName: s.studentName,
          className: s.className,
          consecutiveDays: s.consecutiveDays,
          firstAbsentDate: s.firstAbsentDate,
          lastAbsentDate: s.lastAbsentDate,
          message:
            `${s.studentName} (${s.className}) 已连续缺勤 ${s.consecutiveDays} 天 — ` +
            `${s.firstAbsentDate} 起。请关注。`,
        });
      } catch (e: any) {
        this.logger.warn(`notify.fire failed for ${s.studentId}: ${e?.message}`);
      }
      await this.audit.log({
        actorId: 'system-cron',
        actorRole: 'system',
        action: 'absence_alert.fired',
        entityType: 'User',
        entityId: s.studentId,
        ip: null,
        metadata: {
          consecutiveDays: s.consecutiveDays,
          className: s.className,
          firstAbsentDate: s.firstAbsentDate,
          lastAbsentDate: s.lastAbsentDate,
        },
      });
      fired++;
    }
    this.logger.log(
      `absence-alert pass: ${streaks.length} streak(s), ${fired} fired, ${skipped} deduped`,
    );
    return { streaks, fired, skippedDedup: skipped };
  }

  private iso(d: Date): string {
    const local = new Date(d.getTime() + 8 * 60 * 60_000);
    return local.toISOString().slice(0, 10);
  }
}
