import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

/**
 * 写作自查 —— 学生交卷前的拼写和语法提示。
 *
 * ## 为什么有这个
 *
 * 首发第一周判简答题，丢分里相当一部分是手误而不是没懂：`bule`（blue）、
 * `internets`（interests）、`he away give wirter pen`、`she have a blue umbrella`。
 * 这些机器当场就能指出来。学生自己订正完再交，判分人看到的就只剩内容问题。
 *
 * ## 边界（重要）
 *
 * 它**只说英文写得对不对，不说答得对不对**。不碰参考答案、不碰分数、不写任何
 * 判分字段 —— 所以它是「写作反馈」不是「判分」，与零 Anthropic 调用的铁律无关。
 *
 * ## 后端
 *
 * LanguageTool（开源，可自托管，文本不出自己的服务器）。地址从
 * `LANGUAGETOOL_URL` 读，**没配就整个功能关掉**：接口回 503 `writing_check_disabled`，
 * 学生端据此把提示区藏起来，作答和交卷一切照常。
 *
 * 不默认指向 languagetool.org 的公共接口：那会把学生写的东西发给第三方，
 * 而且一个学校共用一个出口 IP，公共接口的限流一节课就打满。
 */
@Injectable()
export class WritingCheckService {
  private readonly logger = new Logger(WritingCheckService.name);

  /** 一次最多看这么多字符 —— O-Level 8 分题也就 100 词上下。 */
  private static readonly MAX_CHARS = 2000;

  private endpoint(): string | null {
    const base = String(process.env.LANGUAGETOOL_URL ?? '').trim().replace(/\/+$/, '');
    if (!base) return null;
    return base.endsWith('/v2') ? `${base}/check` : `${base}/v2/check`;
  }

  enabled(): boolean {
    return this.endpoint() != null;
  }

  async check(text: string): Promise<{ issues: WritingIssue[] }> {
    const url = this.endpoint();
    if (!url) throw new ServiceUnavailableException({ code: 'writing_check_disabled' });

    const body = new URLSearchParams({
      text: String(text ?? '').slice(0, WritingCheckService.MAX_CHARS),
      language: 'en-GB',
      // 只要拼写和语法，不要风格说教 —— 中学生看不懂「这句话太长」这类建议，
      // 而且我们不希望它对学生的表达指手画脚。
      disabledCategories: 'STYLE,REDUNDANCY,TYPOGRAPHY,CASING,COLLOQUIALISMS',
    });

    let payload: LanguageToolResponse;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body,
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`LanguageTool ${res.status}`);
        payload = (await res.json()) as LanguageToolResponse;
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      // 查不了不该挡住学生答题 —— 回一个空结果，前端什么都不显示。
      this.logger.warn(`writing check failed: ${(e as Error).message}`);
      return { issues: [] };
    }

    const issues: WritingIssue[] = [];
    for (const m of payload.matches ?? []) {
      if (issues.length >= 12) break;
      const offset = Number(m.offset ?? 0);
      const length = Number(m.length ?? 0);
      issues.push({
        offset,
        length,
        text: String(text).slice(offset, offset + length),
        kind: m.rule?.issueType === 'misspelling' ? 'spelling' : 'grammar',
        message: String(m.shortMessage || m.message || '').slice(0, 120),
        suggestions: (m.replacements ?? []).slice(0, 3).map((r) => String(r.value)).filter(Boolean),
      });
    }
    return { issues };
  }
}

export interface WritingIssue {
  offset: number;
  length: number;
  /** 出问题的那几个字，前端直接显示，不用自己按 offset 去切。 */
  text: string;
  kind: 'spelling' | 'grammar';
  message: string;
  suggestions: string[];
}

interface LanguageToolResponse {
  matches?: Array<{
    offset?: number;
    length?: number;
    message?: string;
    shortMessage?: string;
    rule?: { issueType?: string };
    replacements?: Array<{ value?: string }>;
  }>;
}
