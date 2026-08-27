import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './common/auth.guard';
import { allDayConfigSummary } from './lesson/all-day';
import { PrismaService } from './common/prisma.service';

/**
 * Health endpoints (docs/PRD §6.4 — observability).
 *
 *   GET /api/health        liveness  — process is up. DB-INDEPENDENT on
 *                          purpose: this is the path Railway's healthcheck
 *                          hits, and a transient DB blip must NOT cause the
 *                          orchestrator to kill+restart a healthy worker.
 *   GET /api/health/ready  readiness — also verifies DB connectivity. 200
 *                          when reachable, 503 when not. Use this for
 *                          load-balancer / deploy gating, not liveness.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  health() {
    return {
      ok: true,
      ts: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? null,
      commit:
        process.env.RAILWAY_GIT_COMMIT_SHA ??
        process.env.GIT_COMMIT ??
        process.env.SOURCE_COMMIT ??
        null,
      node: process.version,
      // P9.5 —— 全天课程的最终生效模式。
      //
      // **这个端点是公开的**（Railway 健康检查要打它，@Public）。所以
      // 只回显一个枚举：off / all / per-class / invalid。
      //
      // 原始环境值和班级 id 不出现在这里 —— 发布前审查提出的：原始值可能
      // 被误配成别的东西（把整串环境变量粘错的事发生过），班级 id 则是
      // 内部标识，凑齐了能用来枚举/构造深链接。要看完整值去看启动日志，
      // 那是登录才能看到的地方。
      lessons: {
        allDay: allDayConfigSummary().mode,
        allDayClassCount: allDayConfigSummary().classIds.length,
        tzOffsetMin: Number(process.env.MORNING_QUIZ_TZ_OFFSET_MIN ?? 8 * 60),
      },
    };
  }

  @Public()
  @Get('ready')
  async ready() {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        ok: true,
        db: 'up',
        dbLatencyMs: Date.now() - started,
        ts: new Date().toISOString(),
      };
    } catch (e: any) {
      // 503 so a deploy/readiness gate treats the instance as not-ready.
      throw new ServiceUnavailableException({
        ok: false,
        db: 'down',
        error: String(e?.message ?? e).slice(0, 200),
        ts: new Date().toISOString(),
      });
    }
  }
}
