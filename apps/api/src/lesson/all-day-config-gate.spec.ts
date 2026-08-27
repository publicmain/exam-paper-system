import { describe, it, expect, afterEach } from 'vitest';
import { assertAllDayConfig, allDayEnabled, allDayConfigSummary } from './all-day';

/**
 * 发布前审查 —— **配置错了就别起来**。
 *
 * 静默回退是这类开关最危险的失败方式：服务照常起来、日志一切正常、
 * 学生进不去，而没有任何人知道是一个拼写错误造成的。
 *
 * 具体的坑：光看字符串分不清「拼错的布尔值」和「班级 id」。
 * `MORNING_QUIZ_ALL_DAY=ture` 曾经会被当成一个叫 ture 的班 —— 于是
 * 每个班都不开，运维以为全天已经打开了。
 */

const ENV = process.env.MORNING_QUIZ_ALL_DAY;
const NODE = process.env.NODE_ENV;
const set = (v?: string, nodeEnv?: string) => {
  if (v === undefined) delete process.env.MORNING_QUIZ_ALL_DAY;
  else process.env.MORNING_QUIZ_ALL_DAY = v;
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
};
afterEach(() => {
  if (ENV === undefined) delete process.env.MORNING_QUIZ_ALL_DAY;
  else process.env.MORNING_QUIZ_ALL_DAY = ENV;
  if (NODE === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = NODE;
});

describe('合法配置', () => {
  it.each(['on', 'true', 'all', '1', 'ON', 'True'])('全班开：%s', (v) => {
    set(v, 'production');
    expect(assertAllDayConfig().ok).toBe(true);
    expect(allDayEnabled('c1')).toBe(true);
  });

  it.each(['off', 'false', '0', 'OFF'])('全班关：%s', (v) => {
    set(v, 'production');
    expect(assertAllDayConfig().ok).toBe(true);
    expect(allDayEnabled('c1')).toBe(false);
  });

  it('未设置 → 合法且关闭', () => {
    set(undefined, 'production');
    expect(assertAllDayConfig().ok).toBe(true);
    expect(allDayEnabled('c1')).toBe(false);
  });

  it('按班灰度必须带 class: 前缀', () => {
    set('class:c1, c3', 'production');
    expect(assertAllDayConfig().ok).toBe(true);
    expect(allDayEnabled('c1')).toBe(true);
    expect(allDayEnabled('c3')).toBe(true);
    expect(allDayEnabled('c2')).toBe(false);
    expect(allDayConfigSummary()).toEqual({
      mode: 'per-class', raw: 'class:c1, c3', classIds: ['c1', 'c3'],
    });
  });
});

describe('非法配置在生产环境被拒', () => {
  it.each(['ture', 'yes', 'enabled', 'TRUE ON', 'class:'])(
    '**%s → 不合法**（生产下应当拒绝启动，而不是静默当成关）',
    (v) => {
      set(v, 'production');
      const r = assertAllDayConfig();
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain('MORNING_QUIZ_ALL_DAY');
      // 就算有人忽略了这个结果，行为上也必须是「关」，不能误开
      expect(allDayEnabled('c1')).toBe(false);
      expect(allDayConfigSummary().mode).toBe('invalid');
    },
  );

  it('**不带前缀的班级列表在生产下也不接受**（与 ture 长得一样，分不出来）', () => {
    set('c1,c3', 'production');
    expect(assertAllDayConfig().ok).toBe(false);
    expect(allDayEnabled('c1')).toBe(false);
  });

  it('同一个值在非生产环境仍按班级列表解析（不挡本地开发与既有脚本）', () => {
    set('c1,c3', 'test');
    expect(assertAllDayConfig().ok).toBe(true);
    expect(allDayEnabled('c1')).toBe(true);
  });
});

describe('公开端点不泄露配置细节', () => {
  it('summary 里仍有原始值和班级 id —— 那是给**启动日志**用的', () => {
    set('class:c1', 'production');
    const sum = allDayConfigSummary();
    expect(sum.raw).toBe('class:c1');
    expect(sum.classIds).toEqual(['c1']);
    // health.controller 只取 mode 与 classIds.length，不取这两个字段；
    // 这条测试在 health.controller.spec 里从另一头钉住。
  });
});
