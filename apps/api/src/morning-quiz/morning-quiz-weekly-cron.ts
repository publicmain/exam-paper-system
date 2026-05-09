import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import { WechatNotifyService } from '../wechat-notify/wechat-notify.service';
import { MorningQuizService } from './morning-quiz.service';

/**
 * Sunday-night auto-generate cron.
 *
 * At 18:00 every Sunday (server local — Asia/Singapore in production),
 * pull every active class with `morning_quiz_enabled` AND a
 * ClassEnglishLevel row, and call `batchGenerateForWeek` for the
 * upcoming Mon→Fri. AI-generation is best-effort per (date, class) —
 * the existing batchGenerateForWeek records each failure independently
 * but does NOT throw, so the cron continues for remaining classes.
 *
 * Gated by env `MORNING_QUIZ_AUTO_GENERATE=true` (default false). Wiring
 * is conservative: Dan still does Sunday-night generation manually
 * today, the cron's job is to remove THAT load when she opts in.
 *
 * Failures notify via wechat-notify event `morning_quiz_cron_failed`
 * (configured in the admin UI). If no notify config is bound, the cron
 * just logs and continues.
 */
@Injectable()
export class MorningQuizWeeklyCron {
  private readonly logger = new Logger('MorningQuizWeeklyCron');
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mq: MorningQuizService,
    private readonly notify: WechatNotifyService,
  ) {}

  // Cron syntax: '0 18 * * 0' = at 18:00 every Sunday.
  @Cron('0 18 * * 0', { name: 'morning-quiz-weekly-generate' })
  async run(): Promise<void> {
    if (process.env.MORNING_QUIZ_AUTO_GENERATE !== 'true') {
      this.logger.debug('skipped — MORNING_QUIZ_AUTO_GENERATE !== "true"');
      return;
    }
    if (this.isRunning) {
      this.logger.warn('previous run still in flight; skipping this tick');
      return;
    }
    this.isRunning = true;
    try {
      await this.runOnce();
    } finally {
      this.isRunning = false;
    }
  }

  /** Public entry-point so tests + admin endpoint can trigger one run
   *  without waiting for cron. Returns the per-class outcome. */
  async runOnce(): Promise<{
    classesAttempted: number;
    classesSucceeded: number;
    classesFailed: number;
    errors: Array<{ classId: string; error: string }>;
  }> {
    // Pick the Monday of the upcoming week.
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday);
    monday.setHours(0, 0, 0, 0);
    const weekStart = monday.toISOString().slice(0, 10);

    // Find every class with a ClassEnglishLevel row — that's our "this
    // class is in the morning-quiz program" signal today (the schema
    // doesn't have a separate enabled flag).
    const enabledClasses = await this.prisma.classEnglishLevel.findMany({
      select: { classId: true },
    });
    const classIds = enabledClasses.map((c) => c.classId);
    if (classIds.length === 0) {
      this.logger.log('no classes have an English-level row; nothing to generate');
      return { classesAttempted: 0, classesSucceeded: 0, classesFailed: 0, errors: [] };
    }

    this.logger.log(
      `weekly generate kicking off for weekStart=${weekStart}, classes=${classIds.length}`,
    );
    const errors: Array<{ classId: string; error: string }> = [];
    let succeeded = 0;
    try {
      const result = await this.mq.batchGenerateForWeek(
        { weekStart, classIds, questionsPerPaper: 12 },
        { id: 'system-cron', role: 'admin', ip: null },
      );
      // batchGenerateForWeek returns per-tuple outcomes; count successes.
      const items: any[] = (result as any)?.items ?? (result as any)?.results ?? [];
      for (const item of items) {
        if (item?.error) {
          errors.push({ classId: item.classId ?? 'unknown', error: String(item.error) });
        } else {
          succeeded++;
        }
      }
    } catch (e: any) {
      this.logger.error(`batchGenerateForWeek threw: ${e?.message ?? e}`);
      errors.push({ classId: '*', error: e?.message ?? String(e) });
    }

    if (errors.length > 0) {
      try {
        await this.notify.fire('morning_quiz_cron_failed', {
          weekStart,
          classesAttempted: classIds.length,
          succeeded,
          failed: errors.length,
          errors: errors.slice(0, 10),
        });
      } catch (e) {
        this.logger.warn(`notify.fire failed: ${(e as Error).message}`);
      }
    }

    // F2 — review-gate notification.
    // Right after batch generate, summarise verdict distribution for the
    // upcoming week and push to the teacher channel so they can triage
    // any needs_review/reject papers before Monday morning.
    try {
      const monday = new Date(weekStart + 'T00:00:00Z');
      const friday = new Date(monday.getTime() + 5 * 86_400_000);
      const upcomingPapers = await this.prisma.paper.findMany({
        where: {
          assignments: {
            some: {
              morningQuizSession: {
                date: { gte: monday, lt: friday },
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          qaReviewVerdict: true,
          qaReviewSummary: true,
          qaTeacherAction: true,
        },
      });
      const verdictCounts = upcomingPapers.reduce(
        (a, p) => {
          const v = p.qaReviewVerdict ?? 'pending';
          a[v] = (a[v] ?? 0) + 1;
          return a;
        },
        {} as Record<string, number>,
      );
      const needsReviewPapers = upcomingPapers.filter(
        (p) =>
          (p.qaReviewVerdict === 'needs_review' || p.qaReviewVerdict === 'reject') &&
          p.qaTeacherAction === null,
      );
      const message =
        `【晨测出卷已完成】week=${weekStart}\n` +
        `共 ${upcomingPapers.length} 份卷子，` +
        Object.entries(verdictCounts)
          .map(([k, v]) => `${k}=${v}`)
          .join(' / ') +
        `\n` +
        (needsReviewPapers.length > 0
          ? `${needsReviewPapers.length} 份待复核：\n` +
            needsReviewPapers
              .slice(0, 6)
              .map(
                (p) =>
                  `- [${p.qaReviewVerdict}] ${p.name}: ${(p.qaReviewSummary ?? '').slice(0, 80)}`,
              )
              .join('\n') +
            `\n请在周一 06:30 前在 Schedule → Review queue 中处理；逾期未操作的卷子将自动放行。`
          : `全部通过，无需老师操作。`);
      await this.notify.fire('morning_quiz_review_gate', {
        message,
        weekStart,
        verdictCounts,
        needsReview: needsReviewPapers.map((p) => ({ id: p.id, name: p.name })),
      });
    } catch (e) {
      this.logger.warn(`review_gate notify failed: ${(e as Error).message}`);
    }

    return {
      classesAttempted: classIds.length,
      classesSucceeded: succeeded,
      classesFailed: errors.length,
      errors,
    };
  }

  /**
   * F2 fail-open auto-releaser.
   *
   * Runs every Monday 06:30. Any Paper still flagged needs_review with
   * qaTeacherAction null and an upcoming session this week is
   * auto-approved (qaTeacherAction='approved' with actorBy='system-cron').
   * The audit log captures *why* it auto-released; the teacher can still
   * roll back via the Review queue if they catch it later.
   *
   * `reject` verdicts are NOT auto-released — those are presumed to need
   * a real fix (the auditor flagged a critical answer-key error).
   *
   * Gated by env MORNING_QUIZ_REVIEW_FAIL_OPEN=true (default false).
   */
  @Cron('30 6 * * 1', { name: 'morning-quiz-review-fail-open' })
  async failOpen(): Promise<void> {
    if (process.env.MORNING_QUIZ_REVIEW_FAIL_OPEN !== 'true') {
      this.logger.debug('skipped — MORNING_QUIZ_REVIEW_FAIL_OPEN !== "true"');
      return;
    }
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 86_400_000);
    const stuck = await this.prisma.paper.findMany({
      where: {
        qaReviewVerdict: 'needs_review',
        qaTeacherAction: null,
        assignments: {
          some: {
            morningQuizSession: {
              date: { gte: now, lt: weekEnd },
            },
          },
        },
      },
      select: { id: true, name: true, qaReviewSummary: true },
    });
    if (stuck.length === 0) {
      this.logger.log('fail-open: no stuck papers');
      return;
    }
    for (const p of stuck) {
      try {
        await this.prisma.paper.update({
          where: { id: p.id },
          data: {
            qaTeacherAction: 'auto_released',
            qaTeacherActionAt: new Date(),
            qaTeacherActionBy: 'system-cron',
          },
        });
      } catch (e) {
        this.logger.warn(
          `fail-open update paper=${p.id} failed: ${(e as Error).message}`,
        );
      }
    }
    try {
      await this.notify.fire('morning_quiz_auto_released', {
        message:
          `【自动放行】Monday 06:30 前未老师审核的 ${stuck.length} 份卷子已自动放行` +
          `（避免影响今天上学）。请审核 Schedule → Review queue 历史，必要时手动撤销。`,
        count: stuck.length,
        papers: stuck.map((p) => ({ id: p.id, name: p.name })),
      });
    } catch (e) {
      this.logger.warn(`fail-open notify failed: ${(e as Error).message}`);
    }
    this.logger.log(`fail-open released ${stuck.length} stuck papers`);
  }
}
