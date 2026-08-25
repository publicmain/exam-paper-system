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
} from './pin';

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

  async login(input: { name: string; studentId?: string; pin: string }) {
    const name = (input.name ?? '').trim();
    if (!name) throw new BadRequestException({ code: 'name_required' });
    // 格式不对连查库都不必 —— 但错误码统一，不给枚举者信号
    if (!/^\d{6}$/.test(input.pin ?? '')) {
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
    return { token, student: { id: user.id, name: user.name } };
  }

  /** 首次设置。studentId 来自已验证的 token（controller 取），不信 body。 */
  async setPin(studentId: string, pin: string) {
    const err = validatePinFormat(pin);
    if (err) throw new BadRequestException({ code: err });
    const user = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { pinHash: true, role: true, isActive: true },
    });
    if (!user || user.role !== 'student' || !user.isActive) {
      throw new ForbiddenException({ code: 'not_a_student' });
    }
    if (user.pinHash) {
      // 已设置过 —— 想换走 change-pin（需要旧 PIN）。否则捡到别人
      // 还在有效期的 token 就能悄悄改掉 PIN 把人锁在门外。
      throw new BadRequestException({ code: 'pin_already_set' });
    }
    await this.prisma.user.update({
      where: { id: studentId },
      data: { pinHash: await bcrypt.hash(pin, 10), pinSetAt: new Date() },
    });
    return { ok: true as const };
  }

  async changePin(studentId: string, oldPin: string, newPin: string) {
    const err = validatePinFormat(newPin);
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
      select: { id: true, name: true, pinHash: true },
    });
    if (!user) throw new UnauthorizedException({ code: 'invalid_credentials' });
    return { id: user.id, name: user.name, pinSet: user.pinHash != null };
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
