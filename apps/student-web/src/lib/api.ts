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
import type { PilotLevelId } from './levels';

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
  method: 'GET' | 'POST' | 'PATCH',
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
  englishLevel?: PilotLevelId | null;
} & AppRouting;

/** 自助注册的回执 —— 和 login 同构，外加服务端确认下来的那一档。 */
export type SelfRegisterResult = {
  token: string;
  student: StudentProfile;
  englishLevel: PilotLevelId;
} & AppRouting;

export type RegistrationClass = {
  id: string;
  name: string;
  levels: PilotLevelId[];
};

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
  /**
   * 交卷了。`percentage` 直接读落库的值，**不重算** —— 与
   * `apps/api/src/vocab/vocab-score.ts` 的 DTO 逐字对齐。
   */
  | {
      status: 'submitted';
      correct: number;
      total: number;
      percentage: number;
      submittedAt: string;
    };

/**
 * S12L —— 这一段今天**算不算数**。
 *
 * 与 `status: 'none'` 不是一回事：`none` 是「有这一段，今天没内容」，
 * 仍然进分母；`available: false` 是「这个能力现在整个关着」，一段都不算。
 * 服务端负责判定并给出人话理由，前端只负责显示。
 */
export type SegmentAvailability = {
  available?: boolean;
  unavailableReason?: string | null;
};

