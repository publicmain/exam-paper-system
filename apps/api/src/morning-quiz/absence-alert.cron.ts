import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AbsenceAlertService } from './absence-alert.service';

/**
 * Daily 09:30 cron — runs the absence-alert pass after morning attendance
 * has finished. Idempotent (the service dedups against AuditLog).
 *
 * Gated behind `MORNING_QUIZ_ABSENCE_ALERTS=true` (default false). When
 * disabled, the service is still callable from the teacher dashboard
 * via the controller endpoint.
 */
@Injectable()
export class AbsenceAlertCron {
  private readonly logger = new Logger('AbsenceAlertCron');

  constructor(private readonly svc: AbsenceAlertService) {}

  @Cron('30 9 * * *', { name: 'absence-alert-daily' })
  async run(): Promise<void> {
    if (process.env.MORNING_QUIZ_ABSENCE_ALERTS !== 'true') {
      this.logger.debug('skipped — MORNING_QUIZ_ABSENCE_ALERTS !== "true"');
      return;
    }
    try {
      const result = await this.svc.runOnce();
      this.logger.log(
        `daily absence pass: streaks=${result.streaks.length} fired=${result.fired} deduped=${result.skippedDedup}`,
      );
    } catch (e: any) {
      this.logger.error(`absence pass threw: ${e?.message ?? e}`);
    }
  }
}
