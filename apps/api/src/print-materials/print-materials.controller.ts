import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { Public, Roles } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import { RequireStudentReadToken, StudentIdentityGuard } from '../common/student-identity.guard';
import { PrintMaterialsService } from './print-materials.service';

function studentIdOf(req: Request): string {
  const id = (req as Request & { studentAuth?: { id?: string } }).studentAuth?.id;
  if (!id) throw new BadRequestException({ code: 'student_required' });
  return id;
}

/** 学生：打印自己班的阅读、自己的单词。纯读取，教师只读视角也能看。 */
@UseGuards(StudentIdentityGuard)
@Controller('print-materials/me')
export class PrintMaterialsStudentController {
  constructor(private readonly service: PrintMaterialsService) {}

  @Public()
  @RequireStudentReadToken()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'user' })
  @Get('reading/:sessionId')
  reading(@Req() req: Request, @Param('sessionId') sessionId: string) {
    return this.service.studentReading(studentIdOf(req), sessionId);
  }

  @Public()
  @RequireStudentReadToken()
  @RateLimit({ limit: 60, windowSec: 60, scope: 'user' })
  @Get('words')
  words(@Req() req: Request, @Query('date') date = '') {
    return this.service.studentWords(studentIdOf(req), date);
  }
}

/** 老师：一个班某一天的阅读（每档一份，可带答案）和每个学生的单词。 */
@Controller('print-materials/classes')
@Roles('admin', 'head_teacher', 'teacher')
export class PrintMaterialsTeacherController {
  constructor(private readonly service: PrintMaterialsService) {}

  @Get(':classId/date/:date')
  classDay(
    @CurrentUser() user: { id: string; role: string },
    @Param('classId') classId: string,
    @Param('date') date: string,
    @Query('answers') answers?: string,
  ) {
    return this.service.classDay(user, classId, date, answers === '1' || answers === 'true');
  }
}
