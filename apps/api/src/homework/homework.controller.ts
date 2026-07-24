import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth.guard';
import { isTeacherOrAbove } from '../common/roles';
import { HomeworkService, UploadedFileLike } from './homework.service';

const CreateCourseSchema = z.object({
  name: z.string().min(1).max(160),
  subjectId: z.string().optional(),
});

const UpdateCourseSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  subjectId: z.string().nullable().optional(),
  archived: z.boolean().optional(),
});

const CreateHomeworkSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1).max(200),
  instructions: z.string().max(5000).optional(),
  totalMarks: z.number().int().min(1).max(500).optional(),
});

const UpdateHomeworkSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  instructions: z.string().max(5000).nullable().optional(),
  totalMarks: z.number().int().min(1).max(500).nullable().optional(),
  archived: z.boolean().optional(),
});

const AssignSchema = z.object({
  classId: z.string().min(1),
  startAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
  allowLate: z.boolean().optional(),
});

const UpdateAssignmentSchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  allowLate: z.boolean().optional(),
});

const ReturnSchema = z.object({
  teacherScore: z.number().min(0).max(1000).optional(),
  teacherComment: z.string().max(5000).optional(),
});

// M3
const RubricSchema = z.object({
  questions: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        maxMarks: z.number().int().min(1).max(200),
        criteria: z.string().max(5000).optional(),
      }),
    )
    .max(50),
});

const SaveGradesSchema = z.object({
  grades: z
    .array(
      z.object({
        questionId: z.string().min(1),
        awardedMarks: z.number().min(0).max(1000).nullable(),
        comment: z.string().max(3000).optional(),
      }),
    )
    .min(1)
    .max(50),
});

const AiGradesSchema = z.object({
  grades: z
    .array(
      z.object({
        questionId: z.string().min(1),
        awardedMarks: z.number().min(0).max(1000).nullable(),
        confidence: z.number().min(0).max(1).optional(),
        rationale: z.string().max(2000).optional(),
        comment: z.string().max(3000).optional(),
      }),
    )
    .min(1)
    .max(50),
});

const PublishSchema = z.object({
  teacherComment: z.string().max(5000).optional(),
});

const UPLOAD_LIMITS = { fileSize: 25 * 1024 * 1024 };

function assertTeacher(user: AuthUser) {
  if (!isTeacherOrAbove(user.role)) throw new ForbiddenException('teachers only');
}

function parse<T>(schema: { safeParse: (v: unknown) => any }, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new BadRequestException(r.error.issues?.[0]?.message ?? 'invalid body');
  return r.data as T;
}

@Controller()
export class HomeworkController {
  constructor(private readonly homework: HomeworkService) {}

  // ---------- Courses ----------

  @Get('courses')
  listCourses(@CurrentUser() user: AuthUser, @Query('includeArchived') includeArchived?: string) {
    assertTeacher(user);
    return this.homework.listCourses(includeArchived === 'true');
  }

  @Post('courses')
  createCourse(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    assertTeacher(user);
    return this.homework.createCourse(user, parse(CreateCourseSchema, body));
  }

  @Patch('courses/:id')
  updateCourse(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    assertTeacher(user);
    return this.homework.updateCourse(user, id, parse(UpdateCourseSchema, body));
  }

  // ---------- Homework ----------

  @Get('homework')
  listHomework(@CurrentUser() user: AuthUser, @Query('courseId') courseId: string) {
    assertTeacher(user);
    if (!courseId) throw new BadRequestException('courseId required');
    return this.homework.listHomework(courseId);
  }

  /** AI-grading queue — declared before homework/:id so the literal path wins.
   *  Lists submitted-but-ungraded submissions with a rubric + answer pages. */
  @Get('homework/grading-queue')
  gradingQueue(@CurrentUser() user: AuthUser, @Query('classId') classId?: string) {
    assertTeacher(user);
    return this.homework.gradingQueue(user, { classId });
  }

  @Get('homework/:id')
  getHomework(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertTeacher(user);
    return this.homework.getHomework(id);
  }

  @Post('homework')
  createHomework(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    assertTeacher(user);
    return this.homework.createHomework(user, parse(CreateHomeworkSchema, body));
  }

  @Patch('homework/:id')
  updateHomework(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    assertTeacher(user);
    return this.homework.updateHomework(user, id, parse(UpdateHomeworkSchema, body));
  }

  @Post('homework/:id/files')
  @UseInterceptors(FilesInterceptor('files', 10, { limits: UPLOAD_LIMITS }))
  uploadFiles(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFiles() files: UploadedFileLike[],
  ) {
    assertTeacher(user);
    if (!files?.length) throw new BadRequestException('no files');
    return this.homework.addFiles(user, id, files);
  }

  @Delete('homework-files/:fileId')
  deleteFile(@CurrentUser() user: AuthUser, @Param('fileId') fileId: string) {
    assertTeacher(user);
    return this.homework.deleteFile(user, fileId);
  }

  /** Bytes of an uploaded homework file. Reachable by teachers and by
   *  students the homework is assigned to (checked in the service). */
  @Get('homework-files/:fileId/content')
  async fileContent(
    @CurrentUser() user: AuthUser,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const file = await this.homework.getFileForServing(user, fileId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    );
    fs.createReadStream(this.homework.absolutePath(file.storagePath)).pipe(res);
  }

  // ---------- Assignments / dashboard ----------

  @Post('homework/:id/assign')
  assign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    assertTeacher(user);
    return this.homework.assign(user, id, parse(AssignSchema, body));
  }

  @Patch('homework-assignments/:id')
  updateAssignment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    assertTeacher(user);
    return this.homework.updateAssignment(user, id, parse(UpdateAssignmentSchema, body));
  }

  @Get('homework-assignments/:id/dashboard')
  dashboard(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertTeacher(user);
    return this.homework.dashboard(user, id);
  }

  @Get('homework-submissions/:id')
  submission(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertTeacher(user);
    return this.homework.getSubmissionForTeacher(user, id);
  }

  @Post('homework-submissions/:id/return')
  returnSubmission(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    assertTeacher(user);
    return this.homework.returnSubmission(user, id, parse(ReturnSchema, body));
  }

  // ---------- M3: rubric + per-question grading ----------

  @Put('homework/:id/rubric')
  setRubric(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    assertTeacher(user);
    return this.homework.setRubric(user, id, parse<{ questions: any[] }>(RubricSchema, body).questions);
  }

  @Put('homework-submissions/:id/grades')
  saveGrades(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    assertTeacher(user);
    return this.homework.saveGrades(user, id, parse<{ grades: any[] }>(SaveGradesSchema, body).grades);
  }

  @Put('homework-submissions/:id/ai-grades')
  saveAiGrades(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    assertTeacher(user);
    return this.homework.saveAiSuggestions(user, id, parse<{ grades: any[] }>(AiGradesSchema, body).grades);
  }

  @Post('homework-submissions/:id/publish')
  publishGrades(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    assertTeacher(user);
    return this.homework.publishGrades(user, id, parse<{ teacherComment?: string }>(PublishSchema, body).teacherComment);
  }

  /** Page bytes: owning student or class teacher (checked in service). */
  @Get('homework-pages/:pageId/content')
  async pageContent(
    @CurrentUser() user: AuthUser,
    @Param('pageId') pageId: string,
    @Res() res: Response,
  ) {
    const page = await this.homework.getPageForServing(user, pageId);
    res.setHeader('Content-Type', page.mimeType);
    res.setHeader('Content-Disposition', 'inline');
    fs.createReadStream(this.homework.absolutePath(page.storagePath)).pipe(res);
  }
}
