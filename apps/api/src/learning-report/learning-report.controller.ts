import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { LearningReportService } from './learning-report.service';
import { isDateKey } from './weekly-report';

/**
 * 学习周报（教师后台，2026-09-15）。只读。
 *
 *   GET /learning-report/week?weekStart=YYYY-MM-DD&classId=…
 *
 *   · `weekStart` 可以是这周里任何一天，服务端对齐到周一；不给就是本周。
 *   · `classId` 不给 = 能看的全部班；给了别人的班 → 403 `not_your_class`。
 *
 * 权限：管理员 / 班主任全校，任课老师只看自己教的班（服务里再按班核一次）。
 * 返回里有学生姓名和成绩 —— 学生令牌、家长、未登录一律进不来（`@Roles`）。
 */
@Controller('learning-report')
@Roles('admin', 'head_teacher', 'teacher')
export class LearningReportController {
  constructor(private readonly svc: LearningReportService) {}

  @Get('week')
  week(
    @CurrentUser() user: { id: string; role: string },
    @Query('weekStart') weekStart?: string,
    @Query('classId') classId?: string,
  ) {
    if (weekStart && !isDateKey(weekStart)) throw new BadRequestException({ code: 'bad_week_start' });
    if (classId && classId.length > 80) throw new BadRequestException({ code: 'bad_class_id' });
    return this.svc.weekly({ id: user.id, role: user.role }, { weekStart: weekStart || null, classId: classId || null });
  }
}
