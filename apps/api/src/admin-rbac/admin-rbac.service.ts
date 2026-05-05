import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * RBAC management for the admin console.
 *
 * Security invariants (enforced here, not just in the DTO):
 *
 *   1. **An admin cannot demote themselves.** Any PATCH that would change
 *      the *acting* admin's own role to a non-admin role is rejected with
 *      a 400. This prevents the "lockout" footgun where a sole admin
 *      accidentally turns themselves into a teacher and there's no one
 *      left to undo it. Demoting *another* admin is still allowed; the
 *      team is responsible for its own bus-factor.
 *
 *   2. **Password reset never returns or logs the plaintext.** The
 *      service hashes with bcrypt (cost 10, matching auth/users) and
 *      writes only the digest. The audit row records `passwordRotated:
 *      true` and the actor; the new value is *never* persisted in the
 *      audit metadata or the response body.
 *
 *   3. **Self-deactivation is rejected** for the same reason as (1). An
 *      admin shouldn't be able to lock themselves out by toggling their
 *      own isActive flag.
 *
 *   4. **Every mutation is audited.** Role changes, deactivations, and
 *      password resets each emit an AuditLog row with the actor + the
 *      target user's id. The `diff` field shows the before/after for
 *      role and isActive; `metadata` carries non-secret context.
 */
@Injectable()
export class AdminRbacService {
  private readonly logger = new Logger('AdminRbacService');

  // Roles the admin UI is allowed to assign. Mirrors the UserRole enum
  // in prisma. Kept as a list (not just `Object.values(UserRole)`) so a
  // future enum extension doesn't silently become assignable.
  private readonly ASSIGNABLE_ROLES: UserRole[] = [
    UserRole.teacher,
    UserRole.head_teacher,
    UserRole.admin,
    UserRole.student,
  ];

