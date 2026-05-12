import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  /**
   * F14 — parent-token verify. Distinct from `login` — no password,
   * no JWT. Caller passes the 32-char ParentLink.token and receives a
   * { ok, studentId, parentLabel } envelope plus a refreshed
   * lastAccessAt timestamp. Used by the parent-portal frontend to
   * pre-check a stored token before hitting /parent/portal.
   *
   * On failure: throws UnauthorizedException with a structured code
   * so the frontend can show a precise message ("link revoked",
   * "link not found") rather than a generic 401.
   */
  async verifyParentToken(token: string) {
    if (!token || token.length < 16 || token.length > 128) {
      throw new UnauthorizedException({ code: 'invalid_parent_token' });
    }
    const prismaAny: any = this.prisma;
    const link = await prismaAny.parentLink
      .findUnique({
        where: { token },
        include: { student: { select: { id: true, name: true } } },
      })
      .catch(() => null);
    if (!link) throw new UnauthorizedException({ code: 'invalid_parent_token' });
    if (link.revokedAt) {
      throw new UnauthorizedException({ code: 'parent_token_revoked' });
    }
    try {
      await prismaAny.parentLink.update({
        where: { id: link.id },
        data: { lastAccessAt: new Date() },
      });
    } catch {
      /* schema lag — ignore */
    }
    return {
      ok: true,
      studentId: link.studentId,
      studentName: link.student?.name ?? null,
      parentLabel: link.parentLabel ?? null,
    };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok && process.env.MOCK_AUTH !== 'true') {
      throw new UnauthorizedException('Invalid credentials');
    }
    // Schema-documented intent (User.isActive comment): a deactivated user
    // (graduated student, departed teacher) must not be able to log in even
    // with valid credentials. Same generic 401 to avoid account enumeration.
    if (!user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
    const token = await this.jwt.signAsync(payload);
    return { token, user: payload };
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, lastLogin: true, createdAt: true },
    });
  }
}
