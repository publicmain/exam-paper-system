import { describe, it, expect } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

/** Build a controller with a stub Prisma whose $queryRaw we control. */
function make(queryRaw: (...args: any[]) => Promise<any>) {
  return new HealthController({ $queryRaw: queryRaw } as any);
}

describe('HealthController', () => {
  it('liveness returns ok + uptime and does NOT touch the DB', () => {
    let dbHit = false;
    const c = make(async () => {
      dbHit = true;
      return [1];
    });
    const r = c.health();
    expect(r.ok).toBe(true);
    expect(typeof r.uptimeSec).toBe('number');
    expect(r.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(r).toHaveProperty('node');
    expect(dbHit).toBe(false); // liveness must stay DB-independent for Railway
  });

  it('readiness returns ok + db=up + latency when the query resolves', async () => {
    const c = make(async () => [{ '?column?': 1 }]);
    const r = await c.ready();
    expect(r.ok).toBe(true);
    expect(r.db).toBe('up');
    expect(typeof r.dbLatencyMs).toBe('number');
  });

  it('readiness throws 503 ServiceUnavailable when the DB query rejects', async () => {
    const c = make(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(c.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
