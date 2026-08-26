import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ROLES_KEY } from '../common/auth.guard';

/**
 * P4 路由契约 —— 教师改难度的端点必须存在，且**必须对普通教师开放**。
 *
 * 后者才是真正要钉的：\`@Controller('admin/users')\` 整体是
 * \`@Roles('admin')\`，method 上那行 \`@Roles('admin','head_teacher','teacher')\`
 * 一旦被谁顺手删掉，接口就悄悄退化成管理员专用 —— 班主任点一下拿到
 * 403，而所有单测照样绿。这里直接读装饰器元数据。
 */
describe('english-level 路由契约（P4）', () => {
  it('PATCH /api/admin/users/:id/english-level 存在', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: {} }],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    const router = (app.getHttpServer() as any)._events.request._router;
    const routes = router.stack
      .filter((l: any) => l.route)
      .map((l: any) => ({ path: l.route.path, methods: Object.keys(l.route.methods) }));
    await app.close();

    const hit = routes.find((r: any) => r.path === '/api/admin/users/:id/english-level');
    expect(hit, '端点不存在').toBeTruthy();
    expect(hit.methods).toContain('patch');
  });

  it('**handler 上的 @Roles 覆盖了 class 级的 admin-only**，教师在允许名单里', () => {
    const reflector = new Reflector();
    const handler = (UsersController.prototype as any).setEnglishLevel;
    const roles = reflector.getAllAndOverride<string[]>(ROLES_KEY, [handler, UsersController]);
    expect(roles).toBeTruthy();
    expect(roles).toContain('teacher');
    expect(roles).toContain('head_teacher');
    expect(roles).toContain('admin');
    // 学生绝不在名单里
    expect(roles).not.toContain('student');
  });

  it('对照：同 controller 的 PATCH :id（改名）仍是 admin-only', () => {
    const reflector = new Reflector();
    const handler = (UsersController.prototype as any).update;
    const roles = reflector.getAllAndOverride<string[]>(ROLES_KEY, [handler, UsersController]);
    expect(roles).toEqual(['admin']);
  });
});
