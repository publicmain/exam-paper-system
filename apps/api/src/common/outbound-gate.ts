import { ServiceUnavailableException } from '@nestjs/common';

export type OutboundCategory =
  | 'anthropic' | 'openai' | 'azure_speech' | 'azure_translator'
  | 'public_translation' | 'web_push' | 'language_tool' | 'pdf_worker'
  | 'code_runner' | 'wechat_webhook' | 'sentry' | 'content_source'
  | 'source_download' | 'app_api' | 'pdf_assets' | 'other';

// Keep the policy dependency-free so operational scripts use the same rules.
const policy = require('./outbound-policy.cjs');

export function allowedOutboundCategories(env: NodeJS.ProcessEnv = process.env): OutboundCategory[] {
  return policy.allowedOutboundCategories(env);
}

export function isOutboundAllowed(category: OutboundCategory): boolean {
  return policy.isOutboundAllowed(category);
}

export function assertOutboundAllowed(category: OutboundCategory): void {
  if (!isOutboundAllowed(category)) {
    throw new ServiceUnavailableException({
      code: 'outbound_blocked', category, message: '此功能暂时不可用，请稍后再试。',
    });
  }
}

/** Check at the network boundary, including each SDK retry. */
export async function outboundFetch(category: OutboundCategory, ...args: Parameters<typeof fetch>): Promise<Response> {
  assertOutboundAllowed(category);
  return globalThis.fetch(...args);
}

export function outboundGateSummary(): string {
  return `Outbound allowed categories: ${allowedOutboundCategories().join(', ') || '(none)'}`;
}
