import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

type Cached = { text: string; expiresAt: number };

/**
 * 实时英→简中翻译：Azure 优先；其次复用已有 Anthropic；两者都没配置时
 * 用 MyMemory + Google 网页翻译的免密链路支撑小规模试点。后者不是正式
 * Cloud Translation API，只在 MyMemory 被共享出口限流时兜底。只做 24 小时进程内缓存，
 * 不建翻译数据库。生产应配置 Azure，不能把公共免费额度当长期基础设施。
 */
@Injectable()
export class RealtimeTranslationService {
  private readonly logger = new Logger('RealtimeTranslation');
  private readonly cache = new Map<string, Cached>();
  private readonly anthropic: Anthropic | null;

  constructor() {
    const key = process.env.ANTHROPIC_API_KEY;
    this.anthropic = key ? new Anthropic({ apiKey: key, maxRetries: 1 }) : null;
  }

  async translate(text: string): Promise<string | null> {
    const source = text.trim();
    if (!source) return null;
    const key = source.toLowerCase();
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.text;
    let translated: string | null = null;
    try {
      translated = process.env.AZURE_TRANSLATOR_KEY
        ? await this.azure(source)
        : this.anthropic
          ? await this.anthropicFallback(source)
          : await this.pilotFallback(source);
    } catch (e) {
      this.logger.warn(`translation_failed:${String((e as Error)?.message ?? e).slice(0, 120)}`);
    }
    if (translated) this.cache.set(key, { text: translated, expiresAt: Date.now() + 86_400_000 });
    return translated;
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
    if (!response.ok) throw new Error(`azure_${response.status}`);
    const body = await response.json() as Array<{ translations?: Array<{ text?: string }> }>;
    return String(body?.[0]?.translations?.[0]?.text ?? '').trim() || null;
  }

  private async anthropicFallback(text: string): Promise<string | null> {
    if (!this.anthropic) return null;
    const response = await this.anthropic.messages.create({
      model: process.env.TRANSLATION_MODEL || 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      temperature: 0,
      system: 'Translate English learning material into concise, natural Simplified Chinese. Return only the translation, with no labels or explanation.',
      messages: [{ role: 'user', content: text }],
    });
    const block = response.content.find((x) => x.type === 'text');
    return block?.type === 'text' ? block.text.trim() || null : null;
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
    if (!response.ok) throw new Error(`google_web_${response.status}`);
    const body = await response.json() as [Array<[string?]>?];
    const translated = (body?.[0] ?? []).map((segment) => String(segment?.[0] ?? '')).join('').trim();
    return translated || null;
  }
}
