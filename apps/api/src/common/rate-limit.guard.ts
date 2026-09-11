import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  Optional,
  SetMetadata,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from './prisma.service';
import { loadAccountState, tokenStillValid } from './account-lifecycle';

/**
 * Lightweight per-route rate limiter.
 *
 * Why not @nestjs/throttler:
 *   - One extra runtime dep + a peer of cache-manager. The single-replica
 *     Railway deployment can use a process-local fixed-window counter and
 *     get the same protection from auth/login brute force, attendance/scan
 *     spam, and an authenticated student script burning the AI cap.
 *   - When we eventually go multi-replica (or want true distributed limits)
 *     we swap this guard for the throttler + a Redis store. The decorator
 *     contract — `@RateLimit({ limit, windowSec, scope })` — is intentionally
 *     identical to throttler's option shape so the migration is mechanical.
 *
 * Round-7 agent-2 H-9 + agent-9 SEC-11.
 */

export interface RateLimitOptions {
  /** Max requests in the window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
  /**
   * Per-IP (default) or per-user. user-scope falls back to IP if no
   * **verified, live** identity is on the request (see `userScopeId`).
   */
  scope?: 'ip' | 'user';
}

export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit = (opts: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, opts);

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger('RateLimitGuard');
  /**
   * key = `${routeKey}:${scope-id}` so two routes don't share a counter.
   * routeKey is derived from the handler+class so renames preserve the
   * same bucket as long as the route stays.
   */
  private readonly buckets = new Map<string, Bucket>();
  /** Run a tiny GC every N hits so the map can't grow unbounded over weeks
   *  of uptime (each unique IP × each rate-limited route → one entry). */
  private hitsSinceGc = 0;

  constructor(
    private readonly reflector: Reflector,
    // 按用户限流要自己验签取身份（见 userScopeId）。全局 JwtModule 与
    // PrismaService 一定会注入；@Optional 只是让既有单测
    // `new RateLimitGuard(new Reflector())` 照常能建。
    @Optional() private readonly jwt?: JwtService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!opts) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const routeKey = `${ctx.getClass().name}.${ctx.getHandler().name}`;
    const userScope = opts.scope === 'user' ? await this.userScopeId(req) : null;
    const scopeId = userScope ?? `ip:${this.getClientIp(req)}`;
    const key = `${routeKey}:${scopeId}`;
    const now = Date.now();
    const windowMs = opts.windowSec * 1000;

    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;

    this.hitsSinceGc += 1;
    if (this.hitsSinceGc > 1000) {
      this.hitsSinceGc = 0;
      this.gc(now);
    }

    if (bucket.count > opts.limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      // 429 with Retry-After lets clients (and Cloudflare) back off cleanly.
      const res = ctx.switchToHttp().getResponse();
      try {
        res.setHeader?.('Retry-After', String(retryAfter));
      } catch {
        /* response may not be express in tests */
      }
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  /**
   * user scope 的分桶身份（2026-09-11 审计 S06）。
   *
   * ## 修之前
   *
   * 这里只读 `req.user`。可本守卫是**第一个**全局守卫 —— 跑的时候 AuthGuard
   * 还没把身份挂上去，新学生接口的身份又在更靠后的控制器守卫
   * （`req.studentAuth`）里。结果所有声明了 `scope: 'user'` 的路由实际都落在
   * IP 桶：全校共用一个出口 IP，一个学生刷满额度，全班一起 429。
   *
   * ## 修之后
   *
   *   1. 已经有**验证过**的身份（`req.user`，只有验签的守卫会写它）就用它；
   *   2. 否则自己**验签** Bearer 令牌 —— 绝不从未验签的 JWT 里读 id；
   *   3. 再按与两道认证守卫**同一个判据**确认令牌仍有效（撤销 / 停用 /
   *      归档的令牌不配拥有用户桶，否则拿一张废票就能刷掉本人的额度）。
   *      账号状态按请求缓存，后面的 AuthGuard / StudentIdentityGuard 复用
   *      这一次查询，不多一次往返；
   *   4. 任何一步不成立 → 返回 null，调用方落 IP 桶：匿名暴力照旧受 IP 防护。
   *
   * 教师只读视角（teacher_view）单独分桶（按教师 + 学生），不挤占学生本人的额度。
   */
  private async userScopeId(req: Request & { user?: { id?: string } }): Promise<string | null> {
    if (typeof req.user?.id === 'string' && req.user.id) return `u:${req.user.id}`;
    if (!this.jwt) return null;
    const header = req.headers?.['authorization'];
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
    let payload: { id?: unknown; role?: unknown; av?: unknown; scope?: unknown; actorId?: unknown };
    try {
      payload = await this.jwt.verifyAsync(header.slice('Bearer '.length));
    } catch {
      return null;
    }
    const id = typeof payload?.id === 'string' ? payload.id : '';
    if (!id) return null;
    if (this.prisma) {
      const row = await loadAccountState(this.prisma, id, req);
      if (!tokenStillValid(row, payload)) return null;
    }
    if (payload.scope === 'teacher_view') {
      return `tv:${typeof payload.actorId === 'string' ? payload.actorId : '?'}:${id}`;
    }
    return `u:${id}`;
  }

  /** First-pass IP detection. main.ts sets 'trust proxy=1' so req.ip is
   *  the upstream X-Forwarded-For when fronted by Railway/Cloudflare. */
  private getClientIp(req: Request): string {
    return (
      (req as any).ip ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  private gc(now: number) {
    let removed = 0;
    for (const [k, b] of this.buckets) {
      if (b.resetAt <= now) {
        this.buckets.delete(k);
        removed += 1;
      }
    }
    if (removed > 100) {
      this.logger.debug?.(`rate-limit gc removed ${removed} expired buckets`);
    }
  }

  /** Test hook — clear all counters between tests. */
  reset() {
    this.buckets.clear();
    this.hitsSinceGc = 0;
  }
}
