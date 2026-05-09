import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

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
  /** Per-IP (default) or per-user. user-scope falls back to IP if no user. */
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

  constructor(private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!opts) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const routeKey = `${ctx.getClass().name}.${ctx.getHandler().name}`;
    const scopeId =
      opts.scope === 'user' && req.user?.id
        ? `u:${req.user.id}`
        : `ip:${this.getClientIp(req)}`;
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
