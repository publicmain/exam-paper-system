import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateConfigDto, UpdateConfigDto } from './dto';

type EventName = 'paper_assigned' | 'paper_marked' | 'low_score';

/**
 * Notification dispatch surface.
 *
 * STUB POLICY (B7):
 *   - We DO NOT integrate with a real WeChat Work webhook here. The
 *     real webhook URL will be wired in a later block.
 *   - When `target.webhookUrl` starts with `noop://...`, we record
 *     a NotificationLog row with httpStatus=0 and skip the HTTP
 *     call. This lets admins create configs and test the wiring
 *     before a real URL is provisioned.
 *   - When the URL doesn't start with `noop://`, we make a
 *     best-effort POST with a short timeout. Failures are logged,
 *     not raised — a flaky webhook must not break paper-assignment.
 *
 * Other modules (e.g. StudentService.assignPaperToClass) will
 * inject this service and call .fire(event, payload). For B7 we
 * only expose the admin-facing config + test endpoints; the
 * integrator wires the .fire() call sites in MERGE_INSTRUCTIONS.
 */
@Injectable()
export class WechatNotifyService {
  private readonly logger = new Logger('WechatNotifyService');
  constructor(private readonly prisma: PrismaService) {}

  // ----- config CRUD -----

  async listConfigs() {
    const prisma: any = this.prisma;
    return prisma.notificationConfig.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createConfig(body: CreateConfigDto) {
    const prisma: any = this.prisma;
    return prisma.notificationConfig.create({
      data: {
        event: body.event,
        channel: body.channel,
        target: body.target,
        enabled: body.enabled,
      },
    });
  }

  async updateConfig(id: string, body: UpdateConfigDto) {
    const prisma: any = this.prisma;
    const existing = await prisma.notificationConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('config not found');
    return prisma.notificationConfig.update({
      where: { id },
      data: {
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(body.target !== undefined ? { target: body.target } : {}),
      },
    });
  }

  // ----- logs -----

  async listLogs(filter: { event?: EventName; since?: string; limit?: number }) {
    const prisma: any = this.prisma;
    const sinceDate = filter.since
      ? new Date(filter.since)
      : new Date(Date.now() - 7 * 24 * 3600 * 1000);
    return prisma.notificationLog.findMany({
      where: {
        sentAt: { gte: sinceDate },
        ...(filter.event ? { event: filter.event } : {}),
      },
      orderBy: { sentAt: 'desc' },
      take: filter.limit ?? 100,
    });
  }

  // ----- test fire -----

  async testFire(configId: string) {
    const prisma: any = this.prisma;
    const cfg = await prisma.notificationConfig.findUnique({ where: { id: configId } });
    if (!cfg) throw new NotFoundException('config not found');
    if (!cfg.enabled) {
      throw new BadRequestException('config is disabled — enable it first');
    }
    // Synthetic payload used only by the test endpoint. Real call
    // sites will pass their own payload via .fire().
    const payload = {
      test: true,
      configId,
      event: cfg.event,
      channel: cfg.channel,
      message: '[exam-paper-system] notification test ping',
    };
    return this.dispatch(cfg, payload);
  }

  // ----- public dispatcher (called by other modules at integration) -----

  /**
   * Fire every enabled config bound to `event`. Each config dispatch
   * is independent: one failure does not skip the remaining configs.
   * Returns one log entry per config attempted.
   *
   * Call sites (to be wired by integrator):
   *   - StudentService.assignPaperToClass → fire('paper_assigned', { paperId, classId })
   *   - MarkerService.score (B1)          → fire('paper_marked',   { submissionId })
   *   - StudentService.finalSubmit        → fire('low_score', ...) when totalScore < threshold
   */
  async fire(event: EventName, payload: any) {
    const prisma: any = this.prisma;
    const configs = await prisma.notificationConfig.findMany({
      where: { event, enabled: true },
    });
    const results: any[] = [];
    for (const cfg of configs) {
      try {
        results.push(await this.dispatch(cfg, payload));
      } catch (e) {
        this.logger.warn(`dispatch failed for config ${cfg.id}: ${(e as Error).message}`);
      }
    }
    return results;
  }

  // ----- internals -----

  /**
   * Single-config send. Stub-aware:
   *   - target.webhookUrl starts with "noop://" → log only.
   *   - else → POST with 5s timeout; capture status + error body.
   *
   * Always writes exactly one NotificationLog row.
   */
  private async dispatch(cfg: any, payload: any) {
    const prisma: any = this.prisma;
    const target = (cfg.target ?? {}) as { webhookUrl?: string };
    const url = target.webhookUrl;

    // ---- noop stub branch ----
    if (!url || url.startsWith('noop://')) {
      const stubMessage = url
        ? `noop stub: ${url}`
        : 'noop stub: no webhookUrl on config';
      this.logger.log(`[notify ${cfg.event}/${cfg.channel}] ${stubMessage}`);
      return prisma.notificationLog.create({
        data: {
          configId: cfg.id,
          event: cfg.event,
          channel: cfg.channel,
          payload,
          httpStatus: 0,
          error: stubMessage,
        },
      });
    }

    // ---- real HTTP branch ----
    // We use the global fetch (Node 18+; the API runs on 20). 5s
    // timeout is deliberately tight: notification sends must NOT
    // delay user-visible work like paper-assignment.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    let httpStatus = 0;
    let error: string | null = null;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.formatPayload(cfg.channel, payload)),
        signal: controller.signal,
      });
      httpStatus = res.status;
      if (!res.ok) {
        error = (await res.text()).slice(0, 500);
      }
    } catch (e) {
      error = (e as Error).message?.slice(0, 500) ?? 'unknown error';
    } finally {
      clearTimeout(timer);
    }
    return prisma.notificationLog.create({
      data: {
        configId: cfg.id,
        event: cfg.event,
        channel: cfg.channel,
        payload,
        httpStatus,
        error,
      },
    });
  }

  /**
   * Channel-specific payload shape. STUB-LEVEL: we do the minimal
   * formatting needed for each platform's "text" message body. Real
   * card / interactive-message support comes later.
   */
  private formatPayload(channel: 'wechat_work' | 'dingtalk' | 'email', payload: any) {
    const summary = typeof payload === 'object' && payload?.message
      ? String(payload.message)
      : `[exam-paper-system] ${JSON.stringify(payload).slice(0, 400)}`;
    if (channel === 'wechat_work') {
      // WeChat Work bot accepts { msgtype: 'text', text: { content } }.
      return { msgtype: 'text', text: { content: summary } };
    }
    if (channel === 'dingtalk') {
      // DingTalk bot accepts { msgtype: 'text', text: { content } }.
      return { msgtype: 'text', text: { content: summary } };
    }
    // email: opaque JSON; the actual mailer (when wired) decides
    // how to render.
    return { subject: summary, body: payload };
  }
}
