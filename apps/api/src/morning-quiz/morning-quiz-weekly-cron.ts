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
    return {
      classesAttempted: classIds.length,
      classesSucceeded: succeeded,
      classesFailed: errors.length,
      errors,
    };
  }
}
