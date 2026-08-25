import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from './prisma.service';

/**
 * 学生身份 —— 可选解析 + 越权阻断（2026-08-25 外部审查 P0-1 的修复）。
 *
 * ## 修之前
 *
 * 学生端全部接口是 `@Public()`，而 AuthGuard 对 public 路由**直接放行、
 * 根本不解析 JWT**。于是身份完全等于请求里的 `name` 字符串：
 * 知道同学姓名的人可以读他的成绩与错题，也可以**替他加词、删词、
 * 提交复习评分、撤销评分、销账错题**。文档里写的「校园网 IP 门禁」
 * 在代码里并不存在（只有按 IP 的限流，那是配额不是授权）。
 *
 * 这是 OWASP API1:2023 Broken Object Level Authorization 的标准形态。
 *
 * ## 修之后（分两级，兼顾可用性）
 *
 * 扫码时**本来就已经签发了学生 JWT**（attendance.service 的 scanToken，
 * 含 id/name/role），所以不需要新建认证体系，只需开始校验它：
 *
 *   1. **带了 token** → 必须与请求里的 name / studentId 一致，
 *      否则 403 `identity_mismatch`。这堵死「拿自己的 token 操作别人」。
 *   2. **写操作**（标了 `@RequireStudentToken()`）→ 必须带 token，
 *      否则 403 `student_token_required`。这堵死「凭一个姓名字符串
 *      改别人的数据」。
 *   3. **读操作且无 token** → 放行，降级为姓名匹配。
 *
 * ## 第 3 条是刻意保留的已知缺口
 *
 * `/my-history` 这个入口的全部设计前提就是「学生不登录、输姓名就能查」。
 * 一刀切要求 token 会让没扫过码的学生（补看历史成绩、家长陪着看）直接
 * 用不了。**因此「知道姓名即可读到成绩」这个风险仍然存在**，要彻底关闭
 * 需要引入学生登录（PIN / 学校账号），那是产品决策，不是本次修复的范围。
 *
 * 已缩小到：**任何人都无法再写别人的数据**，这是危害最大的那一半。
 */

export const REQUIRE_STUDENT_TOKEN = 'require_student_token';

/** 标记：该路由必须携带有效的学生 token（写操作一律加）。 */
export const RequireStudentToken = () => SetMetadata(REQUIRE_STUDENT_TOKEN, true);

/** 教师「以学生视角查看」的 scope。与 student-auth.service 保持一致。 */
export const TEACHER_VIEW_SCOPE = 'teacher_view';

export interface StudentAuth {
  id: string;
  name: string;
  /**
   * 这个身份是教师借来的（`scope: 'teacher_view'`），不是学生本人。
   * 读放行、**写一律拒绝** —— 见下面 canActivate 的第 ② 步。
   */
  viaTeacherView?: boolean;
  /** teacher_view 时是哪位教师（审计/日志用）。 */
  actorId?: string;
}

/** 挂了本 Guard 的 controller，req 上会多出这个字段。 */
export interface RequestWithStudentAuth extends Request {
  studentAuth?: StudentAuth;
}

/** 请求里声明的身份（query 或 body 都可能带）。 */
export function claimedIdentity(req: Request): { name?: string; studentId?: string } {
  const q = (req.query ?? {}) as Record<string, unknown>;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const pick = (...vals: unknown[]) => {
    for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim();
    return undefined;
  };
  return {
    name: pick(q.name, b.name, b.studentName),
    studentId: pick(q.studentId, b.studentId),
  };
}

/**
 * token 身份与请求声明是否冲突。纯函数，可测。
 *
 * 姓名比较去掉首尾空白（前端某些入口会带上），但**不做模糊匹配** ——
 * 同名学生靠 studentId 消歧，模糊匹配会把这道门变成筛子。
 */
export function identityConflicts(
  token: StudentAuth,
  claimed: { name?: string; studentId?: string },
): boolean {
  if (claimed.studentId && claimed.studentId !== token.id) return true;
  if (claimed.name && claimed.name.trim() !== token.name?.trim()) return true;
  return false;
}

