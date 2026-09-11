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
import {
  LEGACY_DEACTIVATED_PREFIX,
  REVOKE_ALL_SESSIONS,
  isLegacyDeactivated,
} from '../common/account-lifecycle';

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
 *      The audit row is written in the **same transaction** as the change.
 *
 *   5. **Deactivation is the real account state** (2026-09-11 审计 S04).
 *      It used to only prefix `passwordHash` with `!DEACTIVATED!:` —
 *      staff password login failed, but students log in with `pinHash`,
 *      `isActive` never changed and `studentAuthVersion` never moved: the
 *      list said "deactivated" while the student could still log in and
 *      keep using a 30-day token. Now deactivation writes `isActive=false`
 *      AND revokes every issued session (`studentAuthVersion += 1`, the
 *      account's push subscriptions deleted) in one transaction.
 *      Re-activation flips `isActive` back but never rolls the version
 *      back, so tokens revoked by the deactivation stay dead.
 *
 *   6. **Password reset = log out everywhere** (S03): same revocation.
 *
 * Rows deactivated the old way (prefix on `passwordHash`, `isActive` still
 * true) are treated as deactivated everywhere via
 * `common/account-lifecycle.isLegacyDeactivated`, and are normalised
 * (prefix stripped, `isActive` set) the next time an admin touches them.
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

  // Legacy sentinel (pre-S04): deactivation used to be written as this
  // prefix on passwordHash instead of the isActive column. No longer
  // written; still recognised (and stripped on the next admin write) so
  // rows deactivated the old way keep reading as deactivated.
  private readonly DEACTIVATED_PREFIX = LEGACY_DEACTIVATED_PREFIX;

  /** 真实的账号状态：isActive 列，且不是旧版停用标记。 */
  private effectiveActive(u: { isActive: boolean; passwordHash: string }): boolean {
    return u.isActive && !isLegacyDeactivated(u.passwordHash);
  }

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
          isActive: true,
          // Only to recognise rows deactivated the pre-S04 way (prefix on
          // the hash). Prisma can't substring-select, so we read the hash
          // and never return it.
          passwordHash: true,
        },
      }),
    ]);

    const users = rows.map((u) => {
      const isActive = this.effectiveActive(u);
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
      select: { id: true, email: true, name: true, role: true, passwordHash: true, isActive: true },
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

    // S04：停用 / 启用写的是真实账号状态（isActive），不再改写密码摘要。
    const wasActive = this.effectiveActive(target);
    const legacyPrefixed = isLegacyDeactivated(target.passwordHash);
    const flipActive = patch.isActive !== undefined && patch.isActive !== wasActive;
    const deactivating = flipActive && patch.isActive === false;

    const data: any = {};
    if (patch.role !== undefined && patch.role !== target.role) data.role = patch.role;
    if (flipActive) data.isActive = patch.isActive;
    // 按旧办法停用过的行，管理员一碰就规范化：去掉前缀、状态进 isActive 列。
    // 旧办法停用时版本号从没动过 —— 停用前签发的令牌还「活着」，只是被前缀
    // 判据挡着。规范化时补一次撤销，否则去掉前缀的那一刻它们就复活了。
    const normalisingLegacy = patch.isActive !== undefined && legacyPrefixed;
    if (normalisingLegacy) {
      data.passwordHash = target.passwordHash.slice(this.DEACTIVATED_PREFIX.length);
      data.isActive = patch.isActive;
    }
    // 停用 = 登出所有设备（恢复启用**不**回退版本号 —— 撤销过的令牌不复活）
    const revoking = deactivating || normalisingLegacy;
    if (revoking) Object.assign(data, REVOKE_ALL_SESSIONS);

    if (Object.keys(data).length === 0) {
      // No-op update; still return the current shape so the FE can
      // refresh the row consistently.
      return this.shape(target.id);
    }

    const updated = await this.prisma.$transaction(async (tx: any) => {
      const row = await tx.user.update({
        where: { id: target.id },
        data,
        select: {
          id: true, email: true, name: true, role: true, createdAt: true,
          lastLogin: true, passwordHash: true, isActive: true,
        },
      });
      // 被登出的设备不该再收到这个账号的个人提醒（UI07）
      if (revoking) {
        await tx.pushSubscription.deleteMany({ where: { studentId: target.id } });
      }
      const nowActive = this.effectiveActive(row);
      await this.audit.log(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'admin.rbac.user.update',
          entityType: 'user',
          entityId: target.id,
          diff: {
            role: patch.role !== undefined && patch.role !== target.role
              ? { from: target.role, to: patch.role }
              : undefined,
            isActive: wasActive !== nowActive
              ? { from: wasActive, to: nowActive }
              : undefined,
          },
          metadata: {
            targetEmail: target.email,
            ...(revoking ? { sessionsRevoked: true } : {}),
            ...(normalisingLegacy ? { legacyDeactivationNormalised: true } : {}),
          },
          ip: actor.ip ?? null,
        },
        tx,
      );
      return row;
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      createdAt: updated.createdAt,
      lastLogin: updated.lastLogin,
      isActive: this.effectiveActive(updated),
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
      select: { id: true, email: true, passwordHash: true, isActive: true },
    });
    if (!target) throw new NotFoundException('user not found');

    const wasDeactivated = !this.effectiveActive(target);
    const fresh = await bcrypt.hash(newPassword, 10);
    // Preserve deactivation: if the user was deactivated, reset still
    // leaves them deactivated (now via the isActive column — a row
    // deactivated the legacy way is normalised here). Reactivation
    // requires an explicit PATCH /users/:id { isActive: true }.
    await this.prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: target.id },
        data: {
          passwordHash: fresh,
          ...(wasDeactivated ? { isActive: false } : {}),
          // S03：重置密码 = 登出所有设备
          ...REVOKE_ALL_SESSIONS,
        },
      });
      await tx.pushSubscription.deleteMany({ where: { studentId: target.id } });
      await this.audit.log(
        {
          actorId: actor.id,
          actorRole: actor.role,
          action: 'admin.rbac.user.reset_password',
          entityType: 'user',
          entityId: target.id,
          // CRITICAL: never put the plaintext or the hash in metadata.
          // Only a boolean acknowledgement.
          metadata: {
            passwordRotated: true,
            sessionsRevoked: true,
            targetEmail: target.email,
            deactivatedAtRotation: wasDeactivated,
          },
          ip: actor.ip ?? null,
        },
        tx,
      );
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
        createdAt: true, lastLogin: true, passwordHash: true, isActive: true,
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
      isActive: this.effectiveActive(u),
    };
  }
}

// Local helper. Duplicated rather than shared with admin-cost so
// each module stays self-contained for the integrator's diff.
function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

