import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

interface TemplateInput {
  name: string;
  subjectId: string;
  componentId?: string;
  durationMin: number;
  totalMarks: number;
  config: any;
  isSchoolDefault?: boolean;
}

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.paperTemplate.findMany({
      where: { OR: [{ ownerId: userId }, { isSchoolDefault: true }] },
      include: { subject: true, component: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(id: string) {
    const t = await this.prisma.paperTemplate.findUnique({
      where: { id },
      include: { subject: true, component: true },
    });
    if (!t) throw new NotFoundException();
    return t;
  }

  create(userId: string, input: TemplateInput) {
    return this.prisma.paperTemplate.create({
      data: { ownerId: userId, ...input },
    });
  }

  update(id: string, input: Partial<TemplateInput>) {
    return this.prisma.paperTemplate.update({ where: { id }, data: input });
  }

  remove(id: string) { return this.prisma.paperTemplate.delete({ where: { id } }); }
}