@Injectable()
export class StudentIdentityGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestWithStudentAuth>();
    const auth = req.headers['authorization'];

    let student: StudentAuth | undefined;
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = await this.jwt.verifyAsync<{
          id?: string;
          name?: string;
          role?: string;
          scope?: string;
          av?: number;
          actorId?: string;
        }>(auth.slice('Bearer '.length));
        // 只认学生本人的 token。教师 token 不冒充学生（教师看学生数据
        // 走教师端接口，那边有 canActOnClass 的班级权限校验）；
        // handoff token 是发卷专用的窄权限凭证，不用于数据读写。
        //
        // teacher_view 是例外：它是教师端签发的**只读**学生视角令牌，
        // 走到这里当学生身份用，但下面第 ② 步会拒掉一切写操作。
        if (payload?.role === 'student' && payload.id && payload.scope !== 'mq_handoff') {
          // 长期 token 的撤销校验（2026-08-25 复审 P0-2）。
          //
          // 带 av claim 的是 PIN 登录签发的 30 天 token —— 必须逐次比对
          // 数据库里的 studentAuthVersion，并确认账号仍然启用。教师重置
          // PIN / 学生改 PIN / 账号停用都会递增该版本，旧 token 当场作废。
          // 没有这一步，「抢注者已拿到 30 天 token」的情况教师救不回来。
          //
          // 不带 av 的是扫码签发的当天 token（最长活到 23:59）——
          // 它的暴露窗口只有几小时，不查库，避免给每次扫码答题都加一次
          // 数据库往返。
          if (typeof payload.av === 'number') {
            const row = await this.prisma.user.findUnique({
              where: { id: payload.id },
              select: { studentAuthVersion: true, isActive: true, archivedAt: true },
            });
            const stillValid =
              row != null &&
              row.isActive &&
              row.archivedAt == null &&
              row.studentAuthVersion === payload.av;
            if (!stillValid) {
              throw new ForbiddenException({ code: 'token_revoked' });
            }
          }
          student = { id: payload.id, name: payload.name ?? '' };
          // 只在真是教师视角时才挂这两个字段 —— 学生本人的身份对象保持
          // 原样，下游任何 `toEqual({id, name})` 的契约都不受影响
          if (payload.scope === TEACHER_VIEW_SCOPE) {
            student.viaTeacherView = true;
            student.actorId = payload.actorId;
          }
        }
      } catch (e) {
        // token_revoked 是**明确的拒绝**，不能降级成「没带 token」——
        // 那样读操作会静默放行，被撤销的凭证等于还能用
        if (e instanceof ForbiddenException) throw e;
        // 其余（过期/签名损坏）视作没带，走下面的降级逻辑
      }
    }

    const claimed = claimedIdentity(req);

    // ① 带了 token 就必须对得上号 —— 堵死「拿自己的 token 操作别人」
    if (student && identityConflicts(student, claimed)) {
      throw new ForbiddenException({ code: 'identity_mismatch' });
    }

    // ② 写操作必须有 token
    const mustHaveToken = this.reflector.getAllAndOverride<boolean>(REQUIRE_STUDENT_TOKEN, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (mustHaveToken && !student) {
      throw new ForbiddenException({ code: 'student_token_required' });
    }
    // ②b 教师的学生视角是**只读**的。
    //
    // 让教师以学生身份写入看着方便，但会污染成绩数据的可信度：教师进去
    // 帮忙点两下，库里记的就是「学生交了卷」。判分队列和 FSRS 调度都建
    // 在这些记录上，一旦教师的动作能被记成学生的，之后看任何一条记录都
    // 要先问「这是他自己做的吗」。排障只需要看见，不需要代劳。
    if (mustHaveToken && student?.viaTeacherView) {
      throw new ForbiddenException({ code: 'teacher_view_is_read_only' });
    }

    if (student) req.studentAuth = student;
    return true;
  }
}
