/**
 * 学生端版本路由 —— 服务端唯一的事实源。
 *
 * ## 为什么这件事必须由服务端决定
 *
 * 灰度的粒度是**学生 ID**（D5），而**学生 ID 只有在认证通过之后才知道**。
 * 首次导航是一个匿名 HTTP 请求：令牌在前端的 `localStorage` 里，只有那个
 * 源上的 JS 读得到，请求头里没有它，也没有 Cookie。所以：
 *
 *   **边缘层（代理 / nginx / Railway 路由）在首次导航时不可能按学生 ID
 *   分流。** 任何「在入口按学生 ID 路由」的设计都是错的。
 *
 * 正确的做法是：登录 / 注册 / `me` 的**回执**里带上算好的结论，两个前端
 * 都消费同一个事实。前端**永远不解析** `STUDENT_APP_V2`。
 *
 * ## 向后兼容
 *
 * 这里只**新增**两个只读字段。旧端不读它们，行为零变化；新端读了也只是
 * 知道「自己该不该接管」。**阶段 4A 不让任何一端据此跳转。**
 */

/** 学生端版本。`v1` = 旧端（`apps/web`），`v2` = 新端（`apps/student-web`）。 */
export type StudentAppVersion = 'v1' | 'v2';

const TRUTHY = ['on', 'true', 'all', '1'];
const FALSY = ['off', 'false', '0'];

/**
 * 按学生灰度必须**显式前缀**。
 *
 * 照抄 `all-day.ts` 那条用血换来的经验：光看字符串分不清「拼错的布尔值」
 * 和「一个 id」。`STUDENT_APP_V2=ture` 会被当成一个叫 `ture` 的学生，于是
 * 谁都没开 —— 而日志里一切正常。加了前缀之后，非布尔又非 `student:` 的值
 * 一律是配置错误。
 */
const STUDENT_PREFIX = 'student:';

export type StudentAppV2Config =
  | { kind: 'off' }
  | { kind: 'all' }
  | { kind: 'students'; ids: string[] }
  | { kind: 'invalid'; raw: string };

/** 解析 `STUDENT_APP_V2`。纯函数 —— 测试直接测它，不去碰 `process.env`。 */
export function parseStudentAppV2(raw: string | undefined): StudentAppV2Config {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { kind: 'off' };
  const lower = trimmed.toLowerCase();
  if (TRUTHY.includes(lower)) return { kind: 'all' };
  if (FALSY.includes(lower)) return { kind: 'off' };
  if (lower.startsWith(STUDENT_PREFIX)) {
    const ids = trimmed
      .slice(STUDENT_PREFIX.length)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    // `student:` 后面空着 —— 显然是想开却没填，按配置错误处理，
    // 不要静默当成 off（那正是 all-day 那个坑的形状）。
    if (ids.length === 0) return { kind: 'invalid', raw: trimmed };
    return { kind: 'students', ids };
  }
  return { kind: 'invalid', raw: trimmed };
}

/**
 * 这个学生该走哪一版。
 *
 * **fail-closed 到 `v1`**：配置非法、学生 id 为空、拿不准 —— 一律留在旧端。
 * 新端只在**明确**被点名时才接管。
 */
export function studentAppVersionFor(
  cfg: StudentAppV2Config,
  studentId: string | null | undefined,
): StudentAppVersion {
  if (cfg.kind === 'all') return 'v2';
  if (cfg.kind === 'students') {
    const id = (studentId ?? '').trim();
    if (!id) return 'v1';
    return cfg.ids.includes(id) ? 'v2' : 'v1';
  }
  // 'off' 与 'invalid' 都落这里 —— 非法配置在生产会被启动守卫拦下，
  // 万一走到这儿也必须是 v1。
  return 'v1';
}

