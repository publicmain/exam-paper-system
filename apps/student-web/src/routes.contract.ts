/**
 * 路由契约 —— **唯一事实源**。
 *
 * 路由表由它生成，测试也断言「注册的路由集合 === 这里声明的集合」。
 * 加路由却不改这里 → 测试变红。这是守卫 G6。
 *
 * ## 为什么没有 `/app` 前缀
 *
 * 拓扑定案是 **A：学生端独立源**（D7）—— 新端独占一个源的根路径。
 * 设计文档里为了跟旧矩阵对照方便写成 `/app/…`，**实现时整体去掉**。
 *
 * ## 为什么忽略后端的 `href`
 *
 * 服务端只负责 `NextActionKind` + 资源 id；**路由映射归新端**。
 * 后端现有的 `href` 字段是给旧端用的，新端**完全忽略**，等旧端退役
 * （阶段 16e）后才删。见 architecture §4.3。
 */

/**
 * 真正注册、真正渲染的路由。
 *
 * 阶段 6A 起，五条课程路由**从「计划中」变成「已注册」** —— 它们渲染的是
 * 统一的占位页（阶段 7–10 逐个替换成真功能）。这样 `nextAction` 才能真的
 * 把学生送过去，而不是停在 `/today` 说「还没实现」。
 */
export const ROUTES = {
  login: '/login',
  register: '/register',
  account: '/account',
  today: '/today',
  reading: '/lesson/reading',
  readingResult: '/lesson/reading/result',
  lessonVocab: '/lesson/vocab',
  lessonTest: '/lesson/test',
  summary: '/lesson/summary',
  /**
   * 历史成绩（阶段 11）。**同一外壳里的独立页面**，不是七步链的一环 ——
   * 学生随时能进，进了也不改变今天的课走到哪一步。
   *
   * 设计文档里写作 `/app/scores`；与其他路由同理，独立源实现**去掉
   * `/app` 前缀**（见文件头）。
   */
  scores: '/scores',
  /**
   * 单次阅读答卷的逐题回顾。
   *
   * **`:submissionId` 是唯一的选择器** —— 不带姓名、不带 studentId，
   * 归属由服务端按令牌判定。放进路径而不是查询串，是为了让它只可能是
   * 「一份答卷的标识」，而不是一个可以塞任何东西的参数袋。
   */
  scoreDetail: '/scores/:submissionId',
} as const;

/** `/scores/:submissionId` 的具体地址。**只有这一个地方拼它。** */
export function scoreDetailPath(submissionId: string): string {
  return `/scores/${encodeURIComponent(submissionId)}`;
}

export type RouteKey = keyof typeof ROUTES;

/** 注册表 —— 测试拿它和 `<Route>` 的实际注册集合逐项比对。 */
export const REGISTERED_PATHS: readonly string[] = Object.values(ROUTES);

/**
 * 五条课程路由 —— 阶段 6A **已注册**，渲染统一占位页。
 *
 * 保留这个具名分组是为了让占位页知道自己代表哪一段，以及让守卫能断言
 * 「这五条都在 ROUTES 里」。阶段 7–10 各自实现时只替换页面组件，
 * 路径不动。
 */
export const LESSON_ROUTES = {
  reading: ROUTES.reading,
  readingResult: ROUTES.readingResult,
  lessonVocab: ROUTES.lessonVocab,
  lessonTest: ROUTES.lessonTest,
  summary: ROUTES.summary,
} as const;

export type LessonStageKey = keyof typeof LESSON_ROUTES;

/** 占位页的标题 —— 明确说出这是哪一段、还没实现。 */
export const LESSON_STAGE_LABEL: Readonly<Record<LessonStageKey, string>> = {
  reading: '阅读',
  readingResult: '阅读结果',
  lessonVocab: '学习本次单词',
  lessonTest: '正式单词测试',
  summary: '今日总结',
};

/**
 * 服务端 `NextActionKind` 的**全部十个**取值。
 *
 * 与 `apps/api/src/lesson/next-action.ts` 的类型联合逐字对齐 ——
 * 那里是 10 个（含 `none`），不是 9 个。少一个，下面的映射表就会漏。
 */
export const NEXT_ACTION_KINDS = [
  'ready_to_start',
  'resume_reading',
  'read_result',
  'learn_vocab',
  'vocab_test',
  'summary',
  'no_content',
  'window_closed',
  'level_not_set',
  'none',
] as const;

export type NextActionKind = (typeof NEXT_ACTION_KINDS)[number];

/**
 * `kind` 的目标形态。
 *
 * - `navigate` —— 跳到某个路由
 * - `stay` —— **留在 `/today`**，用一句话说明为什么没有下一步
 *
 * 「停留」必须是一等公民：`no_content` / `window_closed` / `level_not_set`
 * 都不是错误，是「今天就这样」。RC1.1-F 的教训就是把「没有任务」当成
 * 「全部完成」，不能再犯。
 */
export type NextActionTarget =
  /** 跳到某条已注册的课程路由 */
  | { kind: 'navigate'; path: string }
  /** 留在 `/today`，但有**一个**主行动（目前只有「开始今天的课程」） */
  | { kind: 'start'; reason: string }
  /** 留在 `/today`，**没有**可点的主行动 */
  | { kind: 'stay'; reason: string };

/**
 * **十个取值全部有目标** —— 守卫 G9 断言这张表是穷尽的。
 *
 * 阶段 6A 起五条课程路由都已注册，所以 `navigate` 是真跳转，落到占位页。
 * 目标路径**只能**从这里取；后端的 `nextAction.href` 永远不参与导航。
 */
export const NEXT_ACTION_ROUTE: Readonly<Record<NextActionKind, NextActionTarget>> = {
  ready_to_start: { kind: 'start', reason: '今天的课还没开始' },
  resume_reading: { kind: 'navigate', path: ROUTES.reading },
  read_result: { kind: 'navigate', path: ROUTES.readingResult },
  learn_vocab: { kind: 'navigate', path: ROUTES.lessonVocab },
  vocab_test: { kind: 'navigate', path: ROUTES.lessonTest },
  summary: { kind: 'navigate', path: ROUTES.summary },
  no_content: { kind: 'stay', reason: '今天的课程还没有发布' },
  window_closed: { kind: 'stay', reason: '今天的作答时间已经结束了' },
  level_not_set: { kind: 'stay', reason: '还没有分配难度 —— 找老师设置一下' },
  none: { kind: 'stay', reason: '今天没有要做的事' },
};

/** 未知 URL 的落点：已登录 → `/today`；未登录 → `/login`。**不是姓名页。** */
export function fallbackPath(authenticated: boolean): string {
  return authenticated ? ROUTES.today : ROUTES.login;
}
