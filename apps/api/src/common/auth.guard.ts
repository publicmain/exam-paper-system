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
  /** Present only on morning-quiz handoff tokens. */
  scope?: 'mq_handoff';
  /** Session id a handoff token is locked to (scope='mq_handoff' only). */
  mqs?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector) {}

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
