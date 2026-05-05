import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { GenerateForClassSchema } from './dto';
import { PaperVariantsService } from './paper-variants.service';

/**
 * Teacher-facing variant routes. Note the controller-level @Roles —
 * the AuthGuard rejects any caller whose role isn't in the set
 * BEFORE the handler runs.
 *
 * The student-facing read route lives below in
 * StudentVariantController so we can apply a different role gate
 * (admin/teacher OR the student themself reading their own row).
 */
@Controller('paper-variants')
@Roles('admin', 'head_teacher', 'teacher')
export class PaperVariantsController {
  constructor(private readonly variants: PaperVariantsService) {}

  /** Bulk-generate variants for every student enrolled in the
   *  assignment's class. Idempotent: running twice on the same
   *  (assignment, student) yields the same seed because the seed is
   *  derived from (assignmentId, studentId). */
  @Post('generate-for-class')
  generateForClass(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = GenerateForClassSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.variants.generateForClass(
      parsed.data.assignmentId,
      parsed.data.mode,
      { id: user.id, role: user.role, ip: req.ip ?? null },
    );
  }

  /** List variants for an assignment so the teacher can preview which
   *  student got which form. */
  @Get('assignment/:assignmentId')
  listForAssignment(@Param('assignmentId') assignmentId: string) {
    return this.variants.listForAssignment(assignmentId);
  }
}

/**
 * Student-facing variant lookup. Path is intentionally identical to
 * what the brief specified (so MERGE_INSTRUCTIONS lines up). We
 * cannot use the controller-level @Roles to allow both staff and
 * the student themself, so we lock the controller to roles that can
 * possibly hit the route, then narrow inside the handler:
 *   - student: only when user.id === :studentId
 *   - teacher / head_teacher / admin: always allowed
 */
@Controller('paper-variants')
@Roles('admin', 'head_teacher', 'teacher', 'student')
export class StudentVariantController {
  constructor(private readonly variants: PaperVariantsService) {}

  @Get('student/:studentId/assignment/:assignmentId')
  get(
    @Param('studentId') studentId: string,
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: any,
  ) {
    if (user.role === 'student' && user.id !== studentId) {
      throw new ForbiddenException('students can only read their own variant');
    }
    return this.variants.getForStudent(studentId, assignmentId);
  }
}
