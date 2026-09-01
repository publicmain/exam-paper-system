import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeTranslationService } from './realtime-translation.service';

const KEYS = [
  'AZURE_TRANSLATOR_KEY',
  'AZURE_TRANSLATOR_ENDPOINT',
  'AZURE_TRANSLATOR_REGION',
  'ANTHROPIC_API_KEY',
] as const;

describe('RealtimeTranslationService', () => {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  beforeEach(() => {
    process.env.AZURE_TRANSLATOR_KEY = 'test-secret-never-returned';
    process.env.AZURE_TRANSLATOR_ENDPOINT = 'https://translator.example.test/';
    process.env.AZURE_TRANSLATOR_REGION = 'southeastasia';
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of KEYS) {
      const value = saved[key];
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('Azure 请求边界固定，并在进程内缓存同一段文本', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [{ translations: [{ text: '悬索桥' }] }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const svc = new RealtimeTranslationService();

    await expect(svc.translate('suspension bridge')).resolves.toBe('悬索桥');
    await expect(svc.translate('  Suspension Bridge  ')).resolves.toBe('悬索桥');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://translator.example.test/translate?api-version=3.0&from=en&to=zh-Hans');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Ocp-Apim-Subscription-Key': 'test-secret-never-returned',
      'Ocp-Apim-Subscription-Region': 'southeastasia',
    });
    expect(JSON.parse(String(init.body))).toEqual([{ Text: 'suspension bridge' }]);
  });

  it('供应商失败时返回 null，不伪造翻译', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429 })));
    const svc = new RealtimeTranslationService();
    await expect(svc.translate('bumped')).resolves.toBeNull();
  });

  it('没配置密钥时使用免密公共接口支撑小规模试点', async () => {
    delete process.env.AZURE_TRANSLATOR_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ responseStatus: 200, responseData: { translatedText: '我们只是访客。' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const svc = new RealtimeTranslationService();
    await expect(svc.translate('We are only visitors.')).resolves.toBe('我们只是访客。');
    const url = String((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(url).toContain('api.mymemory.translated.net/get?');
    expect(new URL(url).searchParams.get('langpair')).toBe('en|zh-CN');
    expect(new URL(url).searchParams.get('q')).toBe('We are only visitors.');
  });
});
