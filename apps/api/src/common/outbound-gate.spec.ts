import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allowedOutboundCategories, assertOutboundAllowed, isOutboundAllowed, outboundFetch, outboundGateSummary } from './outbound-gate';
import { RealtimeTranslationService } from '../vocab/realtime-translation.service';
import { vocabularyContentProviderConfigured } from '../vocab-v2/content-producer';
import { WritingCheckService } from '../writing-check/writing-check.service';

beforeEach(() => {
  vi.stubEnv('OUTBOUND_ALLOW', undefined);
  vi.stubEnv('AZURE_TRANSLATOR_KEY', '');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unexpected network call')));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('outbound allowlist', () => {
  it('defaults to today\'s production behaviour minus the three new-cost / LLM categories', () => {
    const allowed = allowedOutboundCategories();
    for (const category of ['public_translation', 'web_push', 'azure_translator', 'pdf_worker', 'sentry', 'app_api'] as const) {
      expect(allowed).toContain(category);
    }
    for (const category of ['anthropic', 'openai', 'azure_speech'] as const) {
      expect(isOutboundAllowed(category)).toBe(false);
      expect(() => assertOutboundAllowed(category)).toThrow();
    }
    expect(fetch).toHaveBeenCalledTimes(0);
  });

  it.each(['', ' ', '*', 'OPENAI', 'openai_typo'])('fails closed for explicit %j', (value) => {
    vi.stubEnv('OUTBOUND_ALLOW', value);
    expect(allowedOutboundCategories()).toEqual([]);
  });

  it('trims and deduplicates exact categories; an explicit list replaces defaults', () => {
    vi.stubEnv('OUTBOUND_ALLOW', ' openai,openai, azure_translator,typo ');
    expect(allowedOutboundCategories()).toEqual(['openai', 'azure_translator']);
    expect(isOutboundAllowed('public_translation')).toBe(false);
  });

  it('reports a category without logging keys or unrecognized input', () => {
    vi.stubEnv('OUTBOUND_ALLOW', 'openai,do-not-log-this-secret');
    expect(outboundGateSummary()).toBe('Outbound allowed categories: openai');
    try { assertOutboundAllowed('anthropic'); } catch (error: any) {
      expect(error.getStatus()).toBe(503);
      expect(error.getResponse()).toMatchObject({ code: 'outbound_blocked', category: 'anthropic' });
    }
  });

  it('rejects concurrent/repeated attempts before dispatch', async () => {
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => outboundFetch('openai', 'https://example.invalid')));
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(0);
  });

  it('rechecks the policy for each request and shares the JS script policy', async () => {
    vi.stubEnv('OUTBOUND_ALLOW', 'openai');
    vi.mocked(fetch).mockResolvedValue(new Response('{}'));
    await outboundFetch('openai', 'https://example.invalid');
    const policy = require('./outbound-policy.cjs');
    expect(policy.allowedOutboundCategories()).toEqual(allowedOutboundCategories());
    vi.stubEnv('OUTBOUND_ALLOW', '');
    await expect(outboundFetch('openai', 'https://example.invalid')).rejects.toThrow();
    await expect(policy.outboundFetch('openai', 'https://example.invalid')).rejects.toMatchObject({ code: 'outbound_blocked', category: 'openai' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('translation and content availability', () => {
  it('keeps the existing free fallback available by default', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ responseData: { translatedText: '桥梁' } })));
    const service = new RealtimeTranslationService();
    expect(await service.translateDetailed('bridge')).toMatchObject({ text: '桥梁', status: 'ok', provider: 'pilot_free' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to Google only when the public category is allowed', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([[['桥梁']]])));
    expect(await new RealtimeTranslationService().translate('bridge')).toBe('桥梁');
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.stubEnv('OUTBOUND_ALLOW', '');
    expect(await new RealtimeTranslationService().translateDetailed('bridge')).toEqual({ text: null, status: 'disabled', retryable: false, provider: 'none' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not try Google if the gate is revoked while MyMemory is in flight', async () => {
    vi.mocked(fetch).mockImplementationOnce(async () => {
      vi.stubEnv('OUTBOUND_ALLOW', '');
      return new Response('{}', { status: 500 });
    });
    expect(await new RealtimeTranslationService().translate('bridge')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps cached results and empty-input handling local even after closure', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ responseData: { translatedText: '桥梁' } })));
    const service = new RealtimeTranslationService();
    await service.translate('bridge');
    vi.stubEnv('OUTBOUND_ALLOW', '');
    expect(await service.translateDetailed(' BRIDGE ')).toMatchObject({ text: '桥梁', status: 'cached' });
    expect(await service.translateDetailed(' ')).toMatchObject({ status: 'empty_input' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not let an Azure key bypass the gate or change the chosen provider', async () => {
    vi.stubEnv('OUTBOUND_ALLOW', 'public_translation,web_push');
    vi.stubEnv('AZURE_TRANSLATOR_KEY', 'fake-key');
    expect(await new RealtimeTranslationService().translateDetailed('bridge')).toMatchObject({ status: 'disabled', text: null });
    expect(fetch).toHaveBeenCalledTimes(0);
    vi.stubEnv('OUTBOUND_ALLOW', 'azure_translator');
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ translations: [{ text: '桥梁' }] }])));
    expect(await new RealtimeTranslationService().translate('bridge')).toBe('桥梁');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not start paid content production simply because keys exist', () => {
    vi.stubEnv('OUTBOUND_ALLOW', 'public_translation,web_push');
    vi.stubEnv('AZURE_OPENAI_ENDPOINT', 'https://example.invalid');
    vi.stubEnv('AZURE_OPENAI_API_KEY', 'fake-key');
    vi.stubEnv('AZURE_OPENAI_DEPLOYMENT', 'vocab');
    vi.stubEnv('AZURE_TRANSLATOR_KEY', 'fake-key');
    expect(vocabularyContentProviderConfigured()).toBe(false);
    vi.stubEnv('OUTBOUND_ALLOW', 'openai');
    expect(vocabularyContentProviderConfigured()).toBe(true);
    // 默认值（11-05 叶老师：维持现状只关三类）下翻译仍可用，内容生产另有 VOCAB_AUTO_CONTENT_ENABLED 开关管着。
    vi.stubEnv('OUTBOUND_ALLOW', undefined);
    expect(vocabularyContentProviderConfigured()).toBe(true);
  });

  it('tells callers writing checks are unavailable instead of claiming a clean answer', async () => {
    vi.stubEnv('OUTBOUND_ALLOW', 'public_translation,web_push');
    vi.stubEnv('LANGUAGETOOL_URL', 'https://example.invalid');
    const service = new WritingCheckService();
    expect(service.enabled()).toBe(false);
    await expect(service.check('Example')).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(0);
  });
});
