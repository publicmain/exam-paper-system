import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../common/auth.guard';
import { AnalyticsService } from './analytics.service';

/**
 * Read-only analytics endpoints — class statistics + wrong-answer dashboard.
 *
 * Authorization: teacher / head_teacher / admin only.  Students must never
 * reach these (the AuthGuard will 401 them via @Roles).  See the
 * `@Roles` declaration on the controller class — every method below
 * inherits it, so adding a new endpoint to this controller automatically
 * picks up the same gate.  If a future endpoint needs admin-only, attach a
 * tighter @Roles decorator at the method level (it overrides class-level).
 */
@Controller('analytics')
@Roles('admin', 'head_teacher', 'teacher')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('class/:classId/overview')
  classOverview(@Param('classId') classId: string) {
    return this.analytics.classOverview(classId);
  }

  @Get('paper/:paperId/wrong-answers')
  paperWrongAnswers(@Param('paperId') paperId: string) {
    return this.analytics.paperWrongAnswers(paperId);
  }

  @Get('class/:classId/topic-mastery')
  classTopicMastery(
    @Param('classId') classId: string,
    @Query('paperId') paperId?: string,
  ) {
    return this.analytics.classTopicMastery(classId, paperId || undefined);
  }

  @Get('student/:studentId/history')
  studentHistory(@Param('studentId') studentId: string) {
    return this.analytics.studentHistory(studentId);
  }
}
