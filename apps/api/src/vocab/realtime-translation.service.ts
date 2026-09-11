import { Injectable, Logger } from '@nestjs/common';

type Cached = { text: string; expiresAt: number };

/**
 * 一次翻译的结果（VOC15，2026-09-11）。调用方据此给学生说人话：
 * 「暂时翻不了，稍后再试」和「这个词没有可靠中文」是两件事，都不能显示假翻译。
 */
export type TranslationStatus =
  | 'ok'
  | 'cached'
  | 'empty_input'
  /** 429：供应商限流 */
  | 'rate_limited'
  /** 429 之后的冷却期内，本进程不再打供应商 */
  | 'cooling_down'
  /** 5xx / 其他 HTTP 错误 / 响应格式不对 */
  | 'provider_error'
  | 'timeout'
  /** 供应商回来了，但一个汉字都没有（多半是原样回显英文）—— 不当成翻译 */
  | 'no_chinese'
  /** 网络层失败（DNS、连接被拒…） */
  | 'network_error';

export interface TranslationResult {
  text: string | null;
  status: TranslationStatus;
  retryable: boolean;
  retryAfterSec?: number;
  provider: 'azure' | 'pilot_free' | 'cache' | 'none';
}

const CJK = /[㐀-鿿豈-﫿]/;
const MAX_COOLDOWN_MS = 60_000;
const DEFAULT_COOLDOWN_MS = 30_000;

class ProviderHttpError extends Error {
  constructor(public readonly status: number, public readonly retryAfterSec: number | null) {
    super(`http_${status}`);
  }
}

/**
 * 实时英→简中翻译。
 *
 * ## 供应商策略（VOC15 明确下来，不是「自动故障切换」）
 *
 * - **配了 `AZURE_TRANSLATOR_KEY` → 只用 Azure。** Azure 失败时**不**静默把学生
 *   文本改送 MyMemory / Google —— 那等于未经核对隐私、费用、授权就换了供应商。
 * - 没配 key 时（本地 / staging 小规模试点）才走 MyMemory → Google 网页翻译的免密
 *   链路；它不是正式 Cloud Translation API，不能当长期基础设施。
 * - 成功结果进程内缓存 24 小时；失败**不**缓存（学生点「重试」时真的再问一次）。
 * - 429 → 按 `Retry-After` 冷却（上限 60 秒，缺省 30 秒），冷却期内直接返回
 *   `cooling_down`，不再打供应商、也不产生费用。
 * - 返回里没有汉字 → `no_chinese`，调用方显示「暂无可靠中文」，不把英文回显当翻译。
 * - 词典 / 本地词表由调用方先查（`VocabService`、`collect`），这里只管机翻。
 *
 * 旧接口 `translate()` 保留：成功返回字符串，其余一律 null。
 */
@Injectable()
export class RealtimeTranslationService {
  private readonly logger = new Logger('RealtimeTranslation');
  private readonly cache = new Map<string, Cached>();
  private coolingUntil = 0;

  async translate(text: string): Promise<string | null> {
    return (await this.translateDetailed(text)).text;
  }

  async translateDetailed(text: string): Promise<TranslationResult> {
    const source = String(text ?? '').trim();
    if (!source) return { text: null, status: 'empty_input', retryable: false, provider: 'none' };
    const key = source.toLowerCase();
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return { text: hit.text, status: 'cached', retryable: false, provider: 'cache' };

    const useAzure = Boolean(process.env.AZURE_TRANSLATOR_KEY);
    const provider = useAzure ? 'azure' : 'pilot_free';
    if (useAzure && this.coolingUntil > Date.now()) {
      return {
        text: null,
        status: 'cooling_down',
        retryable: true,
        retryAfterSec: Math.max(1, Math.ceil((this.coolingUntil - Date.now()) / 1000)),
        provider,
      };
    }

    let translated: string | null;
    try {
      translated = useAzure ? await this.azure(source) : await this.pilotFallback(source);
    } catch (error) {
      return this.failure(error, provider);
    }
    const clean = String(translated ?? '').trim();
    if (!clean) return { text: null, status: 'provider_error', retryable: true, provider };
    if (!CJK.test(clean)) return { text: null, status: 'no_chinese', retryable: false, provider };
    this.cache.set(key, { text: clean, expiresAt: Date.now() + 86_400_000 });
    return { text: clean, status: 'ok', retryable: false, provider };
  }

