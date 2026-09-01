import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { StudentAuthController } from './student-auth.controller';
import { StudentAuthService } from './student-auth.service';
import { PrismaService } from '../common/prisma.service';

/**
 * P2 路由契约（docs/refactor-plan.md P2）。
 *
 * 断言「哪些路径存在、哪些已删」——直接读 Nest 从装饰器构建的路由表，
 * 不连数据库、不起 HTTP 服务。删掉的端点在表里不存在 = 线上必然 404
 * （Nest 对未注册路径返回 404）。
 *
 * 这张表同时是防回归契约：日后谁再把 set-pin / claim-window 加回来，
 * 这里会红。
 */

/** 已删除（P2，2026-08-26）——注册改为网站式自助，窗口机制废弃。 */
const REMOVED = [
  'set-pin',
  'claim-window',
  'admin/claim-window/open',
  'admin/claim-window/close',
  'admin/claim-window/student',
];

/** 必须保留——当前身份流程在用。 */
const KEPT = [
  'register',
  'registration-status',
  'login',
  'change-pin',
  'me',
  // S12O —— 学生自助注册与自助改难度
  'registration-classes',
  'self-register',
  'me/english-level',
  'admin/reset-pin',
  'admin/claim-status',
  'admin/view-token',
];

async function routePaths(): Promise<string[]> {
  const moduleRef = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: 'routes-spec' })],
    controllers: [StudentAuthController],
    providers: [
      { provide: StudentAuthService, useValue: {} },
      { provide: PrismaService, useValue: {} },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();

  const server = app.getHttpServer();
  const router = server._events.request._router;
  const paths: string[] = router.stack
    .filter((l: any) => l.route)
    .map((l: any) => l.route.path);
  await app.close();
  return paths;
}

describe('student-auth 路由契约（P2）', () => {
  it('已删除的 5 个端点不在路由表 → 线上 404', async () => {
    const paths = await routePaths();
    for (const r of REMOVED) {
      expect(paths, `${r} 应已删除`).not.toContain(`/api/student-auth/${r}`);
    }
  });

  it('当前身份流程的端点全部保留', async () => {
    const paths = await routePaths();
    for (const r of KEPT) {
      expect(paths, `${r} 应保留`).toContain(`/api/student-auth/${r}`);
    }
  });
});
