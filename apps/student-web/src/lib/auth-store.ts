/**
 * 认证状态机 —— 整个新端唯一持有身份的地方。
 *
 * 刻意不用状态管理库：这里只有四个状态，一个 `useSyncExternalStore` 足够，
 * 而且能让「身份怎么来的」在一屏里看完。
 *
 * ## 四个状态
 *
 *   loading         启动时正在用令牌向 `/student-auth/me` 换身份
 *   authenticated   有 profile
 *   anonymous       没有（含「刚被撤销」——那时带一句 notice）
 *   unreachable     有令牌，但此刻问不到服务端（断网 / 5xx / 超时）
 *
 * ## 2026-09-11 审计 UI15：暂时问不到 ≠ 登出
 *
 * 原来网络一抖就当 anonymous：页面跳登录，学生以为被踢了；同一个人再登录时
 * `adoptSession` 还会清掉没同步的草稿。现在分三种情况：
 *   · **令牌确实无效**（401 / token_revoked / student_token_required）→ 只作废令牌，
 *     草稿留着且记着归属；同一个人重新登录能接着用，换人登录会先清空。
 *   · **暂时问不到** → `unreachable`：留着令牌和草稿，给「重试」和「换个账号登录」。
 *     不假装已登录（不渲染任何私有页），也不假装登出。
 *   · **主动退出 / 换人** → 清空整个 `sw:`（含草稿），不把 A 的答案留给 B。
 *
 * ## fail-closed
 *
 * 身份只认服务端 `/me` 的回答。拿不到回答时不渲染私有内容。
 */
import { api, ApiError, NetworkError, type MeResult, type StudentProfile } from './api';
import { clearIdentity, clearTokenOnly, draftsBelongTo, hasDraftOwner, readToken, writeDraftOwner, writeToken } from './identity';
import { REVOKED_NOTICE } from './errors';
import { releasePushForThisDevice } from './push';
import { resetNavigationMemory } from '../design/AppShell';

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; notice?: string }
  | { status: 'unreachable' }
  | { status: 'authenticated'; profile: StudentProfile };

let state: AuthState = { status: 'loading' };
const listeners = new Set<() => void>();

function emit(next: AuthState) {
  state = next;
  for (const l of listeners) l();
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getState(): AuthState {
  return state;
}

/** 服务端此刻答不上来（不是「你是谁我不认」）。 */
function isTransient(e: unknown): boolean {
  if (e instanceof NetworkError) return true;
  if (e instanceof ApiError) return e.status >= 500 || e.status === 408 || e.status === 429;
  return false;
}

/**
 * 启动时用令牌换身份。
 *
 * **不信任本地令牌的内容** —— 不解 JWT、不读里面的姓名。令牌只是一张票，
 * 身份以服务端 `/student-auth/me` 的回答为准。
 */
export async function bootstrap(): Promise<void> {
  const token = readToken();
  if (!token) {
    emit({ status: 'anonymous' });
    return;
  }
  // 从「问不到服务端」重试时才回到 loading；已登录时的复查在后台进行，不把页面卸掉重装
  if (state.status === 'unreachable') emit({ status: 'loading' });
  try {
    const me = await api.me(token);
    if (hasDraftOwner() && !draftsBelongTo(me.id)) {
      // 草稿是别人的（极少见：票与草稿来自不同的人）—— 先清空，再把票放回去
      clearIdentity();
      writeToken(token);
    }
    writeDraftOwner(me.id);
    emit({ status: 'authenticated', profile: toProfile(me) });
  } catch (e) {
    if (e instanceof ApiError && e.isAuthFailure) {
      clearTokenOnly();
      emit({
        status: 'anonymous',
        notice: e.body.code === 'token_revoked' ? REVOKED_NOTICE : undefined,
      });
      return;
    }
    // 已经在用的会话，后台复查暂时失败：保持登录，由各页自己的错误态处理
    if (state.status === 'authenticated') return;
    // 票可能还是好的（断网 / 5xx / 超时，或说不清的非认证错误）：留着票和草稿，让学生重试
    void isTransient(e);
    emit({ status: 'unreachable' });
  }
}

/** 「问不到服务端」时学生选择换个账号：只作废这张票，草稿等归属核对。 */
export function abandonUnreachableSession(): void {
  clearTokenOnly();
  emit({ status: 'anonymous' });
}

function toProfile(me: MeResult): StudentProfile {
  return { id: me.id, name: me.name, nickname: me.nickname, avatar: me.avatar };
}

/**
 * 登录 / 注册成功后调用。**只存令牌与草稿归属**，profile 放内存。
 *
 * 同一个人（归属一致）→ 草稿留着，接着用；换了人（或归属未知）→ 先把整个
 * `sw:` 清空，否则新学生打开阅读页会看到别人的答案，还会被当成「本地更新」
 * 补传到新学生的答卷上。
 */
export function adoptSession(token: string, profile: StudentProfile): void {
  if (!draftsBelongTo(profile.id)) {
    clearIdentity();
    resetNavigationMemory();
  }
  writeToken(token);
  writeDraftOwner(profile.id);
  emit({ status: 'authenticated', profile });
}

/**
 * 主动退出。清掉本包写过的全部键、这台设备上的提醒订阅，回到 anonymous。
 * 提醒要在清票**之前**用这张票解绑，否则下一个在这台设备上登录的人会收到
 * 上一个人的提醒（审计 UI07）。
 */
export async function logoutAndRelease(notice?: string): Promise<void> {
  const token = readToken();
  if (token) await releasePushForThisDevice(token).catch(() => undefined);
  logout(notice);
}

/** 登出（同步部分）。清掉本包写过的全部键，回到 anonymous。 */
export function logout(notice?: string): void {
  clearIdentity();
  resetNavigationMemory();
  emit({ status: 'anonymous', notice });
}

/**
 * 改密码成功之后（且老服务端没发新票）。
 *
 * 服务端会递增 `studentAuthVersion` —— 手里这张票当场作废。只作废令牌：这是本人
 * 改的密码，草稿是他自己的，重新登录后接着用。
 */
export function afterPasswordChanged(): void {
  clearTokenOnly();
  emit({ status: 'anonymous', notice: '密码已经改好了 —— 用新密码重新登录一次。' });
}

/**
 * 任何请求撞上认证失败时调用：只作废令牌、回登录页，草稿留给同一个人（UI15）。
 * 这台设备上的提醒订阅在本地解除（令牌已失效，没法再通知服务端；推送服务那边
 * 这个端点随之失效，服务端下次发送会被拒并清理）。
 */
export function handleAuthFailure(e: unknown): boolean {
  if (e instanceof ApiError && e.isAuthFailure) {
    void releasePushForThisDevice(null).catch(() => undefined);
    clearTokenOnly();
    resetNavigationMemory();
    emit({ status: 'anonymous', notice: e.body.code === 'token_revoked' ? REVOKED_NOTICE : undefined });
    return true;
  }
  return false;
}

/**
 * 仅供测试重置。
 *
 * **只重置状态，不清 listeners** —— 清了会把还挂着的组件订阅一并掐断，
 * 之后的 emit 谁都收不到。
 */
export function __resetForTest(): void {
  state = { status: 'loading' };
}
