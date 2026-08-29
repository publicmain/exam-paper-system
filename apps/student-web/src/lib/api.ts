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
};

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
}

export interface AppealCreated {
  appealId: string;
  status: string;
}
