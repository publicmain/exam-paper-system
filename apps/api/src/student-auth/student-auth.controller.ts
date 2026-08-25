import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/auth.guard';
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
  ) {}

  /** 从 Authorization 里解出**完整**学生身份；handoff 等窄凭证不算。 */
  private async requireStudent(req: Request): Promise<{ id: string }> {
    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) {
      throw new ForbiddenException({ code: 'student_token_required' });
    }
    try {
      const p = await this.jwt.verifyAsync<{ id?: string; role?: string; scope?: string }>(
        auth.slice('Bearer '.length),
      );
      if (p?.role !== 'student' || !p.id || p.scope === 'mq_handoff') {
        throw new Error('not_full_student');
      }
      return { id: p.id };
    } catch {
      throw new ForbiddenException({ code: 'student_token_required' });
    }
  }

  @Public()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'ip' })
  @Post('login')
  async login(@Body() body: unknown) {
    const schema = z.object({
      name: z.string().min(1).max(50),
      studentId: z.string().optional(),
      pin: z.string().min(1).max(20),
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
      oldPin: z.string().min(1).max(20),
      newPin: z.string().min(1).max(20),
    });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.svc.changePin(me.id, p.data.oldPin, p.data.newPin);
  }

  @Public()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
  @Get('me')
  async me(@Req() req: Request) {
    const me = await this.requireStudent(req);
    return this.svc.me(me.id);
  }

  /** 教师端：一键重置（学生忘 PIN 的恢复通道）。走 AuthGuard 正常认证。 */
  @Post('admin/reset-pin')
  async adminResetPin(@Body() body: unknown, @CurrentUser() user: any) {
    const schema = z.object({ studentId: z.string().min(1) });
    const p = schema.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.svc.adminResetPin({ id: user.id, role: user.role }, p.data.studentId);
  }
}
