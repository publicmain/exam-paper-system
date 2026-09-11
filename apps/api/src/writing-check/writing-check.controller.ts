import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { Public } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import {
  RequireStudentReadToken,
  RequireStudentToken,
  StudentIdentityGuard,
} from '../common/student-identity.guard';
import { WritingCheckService } from './writing-check.service';

function studentIdOf(req: Request): string {
  const id = (req as Request & { studentAuth?: { id?: string } }).studentAuth?.id;
  if (!id) throw new BadRequestException({ code: 'student_required' });
  return id;
}

@UseGuards(StudentIdentityGuard)
@Controller('writing-check')
export class WritingCheckController {
  constructor(private readonly service: WritingCheckService) {}

  /** 功能开着没有 —— 学生端据此决定要不要显示提示区，省得每次白跑一趟。
   *  S08：只读一个环境变量，零写库 —— 教师只读视角可读。 */
  @Public()
  @RequireStudentReadToken()
  @Get('status')
  status(@Req() req: Request) {
    studentIdOf(req);
    return { enabled: this.service.enabled() };
  }

  /**
   * 查一段作答的拼写和语法。
   *
   * 限流按**学生**算不按 IP：一个班共用学校出口 IP，按 IP 算等于一个人打满
   * 全班都用不了（2026-09-09 已经在班级注册上踩过一次同源限流的坑）。
   */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 40, windowSec: 60, scope: 'user' })
  @Post()
  async check(@Req() req: Request, @Body() body: unknown) {
    studentIdOf(req);
    const parsed = z.object({ text: z.string().max(4000) }).strict().safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException({ code: 'bad_text' });
    const text = parsed.data.text.trim();
    // 太短就别麻烦服务器了，一两个词的填空题也没什么语法可言
    if (text.length < 12) return { issues: [] };
    return this.service.check(text);
  }
}
