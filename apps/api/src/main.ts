import 'reflect-metadata';
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

  // Detect dev-only escape hatches in production. The truly dangerous ones
  // (MOCK_AUTH, SCHOOL_IP_BYPASS) hard-fail; the lower-risk ones
  // (MORNING_QUIZ_DEBUG, ALLOW_PROD_SEED) are loud-logged but allowed,
  // since they are also gated at the endpoint / seed-script level. This
  // keeps prod bootable for the off-hours smoke-test workflow that
  // legitimately uses MORNING_QUIZ_DEBUG=true.
  if (process.env.NODE_ENV === 'production') {
    const fatal: Array<{ name: string; value: string | undefined }> = [
      { name: 'MOCK_AUTH', value: process.env.MOCK_AUTH },
      { name: 'SCHOOL_IP_BYPASS', value: process.env.SCHOOL_IP_BYPASS },
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
  process.on('uncaughtException', (err) => {
    bootstrapLogger.error('uncaughtException', err);
  });

  const app = await NestFactory.create(AppModule, {
    cors: { origin: resolveCorsOrigin(), credentials: true },
  });
  app.setGlobalPrefix('api');
  // Trust proxy so req.ip reads X-Forwarded-For when fronted by Railway /
  // Cloudflare. Required by IpAllowlistGuard to detect the real school egress
  // IP rather than the proxy's loopback. Trust exactly ONE hop — the
  // single Railway/Cloudflare layer in front of us. `trust proxy=true` would
  // happily honour any number of fake X-Forwarded-For headers, letting a
  // malicious client claim any source IP for the rate limiter / IP
  // allowlist. Round-7 agent-2 H-10.
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
}
bootstrap();
