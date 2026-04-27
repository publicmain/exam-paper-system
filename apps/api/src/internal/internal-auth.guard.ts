import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Public } from '../common/auth.guard';

export const INTERNAL_KEY = 'isInternal';
/**
 * Mark a route as accessible only to internal callers (the pdf-worker).
 * Combined with @Public() it skips JWT but enforces the shared
 * X-Internal-Token header. The token is read at request time from
 * INTERNAL_API_TOKEN so rotating it does not require a restart.
 */
export const Internal = () => (target: any, key?: any, descriptor?: any) => {
  Public()(target, key, descriptor);
  SetMetadata(INTERNAL_KEY, true)(target, key, descriptor);
};

@Injectable()
export class InternalGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isInternal = this.reflector.getAllAndOverride<boolean>(INTERNAL_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!isInternal) return true; // not an internal route — leave it alone

    const expected = process.env.INTERNAL_API_TOKEN;
    if (!expected) {
      throw new UnauthorizedException('Internal token not configured');
    }
    const req = ctx.switchToHttp().getRequest<Request>();
    const got = req.headers['x-internal-token'];
    if (typeof got !== 'string' || got !== expected) {
      throw new UnauthorizedException('Invalid internal token');
    }
    return true;
  }
}
