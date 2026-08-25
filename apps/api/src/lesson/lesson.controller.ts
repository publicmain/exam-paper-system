import { BadRequestException, Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import { StudentIdentityGuard } from '../common/student-identity.guard';
import { PrismaService } from '../common/prisma.service';
import { canActOnClass } from '../common/roles';
import { LessonService } from './lesson.service';

/**
 * 每日一课（4.0 阶段 A，docs/PRD/morning-quiz-4.0-daily-lesson.md §5.2）。
 *
 * 全部只读 —— A 阶段是**影子运行**，这个模块不参与任何答题闸门。
 * 学生端沿用「公开 + 姓名匹配 + 带 token 时校验」的既有模式。
 */
@UseGuards(StudentIdentityGuard)
@Controller('lesson')
export class LessonController {
  constructor(
    private readonly svc: LessonService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 学生：今天的课。
   *
   * **这个接口会冻结当日目标**（首次调用时）—— 「学生打开了课程页」
   * 就是冻结时刻的定义。教师看板走 /class 那条，不冻结。
   */
  @Public()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'ip' })
  @Get('today')
  async today(@Query('name') name?: string, @Query('studentId') studentId?: string) {
    if (!name?.trim()) throw new BadRequestException({ code: 'name_required' });
    return this.svc.today({ studentName: name, studentId: studentId || undefined, freeze: true });
  }

  /** 教师：班级完成度看板。 */
  @Get('class')
  async classBoard(
    @Query('classId') classId: string,
    @Query('date') date: string | undefined,
    @CurrentUser() user: any,
  ) {
    if (!classId) throw new BadRequestException({ code: 'class_id_required' });
    if (!(await canActOnClass(this.prisma, { id: user.id, role: user.role }, classId))) {
      throw new ForbiddenException({ code: 'not_your_class' });
    }
    return this.svc.classBoard(classId, date);
  }
}
