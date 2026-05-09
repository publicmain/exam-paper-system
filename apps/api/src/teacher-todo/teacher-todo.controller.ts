import { Controller, ForbiddenException, Get, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { TeacherTodoService } from './teacher-todo.service';

const TEACHER_ROLES = new Set(['teacher', 'head_teacher', 'admin']);

@Controller()
export class TeacherTodoController {
  constructor(private readonly svc: TeacherTodoService) {}

  /** F1 — today's teacher-todo aggregate.
   *  ?format=digest returns the wechat-style markdown text used by the
   *  morning + evening cron job; default JSON shape is the dashboard
   *  payload. */
  @Get('teacher/todo/today')
  async today(
    @CurrentUser() user: any,
    @Query('format') format?: string,
  ): Promise<any> {
    if (!TEACHER_ROLES.has(user.role)) {
      throw new ForbiddenException('teacher / head_teacher / admin only');
    }
    const payload = await this.svc.today();
    if (format === 'digest') {
      return { digest: this.svc.formatDigest(payload) };
    }
    return payload;
  }

  /** F4 — per-student weakness profile (last 30 days, by Question.tag). */
  @Get('students/:id/weakness-profile')
  async weakness(@Param('id') id: string, @CurrentUser() user: any) {
    if (!TEACHER_ROLES.has(user.role) && user.id !== id) {
      throw new ForbiddenException('not allowed to view this student');
    }
    return this.svc.weaknessProfile(id);
  }
}
