import { applyDecorators, SetMetadata } from '@nestjs/common';

/**
 * 学生端路由的两种权限声明（2026-09-11 审计 S08/S03）。
 *
 * ## 修之前
 *
 * 只有一个 `@RequireStudentToken()`，它同时表达了两件事：
 *
 *   ① 必须带有效令牌（「你是谁」）
 *   ② 必须是学生**本人**（教师的只读视角 `teacher_view` 一律 403）
 *
 * 于是 profile / center / tests 这类纯读取的 GET 也把教师挡在外面 ——
 * 「教师以学生视角查看」这个功能在一半的页面上是坏的。反过来，旧的全局
 * `AuthGuard` 根本不认识 `teacher_view`：教师拿只读令牌打旧的开卷 / 保存 /
 * 交卷接口，一路畅通，库里记成「学生自己做的」。
 *
 * ## 修之后：读身份与本人写入分开声明
 *
 *   · `@RequireStudentToken()`     —— **本人写**。语义不变：必须是学生本人的
 *                                     完整令牌，教师只读视角 403。
 *   · `@RequireStudentReadToken()` —— **读身份**。必须带有效令牌（学生本人或
 *                                     教师只读视角都行），**接口本身零写库**。
 *   · `@AllowTeacherView()`        —— 给走全局 AuthGuard 的旧读接口用：
 *                                     这条 GET 已核实零写库，教师只读视角可以读。
 *
 * 教师只读视角能到达的路由（两道守卫的真实判据）：
 *
 *   · 全局 AuthGuard 那一路（非 `@Public()` 的旧接口）：**只有**显式标了
 *     `@AllowTeacherView()` 的 GET；
 *   · StudentIdentityGuard 那一路（`@Public()` 的新接口）：标了
 *     `@RequireStudentReadToken()` 的 GET，以及**未标注**的可选身份 GET
 *     （旧 vocab 的生词本 / 查词 / 统计那一类 —— 2026-08-25 起就是这样，
 *     本次逐条核实过零写库）。
 *
 * 无论标没标，非 GET/HEAD 的请求一律拒绝（守卫里再兜一层，防止谁把「读」
 * 误标到 POST 上）。精确的可达清单由 `student-access.spec.ts` 从控制器
 * 元数据推导并钉死 —— 多一条少一条都红。
 *
 * ⚠️ 给一个 GET 标「读」之前，先确认服务层这一路**一行都不写**（包括
 * upsert 兜底建档、getOrCreate 之类的隐式写）。会隐式写库的 GET 保持
 * `@RequireStudentToken()`，等服务层拆成真正的只读查询后再放开 ——
 * 清单见 `docs/audit-2026-09-11/ledger-sec.md` 的「留给其他组的端点」。
 */

/**
 * 元数据值：`true` = 本人写（历史语义，所有既有路由都是这个）；
 * `'read'` = 读身份（教师只读视角可读）。同一个键带模式，而不是再加一个
 * 键 —— 既有测试和扫描器按 `=== true` 认「本人写」，一个字都不用改。
 */
export const REQUIRE_STUDENT_TOKEN = 'require_student_token';
export type StudentTokenMode = true | 'read';
/** 给走全局 AuthGuard 的旧读接口用的放行标记。 */
export const ALLOW_TEACHER_VIEW = 'allow_teacher_view';

/** 教师「以学生视角查看」的 scope。与 student-auth.service 保持一致。 */
export const TEACHER_VIEW_SCOPE = 'teacher_view';

/** 本人写：必须携带学生**本人**的有效令牌；教师只读视角一律 403。 */
export const RequireStudentToken = () => SetMetadata(REQUIRE_STUDENT_TOKEN, true);

/** 这条 GET 已核实零写库 —— 教师只读视角可以读。 */
export const AllowTeacherView = () => SetMetadata(ALLOW_TEACHER_VIEW, true);

/** 读身份：必须带有效令牌（学生本人或教师只读视角），接口本身零写库。 */
export const RequireStudentReadToken = () =>
  applyDecorators(SetMetadata(REQUIRE_STUDENT_TOKEN, 'read'), AllowTeacherView());

const READ_ONLY_METHODS = new Set(['GET', 'HEAD']);

/**
 * 是不是只读的 HTTP 方法。
 *
 * `undefined` 视作只读：只会出现在直接调守卫的单元测试里（真实 Express
 * 请求一定有 method）。这样既有的守卫单测不必为了一个它们不关心的字段改写。
 */
export function isReadOnlyMethod(method: string | undefined): boolean {
  return method == null || READ_ONLY_METHODS.has(method.toUpperCase());
}
