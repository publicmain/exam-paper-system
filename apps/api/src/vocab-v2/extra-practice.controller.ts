import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/auth.guard';
import { RateLimit } from '../common/rate-limit.guard';
import { RequireStudentToken, StudentIdentityGuard } from '../common/student-identity.guard';
import { ExtraPracticeService, extraResultSchema } from './extra-practice';

function studentId(req: Request) {
  const id = (req as Request & { studentAuth?: { id?: string } }).studentAuth?.id;
  if (!id) throw new BadRequestException({ code: 'student_required' });
  return id;
}
@UseGuards(StudentIdentityGuard)
@Controller('vocab-v2/extra')
export class ExtraPracticeController {
  constructor(private readonly service: ExtraPracticeService) {}
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 30, windowSec: 60, scope: 'user' })
  @Get('round')
  round(@Req() req: Request, @Query('drill') drill = '') {
    this.service.assertEnabled();
    if (drill !== 'type' && drill !== 'ladder' && drill !== 'shadow') throw new BadRequestException({ code: 'invalid_drill' });
    return this.service.round(studentId(req), drill);
  }
  @Public()
  @RequireStudentToken()
  @RateLimit({ limit: 120, windowSec: 60, scope: 'user' })
  @Post('result')
  result(@Req() req: Request, @Body() body: unknown) {
    this.service.assertEnabled();
    const parsed = extraResultSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'invalid_extra_result' });
    return this.service.result(studentId(req), parsed.data);
  }
}
