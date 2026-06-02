import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './common/auth.guard';
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
