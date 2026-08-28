import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestWithStudentAuth } from './student-identity.guard';

/**
 * 把「这次请求代表哪个学生」收成一个入参对象 —— **令牌优先**（阶段 5A）。
 *
 * ## 为什么只有一处
 *
 * 令牌解析一旦在每个 controller 里各写一遍，就会慢慢长出差异：一处忘了
 * 处理空姓名、一处把 `''` 当成有值。所有 controller 用同一个函数，
 * 差异就无从产生。
 *
 * ## 与守卫的分工
 *
 * `StudentIdentityGuard` 已经做完两件事：验令牌（含撤销校验），以及
 * **确认令牌与请求里声明的身份不冲突**（冲突直接 403 `identity_mismatch`）。
 * 所以这里**不再比一次** —— 到这一步，令牌与 `name`/`studentId` 要么
 * 一致，要么请求里根本没带。
 *
 * ## 向后兼容
 *
 * 没有令牌时原样退回姓名路径：旧客户端、以及无令牌的公开读，行为一字
 * 不改。两者都没有才报 `name_required` —— 与改造前的错误契约一致。
 */
export function identityOf(
  req: Request,
  name?: string,
  studentId?: string,
): { studentName: string; studentId?: string; authStudentId?: string } {
  const auth = (req as RequestWithStudentAuth).studentAuth;
  if (!auth && !(name ?? '').trim()) {
    throw new BadRequestException({ code: 'name_required' });
  }
  return {
    studentName: name ?? '',
    studentId: studentId || undefined,
    authStudentId: auth?.id,
  };
}
