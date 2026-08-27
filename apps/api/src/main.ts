import 'reflect-metadata';
import { allDayConfigSummary, assertAllDayConfig } from './lesson/all-day';
import { assertStudentAppRoutingConfig } from './student-auth/student-app-routing';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

const bootstrapLogger = new Logger('Bootstrap');

/**
 * Parse CORS_ORIGINS into the shape NestFactory expects:
 *   - undefined / empty / '*'  → permissive (true) — only safe in dev.
 *   - comma-separated list     → exact-match allowlist.
 *
 * In production set ALLOWED_ORIGINS (or CORS_ORIGINS) explicitly to the
 * deployed web origin (e.g. "https://exam.school.edu"); leaving it empty
 * is a deployment configuration error and we log a loud warning.
 */
function resolveCorsOrigin(): true | string[] {
  const raw =
    process.env.CORS_ORIGINS ?? process.env.ALLOWED_ORIGINS ?? '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '*') {
    // Fail loud in prod: a permissive CORS in production lets any third-
    // party origin make authenticated requests with the user's cookie /
    // bearer token. Refuse to start instead of degrading silently.
    if (process.env.NODE_ENV === 'production') {
      bootstrapLogger.error(
        'CORS_ORIGINS (or ALLOWED_ORIGINS) must be set to an explicit origin list in production. Refusing to start.',
      );
      process.exit(1);
    }
    return true;
  }
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
}

