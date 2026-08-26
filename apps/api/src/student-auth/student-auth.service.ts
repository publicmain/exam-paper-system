import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma.service';
import { canActOnClass } from '../common/roles';
import {
  LOCK_MINUTES,
  MAX_FAILED_ATTEMPTS,
  afterSuccess,
  isLocked,
  lockRemainingSec,
  validatePinFormat,
  validatePasswordFormat,
} from './pin';
import {
  type ClaimWindowState,
  claimWindowOpen,
  claimWindowRemainingSec,
  normalizeWindowMinutes,
  windowEndsAt,
} from './claim-window';

/**
 * 把一行 user（带 classEnrollments）折成认领窗口状态。
 *
 * 学生可能在多个班（少见但存在）—— 取**最晚**的那个班级窗，否则一个
 * 已归档班级的空窗会盖掉真正开着的那个。
 */
function claimWindowState(
  user: {
    pinClaimOpenUntil: Date | null;
    classEnrollments: { class: { pinClaimOpenUntil: Date | null } }[];
  },
  _now: Date,
): ClaimWindowState {
  const classEnds = user.classEnrollments
    .map((e) => e.class.pinClaimOpenUntil)
    .filter((d): d is Date => d != null)
    .map((d) => d.getTime());
  return {
    classOpenUntil: classEnds.length ? new Date(Math.max(...classEnds)) : null,
    studentOpenUntil: user.pinClaimOpenUntil,
  };
}

/**
 * 学生 PIN 认证（2026-08-25，docs/PRD/student-auth-and-home.md）。
 *
 * 信任根：**首次设置 PIN 必须持有学生 token**（扫码签发或既有登录）——
 * 「能在教室扫到码并选中自己的名字」就是这个体系的身份证明，与
 * scanToken 同源。之后凭「姓名 + PIN」在任何设备换取 30 天 token。
 *
 * 安全（PRD §8）：bcrypt、弱 PIN 黑名单、连错 5 次锁 15 分钟、
 * 失败响应统一 invalid_credentials（不泄露账号是否存在/是否设过 PIN）、
 * PIN 永不落日志。
 */
