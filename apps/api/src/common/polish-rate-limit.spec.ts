import { afterEach, describe, expect, it, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { AudioController } from '../audio/audio.controller';
import { NoSchoolDaysController } from '../classes/no-school-days.controller';
import { LearningReportController } from '../learning-report/learning-report.controller';
import { RATE_LIMIT_KEY, RateLimitGuard, type RateLimitOptions } from './rate-limit.guard';

const routes = [
  { controller: AudioController, handler: AudioController.prototype.sentence, limit: 300, scope: 'ip' },
  ...(['list', 'add', 'remove'] as const).map((name) => ({ controller: NoSchoolDaysController, handler: NoSchoolDaysController.prototype[name], limit: 30, scope: 'user' })),
  ...(['today', 'week'] as const).map((name) => ({ controller: LearningReportController, handler: LearningReportController.prototype[name], limit: 30, scope: 'user' })),
];
function context(route: typeof routes[number], ip = '192.0.2.1', userId = 'teacher-1') {
  return {
    getHandler: () => route.handler, getClass: () => route.controller,
    switchToHttp: () => ({ getRequest: () => ({ ip, headers: {}, user: { id: userId } }), getResponse: () => ({ setHeader: vi.fn() }) }),
  } as unknown as ExecutionContext;
}
afterEach(() => vi.restoreAllMocks());
describe.each(routes)('$controller.name.$handler.name rate limit', (route) => {
  it('declares the expected scope and one-minute allowance', () => {
    expect(Reflect.getMetadata(RATE_LIMIT_KEY, route.handler)).toEqual({ limit: route.limit, windowSec: 60, scope: route.scope });
  });
  it('allows concurrent requests up to the boundary, blocks repeated excess requests, and resets after one minute', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(100_000);
    const guard = new RateLimitGuard(new Reflector());
    const results = await Promise.all(Array.from({ length: route.limit }, () => guard.canActivate(context(route))));
    expect(results.every(Boolean)).toBe(true);
    for (let i = 0; i < 2; i++) await expect(guard.canActivate(context(route))).rejects.toMatchObject({ status: 429 });
    // Audio shares the school IP bucket; teachers on that same IP have separate buckets.
    const other = route.scope === 'ip' ? context(route, '192.0.2.2') : context(route, '192.0.2.1', 'teacher-2');
    await expect(guard.canActivate(other)).resolves.toBe(true);
    const same = route.scope === 'ip' ? context(route, '192.0.2.1', 'teacher-2') : context(route, '192.0.2.2');
    await expect(guard.canActivate(same)).rejects.toMatchObject({ status: 429 });
    now.mockReturnValue(159_999);
    await expect(guard.canActivate(context(route))).rejects.toMatchObject({ status: 429 });
    now.mockReturnValue(160_000);
    await expect(guard.canActivate(context(route))).resolves.toBe(true);
  });
});
