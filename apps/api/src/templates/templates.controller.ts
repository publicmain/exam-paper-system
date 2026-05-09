import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { TemplatesService } from './templates.service';
import { AuthGuard, Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';

// Templates store the structural recipe used to generate papers (subject /
// component / topic mix / difficulty distribution). Tightening the body to
// known fields prevents an attacker from injecting arbitrary keys that the
// service might forward into Prisma `data: { ...dto }` and corrupt the row.
const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  subjectId: z.string().min(1).max(64),
  componentId: z.string().min(1).max(64).optional(),
  durationMin: z.number().int().min(1).max(600),
  totalMarks: z.number().int().min(1).max(1000),
  config: z.record(z.string(), z.any()),
  isSchoolDefault: z.boolean().optional(),
});
const UpdateTemplateSchema = CreateTemplateSchema.partial();

@Controller('templates')
@UseGuards(AuthGuard)
@Roles('admin', 'head_teacher', 'teacher')
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get() list(@CurrentUser() user: any) { return this.service.list(user.id); }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }
  @Post()
  create(@Body() body: unknown, @CurrentUser() user: any) {
    const parsed = CreateTemplateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.create(user.id, parsed.data);
  }
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateTemplateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.update(id, parsed.data);
  }
  @Delete(':id') del(@Param('id') id: string) { return this.service.remove(id); }
}
