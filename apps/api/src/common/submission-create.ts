import { Prisma } from '@prisma/client';

/**
 * 创建「真实」答卷（非 practice）的唯一入口（P1 答卷唯一性防线，
 * docs/refactor-plan.md）。
 *
 * ## 为什么存在
 *
 * R14 拆掉 @@unique 后，三处「findFirst 没有 → create」各自裸奔：
 * 双设备同时扫码（手机 + 平板 handoff 是真实日常）会双双 findFirst
 * 落空、双双 create —— 同学生同卷两条真实答卷，而判分队列 / 完成度 /
 * 历史页全部假定单条。
 *
 * 迁移 20260826210000 加了 partial unique
 * （`WHERE status <> 'practice'`）做数据库防线；本函数是配套的
 * **撞墙自愈**：并发输家撞唯一索引（P2002）时不报错，改为把赢家那条
 * 查出来返回 —— 对两路请求来说都成功，学生无感。
 *
 * 三个调用点：attendance.service.scanQr、attendance.service 教师补登、
 * student.service.openStudentSubmission。新增创建真实答卷的路径必须
 * 走这里，不要再写裸 create。
 */

type PrismaLike = {
  studentSubmission: {
    findFirst: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
  };
};

export function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
  );
}

export async function createRealSubmissionSafe<T>(
  prisma: PrismaLike,
  data: { assignmentId: string; studentId: string; maxScore: number },
): Promise<T> {
  try {
    return (await prisma.studentSubmission.create({ data })) as T;
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // 并发输家：赢家已经建好了 —— 查出来用它
    const winner = (await prisma.studentSubmission.findFirst({
      where: {
        assignmentId: data.assignmentId,
        studentId: data.studentId,
        status: { not: 'practice' },
      },
    })) as T | null;
    if (!winner) throw e; // 索引说有、查却没有：真异常，原样抛
    return winner;
  }
}
