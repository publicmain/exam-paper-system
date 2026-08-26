import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { LessonController } from './lesson.controller';
import { LessonService } from './lesson.service';
import { PrismaService } from '../common/prisma.service';

/**
 * P3 路由契约：断点上报端点必须存在（学生退出恢复靠它）。
 * 直接读 Nest 路由表，不连库不起服务。
 */
describe('lesson 路由契约（P3）', () => {
  it('today / vocab-cursor / class 三个端点都在', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'routes-spec' })],
      controllers: [LessonController],
      providers: [
        { provide: LessonService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    const router = (app.getHttpServer() as any)._events.request._router;
    const paths: string[] = router.stack.filter((l: any) => l.route).map((l: any) => l.route.path);
    await app.close();

    expect(paths).toContain('/api/lesson/today');
    expect(paths).toContain('/api/lesson/vocab-cursor');
    expect(paths).toContain('/api/lesson/class');
  });
});