  private failure(error: unknown, provider: TranslationResult['provider']): TranslationResult {
    const message = String((error as Error)?.message ?? error).slice(0, 120);
    if (error instanceof ProviderHttpError) {
      this.logger.warn(`translation_failed:${message}`);
      if (error.status === 429) {
        const waitMs = Math.min(MAX_COOLDOWN_MS, error.retryAfterSec != null ? error.retryAfterSec * 1000 : DEFAULT_COOLDOWN_MS);
        if (provider === 'azure') this.coolingUntil = Date.now() + waitMs;
        return { text: null, status: 'rate_limited', retryable: true, retryAfterSec: Math.ceil(waitMs / 1000), provider };
      }
      // 401/403 是配置问题，重试没用；5xx 可以稍后再试。
      return { text: null, status: 'provider_error', retryable: error.status >= 500, provider };
    }
    const name = (error as { name?: string })?.name;
    this.logger.warn(`translation_failed:${message}`);
    if (name === 'TimeoutError' || name === 'AbortError') return { text: null, status: 'timeout', retryable: true, provider };
    return { text: null, status: 'network_error', retryable: true, provider };
  }

  private async pilotFallback(text: string): Promise<string | null> {
    try {
      const translated = await this.myMemory(text);
      if (translated) return translated;
    } catch (e) {
      this.logger.warn(`mymemory_fallback:${String((e as Error)?.message ?? e).slice(0, 120)}`);
    }
    return this.googleWeb(text);
  }

  private async azure(text: string): Promise<string | null> {
    const endpoint = (process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com').replace(/\/$/, '');
    const region = process.env.AZURE_TRANSLATOR_REGION;
    const response = await fetch(`${endpoint}/translate?api-version=3.0&from=en&to=zh-Hans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': process.env.AZURE_TRANSLATOR_KEY!,
        ...(region ? { 'Ocp-Apim-Subscription-Region': region } : {}),
      },
      body: JSON.stringify([{ Text: text }]),
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) {
      const retryAfter = Number((response as { headers?: Headers }).headers?.get?.('retry-after'));
      throw new ProviderHttpError(response.status, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null);
    }
    const body = await response.json() as Array<{ translations?: Array<{ text?: string }> }>;
    return String(body?.[0]?.translations?.[0]?.text ?? '').trim() || null;
  }

  private async myMemory(text: string): Promise<string | null> {
    // 官方单次上限 500 bytes。这里按 UTF-8 字节裁剪，避免一句超长文章把
    // 整个请求拒掉；正常阅读原句远低于这个上限。
    let source = text;
    while (Buffer.byteLength(source, 'utf8') > 480) source = source.slice(0, -1);
    const query = new URLSearchParams({ q: source, langpair: 'en|zh-CN', mt: '1' });
    const response = await fetch(`https://api.mymemory.translated.net/get?${query.toString()}`, {
      signal: AbortSignal.timeout(4_000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`mymemory_${response.status}`);
    const body = await response.json() as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };
    if (body.responseStatus && body.responseStatus >= 400) {
      throw new Error(`mymemory_${body.responseStatus}`);
    }
    const translated = String(body.responseData?.translatedText ?? '').trim();
    if (!translated || /^MYMEMORY WARNING/i.test(translated)) return null;
    return translated;
  }

  private async googleWeb(text: string): Promise<string | null> {
    const query = new URLSearchParams({ client: 'gtx', sl: 'en', tl: 'zh-CN', dt: 't', q: text });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${query.toString()}`, {
      signal: AbortSignal.timeout(4_000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new ProviderHttpError(response.status, null);
    const body = await response.json() as [Array<[string?]>?];
    const translated = (body?.[0] ?? []).map((segment) => String(segment?.[0] ?? '')).join('').trim();
    return translated || null;
  }
}
