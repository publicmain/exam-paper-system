import { BadRequestException, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { RateLimit } from '../common/rate-limit.guard';
import { RequireStudentToken, StudentIdentityGuard } from '../common/student-identity.guard';

/**
 * 给单个学生的警告弹窗（2026-09-24，叶老师：糊弄交卷的学生下次打开 App 要看到专属警告）。
 *
 * 数据用现成的 `Notification` 表（userId / type / title / body / readAt）。学生端**只认
 * `STUDENT_POPUP_TYPES` 里的类型** —— 这张表原来还给旧版作业系统发 hw_assigned 之类的通知，
 * 那些不能弹到新 App 里。只读自己的、只能确认自己的。教师只读视角拿不到（要学生本人令牌），
 * 免得老师预览时被一个关不掉的弹窗挡住。
 */
export const STUDENT_POPUP_TYPES = ['effort_warning'] as const;

function studentIdOf(req: Request): string {
  const id = (req as Request & { studentAuth?: { id?: string } }).studentAuth?.id;
  if (!id) throw new BadRequestException({ code: 'student_required' });
  return id;
}

@UseGuards(StudentIdentityGuard)
@Controller('student-notices')
export class StudentNoticesController {
  constructor(private readonly prisma: PrismaService) {}

  /** 还没确认过的警告，早的在前。 */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'user' })
  @Get()
  async list(@Req() req: Request) {
    const rows = await this.prisma.notification.findMany({
      where: { userId: studentIdOf(req), type: { in: [...STUDENT_POPUP_TYPES] }, readAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, type: true, title: true, body: true, createdAt: true },
      take: 5,
    });
    return { items: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })) };
  }

  /** 学生点了「我知道了」。重复点是幂等的；别人的 / 别的类型 → 404。 */
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'user' })
  @Post(':id/read')
  async read(@Req() req: Request, @Param('id') id: string) {
    const studentId = studentIdOf(req);
    const row = await this.prisma.notification.findFirst({
      where: { id, userId: studentId, type: { in: [...STUDENT_POPUP_TYPES] } },
      select: { id: true, readAt: true },
    });
    if (!row) throw new NotFoundException({ code: 'notice_not_found' });
    if (!row.readAt) {
      await this.prisma.notification.updateMany({ where: { id, userId: studentId, readAt: null }, data: { readAt: new Date() } });
    }
    return { ok: true };
  }
}
