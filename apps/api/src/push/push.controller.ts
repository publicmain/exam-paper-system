import { BadRequestException, Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { Public } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import {
  RequireStudentReadToken,
  RequireStudentToken,
  StudentIdentityGuard,
} from '../common/student-identity.guard';
import { PushService } from './push.service';

function studentIdOf(req: Request): string {
  const id = (req as Request & { studentAuth?: { id?: string } }).studentAuth?.id;
  if (!id) throw new BadRequestException({ code: 'student_required' });
  return id;
}

const SubscribeBody = z
  .object({
    endpoint: z.string().url().max(2000),
    keys: z.object({ p256dh: z.string().min(1).max(300), auth: z.string().min(1).max(100) }).strict(),
  })
  .strict();

const EndpointBody = z.object({ endpoint: z.string().url().max(2000) }).strict();

@UseGuards(StudentIdentityGuard)
@Controller('push')
export class PushController {
  constructor(private readonly service: PushService) {}

  /** 开没开、公钥、几点提醒。学生端据此决定显不显示开关 —— 公钥不编进前端。
   *  S08：只读环境变量，零写库 —— 教师只读视角可读。 */
  @Public()
  @RequireStudentReadToken()
  @Get('config')
  config(@Req() req: Request) {
    studentIdOf(req);
    return this.service.config();
  }

  /** 登记这台设备。限流按学生不按 IP —— 全班共用学校出口 IP。 */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 10, windowSec: 60, scope: 'user' })
  @Post('subscribe')
  async subscribe(@Req() req: Request, @Body() body: unknown) {
    const studentId = studentIdOf(req);
    const parsed = SubscribeBody.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException({ code: 'bad_subscription' });
    return this.service.subscribe(studentId, parsed.data, req.headers['user-agent']);
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 10, windowSec: 60, scope: 'user' })
  @Post('unsubscribe')
  async unsubscribe(@Req() req: Request, @Body() body: unknown) {
    const studentId = studentIdOf(req);
    const parsed = EndpointBody.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException({ code: 'bad_subscription' });
    return this.service.unsubscribe(studentId, parsed.data.endpoint);
  }

  /**
   * UI07（2026-09-11）：这台设备此刻是不是**当前账号**的订阅 → `{ subscribed }`。
   *
   * 学生端不再按「浏览器里有订阅」就显示已开启 —— 共用设备上那一行可能还
   * 属于上一个账号。用 POST 是为了把 endpoint 放进请求体，不进 URL、访问
   * 日志和 Referer。纯读取、零写库；身份只取令牌（请求体多一个字段都 400）。
   * 本人令牌才行：教师只读视角对它没有意义，且守卫对一切非 GET 都拒绝。
   */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'user' })
  @Post('status')
  @HttpCode(200)
  async status(@Req() req: Request, @Body() body: unknown) {
    const studentId = studentIdOf(req);
    const parsed = EndpointBody.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException({ code: 'bad_subscription' });
    return this.service.status(studentId, parsed.data.endpoint);
  }
}
