import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { Public } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RateLimit } from '../common/rate-limit.guard';
import {
  RequireStudentReadToken,
  RequireStudentToken,
  StudentIdentityGuard,
} from '../common/student-identity.guard';
import { AchievementsService } from './achievements.service';

function studentIdOf(req: Request): string {
  const id = (req as Request & { studentAuth?: { id?: string } }).studentAuth?.id;
  if (!id) throw new BadRequestException({ code: 'student_required' });
  return id;
}

/**
 * 个人徽章与班级周目标（F05）—— 学生端。身份只来自令牌，没有任何查询参数。
 * 两个 GET 零写库 → 教师只读视角可读；落库只有 `POST /achievements/sync`（本人令牌）。
 */
@UseGuards(StudentIdentityGuard)
@Controller(['achievements', 'student/achievements'])
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Public()
  @RequireStudentReadToken()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'user' })
  @Get()
  mine(@Req() req: Request) {
    return this.achievements.forStudent(studentIdOf(req));
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 20, windowSec: 60, scope: 'user' })
  @Post('sync')
  @HttpCode(200)
  sync(@Req() req: Request) {
    return this.achievements.sync(studentIdOf(req));
  }

  @Public()
  @RequireStudentReadToken()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'user' })
  @Get('notices')
  notices(@Req() req: Request) {
    return this.achievements.notices(studentIdOf(req));
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'user' })
  @Post('notices/claim')
  @HttpCode(200)
  claim(@Req() req: Request, @Body() body: unknown) {
    return this.achievements.claimNotices(studentIdOf(req), parseKeys(body));
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'user' })
  @Post('notices/viewed')
  @HttpCode(200)
  viewed(@Req() req: Request, @Body() body: unknown) {
    return this.achievements.viewNotices(studentIdOf(req), parseKeys(body));
  }

  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'user' })
  @Get('classmates')
  classmates(@Req() req: Request) {
    return this.achievements.classmates(studentIdOf(req));
  }

  @Public()
  @RequireStudentReadToken()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'user' })
  @Get('class-goals')
  classGoals(@Req() req: Request) {
    return this.achievements.classGoalsForStudent(studentIdOf(req));
  }
}

const NoticeKeys = z.object({ keys: z.array(z.string().max(40)).max(16) }).strict();
function parseKeys(body: unknown): string[] {
  const parsed = NoticeKeys.safeParse(body);
  if (!parsed.success) throw new BadRequestException({ code: 'invalid_badge_keys' });
  return parsed.data.keys;
}

const GoalBody = z.object({ enabled: z.boolean() }).strict();
const RevokeBody = z.object({ reason: z.string().trim().min(2).max(200) }).strict();
const RestoreBody = z.object({ note: z.string().trim().max(200).optional().nullable() }).strict();

/**
 * 老师：班级周目标开关、学生徽章查看 / 撤销 / 恢复（F05 / F06）。
 * 走全局登录守卫（教职工 JWT）；角色与班级范围在服务里核，写操作全部留审计。
 */
@Controller('teaching')
export class AchievementsTeachingController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get('classes/:classId/weekly-goal')
  weeklyGoal(@CurrentUser() user: any, @Req() req: Request, @Param('classId') classId: string) {
    return this.achievements.weeklyGoalForTeacher({ id: user?.id, role: user?.role, ip: req.ip ?? null }, classId);
  }

  @Post('classes/:classId/weekly-goal')
  @HttpCode(200)
  setWeeklyGoal(@CurrentUser() user: any, @Req() req: Request, @Param('classId') classId: string, @Body() body: unknown) {
    const parsed = GoalBody.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException({ code: 'bad_weekly_goal' });
    return this.achievements.setWeeklyGoal({ id: user?.id, role: user?.role, ip: req.ip ?? null }, classId, parsed.data.enabled);
  }

  @Get('classes/:classId/students/:studentId/badges')
  studentBadges(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Param('classId') classId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.achievements.studentBadgesForTeacher({ id: user?.id, role: user?.role, ip: req.ip ?? null }, classId, studentId);
  }

  @Post('classes/:classId/students/:studentId/badges/:badgeKey/revoke')
  @HttpCode(200)
  revoke(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Param('classId') classId: string,
    @Param('studentId') studentId: string,
    @Param('badgeKey') badgeKey: string,
    @Body() body: unknown,
  ) {
    const parsed = RevokeBody.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException({ code: 'revoke_reason_required' });
    return this.achievements.revokeBadge({ id: user?.id, role: user?.role, ip: req.ip ?? null }, classId, studentId, badgeKey, parsed.data.reason);
  }

  @Post('classes/:classId/students/:studentId/badges/:badgeKey/restore')
  @HttpCode(200)
  restore(
    @CurrentUser() user: any,
    @Req() req: Request,
    @Param('classId') classId: string,
    @Param('studentId') studentId: string,
    @Param('badgeKey') badgeKey: string,
    @Body() body: unknown,
  ) {
    const parsed = RestoreBody.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException({ code: 'bad_restore' });
    return this.achievements.restoreBadge(
      { id: user?.id, role: user?.role, ip: req.ip ?? null },
      classId,
      studentId,
      badgeKey,
      parsed.data.note ?? null,
    );
  }
}