export type ReadSegment = SegmentAvailability & {
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
export type VocabSegment = SegmentAvailability & {
  key: 'vocab';
  status: SegmentStatus;
  progress: number;
  target: number;
  typicalMinutes: number;
  quizScore: VocabScoreView;
};
export type DrillSegment = SegmentAvailability & {
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

  /**
   * ⚠️ **学生端的页面已经不走这条路了**（S12O）。
   *
   * 它**认领**教师已经建好的一行 —— 那正是自助注册要取消的前提。留着
   * 是因为服务端端点没删、教师端仍在用；新端如果哪天又需要「认领」，
   * 契约在这里。别把它当成注册入口。
   */
  register: (body: {
    name: string;
    studentId?: string;
    password: string;
    nickname?: string;
  }) => request<AuthResult>('POST', '/student-auth/register', { body }),

  /** 注册页只读班级列表：不带身份，也不返回班级码或花名册。 */
  registrationClasses: () =>
    request<{ classes: RegistrationClass[] }>('GET', '/student-auth/registration-classes'),

  /**
   * S12O —— **自助注册**：班级 + 姓名 + 自设 PIN + 自选难度。
   *
   * pre-auth，姓名在这里是**凭据字段**而不是 URL 里的身份；请求体里
   * **没有 studentId**（服务端也用 `.strict()` 直接拒收）。
   */
  selfRegister: (body: {
    classId: string;
    name: string;
    pin: string;
    englishLevel: PilotLevelId;
  }) => request<SelfRegisterResult>('POST', '/student-auth/self-register', { body }),

  /**
   * ⚠️ **临时的 staging 免密夹具登录 —— 上生产前必须拆掉。**
   *
   * **请求体恒为空**：不带姓名、不带 studentId、不带 PIN。服务端那一侧
   * 的账号是写死的（只可能是虚构账号 `t6_done`），所以这里也**没有任何
   * 可传的参数** —— 客户端指定不了登谁。
   *
   * 服务端关掉这条通道时返回 404，调用方据此当作「按钮不该存在」。
   * 闸门全貌与退役步骤见 `apps/api/src/student-auth/staging-fixture-login.ts`。
   */
  stagingFixtureSession: () =>
    request<AuthResult>('POST', '/student-auth/staging-fixture-session', { body: {} }),

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

  /**
   * S12O —— 自己改难度。**身份只靠 Bearer**，体里只有一个字段。
   */
  setEnglishLevel: (token: string, englishLevel: PilotLevelId) =>
    request<{ englishLevel: PilotLevelId; effective: string }>(
      'PATCH',
      '/student-auth/me/english-level',
      { body: { englishLevel }, token },
    ),

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

  // ── 阅读会话（阶段 7B）；同样是**认证后，零身份参数** ──

  /**
   * 权威会话读取。**这一个端点就是对账重载要打的那个**（S7A §5.4）。
   *
   * 服务端把题目数组叫 `paperQuestions`（`morning-quiz.service.ts:2020`），
   * 新端对外叫 `questions`。**归一化只做这一次、只做在这里** ——
   * 之前直接把响应原样返回，真实响应里 `questions` 永远是 undefined，
   * 而测试用捏造的 `questions` 喂进去，所以谁都没发现。
   */
  getReadingSession: async (token: string, sessionId: string): Promise<ReadingSessionPayload> => {
    const wire = await request<ReadingSessionWire>(
      'GET',
      `/morning-quiz/sessions/${encodeURIComponent(sessionId)}`,
      { token },
    );
    return {
      sessionId: wire.sessionId,
      submissionId: wire.submissionId ?? null,
      quizEnd: wire.quizEnd ?? null,
      regularQuizEnd: wire.regularQuizEnd ?? null,
      secondWindowToday: wire.secondWindowToday ?? false,
      level: wire.level ?? null,
      paperMode: wire.paperMode ?? null,
      mode: wire.mode === 'practice' ? 'practice' : 'test',
      rendererKey: wire.rendererKey ?? null,
      questions: wire.paperQuestions ?? [],
      existingAnswers: wire.existingAnswers ?? {},
    };
  },

  saveReadingAnswer: (token: string, sessionId: string, body: ReadingSaveBody) =>
    request<ReadingSaveResult>(
      'PATCH',
      `/morning-quiz/sessions/${encodeURIComponent(sessionId)}/answer`,
      { body, token },
    ),

  submitReading: (token: string, sessionId: string, body: { final: boolean } = { final: true }) =>
    request<ReadingSubmitResult>(
      'POST',
      `/morning-quiz/sessions/${encodeURIComponent(sessionId)}/submit`,
      { body, token },
    ),

  // ── 阅读结果（阶段 8A）；同样是**认证后，零身份参数** ──

  /**
   * 交卷后的成绩与逐题回顾。
   *
   * 服务端自己判归属，也自己决定「分数放不放、答案放不放」
   * （`stripUnreleasedScores`）—— 前端**不做**任何补算或兜底显示。
   * 交卷之前调它会拿到 403 `result_locked_until_submit`。
   */
  getReadingResult: (token: string, sessionId: string) =>
    request<ReadingResult>(
      'GET',
      `/morning-quiz/student-result/${encodeURIComponent(sessionId)}`,
      { token },
    ),

  /**
   * 申诉。整卷申诉不传 `paperQuestionId`，逐题申诉才传。
   *
   * 请求体**恰好三个字段** —— 身份来自 Bearer 令牌，不带姓名 / studentId。
   */
  createAppeal: (
    token: string,
    body: { submissionId: string; paperQuestionId?: string; message: string },
  ) => request<AppealCreated>('POST', '/morning-quiz/appeals', { body, token }),

  // ── 课程学词（阶段 9A）；五条全是**认证后，零身份参数** ──
  //
  // 后端这几条的 schema 里都还留着 `name` / `studentName` / `studentId`
  // 这些**可选**字段（旧端在用），`identityOf()` 会优先认令牌。新端
  // **一个都不传** —— 传了就等于给自己开一个「指定别人身份」的口子。
  //
  // `GET /vocab/lesson-cards` 同样**不带任何查询串**：它的 `?name=` /
  // `?studentId=` 是旧端的入口，新端只靠 Bearer。

  lessonCards: (token: string) =>
    request<LessonCardsResult>('GET', '/vocab/lesson-cards', { token }),

  /**
   * 教学卡「下一个」——**一次调用**同时标记「教过」并推进断点。
   *
   * 后端刻意把这两件事合成一个事务（见 lesson.controller 注释）：分两步时
   * 中间有「cursor 前进了但 firstTaughtAt 没写」的窗口，会把阶段永久锁死在
   * 学词那一段。所以新端也**只走这一条**，不再拼两个请求。
   */
  vocabTaught: (token: string, body: { headword: string; cursor: number }) =>
    request<VocabTaughtResult>('POST', '/lesson/vocab-taught', { body, token }),

  vocabReview: (
    token: string,
    body: { headword: string; rating: CourseRating; elapsedMs: number; requestId: string },
  ) => request<VocabReviewResult>('POST', '/vocab/review', { body, token }),

  vocabReviewUndo: (token: string, body: { headword: string }) =>
    request<VocabUndoResult>('POST', '/vocab/review/undo', { body, token }),

  vocabCursor: (token: string, body: { cursor: number }) =>
    request<VocabCursorResult>('POST', '/lesson/vocab-cursor', { body, token }),

  // ── 正式单词测试（阶段 9B1）；三条全是**认证后，零身份参数** ──
  //
  // 后端这三条的 schema 同样留着可选的 `name` / `studentId`（旧端在用），
  // `identityOf()` 优先认令牌。新端一个都不传 —— 正式测试是**记成绩**的，
  // 允许请求指定身份就等于允许替别人考试。
  //
  // 开考是幂等的：已有这次任务的 attempt 就原样返回（带 `resumed: true`），
  // 所以「进入」和「恢复」是同一个调用，**不需要**另一条 current 端点。

  quizStart: (token: string) =>
    request<QuizAttemptStart>('POST', '/vocab/quiz/attempt/start', { body: {}, token }),

  /** 记一题。选择题传 `optionIndex`，拼写题传 `text`，**二选一**。 */
  quizAnswer: (
    token: string,
    body: { index: number; optionIndex: number } | { index: number; text: string },
  ) => request<QuizAnswerResult>('POST', '/vocab/quiz/attempt/answer', { body, token }),

  quizSubmit: (token: string) =>
    request<QuizSubmitResult>('POST', '/vocab/quiz/attempt/submit', { body: {}, token }),

  // ── 历史成绩（阶段 11）；三条全是**认证后，零身份参数** ──
  //
  // 端点名字里的 `by-name` 是**旧端留下的名字**，不是这里的用法：后端
  // 阶段 5A 起「带令牌就不查姓名」（`morning-quiz.controller.ts` 的
  // `historyByName`），所以新端一个查询串都不带，服务端按令牌里的 id 取。
  //
  // 三条都是只读的。**列表两条互不相干** —— 一条是阅读答卷，一条是正式
  // 单词测试，页面把它们分成两段显示，绝不按日期拼成一条记录。

  /** 阅读历史。**不带查询串** —— 带了就等于允许请求指定看谁的成绩。 */
  readingHistory: (token: string) =>
    request<ReadingHistory>('GET', '/morning-quiz/history-by-name', { token }),

  /** 正式单词测试历史。同样不带查询串。 */
  vocabQuizAttempts: (token: string) =>
    request<VocabAttemptHistory>('GET', '/vocab/quiz/attempts', { token }),

  /**
   * 一份阅读答卷的逐题回顾。
   *
   * 查询串里**只有** `submissionId`，而且它来自路由的路径参数 ——
   * 归属校验在服务端（令牌里的 id 必须等于这份答卷的 studentId），
   * 客户端另外再核一次「回来的就是我问的那一份」。
   *
   * 返回形状与 `/morning-quiz/student-result/:id` **完全一致**：后端两条
   * 路由共用 `getStudentResult`，所以这里复用 `ReadingResult` 类型。
   */
  readingHistoryDetail: (token: string, submissionId: string) =>
    request<ReadingResult>(
      'GET',
      `/morning-quiz/history-detail?submissionId=${encodeURIComponent(submissionId)}`,
      { token },
    ),

  // ── 生词本与自由练习（阶段 12A）；六条全是**认证后，零身份参数** ──
  //
  // 后端这几条同样留着可选的 `?name=` / `?studentId=`（旧端入口），
  // `identityOf()` 优先认令牌。新端**一个都不传**。
  //
  // 与课程线的关系：`/vocab/review` 这一条**两条线共用**（同一套 FSRS
  // 调度），但**取卡的端点完全不同** ——
  //
  //   课程学词  `/vocab/lesson-cards`  当天冻结的固定队列，算课程完成度
  //   自由练习  `/vocab/due`           实时到期 + 配额，**不算**课程完成度
  //   生词自测  `/vocab/quiz`          自由练习的出题，**不是**正式测试
  //
  // 混用取卡端点正是旧端的病（见 `routes.contract.ts` 的 vocabPractice
  // 注释）；守卫 G-12A 静态钉住这一点。

  /** 我的生词本。**不带查询串** —— 带了就等于允许请求指定看谁的本子。 */
  vocabWords: (token: string) => request<VocabWordsResult>('GET', '/vocab/words', { token }),

  /** 我的词汇统计。与词表分开取：统计挂了不该连累词表。 */
  vocabStats: (token: string) => request<VocabStats>('GET', '/vocab/stats', { token }),

  /** 移出生词本。请求体**恰好一个字段**。 */
  vocabWordRemove: (token: string, body: { headword: string }) =>
    request<VocabWordRemoved>('POST', '/vocab/words/remove', { body, token }),

  /** 自由练习的到期卡。**顺序由服务端决定**，前端不重排、不过滤。 */
  vocabDue: (token: string) => request<VocabDueResult>('GET', '/vocab/due', { token }),

  /**
   * 自由练习的一次评分。
   *
   * 与课程线的 `vocabReview` 打同一个端点，差别有两处，都是刻意的：
   *   · **四档**（课程线只发两档 —— 手机上四个按钮挨着，误触是常态，
   *     那是课程内的产品决定；自由练习是学生自己主动来练，给全四档）；
   *   · **不跟 `/lesson/vocab-cursor`** —— 自由练习不推进课程断点。
   */
  vocabPracticeReview: (
    token: string,
    body: { headword: string; rating: PracticeRating; elapsedMs: number; requestId: string },
  ) => request<VocabReviewResult>('POST', '/vocab/review', { body, token }),

  /** 生词自测出题。**不是** `/vocab/quiz/attempt/*`（那条记成绩）。 */
  /**
   * S12L —— 自测出题时带上题量。
   *
   * 服务端本来就收 `?limit=`（`buildQuiz` 的第一个参数），只是新端一直
   * 没传，于是学生进来就是固定的一份。**这是这条路上最小的改动** ——
   * 不新增端点、不做持久化会话。
   */
  vocabSelfTestQuiz: (token: string, limit?: number) =>
    request<VocabSelfTestQuiz>(
      'GET',
      limit ? `/vocab/quiz?limit=${encodeURIComponent(String(limit))}` : '/vocab/quiz',
      { token },
    ),

  // ── 错题本与错题重练（阶段 12B）；四条全是**认证后，零身份参数** ──
  //
  // 后端这四条同样还收 `?name=` / `?studentId=`（旧端入口），
  // `resolveIdentity()` → `identityOf()` 优先认令牌。新端一个都不传。
  //
  // 唯一允许出现的查询串是 `includeResolved=1` —— 它是**视图开关**，
  // 不是身份：服务端拿它决定「已销账的那些要不要一起给」，与谁在问无关。

  /**
   * 我的错题本。**一次取全**（含已销账的），前端自己分两段显示。
   *
   * 为什么不分两次取：`total` 与 `byTaskType` 是服务端按「未销账」算的，
   * 分两次取就会出现两份快照拼在一起的窗口 —— 上半屏的总数和下半屏的
   * 列表来自不同时刻。
   */
  mistakeList: (token: string) =>
    request<MistakeListResult>('GET', '/vocab/mistakes?includeResolved=1', { token }),

  /**
   * 标记「已弄懂」/ 撤销。请求体**恰好两个字段**。
   *
   * 返回 `{ updated }` 是**受影响的行数**：`0` 表示没有一行匹配
   * （不是我的、或者已经不在了）—— 那是**失败**，不是「成功但没变化」。
   */
  mistakeResolve: (token: string, body: { id: string; resolved: boolean }) =>
    request<MistakeResolved>('POST', '/vocab/mistakes/resolve', { body, token }),

  /** 今天的错题重练队列（带原文）。 */
  mistakePracticeQueue: (token: string) =>
    request<MistakePracticeQueue>('GET', '/vocab/mistakes/practice-queue', { token }),

  /**
   * 提交一次重练结果。请求体**恰好两个字段**。
   *
   * ⚠️ **这条没有 `requestId`**，服务端也没有幂等键 —— 它每收到一次就
   * `practiceCount + 1` 并重算连胜。所以网络失败时**绝不能盲目重发**：
   * 调用方必须先把队列读回来，看这道题还在不在（见 `MistakePractice.tsx`）。
   */
  mistakePracticeResult: (token: string, body: { id: string; correct: boolean }) =>
    request<MistakePracticeResult>('POST', '/vocab/mistakes/practice-result', { body, token }),

  // ── 考试中查词（阶段 12C）；两条都是**认证后，零身份参数** ──
  //
  // 这两条是阶段 7 从旧端摘下来的能力（旧实现带姓名写生词本，违反身份
  // 契约），阶段 12C 按 token-only 重写后挂回阅读页。
  //
  // 查词那条后端是 `@Public()` 且**不解析身份**（它只查词典，与谁在问
  // 无关）。新端仍然带上令牌 —— 一是这一页本来就登录着，二是「认证后的
  // 请求一律带 Bearer」这条口径不该为了一个端点开例外。

  /**
   * 查一个词。查不到返回 `{ found: false }` —— 前端显示「未收录」，
   * **绝不猜、绝不编**。
   *
   * 查询串里**只有 `word`**。
   */
  vocabLookup: (token: string, word: string) =>
    request<VocabLookupResult>('GET', `/vocab/lookup?word=${encodeURIComponent(word)}`, { token }),

  /**
   * 把这个词记进**当前登录学生**的生词本。
   *
   * 请求体里**没有任何身份字段** —— 记给谁由令牌决定。后端的 schema 还
   * 收 `studentName` / `studentId`（旧端在用），新端一个都不传。
   *
   * `headword` 由服务端查词典确定（不信任前端），所以同一个学生同一个词
   * 反复提交是**幂等**的：已存在时返回 `{ created: false }` 而不是报错。
   * 这正是失败重试可以直接原样重发的依据 —— 不需要 requestId。
   */
  vocabAddWord: (
    token: string,
    body: { word: string; contextSentence?: string; sourcePassageTitle?: string },
  ) => request<VocabWordAdded>('POST', '/vocab/words', { body, token }),
};

// ─────────────────────────────────────────────────────────────
// 词典查询（阶段 12C）
//
// 类型按**服务端实际返回的字段**写（`vocab.service.ts` 的 `LookupHit`
// 与 `student-word.service.ts` 的 `addWord()`）。
// ─────────────────────────────────────────────────────────────

/** 词典里的一条。`translation` 之外的都可能为 null —— 没有就不显示。 */
export interface DictEntry {
  /** 实际命中的词典词条（可能与点的词形不同：looked → look）。 */
  word: string;
  /** 学生点的那个原词形。 */
  query: string;
  phonetic: string | null;
  translation: string;
  definition: string | null;
  pos: string | null;
  collins: number | null;
  oxford: boolean;
  tag: string[];
  /** 命中方式，便于排查。 */
  via: 'direct' | 'possessive' | 'hyphen';
}

/**
 * 查词结果。
 *
 * **两支都要处理**：`found: false` 是正常结果（本地词典就是没收录），
 * 不是错误 —— 把它当错误显示成「查询失败」会让学生一直重试一个永远查不到
 * 的词。
 */
export type VocabLookupResult =
  | { found: true; entry: DictEntry }
  | { found: false; query: string };

/** `created: false` = 本来就在本子里（不是失败）。 */
export interface VocabWordAdded {
  created: boolean;
  headword: string;
}

// ─────────────────────────────────────────────────────────────
// 错题本与错题重练（阶段 12B）
//
// 类型按**服务端实际返回的字段**写（`mistake.service.ts` 的
// `listForStudent()` / `practiceQueue()` / `resolve()` / `practiceResult()`）。
// ─────────────────────────────────────────────────────────────

/** 收录原因。服务端是三选一的枚举；认不出来的原样显示。 */
export type MistakeReason = 'long_answer' | 'vocabulary' | 'repeated_tasktype';

/**
 * 错题本里的一条。
 *
 * 响应里还有 `studentId`（行的原样字段）。**刻意不声明** —— 与别处同理：
 * 声明了就会有人拿它当身份。
 */
export interface MistakeEntry {
  id: string;
  submissionId: string | null;
  paperQuestionId: string | null;
  taskType: string;
  passageTitle: string;
  quizDay: string;
  stem: string;
  /** 学生当时写的答案（空白记为空串）。 */
  studentAnswer: string;
  correctAnswer: string;
  /** 客观题的判分流水服务端已经洗掉了；空串就是「没有评语」。 */
  markerComment: string;
  awarded: number;
  maxMarks: number;
  reason: MistakeReason | string;
  resolved: boolean;
  resolvedAt: string | null;
  /** 隔天连对两次自动销账 —— 这个数由服务端算，前端只显示。 */
  correctStreak: number;
  practiceCount: number;
  lastPracticedAt: string | null;
  /** 答案要点（服务端已去掉判分指令）。可能是空数组。 */
  answerPoints: string[];
  /** 范文，长答题才有。空串就是没有。 */
  answerModel: string;
  explanation: string;
  evidence: string;
  createdAt: string;
}

export interface MistakeListResult {
  /** **未销账**的条数 —— 与 `entries.length` 不是一回事。 */
  total: number;
  /** 也只统计未销账的。 */
  byTaskType: Array<{ taskType: string; count: number }>;
  /** 顺序就是服务端的顺序（按天倒序、同天按收录原因排）；前端不重排。 */
  entries: MistakeEntry[];
}

export interface MistakeResolved {
  /** 受影响行数。`0` = 失败。 */
  updated: number;
}

/**
 * 重练时的作答方式，由服务端按题型定（`practiceKindOf` + snapshotOptions）。
 *
 *   tfng    固定三键（TRUE/FALSE/NOT GIVEN 或 YES/NO/NOT GIVEN）
 *   letters 段落字母键（从原文的 "Paragraph X" 推出来）
 *   options 题库里存了完整选项（MCQ 之类），能真正重选
 *   reveal  主观题：想好再翻卡，自评对错
 */
export type MistakePracticeKind = 'tfng' | 'letters' | 'options' | 'reveal';

/** `options` 那一路可能是纯字符串，也可能是 `{key,text}`。**原样渲染**。 */
export type MistakeOption = string | { key: string; text: string };

/**
 * 重练队列里的一道题。
 *
 * ⚠️ 这份响应**自带答案材料**（`correctAnswer` / `answerPoints` /
 * `answerModel` / `explanation` / `evidence`）—— 这是**自由重练**，不是考试，
 * 服务端不做遮挡。**遮挡是这一屏的责任**：作答（或翻卡）之前，
 * 这几样一个字都不许进 DOM。
 */
export interface MistakePracticeItem {
  id: string;
  taskType: string;
  reason: MistakeReason | string;
  passageTitle: string;
  quizDay: string;
  stem: string;
  /** 学生当时写的那个答案 —— 只在反馈里显示。 */
  myOldAnswer: string;
  markerComment: string;
  correctAnswer: string;
  answerPoints: string[];
  answerModel: string;
  explanation: string;
  evidence: string;
  practiceKind: MistakePracticeKind;
  options: MistakeOption[];
  correctStreak: number;
  /** 完整原文 —— 段落匹配 / 判断题离开原文没法真正重做。 */
  passage: string;
  submissionId: string | null;
  paperQuestionId: string | null;
}

export interface MistakePracticeQueue {
  /** 今天还有多少道到期未练的（含队列之外的）。 */
  remaining: number;
  /** 发题顺序就是这个数组的顺序；前端不重排、不过滤。 */
  items: MistakePracticeItem[];
}

/**
 * 一次重练结果的回执。
 *
 * `ok: false` = 这道题不是你的、或者已经不在了 —— **失败**，不是「记上了」。
 * `correctStreak` / `resolved` 由服务端算，前端**不自己推**。
 */
export type MistakePracticeResult =
  | { ok: true; correctStreak: number; resolved: boolean }
  | { ok: false };

// ─────────────────────────────────────────────────────────────
// 生词本与自由练习（阶段 12A）
//
// 类型按**服务端实际返回的字段**写：
//   · `student-word.service.ts` 的 `listWords()` / `removeWord()`
//   · `vocab-review.service.ts` 的 `due()` / `stats()`
//   · `vocab-quiz.service.ts` 的 `buildQuiz()`（自由练习那一路）
// ─────────────────────────────────────────────────────────────

/** 自由练习的四档评分。课程线只发两档（见 `CourseRating`）。 */
export type PracticeRating = 'again' | 'hard' | 'good' | 'easy';

export interface VocabWordRow {
  headword: string;
  /** 文章里出现的形式（可能是变位形式）。 */
  surfaceForm: string | null;
  sourceType: string;
  sourcePassageTitle: string | null;
  contextSentence: string | null;
  state: string;
  reps: number;
  lapses: number;
  due: string;
  createdAt: string;
  phonetic: string | null;
  /** 词典没释义时是空串 —— 服务端就这么给，前端**不编**。 */
  translation: string;
  tag: string[];
}

/**
 * 生词本。
 *
 * 响应里还有 `student: { id, name }`。**刻意不声明** —— 与
 * `LessonCardsResult` 同理：声明了就会有人拿它当身份。
 */
export interface VocabWordsResult {
  total: number;
  dueCount: number;
  /** **顺序就是服务端的顺序**（createdAt desc），前端不重排。 */
  words: VocabWordRow[];
}

export interface VocabWordRemoved {
  deleted: number;
}

/**
 * 词汇统计。
 *
 * **每一项都是可选的**，而且这不是偷懒：服务端换了口径、或者某一项算不
 * 出来时，前端要能「这一项不显示」，而不是拿 `?? 0` 把缺失渲染成 0。
 * 「今天复习了 0 次」和「不知道今天复习了几次」对学生是两件事。
 */
export interface VocabStats {
  total?: number;
  totalDue?: number;
  totalReviews?: number;
  reviewedToday?: number;
  knownCount?: number;
  streakDays?: number;
  progress?: { mastered: number; learning: number; untouched: number };
  byState?: Record<string, number>;
  bySource?: Record<string, number>;
}

export interface VocabDueCard {
  headword: string;
  surfaceForm: string | null;
  contextSentence: string | null;
  sourcePassageTitle: string | null;
  phonetic: string | null;
  translation: string;
  pos: string | null;
  definition: string | null;
  tag: string[];
  state: string;
  reps: number;
  needsFirstTeaching: boolean;
  firstTaughtAt: string | null;
  sourceType: string;
  addedAt: string;
}

export interface VocabDueResult {
  totalDue: number;
  /** **发卡顺序就是这个数组的顺序**，前端不得重排、不得过滤。 */
  cards: VocabDueCard[];
}

/**
 * 自测的一道题。
 *
 * 与正式测试（`QuizItem`）**形状不同、语义也不同**：这里的 `correctIndex`
 * / `answer` 是**当场就下发**的 —— 自测是自由练习，判定在本地做，不记
 * 成绩。正式测试恰恰相反（答案要等作答回执才揭开），别把两者的类型混用。
 */
export interface VocabSelfTestQuestion {
  qtype: QuizQType;
  headword: string;
  prompt: string;
  /** 拼写题恒为空数组。 */
  options: string[];
  /** 拼写题是 -1。 */
  correctIndex: number;
  phonetic: string | null;
  translation: string;
  contextSentence: string | null;
  /** 只有拼写题有。 */
  answer?: string;
}

export interface VocabSelfTestQuiz {
  streakDays: number;
  /** 生词本里一共多少词。 */
  totalWords: number;
  /** 其中「教过的」有多少 —— 为 0 说明该先去学，而不是先来考。 */
  seenWords: number;
  questions: VocabSelfTestQuestion[];
}

// ─────────────────────────────────────────────────────────────
// 历史成绩（阶段 11）
//
// 类型按**服务端实际返回的字段**写：
//   · `morning-quiz.controller.ts` 的 `historyByName()` 返回体
//   · `vocab-quiz-attempt.service.ts` 的 `history()` 返回体
// ─────────────────────────────────────────────────────────────

/**
 * 阅读历史里的一行。
 *
 * 三面旗子决定这一行怎么显示，**全部由服务端给**：
 *   · `scoresPending` —— 还没判分：`totalScore` / `autoScore` 是 null；
 *   · `answersPending` —— 还没最终交卷；
 *   · `reopenable` —— 第二作答窗还开着，现在回去还能改。
 *
 * `status` 里可能出现 `practice`（旧端要看练习回放）。**新端一律不显示
 * 它们** —— 那是另一条产品线，混进成绩列表会让学生把练习当成绩。
 */
export interface ReadingHistoryRow {
  submissionId: string;
  answersPending: boolean;
  reopenable: boolean;
  sessionId: string | null;
  /** `MorningQuizSession.date`，`@db.Date` → UTC 零点的 ISO 串。 */
  date: string | null;
  level: string | null;
  paperName: string;
  className: string;
  autoScore: number | null;
  totalScore: number | null;
  maxScore: number | null;
  submittedAt: string | null;
  status: string;
  scoresPending: boolean;
}

/**
 * 响应里还有一个 `student: { name, matchedCount, classes }`。
 *
 * **这里刻意不声明它** —— 与 `LessonCardsResult` 同理：声明了就会有人拿它
 * 当身份。要显示「我是谁」，问 `/student-auth/me`。
 *
 * 同名消歧那一支（`needDisambiguation`）只可能出现在**无令牌**的旧端调用
 * 上；新端永远带令牌，服务端走的是精确 id 路径，不会返回它。
 */
export interface ReadingHistory {
  submissions: ReadingHistoryRow[];
}

/** 正式单词测试的一次成绩。服务端只下发已交卷（`status: 'submitted'`）的。 */
export interface VocabAttemptRow {
  id: string;
  /** 已经是 `YYYY-MM-DD`（服务端切好的）。 */
  date: string;
  submittedAt: string | null;
  total: number;
  correct: number;
  /** 交卷时算一次就冻住的分数。**前端不重算。** */
  score: number;
}

export interface VocabAttemptHistory {
  attempts: VocabAttemptRow[];
}

// ─────────────────────────────────────────────────────────────
// 正式单词测试（阶段 9B1）
//
// 类型按**服务端实际返回的字段**写（`vocab-quiz-attempt.service.ts` 的
// `view()`，S9B0 之后的形状）。
//
// 关键是那几个可空字段**不是「可能没有」，而是「还没轮到你看」**：
// 未作答的题只下发 `index` / `qtype` / `prompt` / `options`，
// `headword` / `phonetic` / `translation` / `contextSentence` /
// `correctIndex` / `answer` 一律是 null，作答成功的回执里才揭开**这一题**。
// 前端不得推断、不得重建 —— 这是 S9B0 的整个用意。
// ─────────────────────────────────────────────────────────────

export type QuizQType = 'word_to_meaning' | 'meaning_to_word' | 'cloze' | 'spelling';

export interface QuizItem {
  index: number;
  qtype: QuizQType;
  /** 看词选义时是单词，看义选词时是释义，cloze / spelling 时是挖空句。 */
  prompt: string;
  /** 拼写题恒为空数组 —— 那道题渲染输入框，不渲染选项。 */
  options: string[];

  /**
   * S12L —— 作答**之前**就下发的安全线索（只有拼写 / 填空题有）。
   *
   * 它不属于下面那一组「作答前一律 null」：那些字段本身就是答案，
   * 这一个恰恰相反 —— 没有它，一道拼写题就只是一句挖了空的英文，
   * 学生根本不知道要拼哪个词。服务端保证它不含答案（见 `cueFor`）。
   */
  cue: {
    pos: string | null;
    translation: string | null;
    definition: string | null;
    instruction: string;
  } | null;

  /** ↓ 作答（或交卷）之前一律是 null。 */
  headword: string | null;
  phonetic: string | null;
  translation: string | null;
  contextSentence: string | null;
  correctIndex: number | null;
  answer: string | null;

  /** ↓ 这一题存下来的作答状态。 */
  studentIndex: number | null;
  studentAnswer: string | null;
  isCorrect: boolean | null;
  answeredAt: string | null;
}

export interface QuizAttempt {
  attemptId: string;
  status: 'in_progress' | 'submitted';
  startedAt: string;
  submittedAt: string | null;
  total: number;
  correct: number;
  /** 只有交卷之后才有分数。 */
  score: number | null;
  items: QuizItem[];
}

export interface QuizAttemptStart extends QuizAttempt {
  /** true = 这次任务本来就有一份，原样接着做（或看成绩）。 */
  resumed: boolean;
}

export type QuizAnswerResult = QuizAttempt &
  (
    | { accepted: true; isCorrect: boolean; reason?: undefined }
    | { accepted: false; reason: 'already_answered' | 'already_submitted'; isCorrect?: undefined }
  );

export interface QuizSubmitResult extends QuizAttempt {
  alreadySubmitted: boolean;
}

// ─────────────────────────────────────────────────────────────
// 课程学词（阶段 9A）
//
// 类型按**服务端实际返回的字段**写：
//   · `vocab-review.service.ts` 的 `lessonCards` / `review` / `undo`
//   · `lesson.service.ts` 的 `markTaughtAndAdvance` / `saveVocabCursor`
// ─────────────────────────────────────────────────────────────

/**
 * 课程评分**只有两档**。
 *
 * 后端的 schema 收四档（`again|hard|good|easy`，自由练习线在用），课程线
 * 刻意只发两档 —— 四档降两档是 RC1.1 的既有产品决定，手机上四个按钮挨在
 * 一起时误触是常态。类型在这里就收窄，别指望 UI 自觉。
 */
export type CourseRating = 'again' | 'good';

export interface LessonCard {
  headword: string;
  /** 文章里的原形（可能是变位形式）；遮词时两个都要遮。 */
  surfaceForm: string | null;
  contextSentence: string | null;
  sourcePassageTitle: string | null;
  phonetic: string | null;
  translation: string;
  pos: string | null;
  definition: string | null;
  tag: string[];
  state: string;
  reps: number;
  /** 服务端说的：这个词还没教过，该走教学卡而不是复习卡。 */
  needsFirstTeaching: boolean;
  firstTaughtAt: string | null;
  sourceType: string;
  addedAt: string;
}

/**
 * 有课时返回队列，没课时返回 `{ lessonContext: false, cards: [], … }`。
 *
 * 响应里其实还有一个 `student: { id, name }`。**这里刻意不声明它** ——
 * 声明了就会有人去读，读了就会有人拿它当身份。身份只有令牌一个来源，
 * 页面上要显示谁，问 `/student-auth/me`。
 */
export interface LessonCardsResult {
  lessonContext: boolean;
  /** 服务端的断点。前端**不自己猜**「第几张」。 */
  cursor: number;
  totalDue: number;
  /** **发卡顺序就是这个数组的顺序**，前端不得重排、不得过滤。 */
  cards: LessonCard[];
}

export interface VocabTaughtResult {
  ok: true;
  headword: string;
  /** 服务端确认的断点 —— 可能比我们请求的更靠前（别的标签页推过了）。 */
  cursor: number;
  /** false = 当日任务行不存在，断点**没有落库**。 */
  stored: boolean;
  alreadyTaught: boolean;
  stage: string;
}

export interface VocabReviewResult {
  headword: string;
  state: string;
  due: string;
  intervalDays: number;
  reps: number;
  /** 同一个 requestId 已经记过 —— 这次是弱网重发，不是第二次复习。 */
  duplicate?: true;
  /** 停留太短，服务端**没有写调度**：这张卡下次还会回来。 */
  tooFast?: true;
}

export interface VocabUndoResult {
  headword: string;
  undone: true;
  reps: number;
  state: string;
}

export interface VocabCursorResult {
  ok: true;
  cursor: number;
  stored: boolean;
}

// ─────────────────────────────────────────────────────────────
// 阅读会话（阶段 7B）
//
// 三个端点的路径、方法、请求体形状**取自 S7A 冻结设计**的 §4.1–§4.3，
// 而设计里的每一条都对着 `apps/api/.../morning-quiz.controller.ts` 核过：
//
//   :517  @Get('sessions/:id')            ← 加载 = 权威会话读取，**没有子路径**
//   :525  @Patch('sessions/:id/answer')   ← 逐题保存
//   :554  @Post('sessions/:id/submit')    ← 最终交卷
//
// 三个都是**认证后**端点：URL 与请求体里一个身份字段都没有。
// ─────────────────────────────────────────────────────────────

/** 一道题在学生端的可编辑答案形状。两者可**同时**存在（双写题型）。 */
export interface ReadingAnswer {
  selectedOption?: string;
  textAnswer?: string;
}

/** 服务端已存的那一份。`content` 是给老客户端的兼容字段，新端不读。 */
export interface ReadingExistingAnswer {
  content?: unknown;
  selectedOption: string | null;
  textAnswer: string | null;
  clientSeq: number | null;
  flagged: boolean;
}

/** 一道题的题面快照。渲染是阶段 7C 的事，这里只如实描述形状。 */
export interface ReadingQuestion {
  id: string;
  sortOrder: number;
  marks: number;
  questionType: string;
  snapshotContent: unknown;
  snapshotOptions: Array<{ key: string; text: string }> | null;
}

/**
 * **线上真实返回的形状**。
 *
 * 题目数组在服务端叫 `paperQuestions`（`morning-quiz.service.ts:2020`），
 * 不叫 `questions`。这个接口如实描述它；对外的公共形状见下面的
 * `ReadingSessionPayload`，两者之间的归一化在 `getReadingSession` 里做。
 */
export interface ReadingSessionWire {
  sessionId: string;
  submissionId: string | null;
  quizEnd: string | null;
  regularQuizEnd: string | null;
  secondWindowToday: boolean;
  /** 渲染要用：分级、卷型、考试口味、以及出卷时写死的渲染器 key。 */
  level: string | null;
  paperMode: 'passage_pick' | 'standard' | null;
  mode: 'practice' | 'test';
  rendererKey?: string | null;
  paperQuestions: ReadingQuestion[];
  existingAnswers: Record<string, ReadingExistingAnswer>;
}

/** 新端对外的公共形状 —— 题目字段叫 `questions`（S7A 冻结）。 */
export interface ReadingSessionPayload {
  sessionId: string;
  submissionId: string | null;
  /** 学生端倒计时**必须**用它，不是 `regularQuizEnd`。 */
  quizEnd: string | null;
  regularQuizEnd: string | null;
  secondWindowToday: boolean;
  level: string | null;
  paperMode: 'passage_pick' | 'standard' | null;
  /** 阅读页永远是 `test`。服务端也按白名单删了答案键，两道闸都要在。 */
  mode: 'practice' | 'test';
  rendererKey?: string | null;
  questions: ReadingQuestion[];
  existingAnswers: Record<string, ReadingExistingAnswer>;
}

export interface ReadingSaveBody {
  paperQuestionId: string;
  selectedOption: string | null;
  textAnswer: string | null;
  clientSeq: number;
}

/**
 * 保存结果。
 *
 * `superseded: true` 表示库里已有更新的写 —— **它不带答案内容**，
 * 所以客户端无法据此认定本地那份是对的（S7A §5.4）。
 */
export interface ReadingSaveResult {
  applied: boolean;
  superseded?: boolean;
  clientSeq: number | null;
  updatedAt?: string | null;
}

/**
 * 交卷结果 —— 就是那一行答卷，**没有 `nextAction`、没有 `href`**。
 * 「交完去哪」必须由随后的 `/lesson/today` 决定，不能从这里推。
 */
export interface ReadingSubmitResult {
  id: string;
  status: string;
  [k: string]: unknown;
}


// ─────────────────────────────────────────────────────────────
// 阅读结果（阶段 8A）
//
// 类型按**服务端实际返回的字段**写（`morning-quiz.service.ts` 的
// `getStudentResult` + `stripUnreleasedScores`）。两道门是**服务端**的：
//
//   · `scoresPending` —— 还没判分：`totalScore` / `awardedMarks` /
//     `isCorrect` / `markerComment` 全是 null；
//   · `answersPending` —— 还没最终提交：`correctAnswer` /
//     `referenceAnswer` / `explanation` 全是 null。
//
// 前端只按这两面旗子决定**显示什么**，绝不自己补一个 0 分或猜答案。
// ─────────────────────────────────────────────────────────────

export interface ReadingResultItem {
  paperQuestionId: string;
  sortOrder: number;
  marks: number;
  questionType: string;
  snapshotContent: unknown;
  snapshotOptions: Array<{ key: string; text: string }> | null;
  /** 学生当时写下的答案；没答过就是 null。 */
  studentAnswer: string | null;
  /** 答案门未开时为 null。 */
  correctAnswer: string | null;
  /** 非选择题的参考答案 / 评分要点；答案门未开时为 null。 */
  referenceAnswer: string | null;
  /** 答案门未开时为 null。 */
  explanation: string | null;
  /** 分数门未开时为 null。 */
  awardedMarks: number | null;
  autoCorrect: boolean | null;
  isCorrect: boolean | null;
  markerComment: string | null;
  commentSource: 'ai' | 'teacher' | null;

  // ── S12H 的**服务端权威**字段 ──
  //
  // 之前这一屏拿整卷的 `scoresPending` 去算每一题的状态，于是一道
  // 已经确定性判完的选择题也被说成「还在判分」。现在逐题状态由服务端给。
  /**
   * 这一题此刻的判分状态。旧服务端不发时为 `undefined`，
   * 届时回退到旧的推断（见 `ResultView.questionOutcome`）。
   */
  gradingStatus?: 'auto_graded' | 'marked' | 'pending_marking' | 'not_answered';
  /**
   * 答案展示 —— **语义，不是文案**。措辞（「正确答案」/「参考答案」）
   * 归客户端；服务端只说这是哪一种、值是什么，且两个值归一化后
   * 相等时**只发一个**。
   */
  answerDisplay?: AnswerDisplay | null;
}

/** S12H 的语义答案展示。 */
export interface AnswerDisplay {
  primaryKind: 'correct' | 'reference';
  primaryValue: string;
  /** 只有与 `primaryValue` 确实不同时才有。 */
  rubricValue?: string;
}

/** S12H 的逐题判分计数 —— 四项之和恒等于 `total`。 */
export interface GradingSummary {
  autoGraded: number;
  marked: number;
  pendingMarking: number;
  notAnswered: number;
  total: number;
}

export interface ReadingResult {
  sessionId: string;
  paperName: string;
  submissionId: string;
  status: string;
  finalSubmittedAt: string | null;
  autoScore: number | null;
  manualScore: number | null;
  totalScore: number | null;
  maxScore: number | null;
  submittedAt: string | null;
  items: ReadingResultItem[];
  /** 服务端说的：分数还没放出来。 */
  scoresPending: boolean;
  /** 服务端说的：答案还没放出来。 */
  answersPending: boolean;
  /**
   * S12H —— 几题已经自动判完、几题等老师。
   * 最终提交之前为 `null`；旧服务端不发时为 `undefined`。
   */
  gradingSummary?: GradingSummary | null;
}

export interface AppealCreated {
  appealId: string;
  status: string;
}
