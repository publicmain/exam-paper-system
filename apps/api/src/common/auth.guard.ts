import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from './prisma.service';
import { assertTokenLive } from './account-lifecycle';
import { ALLOW_TEACHER_VIEW, TEACHER_VIEW_SCOPE, isReadOnlyMethod } from './student-access';

export const PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Marks a handler as reachable by a "morning-quiz handoff" token — the
 * narrow, session-scoped JWT minted at scan time so a student can move
 * from the scanning phone to a second device (AirDrop the quiz URL to a
 * MacBook) and still answer. A handoff token carries `scope='mq_handoff'`
 * and `mqs=<sessionId>`; the AuthGuard rejects it on EVERY route except
 * those decorated here AND only when the route's session id matches `mqs`.
 * So a leaked handoff link can touch that one quiz and nothing else.
 */
export const ALLOW_HANDOFF_KEY = 'allowMqHandoff';
export const AllowHandoff = () => SetMetadata(ALLOW_HANDOFF_KEY, true);

export interface AuthUser {
  id: string;
  email: string;
  role: 'teacher' | 'head_teacher' | 'admin' | 'student';
  name: string;
  /** mq_handoff = 发卷窄凭证；teacher_view = 教师的只读学生视角。 */
  scope?: 'mq_handoff' | 'teacher_view';
  /** Session id a handoff token is locked to (scope='mq_handoff' only). */
  mqs?: string;
  /** 撤销版本号（学生 PIN 登录签发的 30 天令牌才有）。 */
  av?: number;
  /** teacher_view 时是哪位教师。 */
  actorId?: string;
}

/**
 * 全局认证守卫（非 @Public 路由）。
 *
 * 2026-09-11 审计 S03：验签之后还要做两件事，旧版一件都没做 ——
 *
 *   ① **令牌生命周期**（common/account-lifecycle.ts，与 StudentIdentityGuard
 *     同一份判据）：重置 / 改密码 / 停用 / 归档 / 改角色之后，旧令牌在旧接口
 *     上也当场失效。以前 `/student/*`、`/morning-quiz/sessions/:id/*` 只查角色，
 *     被撤销的 30 天令牌照样能开卷、保存、交卷。
 *   ② **教师只读视角的范围**：`teacher_view` 令牌只能读显式标了
 *     `@AllowTeacherView()` 的 GET（已核实零写库）；其余一律 403
 *     `teacher_view_is_read_only`。以前它的 role 是 student，旧的开卷 / 保存 /
 *     交卷只比角色，教师点两下就记成「学生自己交的卷」。
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      // Allow MOCK_AUTH for dev
      if (process.env.MOCK_AUTH === 'true') {
        req.user = { id: 'mock-teacher', email: 'teacher@school.local', role: 'teacher', name: 'Mock Teacher' };
        return true;
      }
      throw new UnauthorizedException('Missing token');
    }
    const token = auth.slice('Bearer '.length);
    try {
      const payload = await this.jwt.verifyAsync<AuthUser>(token);
      req.user = payload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    // Morning-quiz handoff token: a deliberately narrow credential. It is
    // a valid student JWT (so it passes the verify above), but it must be
    // confined to the single session it was minted for. Reject it on any
    // route not explicitly marked @AllowHandoff, and on a matching route
    // whose session id differs from the token's `mqs` claim. This is what
    // makes "AirDrop the quiz link to my MacBook" safe — the worst a
    // mis-shared link can do is answer that one quiz, not impersonate the
    // student elsewhere.
    if (req.user?.scope === 'mq_handoff') {
      const allowHandoff = this.reflector.getAllAndOverride<boolean>(ALLOW_HANDOFF_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]);
      const routeSessionId = req.params?.id ?? req.params?.sessionId;
      if (!allowHandoff || !req.user.mqs || req.user.mqs !== routeSessionId) {
        throw new ForbiddenException('handoff_scope_restricted');
      }
    }

    // 教师只读视角：只能读显式放开的零写库 GET（S03/S08）。在查库之前拒，
    // 越权请求连一次账号查询都换不到。
    if (req.user?.scope === TEACHER_VIEW_SCOPE) {
      const allowTeacherView = this.reflector.getAllAndOverride<boolean>(ALLOW_TEACHER_VIEW, [
        ctx.getHandler(),
        ctx.getClass(),
      ]);
      if (!allowTeacherView || !isReadOnlyMethod(req.method)) {
        throw new ForbiddenException({ code: 'teacher_view_is_read_only' });
      }
    }

    // 令牌生命周期：撤销 / 停用 / 归档 / 改角色后当场失效（S03/S04）。
    // 学生 → 403 token_revoked（学生端据此清票回登录页）；
    // 教职工 → 401 token_revoked（教师端据此重新登录）。
    await assertTokenLive(this.prisma, req.user ?? {}, req);

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (requiredRoles && requiredRoles.length > 0 && req.user && !requiredRoles.includes(req.user.role)) {
      // Role mismatch is an authorization failure (403), not authentication
      // (401).  The user proved who they are with a valid JWT but doesn't have
      // the required role for this resource.  Returning 401 here would
      // confuse clients into thinking the token expired and trying to refresh.
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
