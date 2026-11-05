import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../common/auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PrismaService } from '../common/prisma.service';
import { canActOnClass } from '../common/roles';
import { dateOnly, nextDate, singaporeDate, validDate } from '../common/school-calendar';
import { z } from 'zod';

type Actor = { id: string; role: string };
const rangeSchema = z.object({
  from: z.string().refine(validDate), to: z.string().refine(validDate), reason: z.string().trim().max(200).optional(),
}).refine((v) => v.to >= v.from && dateOnly(v.to).getTime() - dateOnly(v.from).getTime() < 366 * 86400_000);

@Controller('classes/:classId/no-school-days')
@Roles('admin', 'head_teacher', 'teacher')
export class NoSchoolDaysController {
  constructor(private readonly prisma: PrismaService) {}

  private async access(actor: Actor, classId: string) {
    if (!await canActOnClass(this.prisma, actor, classId)) throw new ForbiddenException({ code: 'not_your_class' });
    if (!await this.prisma.class.findUnique({ where: { id: classId }, select: { id: true } })) throw new NotFoundException('找不到这个班');
  }

  @Get()
  async list(@CurrentUser() actor: Actor, @Param('classId') classId: string, @Query('period') period = 'all') {
    await this.access(actor, classId);
    if (!['all', 'past', 'future'].includes(period)) throw new BadRequestException('请选择过去或以后的日期');
    const today = dateOnly(singaporeDate(new Date()));
    return this.prisma.classNoSchoolDay.findMany({
      where: { classId, ...(period === 'past' ? { date: { lt: today } } : period === 'future' ? { date: { gte: today } } : {}) },
      orderBy: { date: 'asc' }, select: { id: true, date: true, reason: true },
    });
  }

  @Post()
  async add(@CurrentUser() actor: Actor, @Param('classId') classId: string, @Body() body: unknown) {
    await this.access(actor, classId);
    const parsed = rangeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('请填写有效日期，每次最多一年');
    const { from, to, reason } = parsed.data;
    const dates: string[] = [];
    for (let d = from; d <= to; d = nextDate(d, 1)) {
      dates.push(d);
      if (d === to) break;
    }
    return this.prisma.$transaction(async (tx) => {
      // Unique(classId,date) + skipDuplicates makes retries/concurrent adds safe.
      const result = await tx.classNoSchoolDay.createMany({
        data: dates.map((date) => ({ classId, date: dateOnly(date), reason: reason || null, createdById: actor.id })), skipDuplicates: true,
      });
      if (result.count) await tx.auditLog.create({ data: {
        actorId: actor.id, actorRole: actor.role, action: 'class.no_school_days.add', entityType: 'Class', entityId: classId,
        metadata: { from, to, reason: reason || null, added: result.count },
      } });
      return { added: result.count };
    });
  }

  @Delete(':date')
  async remove(@CurrentUser() actor: Actor, @Param('classId') classId: string, @Param('date') date: string) {
    await this.access(actor, classId);
    if (!validDate(date)) throw new BadRequestException('日期不正确');
    return this.prisma.$transaction(async (tx) => {
      const old = await tx.classNoSchoolDay.findUnique({ where: { classId_date: { classId, date: dateOnly(date) } } });
      const result = await tx.classNoSchoolDay.deleteMany({ where: { classId, date: dateOnly(date) } });
      if (result.count) await tx.auditLog.create({ data: {
        actorId: actor.id, actorRole: actor.role, action: 'class.no_school_days.remove', entityType: 'Class', entityId: classId,
        metadata: { date, reason: old?.reason ?? null },
      } });
      return { removed: result.count };
    });
  }
}
