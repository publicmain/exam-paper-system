import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { MorningQuizStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

/**
 * Auto-provision the morning-assembly DEMO session on every API start.
 *
 * Design goals:
 *  - Idempotent: a redeploy on the same day reuses the existing
 *    session; a redeploy on a new day creates a fresh one.
 *  - Stable URL for the projector: `/display?classId=<demo-class-id>`
 *    auto-finds today's session for the demo class, so the operator
 *    doesn't need a per-day sessionId.
 *  - Date-aware: targets "this morning" if we boot before noon SGT
 *    locally, else "tomorrow morning". Weekends roll forward to Mon.
 *  - Self-healing answer key: the day-of-week MCQ recomputes the
 *    correct option on every boot from the target date's weekday.
 *
 * Disable with BOOTSTRAP_DEMO_DISABLED=true if a deployment shouldn't
 * touch the demo session (e.g. the demo class has been retired).
 */

const SGT_OFFSET_MIN = 8 * 60;
const ZH_DAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function sgtToUtc(y: number, mo: number, d: number, h: number, m: number): Date {
  return new Date(Date.UTC(y, mo - 1, d, h, m) - SGT_OFFSET_MIN * 60_000);
}

/**
 * Pick the next assembly-window start. Logic:
 *   - If now (in SGT) is before 12:00 SGT today AND today is Mon-Fri,
 *     use today.
 *   - Otherwise advance one day at a time until we hit a weekday.
 */
function pickTargetMorning(now: Date): { y: number; mo: number; d: number; weekday: number } {
  const sgtNow = new Date(now.getTime() + SGT_OFFSET_MIN * 60_000);
  let y = sgtNow.getUTCFullYear();
  let mo = sgtNow.getUTCMonth() + 1;
  let d = sgtNow.getUTCDate();
  const wkday = sgtNow.getUTCDay();
  const beforeNoon = sgtNow.getUTCHours() < 12;
  if (beforeNoon && wkday >= 1 && wkday <= 5) {
    return { y, mo, d, weekday: wkday };
  }
  // Roll forward day by day until Mon-Fri.
  const cursor = new Date(sgtNow);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return {
    y: cursor.getUTCFullYear(),
    mo: cursor.getUTCMonth() + 1,
    d: cursor.getUTCDate(),
    weekday: cursor.getUTCDay(),
  };
}

@Injectable()
export class DemoSessionBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger('DemoBootstrap');

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.BOOTSTRAP_DEMO_DISABLED === 'true') {
      this.logger.log('skipped — BOOTSTRAP_DEMO_DISABLED=true');
      return;
    }
    try {
      // ── 1. Find owner ──
      const owner = await this.prisma.user.findFirst({
        where: { role: { in: ['admin', 'head_teacher', 'teacher'] } },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!owner) {
        this.logger.warn('skipped — no admin/teacher user yet');
        return;
      }

      // ── 2. Find or create the demo class ──
      const cls = await this.prisma.class.upsert({
        where: { classCode: 'DEMO-2026' },
        update: {},
        create: { name: '演示班 · Demo Class', classCode: 'DEMO-2026' },
      });

      // ── 3. Find or create an English/CIE subject + component to host the
      //      question on. Uses the existing IELTS subject if seeded.
      const subject = await this.prisma.subject.findFirst({
        where: { code: 'IELTS' },
        include: { components: true },
      });
      if (!subject || subject.components.length === 0) {
        this.logger.warn('skipped — IELTS subject/component not yet seeded');
        return;
      }
      const component = subject.components[0];

      // ── 4. Pick target morning + recompute the correct day-of-week key ──
      const { y, mo, d, weekday } = pickTargetMorning(new Date());
      const correctKey = String.fromCharCode(65 + weekday); // A..G
      const options = ZH_DAYS.map((zh, i) => ({
        key: String.fromCharCode(65 + i),
        text: `${zh} · ${EN_DAYS[i]}`,
        correct: i === weekday,
      }));

      // ── 5. Find or create the question. Always refresh options +
      //      answerContent so the key matches today's weekday.
      const sourceRef = 'DEMO/morning-assembly/Q1';
      const existingQ = await this.prisma.question.findFirst({
        where: { sourceType: 'past_paper_reference', sourceRef },
      });
      const question = existingQ
        ? await this.prisma.question.update({
            where: { id: existingQ.id },
            data: {
              options: options as any,
              answerContent: { text: correctKey },
              content: { stem: '今天是星期几？\nWhat day of the week is today?' },
            },
          })
        : await this.prisma.question.create({
            data: {
              subjectId: subject.id,
              componentId: component.id,
              questionType: 'mcq',
              marks: 1,
              estimatedTimeMin: 1,
              difficulty: 1,
              sourceType: 'past_paper_reference',
              sourceRef,
              content: { stem: '今天是星期几？\nWhat day of the week is today?' },
              answerContent: { text: correctKey },
              options: options as any,
              status: 'active',
              createdById: owner.id,
              provenanceTag: 'demo_assembly',
            },
          });

      // ── 6. Check: does a (date, classId) session already exist? ──
      const dateOnly = new Date(Date.UTC(y, mo - 1, d));
      const existingSession = await this.prisma.morningQuizSession.findFirst({
        where: { classId: cls.id, date: dateOnly },
      });
      if (existingSession) {
        this.logger.log(
          `demo session already exists for ${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}: ${existingSession.id}`,
        );
        return;
      }

      // ── 7. Build paper + assignment + session for the new day ──
      const attendanceStart = sgtToUtc(y, mo, d, 6, 0);
      const attendanceEnd = sgtToUtc(y, mo, d, 11, 30);
      const lateCutoff = sgtToUtc(y, mo, d, 11, 45);
      const quizStart = sgtToUtc(y, mo, d, 6, 0);
      const quizEnd = sgtToUtc(y, mo, d, 12, 0);
      const dateLabel = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const paper = await this.prisma.paper.create({
        data: {
          name: `演示 · Morning Assembly Demo (${dateLabel})`,
          ownerId: owner.id,
          subjectId: subject.id,
          componentId: component.id,
          durationMin: 5,
          totalMarksTarget: 1,
          totalMarksActual: 1,
          status: 'published',
          generatedSeed: Math.floor(Math.random() * 1e9),
          config: { mode: 'demo_assembly' },
        },
      });
      await this.prisma.paperQuestion.create({
        data: {
          paperId: paper.id,
          questionId: question.id,
          sortOrder: 1,
          snapshotContent: question.content as any,
          snapshotAnswer: question.answerContent as any,
          snapshotOptions: options as any,
          marks: 1,
        },
      });
      const assignment = await this.prisma.paperAssignment.create({
        data: {
          paperId: paper.id,
          classId: cls.id,
          assignedById: owner.id,
          startAt: quizStart,
          dueAt: quizEnd,
          durationMin: 5,
          status: 'open',
        },
      });
      const qrSecret = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16),
      ).join('');
      const session = await this.prisma.morningQuizSession.create({
        data: {
          date: dateOnly,
          classId: cls.id,
          paperAssignmentId: assignment.id,
          attendanceStart,
          attendanceEnd,
          lateCutoff,
          quizStart,
          quizEnd,
          qrSecret,
          qrRotationSeconds: 30,
          status: MorningQuizStatus.active,
          scheduledById: owner.id,
          level: 'olevel',
        },
      });
      this.logger.log(
        `demo session ready for ${dateLabel} (${EN_DAYS[weekday]}): sessionId=${session.id} classId=${cls.id} answer=${correctKey}`,
      );
      this.logger.log(
        `  ⏵ projector URL (stable): /display?classId=${cls.id}`,
      );
    } catch (e: any) {
      // Never block app startup on demo problems — log and continue.
      this.logger.error(`demo bootstrap failed (continuing): ${e.message ?? e}`);
    }
  }
}
