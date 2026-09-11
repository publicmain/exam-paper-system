import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../common/prisma.service';
import { ENABLED_ACCOUNT_WHERE } from '../common/account-lifecycle';
import { STUDENT_TOKEN_TTL_DAYS } from '../student-auth/student-auth.service';
import {
  DAILY_REMINDER_PAYLOAD,
  reminderTargets,
  reminderTime,
  sgtDayStart,
  sgtDayStartInstant,
  type PushPayload,
} from './push-reminder.rules';

/**
 * 浏览器推送（Web Push，2026-09-10）。
 *
 * 为什么要有：所有提醒 —— 包括首页那个「单词小测没做」的弹窗 —— 都得学生
 * **自己先打开 App** 才看得到。推送能在 16:30 直接叫他们。
 *
 * 走的是浏览器原生的 Push API，不经任何第三方推送平台：服务端拿 VAPID
 * 私钥签一下，直接发给浏览器厂商的推送服务。三个环境变量：
 *
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY —— `npx web-push generate-vapid-keys`
 *   VAPID_SUBJECT —— `mailto:` 或站点 https 地址，推送服务出问题时联系谁
 *
 * **没配就整个功能关着**：`/push/config` 回 `enabled:false`，学生端不显示
 * 开关，cron 直接跳过。少一个变量不影响其它任何东西。
 *
 * ## 订阅归属（2026-09-11 审计 UI07）
 *
 * 一行订阅 = 一台设备的浏览器 × **当前已认证的学生**：
 *
 *   · `subscribe`：endpoint 唯一，同一台设备换人订阅 → 这一行转给新的人；
 *   · `unsubscribe`：只删自己名下的；
 *   · `status`：前端按「当前账号 + 本浏览器 endpoint」问库里是不是真有这一行，
 *     不再凭「浏览器里有订阅」就显示已开启（那一行可能属于上一个账号）；
 *   · 发送（cron 与 `sendToStudent`）只发给**此刻仍可用**的账号：启用、
 *     未归档、不是旧版停用标记，且最近 `STUDENT_TOKEN_TTL_DAYS` 天内签发过
 *     长期令牌（登录 / 注册 / 改密码）—— 全部令牌都过期了的账号，那台设备
 *     很可能已经换了人；
 *   · 撤销（改密码 / 教师重置 / 后台停用 / 后台重置密码）时，调用方在同一
 *     事务里删掉该账号的全部订阅 —— 那些设备已被登出。
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');

  constructor(private readonly prisma: PrismaService) {}

  private vapid(): { publicKey: string; privateKey: string; subject: string } | null {
    const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    if (!publicKey || !privateKey) return null;
    const subject =
      process.env.VAPID_SUBJECT?.trim() ||
      process.env.STUDENT_APP_ORIGIN?.trim() ||
      'mailto:ops@example.invalid';
    return { publicKey, privateKey, subject };
  }

  enabled(): boolean {
    return this.vapid() !== null;
  }

  /** 学生端开关页要的：开没开、公钥、几点提醒。 */
  config() {
    const v = this.vapid();
    return { enabled: v !== null, publicKey: v?.publicKey ?? null, reminderTime: reminderTime() };
  }

  /**
   * 登记一台设备。`endpoint` 唯一 —— 同一台设备再来一次只更新这一行；
   * 一台共用的设备换了人登录，这一行就归新的人（旧的人不该再收到）。
   */
  async subscribe(
    studentId: string,
    input: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string | null,
  ) {
    if (!this.enabled()) throw new ServiceUnavailableException({ code: 'push_disabled' });
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        studentId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: userAgent?.slice(0, 200) ?? null,
      },
      update: {
        studentId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: userAgent?.slice(0, 200) ?? null,
      },
    });
    return { ok: true as const };
  }

  /** 只能退订自己名下的那一行 —— endpoint 猜不到，但规矩还是要在。 */
  async unsubscribe(studentId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { studentId, endpoint } });
    return { ok: true as const };
  }

  /**
   * 这台设备（endpoint）此刻是不是**当前账号**的订阅。纯读取。
   *
   * 属于别人、或者根本不存在，一律 `false` —— 不透露这台设备归谁。
   * 推送没配置时同样照实回答（那时表里本来就不会有新订阅）。
   */
  async status(studentId: string, endpoint: string) {
    const row = await this.prisma.pushSubscription.findUnique({
      where: { endpoint },
      select: { studentId: true },
    });
    return { subscribed: row?.studentId === studentId };
  }

  /**
   * 发送对象的账号条件（Prisma 关系过滤片段）：此刻仍可用、且最近
   * `STUDENT_TOKEN_TTL_DAYS` 天内签发过长期令牌。
   *
   * 「签发过」看 `lastLogin`（登录）与 `pinSetAt`（注册 / 改密码）—— 这是
   * 全部三条签发 30 天令牌的路径；教师重置会把 `pinSetAt` 清空并递增版本号。
   */
  private deliverableStudentWhere(now: Date) {
    const cutoff = new Date(now.getTime() - STUDENT_TOKEN_TTL_DAYS * 86_400_000);
    return {
      role: 'student' as const,
      ...ENABLED_ACCOUNT_WHERE,
      OR: [{ lastLogin: { gte: cutoff } }, { pinSetAt: { gte: cutoff } }],
    };
  }

  /**
   * 给一个学生的所有设备发。推送服务回 404 / 410 = 这台设备已经退订
   * （学生在浏览器里关了通知、清了站点数据），那一行直接删掉，下次不再发。
   * 其它错误只记日志 —— 一台设备发不出去不该拦住剩下的。
   */
  async sendToStudent(studentId: string, payload: PushPayload, now = new Date()) {
    const v = this.vapid();
    if (!v) return { sent: 0, dropped: 0, failed: 0 };
    // UI07：停用 / 归档 / 凭证全部过期的账号，一条都不发（cron 已经筛过，这里再兜一层）
    const subs = await this.prisma.pushSubscription.findMany({
      where: { studentId, student: this.deliverableStudentWhere(now) },
    });
    let sent = 0;
    let dropped = 0;
    let failed = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60, vapidDetails: v },
        );
        await this.prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastSentAt: now } });
        sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          dropped += 1;
        } else {
          failed += 1;
          this.logger.warn(`推送失败 status=${status ?? '?'}：${(e as Error).message}`);
        }
      }
    }
    return { sent, dropped, failed };
  }

  /**
   * 每日提醒：订阅了、今天有课、还没交阅读卷、今天没提醒过 —— 见
   * `reminderTargets`。cron 每个工作日到点调一次。
   */
  async runDailyReminder(now = new Date()) {
    if (!this.enabled()) return { skipped: 'disabled' as const, targets: 0, sent: 0, dropped: 0, failed: 0 };

    const day = sgtDayStart(now);
    const dayStart = sgtDayStartInstant(now);

    const subs = await this.prisma.pushSubscription.findMany({
      where: { student: this.deliverableStudentWhere(now) },
      select: { studentId: true, lastSentAt: true },
    });
    const subscribed = new Set(subs.map((s) => s.studentId));
    const sentToday = new Set(
      subs.filter((s) => s.lastSentAt && s.lastSentAt.getTime() >= dayStart.getTime()).map((s) => s.studentId),
    );

    const sessions = await this.prisma.morningQuizSession.findMany({
      where: { date: day, status: 'active' },
      select: {
        paperAssignmentId: true,
        class: { select: { enrollments: { where: { role: 'student' }, select: { userId: true } } } },
      },
    });
    const hasSessionToday = new Set<string>();
    for (const s of sessions) for (const e of s.class.enrollments) hasSessionToday.add(e.userId);

    const done = await this.prisma.studentSubmission.findMany({
      where: {
        assignmentId: { in: sessions.map((s) => s.paperAssignmentId) },
        status: { not: 'practice' },
        finalSubmittedAt: { not: null },
      },
      select: { studentId: true },
    });
    const doneToday = new Set(done.map((d) => d.studentId));

    const targets = reminderTargets({ subscribed, hasSessionToday, doneToday, sentToday });
    let sent = 0;
    let dropped = 0;
    let failed = 0;
    for (const id of targets) {
      const r = await this.sendToStudent(id, DAILY_REMINDER_PAYLOAD, now);
      sent += r.sent;
      dropped += r.dropped;
      failed += r.failed;
    }
    return { skipped: null, targets: targets.length, sent, dropped, failed };
  }
}
