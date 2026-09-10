import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { reminderCronExpression, reminderTime } from './push-reminder.rules';
import { PushService } from './push.service';

/**
 * 每个工作日到点推一次「今天的课还没做完」。
 *
 * 时刻来自 `PUSH_REMINDER_TIME`（默认 16:30，新加坡时间），在**类定义时**
 * 读一次 —— 改了要重启才生效，这是 @Cron 装饰器的限制。
 */
@Injectable()
export class PushReminderCron {
  private readonly logger = new Logger('PushReminderCron');

  constructor(private readonly push: PushService) {}

  @Cron(reminderCronExpression(), { name: 'push-daily-reminder', timeZone: 'Asia/Singapore' })
  async run(): Promise<void> {
    try {
      const r = await this.push.runDailyReminder();
      if (r.skipped) {
        this.logger.debug(`skipped — ${r.skipped}`);
        return;
      }
      this.logger.log(
        `${reminderTime()} 提醒：目标 ${r.targets} 人，送达 ${r.sent} 台，退订清理 ${r.dropped}，失败 ${r.failed}`,
      );
    } catch (e) {
      // cron 里抛出去没人接，只会在日志里留一行；这里自己记清楚
      this.logger.error(`每日提醒跑挂了：${(e as Error).message}`, (e as Error).stack);
    }
  }
}