@Injectable()
export class StudentAuthService {
  private readonly logger = new Logger('StudentAuth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** PIN token 有效期。30 天 —— 学生设备丢失的风险由教师重置兜底。 */
  private static readonly TOKEN_TTL = '30d';

  /** 教师「以学生视角查看」的令牌：只读、15 分钟。 */
  static readonly TEACHER_VIEW_SCOPE = 'teacher_view';
  private static readonly TEACHER_VIEW_TTL = '15m';

  async login(input: { name: string; studentId?: string; pin: string }) {
    const name = (input.name ?? '').trim();
    if (!name) throw new BadRequestException({ code: 'name_required' });
    // 格式不对连查库都不必 —— 但错误码统一，不给枚举者信号。
    // 2026-08-26 网站式注册：从 6 位数字放宽为 6-32 位任意字符。
    const rawPin = input.pin ?? '';
    if (rawPin.length < 6 || rawPin.length > 32) {
      throw new UnauthorizedException({ code: 'invalid_credentials' });
    }

    const candidates = await this.prisma.user.findMany({
      where: {
        name,
        role: 'student',
        isActive: true,
        archivedAt: null,
        classEnrollments: { some: { role: 'student', class: { archivedAt: null } } },
        ...(input.studentId ? { id: input.studentId } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        avatar: true,
        pinHash: true,
        pinFailedCount: true,
        pinLockedUntil: true,
        studentAuthVersion: true,
        classEnrollments: {
          where: { role: 'student', class: { archivedAt: null } },
          select: { class: { select: { id: true, name: true } } },
        },
      },
    });

    if (candidates.length > 1) {
      // 同名：让前端展示班级候选再带 studentId 重试。
      // 绝不「拿 PIN 逐个试哪个对得上」—— 那会让 PIN 碰撞变成串号通道。
      return {
        needDisambiguation: true as const,
        candidates: candidates.map((c) => ({
          studentId: c.id,
          name: c.name,
          classes: c.classEnrollments.map((e) => e.class.name),
        })),
      };
    }

    const user = candidates[0];
    // 查无此人 / 未设 PIN：统一口径，不帮枚举者区分
    if (!user?.pinHash) {
      throw new UnauthorizedException({ code: 'invalid_credentials' });
    }

    const now = new Date();
    if (isLocked(user, now)) {
      throw new ForbiddenException({
        code: 'pin_locked',
        retryAfterSec: lockRemainingSec(user, now),
      });
    }

    const ok = await bcrypt.compare(input.pin, user.pinHash);
    if (!ok) {
      // ⚠️ 必须由**数据库**原子递增（2026-08-25 复审 P0-3）。
      // 原来是「读 pinFailedCount → 内存 +1 → update」：五个并发的错误
      // 请求会读到同一个旧值、各自写回 1，五次失败只记成一次，锁定形同
      // 虚设。改成 { increment: 1 } 由 PG 保证原子性，再回读判定是否越线。
      const bumped = await this.prisma.user.update({
        where: { id: user.id },
        data: { pinFailedCount: { increment: 1 } },
        select: { pinFailedCount: true },
      });
      if (bumped.pinFailedCount >= MAX_FAILED_ATTEMPTS) {
        // 越线才上锁并清零计数 —— 锁到期后重新拥有整额尝试
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            pinFailedCount: 0,
            pinLockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000),
          },
        });
        this.logger.warn(`PIN locked after repeated failures: student=${user.id}`);
        throw new ForbiddenException({
          code: 'pin_locked',
          retryAfterSec: LOCK_MINUTES * 60,
        });
      }
      throw new UnauthorizedException({ code: 'invalid_credentials' });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { ...afterSuccess(), lastLogin: now },
    });

    const token = await this.jwt.signAsync(
      {
        id: user.id,
        email: user.email,
        role: 'student',
        name: user.name,
        // 撤销用的版本号（复审 P0-2）：重置/改 PIN/停用时递增，旧 token 立即作废
        av: user.studentAuthVersion,
      },
      { expiresIn: StudentAuthService.TOKEN_TTL },
    );
    return {
      token,
      student: {
        id: user.id,
        name: user.name,
        nickname: user.nickname ?? user.name,
        avatar: user.avatar ?? null,
      },
    };
  }

  // ─────────────── 网站式注册（2026-08-26，PRD student-registration.md）───────────────

  /**
   * 同名解析 —— 与 login 同一套口径复制（不抽公共层，保持两条路径
   * 各自可读；改一处时另一处的注释会提醒）。
   */
  private async resolveForRegistration(name: string, studentId?: string) {
    return this.prisma.user.findMany({
      where: {
        name,
        role: 'student',
        isActive: true,
        archivedAt: null,
        classEnrollments: { some: { role: 'student', class: { archivedAt: null } } },
        ...(studentId ? { id: studentId } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        pinHash: true,
        studentAuthVersion: true,
        classEnrollments: {
          where: { role: 'student', class: { archivedAt: null } },
          select: { class: { select: { id: true, name: true } } },
        },
      },
    });
  }

  /** 打开 app 要不要弹注册卡。 */
  async registrationStatus(input: { name: string; studentId?: string }) {
    const name = (input.name ?? '').trim();
    if (!name) throw new BadRequestException({ code: 'name_required' });
    const candidates = await this.resolveForRegistration(name, input.studentId);
    if (candidates.length === 0) {
      // 查无此人：不弹卡（别拿一张注不了册的卡挡住页面），
      // 也不报错 —— 打开成绩页输错名字是常态
      return { found: false as const, registered: false };
    }
    if (candidates.length > 1) {
      return {
        found: true as const,
        needDisambiguation: true as const,
        candidates: candidates.map((c) => ({
          studentId: c.id,
          name: c.name,
          classes: c.classEnrollments.map((e) => e.class.name),
        })),
      };
    }
    return { found: true as const, registered: candidates[0].pinHash != null };
  }

  /**
   * 注册 = 首次设密码（+昵称/头像），成功即登录。
   *
   * ## 身份模型（教师 2026-08-26 拍板，PRD §1.1）
   *
   * 先到先得，像普通网站认用户名一样认花名册里的名字。不再要求教师
   * 开窗：弹卡的设备是长期查该生本人成绩的设备，这个延续性本身就是
   * 主要的身份证据；抢注的兜底是教师重置（重置瞬间对方所有登录失效）。
   */
  async register(input: {
    name: string;
    studentId?: string;
    password: string;
    nickname?: string;
    avatar?: string;
  }) {
    const name = (input.name ?? '').trim();
    if (!name) throw new BadRequestException({ code: 'name_required' });

    const pwErr = validatePasswordFormat(input.password ?? '');
    if (pwErr) throw new BadRequestException({ code: pwErr });

    const nickname = (input.nickname ?? '').trim().slice(0, 20) || name;
    const avatar = this.validateAvatar(input.avatar);

    const candidates = await this.resolveForRegistration(name, input.studentId);
    if (candidates.length === 0) {
      throw new BadRequestException({ code: 'student_not_found' });
    }
    if (candidates.length > 1) {
      return {
        needDisambiguation: true as const,
        candidates: candidates.map((c) => ({
          studentId: c.id,
          name: c.name,
          classes: c.classEnrollments.map((e) => e.class.name),
        })),
      };
    }
    const user = candidates[0];
    if (user.pinHash) {
      // 已注册 —— 不覆盖。捡到别人链接的人不能把密码改掉锁人；
      // 本人忘密码走教师重置
      throw new BadRequestException({ code: 'already_registered' });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        pinHash: await bcrypt.hash(input.password, 10),
        pinSetAt: new Date(),
        pinFailedCount: 0,
        pinLockedUntil: null,
        nickname,
        ...(avatar !== undefined ? { avatar } : {}),
      },
    });
    this.logger.log(`student registered: ${user.id}`);

    // 成功即登录 —— 与 login 同构的 30 天 token（带撤销版本号）
    const token = await this.jwt.signAsync(
      {
        id: user.id,
        email: user.email,
        role: 'student',
        name: user.name,
        av: user.studentAuthVersion,
      },
      { expiresIn: StudentAuthService.TOKEN_TTL },
    );
    return {
      token,
      student: { id: user.id, name: user.name, nickname, avatar: avatar ?? null },
    };
  }

  /**
   * 头像校验。undefined = 没传（不写库）；合法值原样返回。
   * 预设：emoji:<1-8字符>；上传：128x128 JPEG/PNG/WebP data URL ≤64KB。
   */
  private validateAvatar(raw?: string): string | undefined {
    if (raw == null || raw === '') return undefined;
    if (/^emoji:.{1,8}$/u.test(raw)) return raw;
    if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(raw)) {
      if (raw.length > 90_000) {
        throw new BadRequestException({ code: 'avatar_too_large' });
      }
      return raw;
    }
    throw new BadRequestException({ code: 'avatar_invalid' });
  }

  /** 首次设置。studentId 来自已验证的 token（controller 取），不信 body。 */
  async setPin(studentId: string, pin: string) {
    const err = validatePinFormat(pin);
    if (err) throw new BadRequestException({ code: err });
    const user = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        pinHash: true,
        role: true,
        isActive: true,
        pinClaimOpenUntil: true,
        classEnrollments: {
          where: { role: 'student', class: { archivedAt: null } },
          select: { class: { select: { pinClaimOpenUntil: true } } },
        },
      },
    });
    if (!user || user.role !== 'student' || !user.isActive) {
      throw new ForbiddenException({ code: 'not_a_student' });
    }
    if (user.pinHash) {
      // 已设置过 —— 想换走 change-pin（需要旧 PIN）。否则捡到别人
      // 还在有效期的 token 就能悄悄改掉 PIN 把人锁在门外。
      throw new BadRequestException({ code: 'pin_already_set' });
    }

    // 2026-08-26：认领窗口闸移除 —— 注册改为学生打开 app 自助完成
    // （网站式注册，PRD student-registration.md §1），此端点仅作兼容保留。
    const now = new Date();

    await this.prisma.user.update({
      where: { id: studentId },
      data: {
        pinHash: await bcrypt.hash(pin, 10),
        pinSetAt: now,
        // 认领成功即关掉个人窗 —— 一次性，不留给下一个人
        pinClaimOpenUntil: null,
      },
    });
    this.logger.log(`PIN claimed: student=${studentId}`);
    return { ok: true as const };
  }

  /** 认领窗口状态（学生端「现在能不能设 PIN」）。 */
  async claimWindow(studentId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: {
        pinHash: true,
        pinClaimOpenUntil: true,
        classEnrollments: {
          where: { role: 'student', class: { archivedAt: null } },
          select: { class: { select: { pinClaimOpenUntil: true } } },
        },
      },
    });
    if (!user) throw new UnauthorizedException({ code: 'invalid_credentials' });
    const now = new Date();
    const state = claimWindowState(user, now);
    return {
      pinSet: user.pinHash != null,
      open: claimWindowOpen(state, now),
      remainingSec: claimWindowRemainingSec(state, now),
    };
  }

  // ───────────────────── 教师端：注册窗口 ─────────────────────

  /**
   * 开班级窗（集体注册课）。
   *
   * 刻意**不做**「一键给全班生成 PIN」：那样 PIN 要经过教师的手和一张
   * 纸才能到学生手里，途中谁都看得见，比让学生自己设更差。
   */
  async openClassClaimWindow(
    actor: { id: string; role: string },
    classId: string,
    minutes?: number,
  ) {
    if (!(await canActOnClass(this.prisma, actor, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    let mins: number;
    try {
      mins = normalizeWindowMinutes(minutes);
    } catch (e) {
      throw new BadRequestException({ code: (e as Error).message });
    }
    const openUntil = windowEndsAt(new Date(), mins);
    await this.prisma.class.update({
      where: { id: classId },
      data: { pinClaimOpenUntil: openUntil, pinClaimOpenedBy: actor.id },
    });
    await this.audit(actor, 'pin_claim_window_open', 'Class', classId, {
      minutes: mins,
      openUntil,
    });
    this.logger.log(`Claim window opened: class=${classId} by=${actor.id} ${mins}min`);
    return { ok: true as const, openUntil, minutes: mins };
  }

  /** 关班级窗。注册完当场关，不等它自己过期。 */
  async closeClassClaimWindow(actor: { id: string; role: string }, classId: string) {
    if (!(await canActOnClass(this.prisma, actor, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    await this.prisma.class.update({
      where: { id: classId },
      data: { pinClaimOpenUntil: null, pinClaimOpenedBy: null },
    });
    await this.audit(actor, 'pin_claim_window_close', 'Class', classId, {});
    return { ok: true as const };
  }

  /**
   * 给单个学生开补注册窗（请假 / 换手机 / 被抢注要重来）。
   *
   * 为什么不让教师重开全班窗：重开会把**所有**未认领的名字重新暴露一次。
   * 一个人的问题不该扩大成全班的敞口。
   */
  async openStudentClaimWindow(
    actor: { id: string; role: string },
    studentId: string,
    minutes?: number,
  ) {
    const enrollment = await this.prisma.classEnrollment.findFirst({
      where: { userId: studentId, role: 'student', class: { archivedAt: null } },
      select: { classId: true },
    });
    if (!enrollment) throw new BadRequestException({ code: 'student_not_found' });
    if (!(await canActOnClass(this.prisma, actor, enrollment.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    let mins: number;
    try {
      mins = normalizeWindowMinutes(minutes);
    } catch (e) {
      throw new BadRequestException({ code: (e as Error).message });
    }
    const openUntil = windowEndsAt(new Date(), mins);
    await this.prisma.user.update({
      where: { id: studentId },
      data: { pinClaimOpenUntil: openUntil },
    });
    await this.audit(actor, 'pin_claim_window_open', 'User', studentId, {
      minutes: mins,
      openUntil,
    });
    return { ok: true as const, openUntil, minutes: mins };
  }

  /**
   * 教师端花名册：谁领了、谁没领、窗口开着没。
   *
   * 「未激活名单」是集体注册课的操作界面，也是之后要不要关闭姓名直读
   * 的判断依据 —— 覆盖率不到 100% 就强制认证，等于把人关在门外。
   */
  async claimStatus(actor: { id: string; role: string }, classId: string) {
    if (!(await canActOnClass(this.prisma, actor, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    const now = new Date();
    const klass = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true, pinClaimOpenUntil: true },
    });
    if (!klass) throw new BadRequestException({ code: 'class_not_found' });

    const rows = await this.prisma.classEnrollment.findMany({
      where: { classId, role: 'student', user: { archivedAt: null, isActive: true } },
      select: {
        user: {
          select: {
            id: true,
            name: true,
            pinSetAt: true,
            pinClaimOpenUntil: true,
            pinLockedUntil: true,
          },
        },
      },
    });

    const students = rows
      .map((r) => r.user)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
      .map((u) => ({
        id: u.id,
        name: u.name,
        claimed: u.pinSetAt != null,
        claimedAt: u.pinSetAt,
        locked: u.pinLockedUntil != null && u.pinLockedUntil.getTime() > now.getTime(),
        personalWindowOpen:
          u.pinClaimOpenUntil != null && u.pinClaimOpenUntil.getTime() > now.getTime(),
      }));

    const claimed = students.filter((s) => s.claimed).length;
    return {
      classId: klass.id,
      className: klass.name,
      windowOpen:
        klass.pinClaimOpenUntil != null && klass.pinClaimOpenUntil.getTime() > now.getTime(),
      windowOpenUntil: klass.pinClaimOpenUntil,
      total: students.length,
      claimed,
      unclaimed: students.length - claimed,
      students,
    };
  }

  // ───────────────────── 教师端：学生视角（只读） ─────────────────────

  /**
   * 签发「以学生视角查看」的短时只读令牌。
   *
   * ## 为什么是只读
   *
   * 让教师**以学生身份登录**（可写）看起来更方便，但它会污染成绩数据的
   * 可信度：教师进去帮忙点两下，数据库里记的就是「学生交了卷」「学生
   * 评了这个词」。判分队列、FSRS 调度全建在这些记录上，一旦教师的动作
   * 能被记成学生的，之后看任何一条记录都要先问「这是他自己做的吗」。
   *
   * 排障要的其实只是「看到学生看到的那个页面」。只读拿到了这份价值，
   * 而写入的风险一点不担。
   *
   * ## 怎么强制只读
   *
   * token 带 `scope: 'teacher_view'`。`StudentIdentityGuard` 认它的读，
   * 但凡标了 `@RequireStudentToken()` 的写接口一律 403 —— 这与发卷用的
   * `mq_handoff` 窄凭证是同一个模式，不新增机制。
   *
   * 15 分钟过期：排障够用，捡到也没多少可用窗口。
   */
  async issueTeacherViewToken(
    actor: { id: string; role: string },
    studentId: string,
    ip?: string,
  ) {
    const enrollment = await this.prisma.classEnrollment.findFirst({
      where: { userId: studentId, role: 'student', class: { archivedAt: null } },
      select: { classId: true },
    });
    if (!enrollment) throw new BadRequestException({ code: 'student_not_found' });
    if (!(await canActOnClass(this.prisma, actor, enrollment.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, email: true, studentAuthVersion: true, isActive: true },
    });
    if (!student || !student.isActive) {
      throw new BadRequestException({ code: 'student_not_found' });
    }

    const token = await this.jwt.signAsync(
      {
        id: student.id,
        email: student.email,
        role: 'student',
        name: student.name,
        scope: StudentAuthService.TEACHER_VIEW_SCOPE,
        av: student.studentAuthVersion,
        // 谁在看 —— 进审计，也让日志能回答「这条读请求是学生还是老师」
        actorId: actor.id,
      },
      { expiresIn: StudentAuthService.TEACHER_VIEW_TTL },
    );

    // 教师查看学生数据必须留痕。这不是防教师，是让「谁看过什么」可回答。
    await this.audit(actor, 'teacher_view_student', 'User', studentId, {
      ttl: StudentAuthService.TEACHER_VIEW_TTL,
    }, ip);
    this.logger.log(`Teacher view issued: teacher=${actor.id} student=${studentId}`);

    return {
      token,
      student: { id: student.id, name: student.name },
      expiresInSec: 15 * 60,
      readOnly: true as const,
    };
  }

  /** 审计写入。失败不能阻断主流程 —— 但要留下痕迹说明审计本身出了问题。 */
  private async audit(
    actor: { id: string; role: string },
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, unknown>,
    ip?: string,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action,
          entityType,
          entityId,
          metadata: metadata as any,
          ip: ip ?? null,
        },
      });
    } catch (e) {
      this.logger.error(`audit write failed action=${action} ${(e as Error).message}`);
    }
  }

  async changePin(studentId: string, oldPin: string, newPin: string) {
    // 2026-08-26 网站式注册：新密码走密码规则（6-32 任意字符），不再限 6 位数字
    const err = validatePasswordFormat(newPin);
    if (err) throw new BadRequestException({ code: err });
    const user = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { pinHash: true, pinFailedCount: true, pinLockedUntil: true },
    });
    if (!user?.pinHash) throw new BadRequestException({ code: 'pin_not_set' });
    const now = new Date();
    if (isLocked(user, now)) {
      throw new ForbiddenException({ code: 'pin_locked', retryAfterSec: lockRemainingSec(user, now) });
    }
    if (!(await bcrypt.compare(oldPin, user.pinHash))) {
      // 改 PIN 时输错旧 PIN 同样计入失败 —— 否则这里成了绕过锁定的
      // 免费试错通道。同 login，用数据库原子递增。
      const bumped = await this.prisma.user.update({
        where: { id: studentId },
        data: { pinFailedCount: { increment: 1 } },
        select: { pinFailedCount: true },
      });
      if (bumped.pinFailedCount >= MAX_FAILED_ATTEMPTS) {
        await this.prisma.user.update({
          where: { id: studentId },
          data: {
            pinFailedCount: 0,
            pinLockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000),
          },
        });
      }
      throw new UnauthorizedException({ code: 'invalid_credentials' });
    }
    await this.prisma.user.update({
      where: { id: studentId },
      data: {
        pinHash: await bcrypt.hash(newPin, 10),
        pinSetAt: now,
        ...afterSuccess(),
        // 改 PIN = 登出所有其它设备（复审 P0-2）
        studentAuthVersion: { increment: 1 },
      },
    });
    return { ok: true as const };
  }

  /** 主页用：我是谁、PIN 设了没。 */
  async me(studentId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, nickname: true, avatar: true, pinHash: true },
    });
    if (!user) throw new UnauthorizedException({ code: 'invalid_credentials' });
    return {
      id: user.id,
      name: user.name,
      nickname: user.nickname ?? user.name,
      avatar: user.avatar ?? null,
      pinSet: user.pinHash != null,
    };
  }

  /** 教师重置：清空 PIN，学生下次扫码后重新设置。走班级权限。 */
  async adminResetPin(actor: { id: string; role: string }, studentId: string) {
    const enrollment = await this.prisma.classEnrollment.findFirst({
      where: { userId: studentId, role: 'student', class: { archivedAt: null } },
      select: { classId: true },
    });
    if (!enrollment) throw new BadRequestException({ code: 'student_not_found' });
    if (!(await canActOnClass(this.prisma, actor, enrollment.classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    await this.prisma.user.update({
      where: { id: studentId },
      data: {
        pinHash: null,
        pinSetAt: null,
        pinFailedCount: 0,
        pinLockedUntil: null,
        // 关键（复审 P0-2）：重置必须让已签发的 30 天 token 立刻失效，
        // 否则「抢注者已经拿到 token」的情况下，教师重置也救不回来
        studentAuthVersion: { increment: 1 },
      },
    });
    this.logger.log(`PIN reset by teacher=${actor.id} for student=${studentId}`);
    return { ok: true as const };
  }
}
