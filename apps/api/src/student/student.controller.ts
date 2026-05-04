import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { StudentService } from './student.service';

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

  /** Student: list assignments for me. */
  @Get('student/assignments')
  myAssignments(@CurrentUser() user: any) {
    if (user.role !== 'student') throw new ForbiddenException('student-only route');
    return this.student.listAssignmentsForStudent(user.id);
  }

  /** Student: open / resume a submission. */
  @Post('student/submissions')
  openSubmission(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    if (user.role !== 'student') throw new ForbiddenException('student-only route');
    const parsed = OpenSubmissionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.student.openSubmission(parsed.data.assignmentId,
      { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  /** Student: autosave / overwrite an answer script. */
  @Patch('student/submissions/:id/scripts')
  saveScript(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    if (user.role !== 'student') throw new ForbiddenException('student-only route');
    const parsed = SaveScriptSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.student.saveScript(id, parsed.data, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  /** Student: final submit. Auto-grades MCQ, leaves structured for marker. */
  @Post('student/submissions/:id/submit')
  finalSubmit(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    if (user.role !== 'student') throw new ForbiddenException('student-only route');
    return this.student.finalSubmit(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  /** Student: read own submission (during exam to refresh, after marking to review). */
  @Get('student/submissions/:id')
  getOwn(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    if (user.role !== 'student') throw new ForbiddenException('student-only route');
    return this.student.getOwnSubmission(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }
}
