import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

/**
 * 令牌生命周期 —— **全仓库唯一的判据**（2026-09-11 审计 S03/S04）。
 *
 * ## 修之前
 *
 * 撤销校验只写在新版 `StudentIdentityGuard` 和 `StudentAuthController`
 * 里，而且只查带 `av` 的长期令牌。旧的全局 `AuthGuard` 验完签名就放行：
 *
 *   · 教师重置密码、学生改密码、后台停用、归档之后，旧令牌打 `/student/*`、
 *     `/morning-quiz/sessions/:id/*` 这些旧接口照样能开卷、保存、交卷；
 *   · 教师账号被停用，手里 7 天的令牌照样能用。
 *
 * ## 修之后
 *
 * 所有**被当作身份使用**的令牌，每次请求都在这里比对一次数据库：
 *
 *   学生令牌（本人 / 扫码当天票 / 教师只读视角 / 发卷 handoff）
 *     账号存在 · 仍是 student · 启用 · 未归档 · 带 av 时版本号一致
 *   教职工令牌
 *     账号存在 · 启用 · 未归档 · 库里的角色与令牌一致（降级立即生效）
 *
 * 同一个请求会先后经过全局 AuthGuard 与控制器上的 StudentIdentityGuard，
 * 这里按请求对象记住查询结果，保证**一次请求只查一次库**。
 */

export interface AccountStateRow {
  role?: string | null;
  isActive: boolean;
  archivedAt: Date | null;
  studentAuthVersion: number;
}

/** 只用到 user.findUnique，测试传假对象即可。 */
export interface AccountLookupPrisma {
  user: { findUnique(args: unknown): Promise<AccountStateRow | null> };
}

export const ACCOUNT_STATE_SELECT = {
  role: true,
  isActive: true,
  archivedAt: true,
  studentAuthVersion: true,
} as const;

const perRequest = new WeakMap<object, Map<string, Promise<AccountStateRow | null>>>();

/** 读账号状态。传了 `req` 就在这个请求内复用同一次查询。 */
export function loadAccountState(
  prisma: AccountLookupPrisma,
  userId: string,
  req?: object,
): Promise<AccountStateRow | null> {
  const query = () =>
    prisma.user.findUnique({ where: { id: userId }, select: ACCOUNT_STATE_SELECT });
  if (!req) return query();
  let byId = perRequest.get(req);
  if (!byId) {
    byId = new Map();
    perRequest.set(req, byId);
  }
  let hit = byId.get(userId);
  if (!hit) {
    hit = query();
    byId.set(userId, hit);
  }
  return hit;
}

/**
 * 学生令牌此刻还能不能用。纯函数。
 *
 * `role` 缺省视作 student：只有在测试用的精简假行里才会缺，真实查询一定带。
 */
export function studentTokenStillValid(row: AccountStateRow | null, av: unknown): boolean {
  if (!row) return false;
  if ((row.role ?? 'student') !== 'student') return false;
  if (!row.isActive || row.archivedAt != null) return false;
  if (typeof av === 'number' && row.studentAuthVersion !== av) return false;
  return true;
}

/** 教职工令牌此刻还能不能用。纯函数。 */
export function staffTokenStillValid(row: AccountStateRow | null, role: unknown): boolean {
  if (!row) return false;
  if (!row.isActive || row.archivedAt != null) return false;
  return row.role === role;
}

/** 学生侧统一的拒绝 —— 学生端据此清掉废票回登录页（沿用既有契约 403）。 */
export function studentTokenRevoked(): ForbiddenException {
  return new ForbiddenException({ code: 'token_revoked' });
}

/** 教职工侧统一的拒绝 —— 401 让教师端走「重新登录」。 */
export function staffTokenRevoked(): UnauthorizedException {
  return new UnauthorizedException({ code: 'token_revoked' });
}

/**
 * 断言一个**已验签**的令牌仍然有效；无效时抛对应的拒绝。
 *
 * 调用方必须先 `jwt.verifyAsync` —— 这里只看生命周期，不看签名。
 */
export async function assertTokenLive(
  prisma: AccountLookupPrisma,
  payload: { id?: unknown; role?: unknown; av?: unknown },
  req?: object,
): Promise<void> {
  const id = typeof payload.id === 'string' ? payload.id : '';
  const isStudent = payload.role === 'student';
  if (!id) throw isStudent ? studentTokenRevoked() : staffTokenRevoked();
  const row = await loadAccountState(prisma, id, req);
  if (isStudent) {
    if (!studentTokenStillValid(row, payload.av)) throw studentTokenRevoked();
    return;
  }
  if (!staffTokenStillValid(row, payload.role)) throw staffTokenRevoked();
}
