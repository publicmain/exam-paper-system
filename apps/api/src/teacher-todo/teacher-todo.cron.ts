import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TeacherTodoService } from './teacher-todo.service';
import { WechatNotifyService } from '../wechat-notify/wechat-notify.service';

/**
 * F1 — twice-daily WeChat-Work digest of the teacher-todo aggregate.
 *
 *   08:30 server-local: morning digest before classes start
 *   18:30 server-local: evening digest after the school day
 *
 * Gated by env TEACHER_DAILY_DIGEST=true so existing deployments don't
 * start spamming bots before an admin opts in. Requires a NotificationConfig
 * row with event=teacher_daily_digest bound to a wechat_work webhook.
 */
@Injectable()
export class TeacherTodoCron {
  private readonly logger = new Logger('TeacherTodoCron');

  constructor(
    private readonly svc: TeacherTodoService,
    private readonly notify: WechatNotifyService,
  ) {}

  @Cron('30 8 * * *', { name: 'teacher-todo-morning-digest' })
  async morning(): Promise<void> {
    return this.runOnce('morning');
  }

  @Cron('30 18 * * *', { name: 'teacher-todo-evening-digest' })
  async evening(): Promise<void> {
    return this.runOnce('evening');
  }

  /** Public so admin endpoints / tests can fire one without waiting. */
  async runOnce(slot: 'morning' | 'evening' | 'manual'): Promise<void> {
    if (process.env.TEACHER_DAILY_DIGEST !== 'true') {
      this.logger.debug(`skipped — TEACHER_DAILY_DIGEST !== "true" (slot=${slot})`);
      return;
    }
    try {
      const payload = await this.svc.today();
      const digest = this.svc.formatDigest(payload);
      // The notify service treats `message` as the rendered text body
      // (its formatPayload picks it up unchanged for the wechat_work
      // and dingtalk channels).
      await this.notify.fire('teacher_daily_digest' as any, {
        message: digest,
        slot,
        summary: payload.summary,
      });
      this.logger.log(
        `teacher-todo digest fired slot=${slot} ` +
          `pendingReview=${payload.summary.pendingReviewPapers} ` +
          `pendingMark=${payload.summary.pendingMarkScripts} ` +
          `absent=${payload.summary.consecutiveAbsentStudents} ` +
          `unaccounted=${payload.summary.unaccountedStudentsToday}`,
      );
    } catch (e: any) {
      this.logger.error(
        `teacher-todo digest slot=${slot} failed: ${String(e?.message ?? e).slice(0, 200)}`,
      );
    }
  }
}
