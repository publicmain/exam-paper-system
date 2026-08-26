import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { RateLimit } from '../common/rate-limit.guard';
import { StudentAuthService } from './student-auth.service';

/**
 * 学生 PIN 认证端点（2026-08-25，docs/PRD/student-auth-and-home.md §5）。
 *
 * login 是公开的（登录前当然没有 token）；set-pin / change-pin / me
 * 需要学生 token —— 这里**手动**验 token 而不是走 AuthGuard 的非公开
 * 路径，因为 AuthGuard 会把 handoff token 等窄凭证一并放进来，而
 * 设置 PIN 的信任根必须是完整的学生 token（扫码或登录签发）。
 */
@Controller('student-auth')
export class StudentAuthController {
  constructor(
    private readonly svc: StudentAuthService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 从 Authorization 里解出**完整**学生身份；handoff 等窄凭证不算。
   *
   * `allowTeacherView`：教师的只读学生视角能不能用这条路。默认**不能** ——
   * set-pin / change-pin 是改凭证，教师借来的视角绝不能碰（教师要重置
   * 走 admin/reset-pin，那条路留痕）。只有 GET /me 打开它，因为「看到
   * 学生看到的主页」正是这个功能的用途。
   */
  private async requireStudent(
    req: Request,
    opts: { allowTeacherView?: boolean } = {},
  ): Promise<{ id: string }> {
    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) {
      throw new ForbiddenException({ code: 'student_token_required' });
    }
    try {
      const p = await this.jwt.verifyAsync<{
        id?: string;
        role?: string;
        scope?: string;
        av?: number;
      }>(auth.slice('Bearer '.length));
      if (p?.role !== 'student' || !p.id || p.scope === 'mq_handoff') {
        throw new Error('not_full_student');
      }
      if (p.scope === StudentAuthService.TEACHER_VIEW_SCOPE && !opts.allowTeacherView) {
        throw new ForbiddenException({ code: 'teacher_view_is_read_only' });
      }
      // 撤销校验（2026-08-25 复审 P0-2）。改 PIN 这条路尤其要查：
      // 抢注者若已拿到 30 天 token，教师重置 PIN 后他必须**不能**再用
      // 旧 token 把 PIN 改回去，否则重置形同虚设。
      // 与 StudentIdentityGuard 同口径：只查带 av 的长期 token。
      if (typeof p.av === 'number') {
        const row = await this.prisma.user.findUnique({
          where: { id: p.id },
          select: { studentAuthVersion: true, isActive: true, archivedAt: true },
        });
        if (
          !row ||
          !row.isActive ||
          row.archivedAt != null ||
          row.studentAuthVersion !== p.av
        ) {
          // 直接抛 Forbidden 并**跳出 try**（下面的 catch 只兜 token 本身
          // 坏掉的情况）。生产 E2E 里这里原先落进 catch，被统一改写成
          // student_token_required —— 前端据此不会清掉那张废票，学生会
          // 卡在「要我登录，但我明明登录了」。撤销必须自报家门。
          throw new ForbiddenException({ code: 'token_revoked' });
        }
      }
      return { id: p.id };
    } catch (e) {
      // 撤销的拒绝理由要原样传出去，不能被统一改写
      if (e instanceof ForbiddenException) throw e;
      throw new ForbiddenException({ code: 'student_token_required' });
    }
  }

  /** 网站式注册（2026-08-26）：打开 app 弹卡 → 首次设密码即注册即登录。 */
  @Public()
  @RateLimit({ limit: 10, windowSec: 60, scope: 'ip' })
  @Post('register')
  async register(@Body() body: unknown) {
    const schema = z.object({
      name: z.string().min(1).max(50),
      studentId: z.string().optional(),
      password: z.string().min(1).max(64),
      nickname: z.string().max(20).optional(),
      avatar: z.string().max(95_000).optional(),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.svc.register(p.data);
  }

  /** 打开 app 要不要弹注册卡。 */
  @Public()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'ip' })
  @Get('registration-status')
  async registrationStatus(
    @Query('name') name?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.svc.registrationStatus({ name: name ?? '', studentId: studentId || undefined });
  }

