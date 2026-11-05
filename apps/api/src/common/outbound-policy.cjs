'use strict';

// Shared by the API and standalone JS/TS/Python script entry points.
// An explicit value REPLACES defaults; OUTBOUND_ALLOW='' closes everything.
const CATEGORIES = Object.freeze([
  'anthropic', 'openai', 'azure_speech', 'azure_translator',
  'public_translation', 'web_push', 'language_tool', 'pdf_worker',
  'code_runner', 'wechat_webhook', 'sentry', 'content_source',
  'source_download', 'app_api', 'pdf_assets', 'other',
]);
// 2026-11-05 叶老师：零 Anthropic、目前不花钱。默认只关「会产生新费用或会把内容发给大模型」的三类，
// 其余维持上线现状（自家 PDF 服务、推送、翻译、错误监控等照旧），免得一上线就坏。
const DEFAULT_DENY = Object.freeze(['anthropic', 'openai', 'azure_speech']);
const DEFAULT_ALLOW = Object.freeze(CATEGORIES.filter((category) => !DEFAULT_DENY.includes(category)));

function allowedOutboundCategories(env = process.env) {
  const requested = env.OUTBOUND_ALLOW === undefined
    ? DEFAULT_ALLOW
    : String(env.OUTBOUND_ALLOW).split(',').map((entry) => entry.trim());
  // Unknown tokens (including '*') never grant access or appear in logs.
  return CATEGORIES.filter((category) => requested.includes(category));
}

function isOutboundAllowed(category, env = process.env) {
  return allowedOutboundCategories(env).includes(category);
}

function assertOutboundAllowed(category) {
  if (!isOutboundAllowed(category)) {
    const error = new Error(`outbound_blocked:${category}`);
    error.code = 'outbound_blocked';
    error.category = category;
    throw error;
  }
}

async function outboundFetch(category, ...args) {
  assertOutboundAllowed(category);
  return globalThis.fetch(...args);
}

module.exports = {
  CATEGORIES, DEFAULT_ALLOW, DEFAULT_DENY, allowedOutboundCategories,
  isOutboundAllowed, assertOutboundAllowed, outboundFetch,
};
