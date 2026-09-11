/**
 * VOC15 · Azure 失败时的降级与诚实反馈（审计 2026-09-11 §5.3）。
 *
 * 全部用 fetch mock，零真实网络、零付费调用。策略（与服务注释一致）：
 *   · 配了 Azure key 就只用 Azure —— 不静默把学生文本送给另一家供应商；
 *   · 成功结果进程内缓存 24 小时；
 *   · 429 → 按 Retry-After 冷却（上限 60 秒），冷却期内不再打 Azure；
 *   · 5xx / 超时 → 返回「暂不可用、可重试」，不缓存失败、不编造翻译；
 *   · 返回里一个汉字都没有（原样回显英文）→ 当作没有可靠中文，不显示。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeTranslationService } from './realtime-translation.service';

const KEYS = ['AZURE_TRANSLATOR_KEY', 'AZURE_TRANSLATOR_ENDPOINT', 'AZURE_TRANSLATOR_REGION'] as const;

function azureOk(text: string) {
  return { ok: true, status: 200, headers: new Headers(), json: async () => [{ translations: [{ text }] }] };
}

describe('VOC15 实时翻译的失败口径', () => {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  beforeEach(() => {
    process.env.AZURE_TRANSLATOR_KEY = 'test-secret-never-returned';
    process.env.AZURE_TRANSLATOR_ENDPOINT = 'https://translator.example.test/';
    delete process.env.AZURE_TRANSLATOR_REGION;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of KEYS) {
      const value = saved[key];
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('429：返回「限流、可重试」+ 等待秒数；冷却期内不再打 Azure，也不换别家', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 429, headers: new Headers({ 'retry-after': '5' }) }));
    vi.stubGlobal('fetch', fetchMock);
    const svc = new RealtimeTranslationService();
    const first = await svc.translateDetailed('bumped');
    expect(first).toEqual(expect.objectContaining({ text: null, status: 'rate_limited', retryable: true, retryAfterSec: 5 }));
    const second = await svc.translateDetailed('another word');
    expect(second.status).toBe('cooling_down');
    expect(second.text).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain('translator.example.test');
  });

  it('500：暂不可用、可重试；只打了 Azure，不偷偷退到免费通道', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500, headers: new Headers() }));
    vi.stubGlobal('fetch', fetchMock);
    const svc = new RealtimeTranslationService();
    const result = await svc.translateDetailed('harbour');
    expect(result).toEqual(expect.objectContaining({ text: null, status: 'provider_error', retryable: true }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // 失败不缓存：稍后重试会真的再问一次
    vi.stubGlobal('fetch', vi.fn(async () => azureOk('海港')));
    await expect(svc.translateDetailed('harbour')).resolves.toEqual(expect.objectContaining({ text: '海港', status: 'ok' }));
  });

  it('超时：timeout、可重试', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const error = new Error('The operation was aborted due to timeout');
      error.name = 'TimeoutError';
      throw error;
    }));
    const svc = new RealtimeTranslationService();
    await expect(svc.translateDetailed('slow')).resolves.toEqual(expect.objectContaining({ text: null, status: 'timeout', retryable: true }));
  });

  it('返回里没有中文（原样回显英文）：不当成翻译显示', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => azureOk('Tekong')));
    const svc = new RealtimeTranslationService();
    const result = await svc.translateDetailed('Tekong');
    expect(result.text).toBeNull();
    expect(result.status).toBe('no_chinese');
    await expect(svc.translate('Tekong')).resolves.toBeNull();
  });

  it('成功一次后命中缓存（status=cached），兼容旧的 translate() 返回字符串', async () => {
    const fetchMock = vi.fn(async () => azureOk('悬索桥'));
    vi.stubGlobal('fetch', fetchMock);
    const svc = new RealtimeTranslationService();
    await expect(svc.translateDetailed('suspension bridge')).resolves.toEqual(expect.objectContaining({ text: '悬索桥', status: 'ok' }));
    await expect(svc.translateDetailed('Suspension Bridge')).resolves.toEqual(expect.objectContaining({ text: '悬索桥', status: 'cached' }));
    await expect(svc.translate('suspension bridge')).resolves.toBe('悬索桥');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('空输入不调用任何接口', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const svc = new RealtimeTranslationService();
    await expect(svc.translateDetailed('   ')).resolves.toEqual(expect.objectContaining({ text: null, status: 'empty_input', retryable: false }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
