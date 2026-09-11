import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

/**
 * 令牌生命周期 —— **全仓库唯一的判据**（2026-09-11 审计 S03/S04/S06）。
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
 *     账号存在 · 仍是 student · 账号可用 · 带 av 时版本号一致
 *   教职工令牌
 *     账号存在 · 账号可用 · 库里的角色与令牌一致（降级立即生效）
 *     · 带 av 时版本号一致（教职工登录目前不签 av —— 见台账「跨组事项」）
 *
 * 「账号可用」= `isActive` · 未归档 · 不是旧版停用标记（见下）。
 *
 * 同一个请求会先后经过限流、全局 AuthGuard 与控制器上的 StudentIdentityGuard，
 * 这里按请求对象记住查询结果，保证**一次请求只查一次库**。
 */

/**
 * 旧版后台「停用」写在 `passwordHash` 前面的标记（S04 之前的实现）。
 *
 * 那时停用**只**改这个前缀：教职工密码登录因此失败，可学生登录用的是
 * `pinHash`，`isActive` 也没动 —— 后台显示已停用，学生照样能登录、旧令牌
 * 照样能用。S04 起停用改写 `isActive` 并递增 `studentAuthVersion`；
 * 库里可能还留着按旧办法停用的行，所以这里把这个前缀**也当作停用**，
 * 在数据修复（台账里给了 dry-run）执行之前各处口径依然一致。
 */
export const LEGACY_DEACTIVATED_PREFIX = '!DEACTIVATED!:';

export function isLegacyDeactivated(passwordHash: unknown): boolean {
  return typeof passwordHash === 'string' && passwordHash.startsWith(LEGACY_DEACTIVATED_PREFIX);
}

export interface AccountStateRow {
  role?: string | null;
  isActive: boolean;
  archivedAt: Date | null;
  studentAuthVersion: number;
  /** 只用来识别旧版停用标记，绝不外传。测试用的精简假行可以不带。 */
  passwordHash?: string | null;
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
  passwordHash: true,
} as const;

/**
 * 登录类查询共用的「账号可用」条件（Prisma where 片段）。
 * 与 `accountEnabled` 同一口径：启用、未归档、不是旧版停用标记。
 */
export const ENABLED_ACCOUNT_WHERE = {
  isActive: true,
  archivedAt: null,
  NOT: { passwordHash: { startsWith: LEGACY_DEACTIVATED_PREFIX } },
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

/** 账号此刻是否可用（启用、未归档、不是旧版停用标记）。纯函数。 */
export function accountEnabled(row: AccountStateRow | null): boolean {
  if (!row) return false;
  return row.isActive && row.archivedAt == null && !isLegacyDeactivated(row.passwordHash);
}

/**
 * 学生令牌此刻还能不能用。纯函数。
 *
 * `role` 缺省视作 student：只有在测试用的精简假行里才会缺，真实查询一定带。
 */
export function studentTokenStillValid(row: AccountStateRow | null, av: unknown): boolean {
  if (!row) return false;
  if ((row.role ?? 'student') !== 'student') return false;
  if (!accountEnabled(row)) return false;
  if (typeof av === 'number' && row.studentAuthVersion !== av) return false;
  return true;
}

/**
 * 教职工令牌此刻还能不能用。纯函数。
 *
 * `av`：教职工登录目前不签版本号，所以缺省不比；一旦 auth.service 签了
 * （台账「跨组事项」），停用后恢复、重置密码就能让旧令牌永久失效。
 */
export function staffTokenStillValid(row: AccountStateRow | null, role: unknown, av?: unknown): boolean {
  if (!row) return false;
  if (!accountEnabled(row)) return false;
  if (row.role !== role) return false;
  if (typeof av === 'number' && row.studentAuthVersion !== av) return false;
  return true;
}

/** 按令牌里的角色分派到上面两个判据之一。 */
export function tokenStillValid(
  row: AccountStateRow | null,
  payload: { role?: unknown; av?: unknown },
): boolean {
  return payload.role === 'student'
    ? studentTokenStillValid(row, payload.av)
    : staffTokenStillValid(row, payload.role, payload.av);
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
  if (tokenStillValid(row, payload)) return;
  throw isStudent ? studentTokenRevoked() : staffTokenRevoked();
}

/**
 * 「让这个账号的所有已签发令牌作废」写库时用的数据片段（S03/S04/UI07）。
 *
 * 递增版本号 = 登出所有设备。与之配套，调用方要在**同一个事务**里删掉该账号
 * 的推送订阅（`pushSubscription.deleteMany({ where: { studentId } })`）——
 * 那些设备已经被登出，不该再收到这个账号的个人提醒。
 */
export const REVOKE_ALL_SESSIONS = { studentAuthVersion: { increment: 1 } } as const;
