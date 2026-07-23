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
  ) {
    assertStudent(user);
    if (!files?.length) throw new BadRequestException('no files');
    return this.homework.addPages(user, assignmentId, files);
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
}
