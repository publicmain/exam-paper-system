import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../common/prisma.service';

/**
 * F14 — ParentAuthGuard.
 *
 * Extracts a 32-char ParentLink.token from either `?token=...` query
 * string OR `Authorization: ParentLink <token>` header. Looks the
 * token up, verifies it's not revoked (`revokedAt == null`), updates
 * `lastAccessAt`, and attaches the resolved link to `req.parentLink`
 * so the controller can use it without re-querying.
 *
 * Rejection cases:
 *   - missing token → 401 with code='missing_parent_token'
 *   - token not found → 401 with code='invalid_parent_token'
 *   - token revoked → 401 with code='parent_token_revoked'
 *
 * IMPORTANT: this guard is independent of the global AuthGuard. Routes
 * using it MUST also be marked @Public() so AuthGuard lets the request
 * through to this guard's check.
 */
@Injectable()
export class ParentAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { parentLink?: any }>();
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException({ code: 'missing_parent_token' });
    }
    const prismaAny: any = this.prisma;
    const link = await prismaAny.parentLink.findUnique({
      where: { token },
      include: {
        student: { select: { id: true, name: true, archivedAt: true } },
      },
    }).catch(() => null);
    if (!link) {
      throw new UnauthorizedException({ code: 'invalid_parent_token' });
    }
    if (link.revokedAt) {
      throw new UnauthorizedException({ code: 'parent_token_revoked' });
    }
    // Touch lastAccessAt for the admin dashboard. Fire-and-forget but
    // awaited so reads are causally consistent with the audit story.
    try {
      await prismaAny.parentLink.update({
        where: { id: link.id },
        data: { lastAccessAt: new Date() },
      });
    } catch {
      // Schema mismatch (column missing on older client) — ignore.
    }
    req.parentLink = link;
    return true;
  }

  private extractToken(req: Request): string | null {
    const q = req.query?.token;
    if (typeof q === 'string' && q.length >= 16 && q.length <= 128) return q;
    const auth = req.headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('ParentLink ')) {
      const t = auth.slice('ParentLink '.length).trim();
      if (t.length >= 16 && t.length <= 128) return t;
    }
    return null;
  }
}
