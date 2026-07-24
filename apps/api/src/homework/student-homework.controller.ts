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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../common/auth.guard';
import { ROLE_STUDENT } from '../common/roles';
import { HomeworkService, UploadedFileLike } from './homework.service';

const ReorderSchema = z.object({
  pageIds: z.array(z.string().min(1)).min(1).max(50),
});

const CreateInkSchema = z.object({
  width: z.number().int().min(50).max(4000),
  height: z.number().int().min(50).max(6000),
  backgroundFileId: z.string().min(1).optional(),
  // 1-based PDF page when the background file is a PDF.
  backgroundPage: z.number().int().min(1).max(500).optional(),
});

// strokes: [{ pts: [[x,y,pressure], ...], color, size }]. Kept loose on
// purpose — it's opaque replay data; the service caps its serialized size.
const SaveInkSchema = z.object({
  strokes: z.array(
    z.object({
      pts: z.array(z.array(z.number())).max(20000),
      color: z.string().max(32).optional(),
      size: z.number().optional(),
    }),
  ).max(2000),
});

function assertStudent(user: AuthUser) {
  if (user.role !== ROLE_STUDENT) throw new ForbiddenException('students only');
}

@Controller('student/homework')
export class StudentHomeworkController {
  constructor(private readonly homework: HomeworkService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    assertStudent(user);
    return this.homework.listForStudent(user);
  }

  @Get(':assignmentId')
  detail(@CurrentUser() user: AuthUser, @Param('assignmentId') assignmentId: string) {
    assertStudent(user);
    return this.homework.studentDetail(user, assignmentId);
  }

  /** Photo pages, multipart field name "pages". iPad Safari's
   *  <input accept="image/*" capture> hands over JPEGs directly. */
  @Post(':assignmentId/pages')
  @UseInterceptors(FilesInterceptor('pages', 15, { limits: { fileSize: 25 * 1024 * 1024 } }))
  addPages(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
    @UploadedFiles() files: UploadedFileLike[],
    @Query('source') source?: string,
  ) {
    assertStudent(user);
    if (!files?.length) throw new BadRequestException('no files');
    return this.homework.addPages(user, assignmentId, files, source === 'ink' ? 'ink' : 'upload');
  }

  @Delete('pages/:pageId')
  deletePage(@CurrentUser() user: AuthUser, @Param('pageId') pageId: string) {
    assertStudent(user);
    return this.homework.deletePage(user, pageId);
  }

  @Patch(':assignmentId/pages/reorder')
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
    @Body() body: unknown,
  ) {
    assertStudent(user);
    const r = ReorderSchema.safeParse(body);
    if (!r.success) throw new BadRequestException('invalid body');
    return this.homework.reorderPages(user, assignmentId, r.data.pageIds);
  }

  @Post(':assignmentId/submit')
  submit(@CurrentUser() user: AuthUser, @Param('assignmentId') assignmentId: string) {
    assertStudent(user);
    return this.homework.submit(user, assignmentId);
  }

  /** Withdraw to resubmit — only before any grading starts (checked in service). */
  @Post(':assignmentId/withdraw')
  withdraw(@CurrentUser() user: AuthUser, @Param('assignmentId') assignmentId: string) {
    assertStudent(user);
    return this.homework.withdraw(user, assignmentId);
  }

  // ---------- M2: handwriting (ink) ----------

  @Get(':assignmentId/ink')
  listInk(@CurrentUser() user: AuthUser, @Param('assignmentId') assignmentId: string) {
    assertStudent(user);
    return this.homework.listInk(user, assignmentId);
  }

  @Post(':assignmentId/ink')
  createInk(
    @CurrentUser() user: AuthUser,
    @Param('assignmentId') assignmentId: string,
    @Body() body: unknown,
  ) {
    assertStudent(user);
    const r = CreateInkSchema.safeParse(body);
    if (!r.success) throw new BadRequestException(r.error.issues?.[0]?.message ?? 'invalid body');
    return this.homework.createInkPage(user, assignmentId, r.data);
  }

  @Put('ink/:pageId')
  saveInk(@CurrentUser() user: AuthUser, @Param('pageId') pageId: string, @Body() body: unknown) {
    assertStudent(user);
    const r = SaveInkSchema.safeParse(body);
    if (!r.success) throw new BadRequestException('invalid body');
    return this.homework.saveInk(user, pageId, r.data.strokes);
  }

  @Delete('ink/:pageId')
  deleteInk(@CurrentUser() user: AuthUser, @Param('pageId') pageId: string) {
    assertStudent(user);
    return this.homework.deleteInkPage(user, pageId);
  }
}
