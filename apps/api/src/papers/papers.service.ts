import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { GenerationService } from './generation.service';
import { GeneratePaperDto, UpdatePaperQuestionDto } from './dto';
import { PaperStatus, Prisma } from '@prisma/client';

@Injectable()
export class PapersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generation: GenerationService,
  ) {}

  list(userId: string) {
    return this.prisma.paper.findMany({
      where: { ownerId: userId },
      include: { subject: true, component: true, _count: { select: { questions: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(id: string) {
    const p = await this.prisma.paper.findUnique({
      where: { id },
      include: {
        subject: { include: { examBoard: true } },
        component: true,
        questions: {
          include: {
            question: { include: { primaryTopic: true, assets: true, component: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!p) throw new NotFoundException('Paper not found');
    return p;
  }

  async generate(userId: string, dto: GeneratePaperDto) {
    let config = dto.config;
    if (dto.templateId) {
      const tpl = await this.prisma.paperTemplate.findUnique({ where: { id: dto.templateId } });
      if (!tpl) throw new NotFoundException('Template not found');
      config = config ?? {
        subjectId: tpl.subjectId,
        componentId: tpl.componentId ?? undefined,
        durationMin: tpl.durationMin,
        totalMarks: tpl.totalMarks,
        ...((tpl.config as any) ?? {}),
        questionMix: ((tpl.config as any)?.questionMix) ?? [],
      };
    }
    if (!config) throw new BadRequestException('Generation config is required.');

    const result = await this.generation.generate(config);

    const paper = await this.prisma.paper.create({
      data: {
        ownerId: userId,
        templateId: dto.templateId,
        name: dto.name,
        classLabel: dto.classLabel,
        examDate: dto.examDate ? new Date(dto.examDate) : undefined,
        subjectId: config.subjectId,
        componentId: config.componentId,
        durationMin: config.durationMin,
        totalMarksTarget: config.totalMarks,
        totalMarksActual: result.totalMarks,
        status: PaperStatus.draft,
        generatedSeed: result.seed,
        config: config as any,
        questions: {
          create: result.questions.map((q, idx) => ({
            questionId: q.id,
            sortOrder: idx,
            snapshotContent: q.content as any,
            snapshotAnswer: q.answerContent as any,
            snapshotOptions: (q.options as any) ?? null,
            marks: q.marks,
          })),
        },
      },
      include: {
        questions: { include: { question: true } },
      },
    });

    // log usage
    await this.prisma.questionUsageLog.createMany({
      data: result.questions.map(q => ({
        questionId: q.id, paperId: paper.id, classLabel: dto.classLabel,
      })),
    });

    // initial version
    await this.prisma.paperVersion.create({
      data: {
        paperId: paper.id,
        versionNumber: 1,
        snapshot: paper as any,
        changedById: userId,
        changeNote: 'generated',
      },
    });

    return { paper, warnings: result.warnings };
  }

  async updatePaper(id: string, data: { name?: string; classLabel?: string; examDate?: string; status?: PaperStatus }) {
    const update: any = {};
    if (data.name) update.name = data.name;
    if (data.classLabel !== undefined) update.classLabel = data.classLabel;
    if (data.examDate) update.examDate = new Date(data.examDate);
    if (data.status) update.status = data.status;
    return this.prisma.paper.update({ where: { id }, data: update });
  }

  async updateQuestion(paperId: string, pqId: string, dto: UpdatePaperQuestionDto) {
    const pq = await this.prisma.paperQuestion.findUnique({ where: { id: pqId } });
    if (!pq || pq.paperId !== paperId) throw new NotFoundException();

    if (dto.action === 'delete') {
      await this.prisma.paperQuestion.delete({ where: { id: pqId } });
      await this.recompactSortOrder(paperId);
    } else if (dto.action === 'reorder' && typeof dto.newSortOrder === 'number') {
      await this.reorder(paperId, pqId, dto.newSortOrder);
    } else if (dto.action === 'edit') {
      await this.prisma.paperQuestion.update({
        where: { id: pqId },
        data: {
          // class-validator @IsObject is stricter than Prisma's JsonValue.
          // Cast through any at the boundary so the runtime check still
          // applies but Prisma is happy with the JSON column write.
          overrideContent: (dto.overrideContent ?? pq.overrideContent ?? undefined) as any,
          overrideAnswer: (dto.overrideAnswer ?? pq.overrideAnswer ?? undefined) as any,
        },
      });
    } else if (dto.action === 'replace' && dto.replacementQuestionId) {
      const newQ = await this.prisma.question.findUnique({ where: { id: dto.replacementQuestionId } });
      if (!newQ) throw new NotFoundException('Replacement question not found');
      await this.prisma.paperQuestion.update({
        where: { id: pqId },
        data: {
          questionId: newQ.id,
          snapshotContent: newQ.content as any,
          snapshotAnswer: newQ.answerContent as any,
          snapshotOptions: (newQ.options as any) ?? null,
          overrideContent: Prisma.JsonNull,
          overrideAnswer: Prisma.JsonNull,
          marks: newQ.marks,
        },
      });
      await this.prisma.questionUsageLog.create({ data: { questionId: newQ.id, paperId } });
    } else {
      throw new BadRequestException('Invalid action');
    }

    await this.recomputeTotalMarks(paperId);
    return { ok: true };
  }

  async findReplacements(paperId: string, pqId: string) {
    const pq = await this.prisma.paperQuestion.findUnique({ where: { id: pqId } });
    if (!pq) throw new NotFoundException();
    return this.generation.findReplacement({ paperId, questionId: pq.questionId });
  }

  async saveVersion(paperId: string, userId: string, note?: string) {
    const lastVer = await this.prisma.paperVersion.findFirst({
      where: { paperId }, orderBy: { versionNumber: 'desc' },
    });
    const paper = await this.get(paperId);
    return this.prisma.paperVersion.create({
      data: {
        paperId,
        versionNumber: (lastVer?.versionNumber ?? 0) + 1,
        snapshot: paper as any,
        changedById: userId,
        changeNote: note,
      },
    });
  }

  async listVersions(paperId: string) {
    return this.prisma.paperVersion.findMany({
      where: { paperId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, changedAt: true, changeNote: true, changedById: true },
    });
  }

  private async recompactSortOrder(paperId: string) {
    const all = await this.prisma.paperQuestion.findMany({
      where: { paperId }, orderBy: { sortOrder: 'asc' },
    });
    for (let i = 0; i < all.length; i++) {
      if (all[i].sortOrder !== i) {
        await this.prisma.paperQuestion.update({ where: { id: all[i].id }, data: { sortOrder: i } });
      }
    }
  }

  private async reorder(paperId: string, pqId: string, newSortOrder: number) {
    const all = await this.prisma.paperQuestion.findMany({
      where: { paperId }, orderBy: { sortOrder: 'asc' },
    });
    const idx = all.findIndex(p => p.id === pqId);
    if (idx === -1) return;
    const [moved] = all.splice(idx, 1);
    const dest = Math.max(0, Math.min(newSortOrder, all.length));
    all.splice(dest, 0, moved);
    for (let i = 0; i < all.length; i++) {
      await this.prisma.paperQuestion.update({ where: { id: all[i].id }, data: { sortOrder: i } });
    }
  }

  private async recomputeTotalMarks(paperId: string) {
    const sum = await this.prisma.paperQuestion.aggregate({
      where: { paperId }, _sum: { marks: true },
    });
    await this.prisma.paper.update({
      where: { id: paperId },
      data: { totalMarksActual: sum._sum.marks ?? 0 },
    });
  }
}
