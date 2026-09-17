import { describe, expect, it } from 'vitest';
import { assertModuleEnabled, enabledModules, moduleEnabled } from './product-modules';

describe('产品模块开关', () => {
  it('徽章独立发布：只默认开放 achievements，其他升级模块关闭', () => {
    const m = enabledModules({});
    expect(m.coach).toBe(false);
    expect(m.growth).toBe(false);
    expect(m.achievements).toBe(true);
    expect(m.teaching).toBe(false);
    expect(Object.entries(m).filter(([, enabled]) => enabled).map(([key]) => key)).toEqual(['achievements']);
    expect(m.leaderboard).toBe(false);
  });

  it('PRODUCT_MODULES_OFF 关掉、PRODUCT_MODULES_ON 打开；两边都写按关处理', () => {
    expect(moduleEnabled('coach', { PRODUCT_MODULES_OFF: 'growth, coach' })).toBe(false);
    expect(moduleEnabled('growth', { PRODUCT_MODULES_OFF: 'growth, coach' })).toBe(false);
    expect(moduleEnabled('achievements', { PRODUCT_MODULES_OFF: 'growth, coach' })).toBe(true);
    expect(moduleEnabled('leaderboard', { PRODUCT_MODULES_ON: 'leaderboard' })).toBe(true);
    expect(moduleEnabled('leaderboard', { PRODUCT_MODULES_ON: 'leaderboard', PRODUCT_MODULES_OFF: 'leaderboard' })).toBe(false);
  });

  it('关着时 assertModuleEnabled 抛 503 module_off，并说是哪个模块', () => {
    expect(() => assertModuleEnabled('coach', { PRODUCT_MODULES_OFF: 'coach' })).toThrow();
    try {
      assertModuleEnabled('coach', { PRODUCT_MODULES_OFF: 'coach' });
    } catch (e: any) {
      expect(e.getStatus()).toBe(503);
      expect(e.getResponse()).toMatchObject({ code: 'module_off', module: 'coach' });
    }
    expect(() => assertModuleEnabled('achievements', {})).not.toThrow();
  });
});
