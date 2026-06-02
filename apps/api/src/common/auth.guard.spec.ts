import { describe, it, expect, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthGuard, ALLOW_HANDOFF_KEY, PUBLIC_KEY, ROLES_KEY } from './auth.guard';

const SECRET = 'test-secret-for-auth-guard';
const jwt = new JwtService({ secret: SECRET });

/** Build a fake ExecutionContext with handler metadata, bearer token, route params. */
function makeCtx(opts: {
  token?: string;
  params?: Record<string, string>;
  allowHandoff?: boolean;
  isPublic?: boolean;
  roles?: string[];
}) {
  const handler = function fakeHandler() {} as any;
  const klass = function FakeController() {} as any;
  if (opts.allowHandoff) Reflect.defineMetadata(ALLOW_HANDOFF_KEY, true, handler);
  if (opts.isPublic) Reflect.defineMetadata(PUBLIC_KEY, true, handler);
  if (opts.roles) Reflect.defineMetadata(ROLES_KEY, opts.roles, handler);
  const req: any = {
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    params: opts.params ?? {},
  };
  return {
    ctx: {
      getHandler: () => handler,
      getClass: () => klass,
      switchToHttp: () => ({ getRequest: () => req }),
    } as ExecutionContext,
    req,
  };
}

const student = { id: 'stu1', email: 's@x.io', role: 'student' as const, name: 'Kid' };

describe('AuthGuard — morning-quiz handoff scope', () => {
  let guard: AuthGuard;
  beforeEach(() => {
    guard = new AuthGuard(jwt, new Reflector());
  });

  it('accepts a normal student token on a non-handoff route', async () => {
    const token = await jwt.signAsync(student);
    const { ctx, req } = makeCtx({ token, params: { id: 'sessA' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user.id).toBe('stu1');
  });

  it('accepts a handoff token on an @AllowHandoff route whose session id matches mqs', async () => {
    const token = await jwt.signAsync({ ...student, scope: 'mq_handoff', mqs: 'sessA' });
    const { ctx } = makeCtx({ token, params: { id: 'sessA' }, allowHandoff: true });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects a handoff token on an @AllowHandoff route whose session id differs from mqs', async () => {
    const token = await jwt.signAsync({ ...student, scope: 'mq_handoff', mqs: 'sessA' });
    const { ctx } = makeCtx({ token, params: { id: 'sessB' }, allowHandoff: true });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a handoff token on a route NOT marked @AllowHandoff (no broad impersonation)', async () => {
    const token = await jwt.signAsync({ ...student, scope: 'mq_handoff', mqs: 'sessA' });
    // e.g. /auth/me, /morning-quiz/student-result/:sessionId, anything else
    const { ctx } = makeCtx({ token, params: { sessionId: 'sessA' } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a handoff token missing the mqs claim even on an allowed route', async () => {
    const token = await jwt.signAsync({ ...student, scope: 'mq_handoff' });
    const { ctx } = makeCtx({ token, params: { id: 'sessA' }, allowHandoff: true });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('still rejects a missing token with 401', async () => {
    const { ctx } = makeCtx({ params: { id: 'sessA' }, allowHandoff: true });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('a normal token is unaffected by the handoff gate on an @AllowHandoff route', async () => {
    const token = await jwt.signAsync(student);
    const { ctx } = makeCtx({ token, params: { id: 'sessA' }, allowHandoff: true });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
