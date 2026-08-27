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

  it('**公开的 liveness 不泄露全天配置的原始值与班级 id**', () => {
    // 这个端点带 @Public（Railway 健康检查要打它）。原始环境值可能被
    // 误配成别的东西，班级 id 是内部标识 —— 两者都只该出现在启动日志里。
    const prev = process.env.MORNING_QUIZ_ALL_DAY;
    process.env.MORNING_QUIZ_ALL_DAY = 'class:cls_secret_a,cls_secret_b';
    try {
      const r: any = make(async () => [1]).health();
      expect(r.lessons.allDay).toBe('per-class');
      expect(r.lessons.allDayClassCount).toBe(2);
      const body = JSON.stringify(r);
      expect(body).not.toContain('cls_secret_a');
      expect(body).not.toContain('class:');
      expect(r.lessons).not.toHaveProperty('allDayRaw');
      expect(r.lessons).not.toHaveProperty('allDayClasses');
    } finally {
      if (prev === undefined) delete process.env.MORNING_QUIZ_ALL_DAY;
      else process.env.MORNING_QUIZ_ALL_DAY = prev;
    }
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
