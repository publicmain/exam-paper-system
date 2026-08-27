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

/** 阶段 4A 真正注册、真正渲染的路由。 */
export const ROUTES = {
  login: '/login',
  register: '/register',
  account: '/account',
  today: '/today',
} as const;

export type RouteKey = keyof typeof ROUTES;

/** 注册表 —— 测试拿它和 `<Route>` 的实际注册集合逐项比对。 */
export const REGISTERED_PATHS: readonly string[] = Object.values(ROUTES);

/**
 * 课程页的路由**常量占位**。
 *
 * 阶段 4A **只声明、不注册、不渲染任何课程功能**。它们存在的意义是让
 * 下面那张 `kind → 目标` 映射表现在就能写全 —— 否则映射表要么缺项，
 * 要么用魔法字符串。
 *
 * 阶段 6–10 逐个实现时，把它们搬进 `ROUTES` 并注册。
 */
export const PLANNED_LESSON_ROUTES = {
  reading: '/lesson/reading',
  readingResult: '/lesson/reading/result',
  lessonVocab: '/lesson/vocab',
  lessonTest: '/lesson/test',
  summary: '/lesson/summary',
} as const;

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
  | { kind: 'navigate'; path: string; planned: boolean }
  | { kind: 'stay'; reason: string };

/**
 * **十个取值全部有目标** —— 守卫 G9 断言这张表是穷尽的。
 *
 * `planned: true` 表示目标路由在阶段 4A 还没实现（属于
 * `PLANNED_LESSON_ROUTES`）。新端在 4A 遇到这些 kind 时**停在 `/today`
 * 并说明**，绝不跳到一个不存在的路由。
 */
export const NEXT_ACTION_ROUTE: Readonly<Record<NextActionKind, NextActionTarget>> = {
  ready_to_start: { kind: 'stay', reason: '今天的课还没开始' },
  resume_reading: { kind: 'navigate', path: PLANNED_LESSON_ROUTES.reading, planned: true },
  read_result: { kind: 'navigate', path: PLANNED_LESSON_ROUTES.readingResult, planned: true },
  learn_vocab: { kind: 'navigate', path: PLANNED_LESSON_ROUTES.lessonVocab, planned: true },
  vocab_test: { kind: 'navigate', path: PLANNED_LESSON_ROUTES.lessonTest, planned: true },
  summary: { kind: 'navigate', path: PLANNED_LESSON_ROUTES.summary, planned: true },
  no_content: { kind: 'stay', reason: '今天的课程还没有发布' },
  window_closed: { kind: 'stay', reason: '今天的作答时间已经结束了' },
  level_not_set: { kind: 'stay', reason: '还没有分配难度 —— 找老师设置一下' },
  none: { kind: 'stay', reason: '今天没有要做的事' },
};

/** 未知 URL 的落点：已登录 → `/today`；未登录 → `/login`。**不是姓名页。** */
export function fallbackPath(authenticated: boolean): string {
  return authenticated ? ROUTES.today : ROUTES.login;
}