async function bootstrap() {
  // Fail loud on default JWT secret in prod. The fallback 'dev-secret' in
  // app.module.ts is only for local boot — leaking it as a signing key in
  // production lets anyone forge any role.
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret')
  ) {
    bootstrapLogger.error(
      'JWT_SECRET is unset or still the dev default in production. Refusing to start.',
    );
    process.exit(1);
  }

  // Detect dev-only escape hatches in production. The truly dangerous one
  // (MOCK_AUTH) hard-fails; the lower-risk ones (MORNING_QUIZ_DEBUG,
  // ALLOW_PROD_SEED) are loud-logged but allowed, since they are also
  // gated at the endpoint / seed-script level. This keeps prod bootable
  // for the off-hours smoke-test workflow that legitimately uses
  // MORNING_QUIZ_DEBUG=true.
  if (process.env.NODE_ENV === 'production') {
    const fatal: Array<{ name: string; value: string | undefined }> = [
      { name: 'MOCK_AUTH', value: process.env.MOCK_AUTH },
    ];
    const tripped = fatal.filter((d) => d.value === 'true' || d.value === '1');
    if (tripped.length > 0) {
      bootstrapLogger.error(
        `Refusing to start: dev escape hatches enabled in production: ${tripped
          .map((d) => `${d.name}=${d.value}`)
          .join(', ')}`,
      );
      process.exit(1);
    }
    // 全天课程开关的值必须能被识别。
    //
    // 静默回退是这类开关最危险的失败方式：服务照常起来、日志一切正常、
    // 学生进不去，而没有任何人知道是一个拼写错误造成的 ——
    // `MORNING_QUIZ_ALL_DAY=ture` 会被当成一个叫 ture 的班，于是每个班
    // 都不开，而运维以为全天已经打开了。与上面几道门同样处理：宁可起不来。
    const allDayCfg = assertAllDayConfig();
    if (!allDayCfg.ok) {
      bootstrapLogger.error(`Refusing to start: ${allDayCfg.reason}`);
      process.exit(1);
    }

    // 学生端版本路由的配置同样不许静默回退 —— 与上面那条同一个道理：
    // `STUDENT_APP_V2=ture` 会被当成一个叫 ture 的学生，于是谁都没开，
    // 而运维以为灰度已经打开了。另外，点了名却没配 origin 也要拦下来：
    // 那些学生会拿到 appVersion=v2 却没有可去的地址。
    try {
      bootstrapLogger.log(assertStudentAppRoutingConfig(process.env));
    } catch (e) {
      bootstrapLogger.error(`Refusing to start: ${(e as Error).message}`);
      process.exit(1);
    }

    const audit: Array<{ name: string; value: string | undefined }> = [
      { name: 'MORNING_QUIZ_DEBUG', value: process.env.MORNING_QUIZ_DEBUG },
      { name: 'ALLOW_PROD_SEED', value: process.env.ALLOW_PROD_SEED },
    ];
    const noisy = audit.filter((d) => d.value === 'true' || d.value === '1');
    for (const f of noisy) {
      bootstrapLogger.warn(
        `Dev escape hatch enabled in production: ${f.name}=${f.value} — endpoint-level gate must hold.`,
      );
    }
  }

  // Catch-all for stray async errors — without this, an unhandled rejection
  // from a fire-and-forget Promise (audit log, wechat webhook, cleanup cron)
  // can crash the worker silently. We log loudly and let the process keep
  // serving so a single rogue task doesn't take the school offline.
  process.on('unhandledRejection', (reason) => {
    bootstrapLogger.error('unhandledRejection', reason as any);
  });
  // ⚠️ 与 unhandledRejection **刻意区别对待**（2026-08-25 外部审查 P2-6）：
  // 那个是某个 fire-and-forget Promise 挂了，进程通常仍然健康，继续服务
  // 是对的；而 uncaughtException 是同步栈上抛出且没人接 —— Node 官方明确
  // 指出此时进程处于**未定义状态**（半完成的写入、泄露的句柄、坏掉的模块级
  // 单例）。原来这里也只记日志继续跑，等于让一个状态不可信的进程继续接收
  // 学生答卷。带病服务比短暂不可用更危险，现在记完日志就退出，由 Railway
  // 拉起新进程（约 15–30 秒）。前提是生命周期任务都幂等（cron 每分钟一跳、
  // 都有兜底），重启不丢工作。
  process.on('uncaughtException', (err) => {
    bootstrapLogger.error('uncaughtException — 进程状态已不可信，退出让平台重启', err);
    // 留 100ms 把日志刷出去；unref 避免这个定时器自己拖住事件循环
    setTimeout(() => process.exit(1), 100).unref();
  });

  const app = await NestFactory.create(AppModule, {
    cors: { origin: resolveCorsOrigin(), credentials: true },
    // Round-7 H39: body size cap.  NestJS defaults to express's 100KB
    // built-in.  Bump explicitly to 2MB so paper authoring (long passages,
    // 30+ MCQ options, large overrideContent JSON) works, but cap so a
    // single attacker can't memory-bomb the API by streaming a 1GB body.
    bodyParser: true,
    rawBody: false,
  });
  app.setGlobalPrefix('api');
  // Round-7 H39: explicit json/urlencoded limits. Without these the
  // express defaults apply (~100KB), which is enough for most APIs but
  // too small for the paper authoring UI's overrideContent payloads
  // and too large for an attacker who wants to memory-bomb the worker.
  // 2MB is a working middle ground.
  const expressApp = app.getHttpAdapter().getInstance() as any;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  expressApp.use(express.json({ limit: '2mb' }));
  expressApp.use(express.urlencoded({ limit: '2mb', extended: true }));

  // r15-followup-31 — NO browser caching of any API response. Every /api
  // route is dynamic and time-sensitive (attendance windows, live scores).
  // Bug: GET /attendance/scan-roster returns 410 Gone for
  // `session_not_active`, and 410 is heuristically CACHEABLE per HTTP spec.
  // With the v2 static QR the scan URL is byte-identical every day, so a
  // 410 cached BEFORE the window opened (student scanned at 08:20) was
  // replayed from the browser cache AFTER it opened (08:41) — Chrome
  // showed "考勤窗口尚未开启" while WeChat (no/different cache) hit the
  // live backend and worked. The PWA service worker added a second cache
  // layer with the same effect. Force no-store on the whole API so no
  // response — success OR error — is ever reused. Also disable ETag so
  // there's no conditional-revalidation path either.
  expressApp.set('etag', false);
  expressApp.use((_req: any, res: any, next: any) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    next();
  });

  // Phase 1 observability (docs/PRD §6.4) — request correlation id. Reuse an
  // inbound x-request-id if a proxy already set one, else mint a uuid. Stamped
  // on req.id (available to logging/error paths) and echoed in the response
  // header so a client or support agent can quote it for trace lookup.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomUUID } = require('crypto');
  expressApp.use((req: any, res: any, next: any) => {
    const incoming = req.headers['x-request-id'];
    const id =
      typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 200
        ? incoming
        : randomUUID();
    req.id = id;
    res.setHeader('x-request-id', id);
    next();
  });

  // Trust proxy so req.ip reads X-Forwarded-For when fronted by Railway /
  // Cloudflare. Needed so the per-IP rate limiter and the audit log
  // record the real client IP rather than the proxy's loopback. Trust
  // exactly ONE hop — the single Railway/Cloudflare layer in front of
  // us. `trust proxy=true` would happily honour any number of fake
  // X-Forwarded-For headers, letting a malicious client claim any
  // source IP for the rate limiter. Round-7 agent-2 H-10.
  (app.getHttpAdapter().getInstance() as any).set('trust proxy', 1);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  const port = Number(process.env.API_PORT || process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  bootstrapLogger.log(`API listening on :${port}`);
  // P9.5 —— 把全天配置的**最终生效值**打在启动日志里。
  // 这个开关决定学生 09:00 之后还能不能上课；出问题时第一件要确认的事
  // 就是「它到底开没开」，翻环境变量不如让服务自己说一句。
  const allDayCheck = assertAllDayConfig();
  if (!allDayCheck.ok) {
    // 生产环境上面已经拒绝启动了；这里只可能是本地/测试环境。
    bootstrapLogger.warn(`MORNING_QUIZ_ALL_DAY 配置有问题（非生产环境放行）：${allDayCheck.reason}`);
  }
  // 学生端版本路由的最终生效值 —— 与全天开关同样，出问题时先确认它
  try {
    bootstrapLogger.log(assertStudentAppRoutingConfig(process.env));
  } catch (e) {
    bootstrapLogger.warn(`STUDENT_APP_V2 / STUDENT_APP_ORIGIN 配置有问题（非生产放行）：${(e as Error).message}`);
  }
  const allDay = allDayConfigSummary();
  bootstrapLogger.log(
    `all-day lessons: ${allDay.mode}` +
      (allDay.mode === 'per-class' ? ` (classes: ${allDay.classIds.join(', ')})` : '') +
      ` [MORNING_QUIZ_ALL_DAY=${allDay.raw || '(unset)'}]`,
  );
}
bootstrap();
