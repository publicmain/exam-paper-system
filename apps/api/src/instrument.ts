/**
 * Sentry —— 报错收集（2026-09-10）。
 *
 * 为什么要有：09-09 那次 502 挂了 11 分钟，是人碰巧盯着日志才发现的；学生
 * 手机上的前端报错我们一条都看不到。这个文件必须是 `main.ts` 的**第一个
 * import** —— SDK 要在其它模块加载之前挂好钩子。
 *
 * **没配 `SENTRY_DSN` 就什么都不做**：`Sentry.init` 不会被调用，后面
 * `@SentryExceptionCaptured()` 之类的调用全部静默 no-op。与 LanguageTool
 * 同一条规矩 —— 少一个环境变量，服务照常起来，只是少一项能力。
 *
 * 隐私：`sendDefaultPii: false`，不采集请求体、不采集 cookie / header。
 * 学生端的 URL 本来就不带姓名和 studentId（身份规则），所以事件里能出现的
 * 只有路径、方法、状态码和堆栈。
 */
import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN?.trim();

export const sentryEnabled = Boolean(dsn);

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV ?? 'development',
    // /api/health 也用同一个值，事件能对回具体哪次部署
    release: process.env.RAILWAY_GIT_COMMIT_SHA ?? undefined,
    sendDefaultPii: false,
    // 只收错误，不做性能追踪 —— 那是另一笔额度，现在用不上
    tracesSampleRate: 0,
  });
}
