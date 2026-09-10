/**
 * Sentry —— 学生端报错收集（2026-09-10）。
 *
 * 为什么要有：学生手机上的报错我们一条都看不到，他们要么忍着，要么说
 * 「什么都没发生」。这里把 React 渲染错误和未捕获的异常送出去。
 *
 * **没配 `VITE_SENTRY_DSN` 就什么都不做** —— `Sentry.init` 不会被调用，
 * `ErrorBoundary` 退化成一个普通的错误边界。DSN 在构建期注入
 * （Dockerfile 里的 `ARG VITE_SENTRY_DSN`），不在代码里出现。
 *
 * 隐私：`sendDefaultPii: false`；URL 去掉 query；本来 canonical URL 就不带
 * 姓名和 studentId，事件里能出现的只有路径、堆栈和浏览器型号。令牌在
 * localStorage 里，Sentry 不采集它。
 */
import * as Sentry from '@sentry/react';

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const dsn = (env.VITE_SENTRY_DSN ?? '').trim();

export const sentryEnabled = Boolean(dsn);

export function initSentry(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: env.MODE ?? 'production',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request?.url) event.request.url = event.request.url.split('?')[0];
      return event;
    },
  });
}

export const ErrorBoundary = Sentry.ErrorBoundary;
