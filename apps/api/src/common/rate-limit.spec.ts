import { describe, it, expect, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { RateLimitGuard, RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.guard';

/** Build a fake ExecutionContext with the given decorator metadata + IP. */
function makeCtx(opts: RateLimitOptions | null, ip: string, userId?: string) {
  const handler = function fakeHandler() {} as any;
  const klass = function FakeController() {} as any;
  if (opts) Reflect.defineMetadata(RATE_LIMIT_KEY, opts, handler);
  const req: any = {
    ip,
    headers: {},
    socket: { remoteAddress: ip },
    user: userId ? { id: userId } : undefined,
  };
  const res: any = { setHeader: () => {} };
  return {
    getHandler: () => handler,
    getClass: () => klass,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as ExecutionContext;
}

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;

  beforeEach(() => {
    guard = new RateLimitGuard(new Reflector());
  });

  it('passes when no @RateLimit metadata is present', async () => {
    const ctx = makeCtx(null, '1.1.1.1');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows up to limit, blocks the (limit+1)-th', async () => {
    const opts: RateLimitOptions = { limit: 3, windowSec: 60 };
    const ip = '2.2.2.2';
    for (let i = 0; i < 3; i++) {
      await expect(guard.canActivate(makeCtx(opts, ip))).resolves.toBe(true);
    }
    await expect(guard.canActivate(makeCtx(opts, ip))).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('separate IPs have separate buckets', async () => {
    const opts: RateLimitOptions = { limit: 1, windowSec: 60 };
    await guard.canActivate(makeCtx(opts, '3.3.3.3'));
    await expect(guard.canActivate(makeCtx(opts, '4.4.4.4'))).resolves.toBe(true);
  });

  it('user scope partitions by user id, not IP', async () => {
    const opts: RateLimitOptions = { limit: 1, windowSec: 60, scope: 'user' };
    // Same IP, different users → both pass first hit.
    await guard.canActivate(makeCtx(opts, '5.5.5.5', 'u1'));
    await expect(
      guard.canActivate(makeCtx(opts, '5.5.5.5', 'u2')),
    ).resolves.toBe(true);
    // Same user, second hit → 429.
    await expect(
      guard.canActivate(makeCtx(opts, '5.5.5.5', 'u1')),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('user-scope falls back to IP when no user', async () => {
    const opts: RateLimitOptions = { limit: 1, windowSec: 60, scope: 'user' };
    await guard.canActivate(makeCtx(opts, '6.6.6.6'));
    await expect(
      guard.canActivate(makeCtx(opts, '6.6.6.6')),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('429 carries retryAfter in the body', async () => {
    const opts: RateLimitOptions = { limit: 1, windowSec: 60 };
    await guard.canActivate(makeCtx(opts, '7.7.7.7'));
    try {
      await guard.canActivate(makeCtx(opts, '7.7.7.7'));
      throw new Error('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(HttpException);
      const body = e.getResponse();
      expect(body.statusCode).toBe(429);
      expect(typeof body.retryAfter).toBe('number');
      expect(body.retryAfter).toBeGreaterThan(0);
    }
  });
});
