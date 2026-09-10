import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { AudioController } from '../audio/audio.controller';

/**
 * 路由契约：学生端要打的几个端点都在。直接读 Nest 路由表，不连库不起服务。
 */
describe('push / audio 路由契约', () => {
  it('config / subscribe / unsubscribe / audio 都在', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'routes-spec' })],
      controllers: [PushController, AudioController],
      providers: [
        { provide: PushService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    const router = (app.getHttpServer() as any)._events.request._router;
    const routes = router.stack
      .filter((l: any) => l.route)
      .map((l: any) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`);
    await app.close();

    expect(routes).toContain('GET /api/push/config');
    expect(routes).toContain('POST /api/push/subscribe');
    expect(routes).toContain('POST /api/push/unsubscribe');
    expect(routes).toContain('GET /api/audio/word/:headword');
  });
});
