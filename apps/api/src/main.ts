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
    if (process.env.NODE_ENV === 'production') {
      bootstrapLogger.warn(
        'CORS_ORIGINS unset in production — falling back to allow-all. Set CORS_ORIGINS=https://your.domain in env.',
      );
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
  // IP rather than the proxy's loopback. Trust all hops — the upstream proxy
  // is well-known and terminates TLS in front of us.
  (app.getHttpAdapter().getInstance() as any).set('trust proxy', true);
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
