import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
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
  new Logger('Bootstrap').log(`API listening on :${port}`);
}
bootstrap();
