import { Controller, ForbiddenException, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PrismaService } from '../common/prisma.service';
import { canActOnClass } from '../common/roles';
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
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  /** IDOR gate for class-scoped analytics. Regular teachers must be enrolled
   *  in classId (non-student); admin / head_teacher always pass. */
  private async assertClassAccess(user: { id: string; role: string }, classId: string) {
    const ok = await canActOnClass(this.prisma, user, classId);
    if (!ok) throw new ForbiddenException({ code: 'not_your_class' });
  }

  @Get('class/:classId/overview')
  async classOverview(@Param('classId') classId: string, @CurrentUser() user: any) {
    await this.assertClassAccess(user, classId);
    return this.analytics.classOverview(classId);
  }

  @Get('paper/:paperId/wrong-answers')
  async paperWrongAnswers(@Param('paperId') paperId: string, @CurrentUser() user: any) {
    // A teacher must own at least one assignment for this paper, or the paper
    // itself. Admin / head_teacher always pass.
    if (user.role !== 'admin' && user.role !== 'head_teacher') {
      const assignment = await this.prisma.paperAssignment.findFirst({
        where: {
          paperId,
          class: { enrollments: { some: { userId: user.id, role: { not: 'student' } } } },
        },
        select: { id: true },
      });
      if (!assignment) {
        const owns = await this.prisma.paper.findFirst({
          where: { id: paperId, ownerId: user.id },
          select: { id: true },
        });
        if (!owns) throw new ForbiddenException({ code: 'not_your_paper' });
      }
    }
    return this.analytics.paperWrongAnswers(paperId);
  }

  @Get('class/:classId/topic-mastery')
  async classTopicMastery(
    @Param('classId') classId: string,
    @CurrentUser() user: any,
    @Query('paperId') paperId?: string,
  ) {
    await this.assertClassAccess(user, classId);
    return this.analytics.classTopicMastery(classId, paperId || undefined);
  }

  @Get('student/:studentId/history')
  async studentHistory(@Param('studentId') studentId: string, @CurrentUser() user: any) {
    // Regular teachers must share at least one class with the student.
    if (user.role !== 'admin' && user.role !== 'head_teacher') {
      const student = await this.prisma.user.findUnique({
        where: { id: studentId },
        select: { id: true },
      });
      if (!student) throw new NotFoundException('student not found');
      const shared = await this.prisma.class.findFirst({
        where: {
          AND: [
            { enrollments: { some: { userId: studentId, role: 'student' } } },
            { enrollments: { some: { userId: user.id, role: { not: 'student' } } } },
          ],
        },
        select: { id: true },
      });
      if (!shared) throw new ForbiddenException({ code: 'not_your_student' });
    }
    return this.analytics.studentHistory(studentId);
  }
}
