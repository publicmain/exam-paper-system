/**
 * 认证状态机 —— 整个新端唯一持有身份的地方。
 *
 * 刻意不用状态管理库：这里只有三个状态和四个转换，一个 `useSyncExternalStore`
 * 足够，而且能让「身份怎么来的」在一屏里看完。
 *
 * ## 三个状态
 *
 *   loading         启动时正在用令牌向 `/student-auth/me` 换身份
 *   authenticated   有 profile
 *   anonymous       没有（含「刚被撤销」——那时带一句 notice）
 *
 * ## fail-closed
 *
 * 拿不准就是 anonymous。任何 401 / `token_revoked` / `student_token_required`
 * → 清身份 → anonymous。**绝不**因为本地还留着什么就假装已登录。
 */
import { api, ApiError, type MeResult, type StudentProfile } from './api';
import { clearIdentity, readToken, writeToken } from './identity';
import { REVOKED_NOTICE } from './errors';

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; notice?: string }
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

/**
 * 启动时用令牌换身份。
 *
 * **不信任本地令牌的内容** —— 不解 JWT、不读里面的姓名。令牌只是一张
 * 票，身份以服务端 `/student-auth/me` 的回答为准。
 */
export async function bootstrap(): Promise<void> {
  const token = readToken();
  if (!token) {
    emit({ status: 'anonymous' });
    return;
  }
  try {
    const me = await api.me(token);
    emit({ status: 'authenticated', profile: toProfile(me) });
  } catch (e) {
    if (e instanceof ApiError && e.isAuthFailure) {
      clearIdentity();
      emit({
        status: 'anonymous',
        notice: e.body.code === 'token_revoked' ? REVOKED_NOTICE : undefined,
      });
      return;
    }
    // 网络问题不该把人登出 —— 票可能还是好的。停在 anonymous 但不清票，
    // 学生重连后刷新即可恢复。
    emit({ status: 'anonymous' });
  }
}

function toProfile(me: MeResult): StudentProfile {
  return { id: me.id, name: me.name, nickname: me.nickname, avatar: me.avatar };
}

/** 登录 / 注册成功后调用。**只存令牌**，profile 放内存。 */
export function adoptSession(token: string, profile: StudentProfile): void {
  writeToken(token);
  emit({ status: 'authenticated', profile });
}

/** 登出。清掉本包写过的全部键，回到 anonymous。 */
export function logout(notice?: string): void {
  clearIdentity();
  emit({ status: 'anonymous', notice });
}

/**
 * 改密码成功之后。
 *
 * 服务端会递增 `studentAuthVersion` —— **手里这张票当场作废**。
 * 所以必须清掉并回登录页，否则学生会卡在「要我登录，但我明明登录了」。
 */
export function afterPasswordChanged(): void {
  logout('密码已经改好了 —— 用新密码重新登录一次。');
}

/** 任何请求撞上认证失败时调用。 */
export function handleAuthFailure(e: unknown): boolean {
  if (e instanceof ApiError && e.isAuthFailure) {
    logout(e.body.code === 'token_revoked' ? REVOKED_NOTICE : undefined);
    return true;
  }
  return false;
}

/**
 * 仅供测试重置。
 *
 * **只重置状态，不清 listeners** —— 清了会把还挂着的组件订阅一并掐断，
 * 之后的 emit 谁都收不到。状态是模块级的，测试之间必须显式复位，
 * 否则上一个用例登录完的身份会漏进下一个用例。
 */
export function __resetForTest(): void {
  state = { status: 'loading' };
}
