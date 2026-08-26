import { describe, it, expect } from 'vitest';
import { needsFirstTeaching, needsReviewInteraction } from './first-teaching';

/**
 * P5 —— 「教过没有」的判据。
 *
 * 「教学只写一个字段、且与断点同事务」那组断言在
 * lesson/vocab-taught.spec.ts —— 收尾后写路径合并到了
 * markTaughtAndAdvance，这里只留纯判据。
 */

describe('needsFirstTeaching —— 判据', () => {
  it('从没评过分、也没教过 → 该教', () => {
    expect(needsFirstTeaching({ firstTaughtAt: null, reps: 0 })).toBe(true);
  });

  it('**教过了就不再教**（哪怕 reps 仍是 0）—— 否则天天教同一批词', () => {
    expect(needsFirstTeaching({ firstTaughtAt: new Date(), reps: 0 })).toBe(false);
  });

  it('存量词：评过分（reps>0）但没有 firstTaughtAt → 当复习词，不需要回填', () => {
    expect(needsFirstTeaching({ firstTaughtAt: null, reps: 3 })).toBe(false);
  });

  it('字段缺失（老代码路径没 select 到）按 0 处理，不会误判成已教', () => {
    expect(needsFirstTeaching({ firstTaughtAt: undefined, reps: undefined })).toBe(true);
  });

  it('ISO 字符串形态的 firstTaughtAt 同样算已教（跨 API 边界后是字符串）', () => {
    expect(needsFirstTeaching({ firstTaughtAt: '2026-08-27T00:00:00.000Z', reps: 0 })).toBe(false);
  });

  it('两条分支互斥且穷尽', () => {
    const cases = [
      { firstTaughtAt: null, reps: 0 },
      { firstTaughtAt: null, reps: 5 },
      { firstTaughtAt: new Date(), reps: 0 },
      { firstTaughtAt: new Date(), reps: 5 },
    ];
    for (const c of cases) {
      expect(needsFirstTeaching(c)).toBe(!needsReviewInteraction(c));
    }
  });
});

describe('P5 收尾 —— 死端点已清除', () => {
  it('**/vocab/first-taught 不再存在**：教学只剩 /lesson/vocab-taught 一条写路径', async () => {
    const { Test } = await import('@nestjs/testing');
    const { VocabController } = await import('./vocab.controller');
    const moduleRef = await Test.createTestingModule({ controllers: [VocabController] })
      .useMocker(() => ({}))
      .compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    const router = (app.getHttpServer() as any)._events.request._router;
    const paths: string[] = router.stack.filter((l: any) => l.route).map((l: any) => l.route.path);
    await app.close();

    // 分两步写会留下「cursor 前进了但 firstTaughtAt 没写上」的窗口。
    // 端点留着就是留着那条旁路 —— 删掉，别指望后人记得不要用。
    expect(paths).not.toContain('/api/vocab/first-taught');
    // 复习评分这条路不受影响
    expect(paths).toContain('/api/vocab/review');
  });
});
