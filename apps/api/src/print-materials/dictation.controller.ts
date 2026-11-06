import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { DictationService } from './dictation.service';

const RequestId = z.string().min(8).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const Dates = z.object({ learnedDate: z.string().optional(), heldOn: z.string().optional() }).strict();
export const EntrySchema = z.object({ requestId: RequestId, status: z.enum(['entered', 'absent']), wrongSenseIds: z.array(z.string().min(1)).max(500).default([]) }).strict();
const Bulk = z.object({ requestId: RequestId, excludedStudentIds: z.array(z.string().min(1).max(200)).max(1000).default([]) }).strict();
function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException({ code: 'invalid_dictation_input' });
  return result.data;
}
@Controller('classes/:classId/dictation')
@Roles('admin', 'head_teacher', 'teacher')
export class DictationController {
  constructor(private readonly service: DictationService) {}
  @Get()
  get(@CurrentUser() actor: { id: string; role: string }, @Param('classId') classId: string, @Query() query: unknown) {
    const dates = parse(Dates, query);
    return this.service.get(actor, classId, dates.learnedDate, dates.heldOn);
  }
  @Post()
  generate(@CurrentUser() actor: { id: string; role: string }, @Param('classId') classId: string, @Body() body: unknown, @Req() req: Request) {
    const dates = parse(Dates, body);
    return this.service.generate({ ...actor, ip: req.ip }, classId, dates.learnedDate, dates.heldOn);
  }
  @Post(':sheetId/students/:studentId')
  save(@CurrentUser() actor: { id: string; role: string }, @Param('classId') classId: string, @Param('sheetId') sheetId: string,
    @Param('studentId') studentId: string, @Body() body: unknown, @Req() req: Request) {
    return this.service.save({ ...actor, ip: req.ip }, classId, sheetId, studentId, parse(EntrySchema, body));
  }
  @Post(':sheetId/remaining-correct')
  remaining(@CurrentUser() actor: { id: string; role: string }, @Param('classId') classId: string, @Param('sheetId') sheetId: string,
    @Body() body: unknown, @Req() req: Request) {
    return this.service.save({ ...actor, ip: req.ip }, classId, sheetId, null, { ...parse(Bulk, body), status: 'entered', wrongSenseIds: [] });
  }
}