  @Public()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'ip' })
  @Post('login')
  async login(@Body() body: unknown) {
    const schema = z.object({
      name: z.string().min(1).max(50),
      studentId: z.string().optional(),
      pin: z.string().min(1).max(32),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.svc.login(p.data);
  }

  @Public()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'ip' })
  @Post('set-pin')
  async setPin(@Body() body: unknown, @Req() req: Request) {
    const me = await this.requireStudent(req);
    const schema = z.object({ pin: z.string().min(1).max(20) });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.svc.setPin(me.id, p.data.pin);
  }

  @Public()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'ip' })
  @Post('change-pin')
  async changePin(@Body() body: unknown, @Req() req: Request) {
    const me = await this.requireStudent(req);
    const schema = z.object({
      oldPin: z.string().min(1).max(32),
      newPin: z.string().min(1).max(32),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.svc.changePin(me.id, p.data.oldPin, p.data.newPin);
  }

  @Public()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
  @Get('me')
  async me(@Req() req: Request) {
    // 教师的只读视角可以看主页 —— 这正是「看到学生看到的东西」
    const me = await this.requireStudent(req, { allowTeacherView: true });
    return this.svc.me(me.id);
  }

  /** 学生端：现在能不能设 PIN（认领窗口开着吗、还剩多久）。 */
  @Public()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
  @Get('claim-window')
  async claimWindow(@Req() req: Request) {
    const me = await this.requireStudent(req, { allowTeacherView: true });
    return this.svc.claimWindow(me.id);
  }

  /** 教师端：一键重置（学生忘 PIN 的恢复通道）。走 AuthGuard 正常认证。 */
  @Post('admin/reset-pin')
  async adminResetPin(@Body() body: unknown, @CurrentUser() user: any) {
    const schema = z.object({ studentId: z.string().min(1) });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.svc.adminResetPin({ id: user.id, role: user.role }, p.data.studentId);
  }

  // ───────────────── 教师端：集体注册窗口 ─────────────────

  /** 开班级注册窗（集体注册课用）。默认 20 分钟，上限 120。 */
  @Post('admin/claim-window/open')
  async openClaimWindow(@Body() body: unknown, @CurrentUser() user: any) {
    const schema = z.object({
      classId: z.string().min(1),
      minutes: z.number().int().min(1).max(120).optional(),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.svc.openClassClaimWindow(
      { id: user.id, role: user.role },
      p.data.classId,
      p.data.minutes,
    );
  }

  /** 关班级注册窗。注册完当场关，别等它自己过期。 */
  @Post('admin/claim-window/close')
  async closeClaimWindow(@Body() body: unknown, @CurrentUser() user: any) {
    const schema = z.object({ classId: z.string().min(1) });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.svc.closeClassClaimWindow({ id: user.id, role: user.role }, p.data.classId);
  }

  /** 给单个学生开补注册窗（请假 / 换手机 / 被抢注要重来）。 */
  @Post('admin/claim-window/student')
  async openStudentWindow(@Body() body: unknown, @CurrentUser() user: any) {
    const schema = z.object({
      studentId: z.string().min(1),
      minutes: z.number().int().min(1).max(120).optional(),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.svc.openStudentClaimWindow(
      { id: user.id, role: user.role },
      p.data.studentId,
      p.data.minutes,
    );
  }

  /** 教师端花名册：谁领了、谁没领、窗口开着没。 */
  @Get('admin/claim-status')
  async claimStatus(@Query('classId') classId: string, @CurrentUser() user: any) {
    if (!classId) throw new BadRequestException({ code: 'class_id_required' });
    return this.svc.claimStatus({ id: user.id, role: user.role }, classId);
  }

  // ───────────────── 教师端：学生视角（只读） ─────────────────

  /**
   * 签发只读的「以学生视角查看」令牌（15 分钟）。
   * 写接口一律 403 `teacher_view_is_read_only` —— 见 StudentIdentityGuard。
   */
  @Post('admin/view-token')
  async viewToken(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const schema = z.object({ studentId: z.string().min(1) });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.svc.issueTeacherViewToken(
      { id: user.id, role: user.role },
      p.data.studentId,
      req.ip,
    );
  }
}
