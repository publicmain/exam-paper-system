import { ForbiddenException } from '@nestjs/common';

/**
 * 已认证学生的**精确 ID 解析** —— 阶段 5A。
 *
 * ## 它解决什么
 *
 * 旧的身份解析是「姓名 → 唯一学生」：查名字、同名要消歧、查不到还给
 * 近似姓名建议。那套逻辑是为「学生不登录、输姓名查成绩」设计的。
 *
 * 带了**服务端验证过的学生令牌**之后，这些统统不该发生 —— 令牌里就是
 * 一个确定的 id。所以这条路径：
 *
 *   · **不查姓名**
 *   · **不做同名消歧**（`multiple_students_with_same_name` 不可能发生）
 *   · **不给近似姓名建议**（那会把花名册漏给调用方）
 *
 * ## 但它不放宽资格
 *
 * 令牌证明「你是谁」，不证明「你还在读」。学生被停用、班级被归档之后，
 * 手里的令牌可能还没过期（扫码签发的当天令牌不查库）。所以这里仍然要
 * 校验资格 —— 只是用 id 查，不用姓名查。
 *
 * 资格条件取两个旧解析器里**更严的那一套**（morning-quiz 的）：
 *
 * | 条件 | vocab 的 resolveStudent | morning-quiz 的 resolveStudentByName | 这里 |
 * |---|---|---|---|
 * | `role: 'student'` | 未查 | ✓ | ✓ |
 * | `isActive: true` | ✓ | ✓ | ✓ |
 * | `archivedAt: null` | 未查 | ✓ | ✓ |
 * | 在读于未归档班级 | ✓ | ✓ | ✓ |
 *
 * 取严不取宽 —— 「不得绕过旧解析器已经在把的关」，取更严只会更安全。
 *
 * ## 为什么不把令牌里的姓名塞回姓名解析器
 *
 * 那样等于用一个可疑的等价物假装成精确查询：同名时它会走进消歧分支，
 * 姓名里有空白差异时会查不到，而且照样会触发近似姓名建议。
 * 令牌里有 id，就该用 id。
 */

/** 只用到这两个方法，方便测试时传假对象。 */
export interface StudentLookupPrisma {
  user: {
    findFirst(args: unknown): Promise<{ id: string; name: string } | null>;
  };
}

/**
 * 资格谓词 —— **唯一定义处**。
 *
 * 导出它而不是让每个调用方各写一份 where，是因为「令牌解析」一旦在两处
 * 各写一遍，就会慢慢长出差异：一处查了 archivedAt、另一处忘了，然后
 * 同一个学生在两个接口上是两种资格。调用方只在 select 上按自己的需要
 * 取字段。
 */
export function authenticatedStudentWhere(authStudentId: string) {
  return {
    id: authStudentId,
    role: 'student' as const,
    isActive: true,
    archivedAt: null,
    classEnrollments: { some: { role: 'student', class: { archivedAt: null } } },
  };
}

/** 资格不符时统一抛这个 —— 只在已认证路径上可能出现。 */
export function studentNotEligible(): ForbiddenException {
  return new ForbiddenException({ code: 'student_not_eligible' });
}

/**
 * 已认证学生仍然「在读」时返回 `{ id, name }`，否则抛。
 *
 * **新错误码 `student_not_eligible`**：只可能出现在**已认证**路径上 ——
 * 令牌有效、但该学生已停用 / 已归档 / 不在任何未归档班级里。
 * 旧的无令牌路径永远走不到这里，因此不影响任何既有客户端的错误契约。
 */
export async function resolveAuthenticatedStudent(
  prisma: StudentLookupPrisma,
  authStudentId: string,
): Promise<{ id: string; name: string }> {
  const row = await prisma.user.findFirst({
    where: authenticatedStudentWhere(authStudentId),
    select: { id: true, name: true },
  });
  if (!row) throw studentNotEligible();
  return row;
}
