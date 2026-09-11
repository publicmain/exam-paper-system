import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { AllowTeacherView } from '../common/student-access';
import { StudentService } from './student.service';
import {
  answerScriptView,
  assignmentListItemView,
  submissionRowView,
} from './student-submission-view';

const AssignSchema = z.object({
  classId: z.string(),
  startAt: z.string().datetime().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  durationMin: z.number().int().min(5).max(360).nullable().optional(),
});

const OpenSubmissionSchema = z.object({ assignmentId: z.string() });

const SaveScriptSchema = z.object({
  paperQuestionId: z.string(),
  selectedOption: z.string().max(2).nullable().optional(),
  textAnswer: z.string().max(20000).nullable().optional(),
});

const ROLES_TEACHER = new Set(['admin', 'head_teacher', 'teacher']);

@Controller()
export class StudentController {
  constructor(private readonly student: StudentService) {}

  /** Teacher: assign an existing paper to a class. */
  @Post('papers/:paperId/assign')
  assign(@Param('paperId') paperId: string, @Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    if (!ROLES_TEACHER.has(user.role)) {
      throw new ForbiddenException('teacher / head_teacher / admin only');
    }
    const parsed = AssignSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.student.assignPaperToClass(paperId, parsed.data, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  /** Student: list assignments for me. S08：纯读取，教师只读视角可读。
   *  S01：mySubmission 走字段白名单（未定稿不给分数）。 */
  @AllowTeacherView()
  @Get('student/assignments')
  async myAssignments(@CurrentUser() user: any) {
    if (user.role !== 'student') throw new ForbiddenException('student-only route');
    const rows = await this.student.listAssignmentsForStudent(user.id);
    return rows.map(assignmentListItemView);
  }

  /** Student: open / resume a submission. S01：返回答卷行的白名单。 */
  @Post('student/submissions')
  async openSubmission(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    if (user.role !== 'student') throw new ForbiddenException('student-only route');
    const parsed = OpenSubmissionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const row = await this.student.openSubmission(parsed.data.assignmentId,
      { id: user.id, role: user.role, ip: req.ip ?? null });
    return submissionRowView(row);
  }

  /** Student: autosave / overwrite an answer script.
   *  S01：只回作答本身 —— 能保存说明还在答题中，判分信息一概不给
   *  （系统收卷后重开的答卷，行上还留着旧的 autoCorrect）。 */
  @Patch('student/submissions/:id/scripts')
  async saveScript(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    if (user.role !== 'student') throw new ForbiddenException('student-only route');
    const parsed = SaveScriptSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const row = await this.student.saveScript(id, parsed.data, { id: user.id, role: user.role, ip: req.ip ?? null });
    return answerScriptView(row, { scoresShown: false, finallySubmitted: false });
  }

  /** Student: final submit. Auto-grades MCQ, leaves structured for marker.
   *  S01：返回答卷行的白名单 —— 交卷时的自动分只是客观题部分分，
   *  判分定稿之前不给（与阅读结果页同一个成绩发布口径）。 */
  @Post('student/submissions/:id/submit')
  async finalSubmit(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    if (user.role !== 'student') throw new ForbiddenException('student-only route');
    const row = await this.student.finalSubmit(id, { id: user.id, role: user.role, ip: req.ip ?? null });
    return submissionRowView(row);
  }

  /** Student: read own submission (during exam to refresh, after marking to review).
   *  S08：纯读取，教师只读视角可读；响应按答题状态白名单投影（S01）。 */
  @AllowTeacherView()
  @Get('student/submissions/:id')
  getOwn(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    if (user.role !== 'student') throw new ForbiddenException('student-only route');
    return this.student.getOwnSubmission(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }
}