  // Sentinel prefix used when the User.isActive column doesn't yet
  // exist in the deployed schema. We mark the passwordHash with this
  // prefix so login fails (bcrypt.compare returns false) but the row
  // can still be reactivated by an admin (we strip the prefix back off
  // and the original hash is restored). Never put real tokens here —
  // bcrypt hashes start with "$2a$" / "$2b$" / "$2y$", so the leading
  // "!" is a safe namespace.
  private readonly DEACTIVATED_PREFIX = '!DEACTIVATED!:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --------------------------------------------------------------------
  // GET /admin-rbac/users?q=&role=&page=
  // --------------------------------------------------------------------
  async listUsers(args: { q?: string; role?: string; page?: number; pageSize?: number }) {
    const pageSize = clampInt(args.pageSize ?? 20, 1, 100);
    const page = Math.max(1, Math.floor(args.page ?? 1));

    const where: any = {};
    if (args.q) {
      const q = args.q.trim();
      if (q.length > 0) {
        where.OR = [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ];
      }
    }
    if (args.role) {
      if (!this.ASSIGNABLE_ROLES.includes(args.role as UserRole)) {
        throw new BadRequestException(`unknown role: ${args.role}`);
      }
      where.role = args.role;
    }

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          lastLogin: true,
          // We rely on the passwordHash sentinel to detect "deactivated"
          // until the isActive column lands. Selecting just the prefix
          // would be ideal but Prisma can't substring-select, so we read
          // the full hash and never return it.
          passwordHash: true,
        },
      }),
    ]);

    const users = rows.map((u) => {
      const isActive = !u.passwordHash.startsWith(this.DEACTIVATED_PREFIX);
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
        isActive,
      };
    });

    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      users,
    };
  }

  // --------------------------------------------------------------------
  // PATCH /admin-rbac/users/:id { role?, isActive? }
  // --------------------------------------------------------------------
  async update(
    targetId: string,
    patch: { role?: UserRole; isActive?: boolean },
    actor: { id: string; role: string; ip?: string | null },
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, name: true, role: true, passwordHash: true },
    });
    if (!target) throw new NotFoundException('user not found');

    // Validate role if present.
    if (patch.role !== undefined && !this.ASSIGNABLE_ROLES.includes(patch.role)) {
      throw new BadRequestException(`unknown role: ${patch.role}`);
    }

    // ----- self-lockout protection -----
    const isSelf = target.id === actor.id;
    if (isSelf) {
      if (patch.role !== undefined && patch.role !== UserRole.admin) {
        throw new BadRequestException(
          'You cannot change your own role to a non-admin role. ' +
            'Ask another admin to perform this change.',
        );
      }
      if (patch.isActive === false) {
        throw new BadRequestException(
          'You cannot deactivate your own account. ' +
            'Ask another admin to perform this change.',
        );
      }
    }

    // Compute the new passwordHash if isActive flipped.
    const wasDeactivated = target.passwordHash.startsWith(this.DEACTIVATED_PREFIX);
    let newPasswordHash: string | undefined;
    if (patch.isActive !== undefined) {
      if (patch.isActive === false && !wasDeactivated) {
        // Activate -> deactivate: prefix the hash.
        newPasswordHash = this.DEACTIVATED_PREFIX + target.passwordHash;
      } else if (patch.isActive === true && wasDeactivated) {
        // Deactivated -> activate: strip the prefix.
        newPasswordHash = target.passwordHash.slice(this.DEACTIVATED_PREFIX.length);
      }
    }

    const data: any = {};
    if (patch.role !== undefined && patch.role !== target.role) data.role = patch.role;
    if (newPasswordHash !== undefined) data.passwordHash = newPasswordHash;

    if (Object.keys(data).length === 0) {
      // No-op update; still return the current shape so the FE can
      // refresh the row consistently.
      return this.shape(target.id);
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data,
      select: {
        id: true, email: true, name: true, role: true, createdAt: true,
        lastLogin: true, passwordHash: true,
      },
    });

    const newIsActive = !updated.passwordHash.startsWith(this.DEACTIVATED_PREFIX);
    const wasActive = !wasDeactivated;

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'admin.rbac.user.update',
      entityType: 'user',
      entityId: target.id,
      diff: {
        role: patch.role !== undefined && patch.role !== target.role
          ? { from: target.role, to: patch.role }
          : undefined,
        isActive: patch.isActive !== undefined && patch.isActive !== wasActive
          ? { from: wasActive, to: newIsActive }
          : undefined,
      },
      metadata: {
        targetEmail: target.email,
      },
      ip: actor.ip ?? null,
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      createdAt: updated.createdAt,
      lastLogin: updated.lastLogin,
      isActive: newIsActive,
    };
  }

  // --------------------------------------------------------------------
  // POST /admin-rbac/users/:id/reset-password { newPassword }
  // --------------------------------------------------------------------
  async resetPassword(
    targetId: string,
    newPassword: string,
    actor: { id: string; role: string; ip?: string | null },
  ) {
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new BadRequestException('newPassword must be at least 8 characters');
    }
    if (newPassword.length > 200) {
      throw new BadRequestException('newPassword too long');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!target) throw new NotFoundException('user not found');

    const wasDeactivated = target.passwordHash.startsWith(this.DEACTIVATED_PREFIX);
    const fresh = await bcrypt.hash(newPassword, 10);
    // Preserve deactivation: if the user was deactivated, reset still
    // leaves them deactivated. Reactivation requires an explicit
    // PATCH /users/:id { isActive: true }.
    const stored = wasDeactivated ? this.DEACTIVATED_PREFIX + fresh : fresh;

    await this.prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: stored },
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'admin.rbac.user.reset_password',
      entityType: 'user',
      entityId: target.id,
      // CRITICAL: never put the plaintext or the hash in metadata.
      // Only a boolean acknowledgement.
      metadata: {
        passwordRotated: true,
        targetEmail: target.email,
        deactivatedAtRotation: wasDeactivated,
      },
      ip: actor.ip ?? null,
    });

    // Response is an acknowledgement only — no plaintext, no hash.
    return { ok: true, userId: target.id };
  }

  // --------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------

  /** Read a single user shape (no passwordHash leak). */
  private async shape(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, role: true,
        createdAt: true, lastLogin: true, passwordHash: true,
      },
    });
    if (!u) throw new NotFoundException('user not found');
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
      isActive: !u.passwordHash.startsWith(this.DEACTIVATED_PREFIX),
    };
  }
}

// Local helper. Duplicated rather than shared with admin-cost so
// each module stays self-contained for the integrator's diff.
function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

