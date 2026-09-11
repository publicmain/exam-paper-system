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

/**
 * 本包拥有的**整个命名空间**。阶段 7B 起这里不止一个键 ——
 * 阅读页会写 `sw:reading:*`、字号会写 `sw:fontScale`，而且键名里带
 * sessionId / submissionId，**枚举不出来**。所以清理必须按前缀扫。
 */
export const OWNED_STORAGE_PREFIX = 'sw:';

const TOKEN_KEY = 'sw:token';
/**
 * 本机草稿属于谁 —— 存的是服务端学生 id 的**摘要**，不是 id 本身。
 *
 * 2026-09-11 审计 UI15：原来登录前一律清空 `sw:`，同一个学生因为令牌过期重新登录，
 * 没来得及同步的阅读草稿也被删了。现在：**同一个人**回来，草稿留着；**换了人**，
 * 先清空再写新票。
 *
 * 契约 §2.3 不许把 studentId 持久化，所以这里只存一个不可逆的短摘要：它只用来回答
 * 「草稿是不是刚登录的这个人的」，不能拿来识别身份，也不参与任何请求。
 */
const OWNER_KEY = 'sw:owner';

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

/** FNV-1a 64 位（两段 32 位）摘要 —— 只做相等比较用。 */
export function ownerDigest(studentId: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ studentId.length;
  for (let i = 0; i < studentId.length; i += 1) {
    const c = studentId.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x01000193) >>> 0;
  }
  return `o${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/** 本机草稿是不是这个学生的。没有记号（旧版本留下的草稿）按「不是」处理。 */
export function draftsBelongTo(studentId: string): boolean {
  const s = safeStorage();
  if (!s) return false;
  return s.getItem(OWNER_KEY) === ownerDigest(studentId);
}

export function hasDraftOwner(): boolean {
  const s = safeStorage();
  if (!s) return false;
  return Boolean(s.getItem(OWNER_KEY));
}

export function writeDraftOwner(studentId: string): void {
  const s = safeStorage();
  if (!s) return;
  s.setItem(OWNER_KEY, ownerDigest(studentId));
}

/**
 * 只作废令牌，**草稿与归属留着**（令牌过期 / 被撤销 / 暂时换不到身份时）。
 * 没有令牌就不可能再写任何东西到服务端；同一个人重新登录能接着用草稿，
 * 换了人则由 `adoptSession` 先清空（归属对不上）。
 */
export function clearTokenOnly(): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.removeItem(TOKEN_KEY);
  } catch {
    /* 删不掉就算了 —— 下一次认证失败还会再来 */
  }
}

/**
 * 清身份 —— 主动退出、换了一个人登录时走这里。
 *
 * 只清我们自己的命名空间。**绝不遍历清空整个 localStorage** ——
 * 同源上将来可能有别的东西，把别人的数据一起抹掉是另一种事故。
 */
export function clearIdentity(): void {
  const s = safeStorage();
  if (!s) return;
  // 前缀扫除：令牌之外，这个学生的阅读草稿 / 序号 / 旗标 / 标签所有权 /
  // 字号也一起走。留下任何一样，下一个在这台设备上登录的人都可能看见
  // 上一个人的答案。
  //
  // **只扫 `sw:`**。同源上将来可能有别的东西，遍历清空整个 localStorage
  // 是另一种事故；`mq:*` 是旧端的，更是碰都不碰。
  const doomed: string[] = [];
  try {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(OWNED_STORAGE_PREFIX)) doomed.push(k);
    }
  } catch {
    doomed.push(TOKEN_KEY);
  }
  for (const k of doomed) {
    try { s.removeItem(k); } catch { /* 单个键删不掉不该拖垮整轮清理 */ }
  }
}

/**
 * 本包写进 storage 的**固定**键。带 sessionId 的那些是动态的，
 * 枚举不出来 —— 它们由 `OWNED_STORAGE_PREFIX` 兜住。
 */
export const OWNED_STORAGE_KEYS: readonly string[] = [TOKEN_KEY, OWNER_KEY];
