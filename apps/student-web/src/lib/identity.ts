/**
 * 学生身份 —— **只有一个令牌，没有别的**。
 *
 * ## 契约（product-contract.md §2.3）
 *
 * - 身份**只来自服务端验证过的学生令牌**
 * - canonical URL **不携带姓名或 studentId**
 * - **不得**从 localStorage 的姓名键推断身份
 * - 令牌失效 → 回登录页，**不是**姓名输入页
 *
 * ## 因此这里刻意只有一个键
 *
 * 存的是令牌，**只有令牌**。姓名、studentId、候选人选择、昵称、头像、
 * 路由决定 —— **一律不持久化**。它们要么在内存里（本次会话），要么
 * 每次问服务端要。
 *
 * 旧端的 `mq:history:name` / `mq:history:studentId` 在这里**读都不读**：
 * 那两个键是「姓名即身份」时代的承重结构，新端从第一行代码起就不碰。
 *
 * 键名带命名空间（`sw:` = student-web），避免与将来同源上的任何东西撞名。
 */

const TOKEN_KEY = 'sw:token';

function safeStorage(): Storage | null {
  try {
    // Safari 隐私模式下 localStorage 可能存在但一写就抛
    const s = window.localStorage;
    const probe = '__sw_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function readToken(): string | null {
  const s = safeStorage();
  if (!s) return null;
  const v = s.getItem(TOKEN_KEY);
  return v && v.length > 0 ? v : null;
}

export function writeToken(token: string): void {
  const s = safeStorage();
  if (!s) return;
  s.setItem(TOKEN_KEY, token);
}

/**
 * 清身份 —— 登出、令牌撤销、改密码成功之后都走这里。
 *
 * 只清我们自己的命名空间。**绝不遍历清空整个 localStorage** ——
 * 同源上将来可能有别的东西，把别人的数据一起抹掉是另一种事故。
 */
export function clearIdentity(): void {
  const s = safeStorage();
  if (!s) return;
  s.removeItem(TOKEN_KEY);
}

/** 本包写进 storage 的全部键。测试用它断言「登出后一个不剩」。 */
export const OWNED_STORAGE_KEYS: readonly string[] = [TOKEN_KEY];
