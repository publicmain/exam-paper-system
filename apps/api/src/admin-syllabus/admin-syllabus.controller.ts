import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AdminSyllabusService } from './admin-syllabus.service';
import {
  CreateExamBoardSchema,
  CreateSubjectSchema,
  CreateComponentSchema,
  CreateTopicSchema,
  UpdateTopicSchema,
  UpdateExamBoardSchema,
  UpdateSubjectSchema,
  UpdateComponentSchema,
  ImportSyllabusSchema,
} from './dto';

/**
 * Admin-only mutation endpoints for the syllabus tree
 * (ExamBoard / Subject / SyllabusComponent / Topic).
 *
 * Read access for these tables already exists at GET /api/exam-boards,
 * /subjects, /components, /topics in `ReferenceController` and is open to
 * any authenticated user. Mutations are restricted to `admin` only — see
 * the authz checklist in MERGE_INSTRUCTIONS.md for the rationale on why
 * head_teacher is *not* granted access here.
 */
@Controller('admin-syllabus')
@Roles('admin')
export class AdminSyllabusController {
  constructor(private readonly svc: AdminSyllabusService) {}

  @Post('exam-boards')
  createExamBoard(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = CreateExamBoardSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.createExamBoard(parsed.data, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  @Post('subjects')
  createSubject(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = CreateSubjectSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.createSubject(parsed.data, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  @Post('components')
  createComponent(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = CreateComponentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.createComponent(parsed.data, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  @Post('topics')
  createTopic(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = CreateTopicSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.createTopic(parsed.data, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  @Patch('topics/:id')
  updateTopic(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const parsed = UpdateTopicSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.updateTopic(id, parsed.data, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  @Delete('topics/:id')
  deleteTopic(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    return this.svc.deleteTopic(id, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }

  // Fix #15: PATCH/DELETE for board / subject / component (was topic-only).

  @Patch('exam-boards/:id')
  updateExamBoard(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const parsed = UpdateExamBoardSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.updateExamBoard(id, parsed.data, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  @Delete('exam-boards/:id')
  deleteExamBoard(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    return this.svc.deleteExamBoard(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  @Patch('subjects/:id')
  updateSubject(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const parsed = UpdateSubjectSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.updateSubject(id, parsed.data, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  @Delete('subjects/:id')
  deleteSubject(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    return this.svc.deleteSubject(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  @Patch('components/:id')
  updateComponent(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const parsed = UpdateComponentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.updateComponent(id, parsed.data, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  @Delete('components/:id')
  deleteComponent(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    return this.svc.deleteComponent(id, { id: user.id, role: user.role, ip: req.ip ?? null });
  }

  @Post('import')
  importSyllabus(@Body() body: unknown, @CurrentUser() user: any, @Req() req: Request) {
    const parsed = ImportSyllabusSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.svc.importSyllabus(parsed.data, {
      id: user.id,
      role: user.role,
      ip: req.ip ?? null,
    });
  }
}
