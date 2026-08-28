/**
 * API 客户端。
 *
 * ## 身份怎么走
 *
 * **令牌走 `Authorization: Bearer`，不用 Cookie。** 认证之后的请求
 * **一个身份参数都不带** —— 不带 `name`、不带 `studentId`、不带 `then`、
 * 不带 `after`。
 *
 * 唯一的例外是三个 **pre-auth** 场景：登录、注册、同名消歧。那时还没有
 * 令牌，姓名是**请求体里的凭据字段**，不是 URL 里的身份。它们也**绝不
 * 落盘** —— 见 identity.ts。
 *
 * ## BASE
 *
 * 跨源（拓扑 A）时由构建期 `VITE_API_URL` 指定；留空则同源相对路径。
 * **新端不写死自己的公开 origin** —— 那个由服务端在运行期下发
 * （`studentAppOrigin`），换域名不需要重新构建。
 */

import type { NextActionKind } from '../routes.contract';

export const BASE: string = (import.meta as unknown as { env?: Record<string, string> }).env
  ?.VITE_API_URL ?? '';

export interface ApiErrorBody {
  code?: string;
  message?: string;
  retryAfterSec?: number;
  [k: string]: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;
  constructor(status: number, body: ApiErrorBody) {
    super(body.code ?? body.message ?? `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
  /** 服务端明说令牌不能用了。调用方据此清身份并回登录页。 */
  get isAuthFailure(): boolean {
    return (
      this.status === 401 ||
      this.body.code === 'token_revoked' ||
      this.body.code === 'student_token_required'
    );
  }
}

/** 网络层本身失败（断网、DNS、CORS 被拒）—— 与「服务端说不行」区分开。 */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super(String((cause as Error)?.message ?? cause));
    this.name = 'NetworkError';
  }
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  opts: { body?: unknown; token?: string | null } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    });
  } catch (e) {
    throw new NetworkError(e);
  }
  const text = await res.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { message: text };
  }
  if (!res.ok) throw new ApiError(res.status, parsed as ApiErrorBody);
  return parsed as T;
}

// ─────────────────────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────────────────────

export interface StudentCandidate {
  studentId: string;
  name: string;
  classes?: string[];
}

export interface StudentProfile {
  id: string;
  name: string;
  nickname: string;
  avatar: string | null;
}

/** 服务端算好的版本路由结论。前端**只消费，不解析开关**。 */
export interface AppRouting {
  appVersion?: 'v1' | 'v2';
  studentAppOrigin?: string | null;
}

export type AuthResult =
  | { needDisambiguation: true; candidates: StudentCandidate[] }
  | ({ needDisambiguation?: false; token: string; student: StudentProfile } & AppRouting);

export type MeResult = {
  id: string;
  name: string;
  nickname: string;
  avatar: string | null;
  pinSet?: boolean;
} & AppRouting;

export type RegistrationStatus =
  | { found: false; registered: false }
  | { needDisambiguation: true; candidates: StudentCandidate[] }
  | { found: true; registered: boolean };

// ─────────────────────────────────────────────────────────────
// 今天的课
//
// 类型按**服务端实际返回的字段**写，只写页面真的要用的那些。
// 不用 `any`：这条契约一旦漂移，typecheck 要能先喊。
// ─────────────────────────────────────────────────────────────

/** 与 `apps/api/src/lesson/lesson-rules.ts` 的 SegmentStatus 逐字对齐。 */
export type SegmentStatus = 'done' | 'partial' | 'todo' | 'none' | 'auto_closed';

/** 正式词汇成绩视图 —— 与阅读成绩分开（P7）。 */
export type VocabScoreView =
  | { status: 'legacy_no_queue' }
  | { status: 'not_started' }
  | { status: 'in_progress'; answered: number; total: number }
  | { status: 'submitted'; correct: number; total: number; score: number };

export type ReadSegment = {
  key: 'read';
  status: SegmentStatus;
  label: string | null;
  questionCount: number | null;
  typicalMinutes: number;
  score: number | null;
  maxScore: number | null;
  scoresPending: boolean;
  submissionId: string | null;
  sessionId: string | null;
  autoClosed: boolean;
};
export type VocabSegment = {
  key: 'vocab';
  status: SegmentStatus;
  progress: number;
  target: number;
  typicalMinutes: number;
  quizScore: VocabScoreView;
};
export type DrillSegment = {
  key: 'drill';
  status: SegmentStatus;
  progress: number;
  target: number;
  typicalMinutes: number;
};
export type LessonSegment = ReadSegment | VocabSegment | DrillSegment;

/**
 * 服务端的下一步。
 *
 * `href` **是给旧端用的，新端完全忽略**（architecture §4.3）——
 * 这里保留字段声明只是为了如实描述响应，任何代码都不得读它。
 */
export type NextActionPayload = {
  kind: NextActionKind;
  label: string;
  href: string | null;
};

export type LessonToday = {
  student: { id: string; name: string };
  date: string;
  nextAction: NextActionPayload;
  rulesVersion: number;
  completed: number;
  total: number;
  allDone: boolean;
  streakDays: number;
  targetsFrozenAt: string | null;
  stage: string;
  stageAt: string | null;
  vocabCursor: number;
  segments: LessonSegment[];
};


// ─────────────────────────────────────────────────────────────
// 端点
//
// 下面四个是 **pre-auth**：姓名 / studentId 出现在**请求体或查询串**里是
// 正当的（那时还没有令牌）。它们不写进 URL 作为身份，也不落盘。
// ─────────────────────────────────────────────────────────────

export const api = {
  login: (body: { name: string; studentId?: string; pin: string }) =>
    request<AuthResult>('POST', '/student-auth/login', { body }),

  register: (body: {
    name: string;
    studentId?: string;
    password: string;
    nickname?: string;
  }) => request<AuthResult>('POST', '/student-auth/register', { body }),

  registrationStatus: (params: { name: string; studentId?: string }) =>
    request<RegistrationStatus>(
      'GET',
      `/student-auth/registration-status?name=${encodeURIComponent(params.name)}` +
        (params.studentId ? `&studentId=${encodeURIComponent(params.studentId)}` : ''),
    ),

  // ── 以下需要令牌；**不带任何身份参数** ──

  me: (token: string) => request<MeResult>('GET', '/student-auth/me', { token }),

  changePassword: (token: string, body: { oldPin: string; newPin: string }) =>
    request<{ ok: true }>('POST', '/student-auth/change-pin', { body, token }),

  // ── 今天的课；**认证后，零身份参数** ──

  /** 权威课程状态。纯读取 —— 服务端保证它一个字都不写（P8）。 */
  lessonToday: (token: string) => request<LessonToday>('GET', '/lesson/today', { token }),

  /**
   * 开始今天的课。
   *
   * 请求体**恰好是** `{ begin: true }` —— 不带姓名、不带 studentId。
   * `begin` 必须显式为 true：缺省只是「恢复」，那不等于学生真的开始了
   * 今天的考试（P9）。
   */
  lessonStart: (token: string) =>
    request<LessonToday>('POST', '/lesson/start', { body: { begin: true }, token }),
};
