import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
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
import { studentAppRoutingFromEnv } from './student-app-routing';
import { STAGING_FIXTURE_STUDENT_ID } from './staging-fixture-login';
import {
  displayName,
  isPilotLevel,
  levelOffered,
  normalizeClassCode,
  normalizeName,
  PILOT_LEVELS,
  type PilotLevel,
} from './pilot-levels';

/**
 * 学生 PIN 认证（2026-08-25，docs/PRD/student-auth-and-home.md）。
 *
 * ## 信任根（2026-08-26 起 —— 下面这段是现状，别照旧文档理解）
 *
 * 早期的信任根是「首次设置 PIN 必须持有学生 token（扫码签发）」。
 * **那已经不是现在的行为了。** `student-registration.md` 定案后改成了
 * **网站式、以姓名为先的公开注册**：
 *
 *   · `POST /student-auth/register` 是 `@Public()` 的 —— **不需要扫码
 *     令牌，也不需要任何学生令牌**。给姓名 + 密码即注册即登录；同名时
 *     返回 `needDisambiguation` + `candidates`，调用方选一个 studentId
 *     再来一次。
 *   · 身份证据换成了「先到先得 + 教师重置兜底」（重置瞬间该生所有登录
 *     失效，见 `studentAuthVersion`）。
 *   · `POST /student-auth/change-pin` **仍然要令牌** —— 改密码是持有者
 *     才能做的事，与注册不是一回事。
 *
 * 之后凭「姓名 + 密码」在任何设备换取 30 天 token。
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
      // 学生端版本路由（阶段 4A 新增，**只读、向后兼容**）。
      // 旧端不读这两个字段，行为零变化；新端读了也只是知道自己该不该
      // 接管。**本阶段两端都不据此跳转。** 判据见 student-app-routing.ts
      // ——「学生 id 只有认证之后才知道」正是它必须由服务端算的原因。
      ...studentAppRoutingFromEnv(user.id),
    };
  }

  // ─────────────── ⚠️ 临时：staging 免密夹具登录（上生产前必须拆） ───────────────

  /**
   * 只给**一个虚构账号**（`t6_done`）签发正常的学生令牌，**不校验任何凭据**。
   *
   * 闸门与退役步骤见 `staging-fixture-login.ts` 的文件头。这里只负责两件事：
   *
   *   · **账号是写死的**。`STAGING_FIXTURE_STUDENT_ID` 是常量，方法**不收
   *     任何入参** —— 调用方（控制器）也不接收请求体。「换个 id 就能登别人」
   *     这条路在类型层面就不存在。
   *   · **资格照常查**。`role/isActive/archivedAt/在读注册` 与
   *     `login()` 用的是同一组条件，`av` 取当下的 `studentAuthVersion`
   *     —— 教师一旦重置该账号，已签发的令牌照常立刻失效。
   *
   * **不写库**：不动 PIN、不动注册状态、不动 `studentAuthVersion`、
   * 连 `lastLogin` 都不写（免密登录不是「学生登录」这个事实）。
   */
  async stagingFixtureSession() {
    const user = await this.prisma.user.findFirst({
      where: {
        id: STAGING_FIXTURE_STUDENT_ID,
        role: 'student',
        isActive: true,
        archivedAt: null,
        classEnrollments: { some: { role: 'student', class: { archivedAt: null } } },
      },
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        avatar: true,
        studentAuthVersion: true,
      },
    });
    if (!user) {
      // 夹具账号不在（换了库、被停用、班级归档）—— 明说，不糊弄出一个令牌
      throw new NotFoundException({ code: 'fixture_student_unavailable' });
    }

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
    this.logger.warn(
      `⚠️ staging fixture passwordless session issued for ${user.id} — this channel must be retired before production`,
    );
    return {
      token,
      student: {
        id: user.id,
        name: user.name,
        nickname: user.nickname ?? user.name,
        avatar: user.avatar ?? null,
      },
      ...studentAppRoutingFromEnv(user.id),
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
      // 同 login —— 只读、向后兼容，本阶段不据此跳转
      ...studentAppRoutingFromEnv(user.id),
    };
  }

  // ───────────────── S12O：自助注册 + 自助改难度 ─────────────────

  /**
   * **学生自己注册** —— 选择班级 + 姓名 + 自设 PIN + 自选难度。
   *
   * ## 和上面那个 `register` 是两件事
   *
   * `register` 干的是**认领**：花名册上必须已经有他这一行（教师先建好、
   * 且难度也由教师设好），学生只是给那一行补一个密码。`student_not_found`
   * 就是这个前提的回声。试点要请真人进来，这个前提站不住 —— 老师不该
   * 为每个想试的人先建一行，更不该替他决定上哪一层。
   *
   * 所以这条路**真的建号**。学生从服务端给出的开放班级中选择，客户端
   * 只提交不可读的 classId；服务端仍会重新校验班级存在、未归档且开着
   * 所选难度，不能靠伪造 id 混进一个关闭的班。
   *
   * ## 唯一性靠哪一条
   *
   * 「同一个班里同名」这件事，光靠先查一遍是拦不住并发的（双击、
   * 手抖连点、弱网重发都会产生两个几乎同时到达的请求）。所以真正的
   * 防线是 `User.email` 上的唯一索引：email 由 `(classId, 归一后的姓名)`
   * 确定性地算出来，两个请求算出同一个值，数据库让其中一个 P2002。
   * 先查那一遍只是为了给出一句人话的错误。
   */
  async registrationClasses() {
    const rows = await this.prisma.class.findMany({
      where: { archivedAt: null, englishLevels: { some: {} } },
      select: { id: true, name: true, classCode: true, englishLevels: { select: { level: true } } },
      orderBy: { name: 'asc' },
    });
    return {
      classes: rows
        .map((klass: any) => ({
          id: klass.id,
          name: klass.name,
          classCode: klass.classCode,
          offered: new Set<string>(
            (klass.englishLevels ?? []).map((row: any) => String(row.level)).filter(isPilotLevel),
          ),
        }))
        // 学生不需要知道「班级对应哪些难度」。只有五档全部准备好的班级
        // 才出现在注册页，因此选完班以后五档永远都可选，不会进空课程。
        .filter((klass: { classCode: string; offered: Set<string> }) =>
          klass.classCode !== 'PILOTW1' && PILOT_LEVELS.every((level) => klass.offered.has(level)),
        )
        .map(({ id, name }: { id: string; name: string }) => ({ id, name })),
    };
  }

  async selfRegister(input: {
    classId: string;
    name: string;
    pin: string;
    englishLevel: string;
  }) {
    const shown = displayName(input.name);
    if (!shown) throw new BadRequestException({ code: 'name_required' });

    // 难度白名单先于班级查询 —— 一个瞎编的难度不该换来「这个班存不存在」
    // 的信息。
    if (!isPilotLevel(input.englishLevel)) {
      throw new BadRequestException({ code: 'level_not_allowed' });
    }
    const level = input.englishLevel as PilotLevel;

    const pinErr = validatePinFormat(input.pin ?? '');
    if (pinErr) throw new BadRequestException({ code: pinErr });

    const klass = await this.prisma.class.findFirst({
      where: { id: input.classId, archivedAt: null },
      select: { id: true, name: true, classCode: true, englishLevels: { select: { level: true } } },
    });
    if (!klass) throw new BadRequestException({ code: 'class_not_available' });
    if (klass.classCode === 'PILOTW1') {
      throw new BadRequestException({ code: 'class_not_available' });
    }

    const offered = (klass.englishLevels ?? []).map((l) => String(l.level));
    if (offered.length === 0) throw new BadRequestException({ code: 'class_not_open' });
    if (!levelOffered(level, offered)) {
      throw new BadRequestException({ code: 'level_not_offered' });
    }

    const key = normalizeName(shown);
    const taken = await this.prisma.user.findMany({
      where: { classEnrollments: { some: { classId: klass.id } } },
      select: { id: true, name: true },
    });
    if (taken.some((u) => normalizeName(u.name) === key)) {
      throw new ConflictException({ code: 'name_taken_in_class' });
    }

    const email = this.selfRegisterEmail(klass.id, key);
    const pinHash = await bcrypt.hash(input.pin, 10);
    // 教师端的密码位是必填的，而学生根本不走那条登录路 —— 放一个谁也
    // 打不出来的随机串的哈希，等于把那扇门焊死。
    const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);

    let created: { id: string; name: string; nickname: string | null; avatar: string | null; studentAuthVersion: number };
    try {
      created = await this.prisma.$transaction(async (tx: any) => {
        const user = await tx.user.create({
          data: {
            email,
            name: shown,
            nickname: shown,
            passwordHash,
            role: 'student',
            pinHash,
            pinSetAt: new Date(),
            englishLevel: level,
          },
        });
        await tx.classEnrollment.create({
          data: { classId: klass.id, userId: user.id, role: 'student' },
        });
        return user;
      });
    } catch (e: any) {
      // 并发的那一个。数据库刚刚替我们做完了「同名」的判断。
      if (e?.code === 'P2002') throw new ConflictException({ code: 'name_taken_in_class' });
      throw e;
    }

    // 日志里只有 id —— 姓名、PIN、令牌、班级 id 一个都不落。
    this.logger.log(`student self-registered: ${created.id}`);

    const token = await this.jwt.signAsync(
      {
        id: created.id,
        email,
        role: 'student',
        name: created.name,
        av: created.studentAuthVersion ?? 0,
      },
      { expiresIn: StudentAuthService.TOKEN_TTL },
    );
    return {
      token,
      student: {
        id: created.id,
        name: created.name,
        nickname: created.nickname ?? created.name,
        avatar: created.avatar ?? null,
      },
      englishLevel: level,
      ...studentAppRoutingFromEnv(created.id),
    };
  }

  /**
   * 自助注册用的 email。
   *
   * 学生自己没有校邮箱，而 `User.email` 是必填且唯一的 —— 于是它在这里
   * 承担了第二个职责：**「同一个班 + 同一个名字」的唯一索引**。
   *
   * 用哈希而不是把名字拼进去，是因为 email 会出现在日志、导出、错误
   * 信息里；把学生姓名写进一个到处流动的字段等于白送一份花名册。
   * `.invalid` 是 RFC 2606 保留后缀，永远不会有人真的收到信。
   */
  private selfRegisterEmail(classId: string, nameKey: string): string {
    const h = crypto.createHash('sha256').update(`${classId}|${nameKey}`).digest('hex');
    return `selfreg-${h.slice(0, 32)}@pilot.invalid`;
  }

  /**
   * 学生**自己**改难度。身份只来自令牌 —— 调用方给不了 studentId。
   *
   * ## 只写一个字段，是有意的
   *
   * 难度是「他现在在哪一层」这个**学生属性**，不是任何一份历史任务的
   * 属性。已经交的卷子记在 `MorningQuizSession.level` 上、当天的课程
   * 目标冻结在 `DailyLessonCompletion` 里 —— 改这里一个字都碰不到它们。
   * 生效时机因此是自然的：**下一次还没冻结的课**按新难度挑场次
   * （见 `pickTodaySession`），已经开始的那一天原样不动。
   *
   * 也**不动** `studentAuthVersion` —— 改难度不是改凭据，没有理由把他
   * 手里的令牌作废、把他踢回登录页。
   */
  async setEnglishLevel(studentId: string, level: string) {
    if (!isPilotLevel(level)) throw new BadRequestException({ code: 'level_not_allowed' });

    const rows = await this.prisma.classEnrollment.findMany({
      where: { userId: studentId, role: 'student' },
      select: { classId: true, class: { select: { englishLevels: { select: { level: true } } } } },
    });
    const offered = [
      ...new Set(
        rows.flatMap((r: any) => (r.class?.englishLevels ?? []).map((l: any) => String(l.level))),
      ),
    ];
    // 一个班都没有（或者班里一档都没开）—— 说不清该允许什么，就不允许。
    if (offered.length === 0) throw new BadRequestException({ code: 'class_not_open' });
    if (!levelOffered(level, offered)) {
      throw new BadRequestException({ code: 'level_not_offered' });
    }

    await this.prisma.user.update({
      where: { id: studentId },
      data: { englishLevel: level as PilotLevel },
    });
    this.logger.log(`student level changed: ${studentId}`);
    return { englishLevel: level, effective: 'next_unfrozen_lesson' as const };
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
      select: {
        id: true,
        name: true,
        nickname: true,
        avatar: true,
        pinHash: true,
        // P4: 学生当前难度。前端扫码页据此跳过难度选择器 —— 已经
        // 定过的人不该每天再被问一次。
        englishLevel: true,
      },
    });
    if (!user) throw new UnauthorizedException({ code: 'invalid_credentials' });
    return {
      id: user.id,
      name: user.name,
      nickname: user.nickname ?? user.name,
      avatar: user.avatar ?? null,
      pinSet: user.pinHash != null,
      englishLevel: user.englishLevel ?? null,
      // 与 login/register 同一套只读字段 —— 刷新之后新端要能重新拿到
      // 结论，不能只在登录那一刻给一次。
      ...studentAppRoutingFromEnv(user.id),
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
