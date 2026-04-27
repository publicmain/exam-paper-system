import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateQuestionDto, ListQuestionsQuery, UpdateQuestionDto } from './dto';
import { Prisma, QuestionStatus, SourceType } from '@prisma/client';

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListQuestionsQuery) {
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 200);

    const where: Prisma.QuestionWhereInput = {
      ...(q.subjectId && { subjectId: q.subjectId }),
      ...(q.componentId && { componentId: q.componentId }),
      ...(q.questionType && { questionType: q.questionType }),
      ...(q.status ? { status: q.status } : (q.includeDraft ? {} : { status: QuestionStatus.active })),
      ...(q.difficulty && { difficulty: Number(q.difficulty) }),
      ...((q.marksMin || q.marksMax) && {
        marks: {
          ...(q.marksMin && { gte: Number(q.marksMin) }),
          ...(q.marksMax && { lte: Number(q.marksMax) }),
        },
      }),
      ...(q.topicId && {
        OR: [
          { primaryTopicId: q.topicId },
          { topics: { some: { topicId: q.topicId } } },
        ],
      }),
    };

    const [total, items] = await Promise.all([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          primaryTopic: true,
          component: true,
          topics: { include: { topic: true } },
          assets: true,
        },
      }),
    ]);
    return { total, page, pageSize, items };
  }

  async get(id: string) {
    const q = await this.prisma.question.findUnique({
      where: { id },
      include: {
        primaryTopic: true,
        component: true,
        subject: { include: { examBoard: true } },
        topics: { include: { topic: true } },
        assets: true,
        versions: { orderBy: { versionNumber: 'desc' }, take: 10 },
      },
    });
    if (!q) throw new NotFoundException('Question not found');
    return q;
  }

  async create(dto: CreateQuestionDto, userId: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id: dto.subjectId } });
    if (!subject) throw new NotFoundException('Subject not found');

    const timePerMark = subject.code === '9702' ? 1.25 : 1.0;
    const estimated = dto.estimatedTimeMin ?? dto.marks * timePerMark;

    const q = await this.prisma.question.create({
      data: {
        subjectId: dto.subjectId,
        componentId: dto.componentId,
        primaryTopicId: dto.primaryTopicId,
        questionType: dto.questionType,
        marks: dto.marks,
        difficulty: dto.difficulty,
        sourceType: dto.sourceType ?? SourceType.original_school,
        sourceRef: dto.sourceRef,
        estimatedTimeMin: estimated,
        content: dto.content,
        answerContent: dto.answerContent,
        options: dto.options,
        markScheme: dto.markScheme,
        status: dto.status ?? QuestionStatus.draft,
        createdById: userId,
        topics: dto.topicIds && dto.topicIds.length > 0 ? {
          create: dto.topicIds.map(tid => ({ topicId: tid })),
        } : undefined,
      },
    });

    await this.prisma.questionVersion.create({
      data: {
        questionId: q.id, versionNumber: 1,
        snapshot: q as any, changedById: userId,
        changeNote: 'created',
      },
    });
    return q;
  }

  async update(id: string, dto: UpdateQuestionDto, userId: string) {
    const existing = await this.prisma.question.findUnique({
      where: { id },
      include: { topics: true },
    });
    if (!existing) throw new NotFoundException();

    const data: Prisma.QuestionUpdateInput = {};
    if (dto.questionType) data.questionType = dto.questionType;
    if (dto.marks != null) data.marks = dto.marks;
    if (dto.difficulty != null) data.difficulty = dto.difficulty;
    if (dto.sourceType) data.sourceType = dto.sourceType;
    if (dto.sourceRef !== undefined) data.sourceRef = dto.sourceRef;
    if (dto.estimatedTimeMin != null) data.estimatedTimeMin = dto.estimatedTimeMin;
    if (dto.content) data.content = dto.content;
    if (dto.answerContent) data.answerContent = dto.answerContent;
    if (dto.options !== undefined) data.options = dto.options;
    if (dto.markScheme !== undefined) data.markScheme = dto.markScheme;
    if (dto.status) data.status = dto.status;
    if (dto.primaryTopicId) {
      data.primaryTopic = { connect: { id: dto.primaryTopicId } };
    }

    const updated = await this.prisma.question.update({ where: { id }, data });

    if (dto.topicIds) {
      await this.prisma.questionTopic.deleteMany({ where: { questionId: id } });
      if (dto.topicIds.length) {
        await this.prisma.questionTopic.createMany({
          data: dto.topicIds.map(t => ({ questionId: id, topicId: t })),
        });
      }
    }

    const lastVer = await this.prisma.questionVersion.findFirst({
      where: { questionId: id }, orderBy: { versionNumber: 'desc' },
    });
    await this.prisma.questionVersion.create({
      data: {
        questionId: id,
        versionNumber: (lastVer?.versionNumber ?? 0) + 1,
        snapshot: updated as any,
        changedById: userId,
        changeNote: dto.changeNote ?? 'updated',
      },
    });

    return updated;
  }

  async delete(id: string) {
    return this.prisma.question.update({
      where: { id },
      data: { status: QuestionStatus.retired },
    });
  }

  async addAsset(questionId: string, asset: { assetType: string; storageUrl: string; altText?: string }) {
    return this.prisma.questionAsset.create({
      data: { questionId, ...asset },
    });
  }
}