/**
 * 新端的公开 origin，规范化后下发。
 *
 * **新端不得把自己的 origin 写死**（它换域名不该要求重新构建前端），
 * 所以由服务端在运行期告诉它。生产主机名尚未确定 —— 这正是这个字段
 * 存在的理由。
 *
 * 规范化：去掉尾斜杠。空值返回 `null`，表示「还没配」。
 */
export function normalizeStudentAppOrigin(raw: string | undefined): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
}

/** `STUDENT_APP_ORIGIN` 是否是一个像样的绝对 origin。 */
export function isValidStudentAppOrigin(value: string | null): boolean {
  if (value === null) return true; // 没配 = 合法（还没到那一步）
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    // 只要 origin，不要路径 —— 带路径说明配错了，早点报出来
    return u.pathname === '/' && !u.search && !u.hash;
  } catch {
    return false;
  }
}

/**
 * 启动硬门 —— **生产环境下非法配置直接拒绝启动**。
 *
 * 与 `assertAllDayConfig` 同一套道理：配错了要在启动时炸，而不是让它
 * 安静地退化成「谁都没开」，然后由人在几天后从「学生说打不开」里反推。
 *
 * 返回一行给启动日志的摘要（**不含任何值以外的秘密**）。
 */
export function assertStudentAppRoutingConfig(env: {
  STUDENT_APP_V2?: string;
  STUDENT_APP_ORIGIN?: string;
  NODE_ENV?: string;
}): string {
  const cfg = parseStudentAppV2(env.STUDENT_APP_V2);
  const origin = normalizeStudentAppOrigin(env.STUDENT_APP_ORIGIN);
  const isProd = (env.NODE_ENV ?? '').toLowerCase() === 'production';

  if (cfg.kind === 'invalid') {
    const msg =
      `STUDENT_APP_V2 的值无法解析：「${cfg.raw}」。\n` +
      `合法取值：留空 / off / on / student:<id>,<id>,…\n` +
      `（按学生灰度必须带 student: 前缀 —— 否则分不清拼错的布尔值和一个 id。）`;
    if (isProd) throw new Error(msg);
    // 非生产只警告：本地和测试经常写半截值
    return `student-app routing: INVALID STUDENT_APP_V2 (non-prod, treated as off) — ${cfg.raw}`;
  }

  if (!isValidStudentAppOrigin(origin)) {
    const msg =
      `STUDENT_APP_ORIGIN 不是一个合法的 origin：「${env.STUDENT_APP_ORIGIN}」。\n` +
      `要的是纯 origin（如 https://example.invalid），不带路径、查询串或 hash。`;
    if (isProd) throw new Error(msg);
    return `student-app routing: INVALID STUDENT_APP_ORIGIN (non-prod, ignored)`;
  }

  // v2 指了人却没有 origin —— 那些学生会被告知「去新端」却没有地址。
  const wantsV2 = cfg.kind === 'all' || cfg.kind === 'students';
  if (wantsV2 && origin === null) {
    const msg =
      `STUDENT_APP_V2 已开启（${cfg.kind}），但 STUDENT_APP_ORIGIN 没有配。\n` +
      `被点名的学生会拿到 appVersion=v2 却没有可去的地址。`;
    if (isProd) throw new Error(msg);
    return `student-app routing: v2 enabled without STUDENT_APP_ORIGIN (non-prod)`;
  }

  const scope =
    cfg.kind === 'students' ? `${cfg.ids.length} student(s)` : cfg.kind;
  return `student-app routing: v2=${scope} origin=${origin ?? '(unset)'}`;
}

/** 从 `process.env` 现算一次。故意不缓存 —— 测试要能改环境变量。 */
export function studentAppRoutingFromEnv(studentId: string | null | undefined): {
  appVersion: StudentAppVersion;
  studentAppOrigin: string | null;
} {
  const cfg = parseStudentAppV2(process.env.STUDENT_APP_V2);
  return {
    appVersion: studentAppVersionFor(cfg, studentId),
    studentAppOrigin: normalizeStudentAppOrigin(process.env.STUDENT_APP_ORIGIN),
  };
}
