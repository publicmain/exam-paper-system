import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  Prisma,
  QuestionStatus,
  QuestionType,
  ReviewStatus,
  SourceType,
} from '@prisma/client';

interface ActorCtx {
  id: string;
  role: string;
  ip?: string | null;
}

export interface ListReviewQuery {
  repoId?: string;
  syllabusCode?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateReviewItemDto {
  questionNumber?: string | null;
  rawExtractedText?: string | null;
  suggestedType?: QuestionType | null;
  suggestedMarks?: number | null;
  suggestedDifficulty?: number | null;
  suggestedTopicCode?: string | null;
  reviewNotes?: string | null;
}

const SEASON_TO_LETTER: Record<string, string> = { m: 'F', s: 'M', w: 'O' };
const SEASON_TO_LABEL: Record<string, string> = { m: 'F/M', s: 'M/J', w: 'O/N' };

@Injectable()
export class ReviewService {
  private readonly logger = new Logger('ReviewService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListReviewQuery) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(Math.max(1, Number(q.pageSize) || 25), 100);

    const where: Prisma.QuestionItemWhereInput = {
      ...(q.status ? { reviewStatus: q.status as ReviewStatus } : { reviewStatus: ReviewStatus.pending_review }),
      ...(q.repoId && { sourceFile: { repoId: q.repoId } }),
      ...(q.syllabusCode && { sourceFile: { syllabusCode: q.syllabusCode } }),
    };
    if (q.repoId && q.syllabusCode) {
      where.sourceFile = { repoId: q.repoId, syllabusCode: q.syllabusCode };
    }

    const [total, items] = await Promise.all([
      this.prisma.questionItem.count({ where }),
      this.prisma.questionItem.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          sourceFile: {
            select: {
              id: true,
              rawFilename: true,
              syllabusCode: true,
              examYear: true,
              examSeason: true,
              paperVariant: true,
              fileKind: true,
              repoId: true,
            },
          },
          markSchemeItems: { orderBy: { sortOrder: 'asc' } },
        },
      }),
    ]);
    return { total, page, pageSize, items };
  }

  async get(id: string) {
    const item = await this.prisma.questionItem.findUnique({
      where: { id },
      include: {
        sourceFile: {
          include: {
            pages: { orderBy: { pageNo: 'asc' }, select: { pageNo: true, imageUrl: true } },
          },
        },
        markSchemeItems: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!item) throw new NotFoundException('review item not found');
    return item;
  }

  async update(id: string, dto: UpdateReviewItemDto, actor: ActorCtx) {
    const existing = await this.prisma.questionItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('review item not found');
    if (existing.questionId) {
      throw new BadRequestException('item already approved — edit the Question instead');
    }
    const updated = await this.prisma.questionItem.update({
      where: { id },
      data: {
        questionNumber: dto.questionNumber ?? existing.questionNumber,
        rawExtractedText: dto.rawExtractedText ?? existing.rawExtractedText,
        suggestedType: dto.suggestedType ?? existing.suggestedType,
        suggestedMarks: dto.suggestedMarks ?? existing.suggestedMarks,
        suggestedDifficulty: dto.suggestedDifficulty ?? existing.suggestedDifficulty,
        suggestedTopicCode: dto.suggestedTopicCode ?? existing.suggestedTopicCode,
        reviewNotes: dto.reviewNotes ?? existing.reviewNotes,
      },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'review.item.update',
      entityType: 'question_item',
      entityId: id,
      diff: { before: existing as any, after: updated as any },
      ip: actor.ip ?? null,
    });
    return updated;
  }

  async reject(id: string, reason: string | undefined, actor: ActorCtx) {
    const existing = await this.prisma.questionItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('review item not found');
    const updated = await this.prisma.questionItem.update({
      where: { id },
      data: {
        reviewStatus: ReviewStatus.rejected,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewNotes: reason ?? existing.reviewNotes,
      },
    });
    await this.prisma.teacherReview.create({
      data: {
        questionItemId: id,
        reviewerId: actor.id,
        action: 'reject',
        notes: reason ?? null,
      },
    });
    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'review.item.reject',
      entityType: 'question_item',
      entityId: id,
      metadata: { reason: reason ?? null },
      ip: actor.ip ?? null,
    });
    return updated;
  }

  /**
   * Mirror a QuestionItem into a Question row that the paper generator
   * can pick. The QuestionItem stays as the audit / re-review handle and
   * its questionId points at the new row. Approval is the only path from
   * pending_review → live question bank.
   */
  async approve(id: string, actor: ActorCtx) {
    const item = await this.prisma.questionItem.findUnique({
      where: { id },
      include: {
        sourceFile: true,
        markSchemeItems: true,
      },
    });
    if (!item) throw new NotFoundException('review item not found');
    if (item.questionId) throw new BadRequestException('already approved');
    if (!item.sourceFile) throw new BadRequestException('item missing sourceFile');
    if (!item.suggestedType) {
      throw new BadRequestException('cannot approve: question type unset');
    }
    if (!item.suggestedMarks || item.suggestedMarks < 1) {
      throw new BadRequestException('cannot approve: marks unset');
    }

    const sf = item.sourceFile;
    const subject = await this.resolveSubject(sf.syllabusCode);
    if (!subject) {
      throw new BadRequestException(
        `cannot approve: no Subject seeded for syllabus '${sf.syllabusCode}'`,
      );
    }
    const component = await this.resolveComponent(subject.id, sf.paperVariant);
    const topic = item.suggestedTopicCode
      ? await this.prisma.topic.findFirst({
          where: { componentId: component?.id ?? undefined, code: item.suggestedTopicCode },
        })
      : null;

    const sourceRef = this.buildSourceRef(sf, item.questionNumber);
    const stem = item.rawExtractedText ?? '';
    const markScheme =
      item.markSchemeItems.length > 0
        ? item.markSchemeItems.map((m) => ({
            point: m.pointText,
            marks: m.marks,
            partLabel: m.partLabel ?? null,
          }))
        : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const q = await tx.question.create({
        data: {
          subjectId: subject.id,
          componentId: component?.id ?? null,
          primaryTopicId: topic?.id ?? null,
          questionType: item.suggestedType!,
          marks: item.suggestedMarks!,
          estimatedTimeMin: item.suggestedMarks! * 1.0,
          difficulty: item.suggestedDifficulty ?? 3,
          sourceType: SourceType.past_paper_reference,
          sourceRef,
          content: { stem } as any,
          answerContent: { text: '' } as any,
          options: null as any,
          markScheme: markScheme as any,
          status: QuestionStatus.active,
          complianceStatus: item.complianceStatus,
          allowedUsage: 'internal_classroom_only' as any,
          createdById: actor.id,
        },
      });
      const upd = await tx.questionItem.update({
        where: { id },
        data: {
          questionId: q.id,
          reviewStatus: ReviewStatus.approved,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
      });
      await tx.teacherReview.create({
        data: {
          questionItemId: id,
          reviewerId: actor.id,
          action: 'approve',
          notes: null,
        },
      });
      return { question: q, item: upd };
    });

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: 'review.item.approve',
      entityType: 'question_item',
      entityId: id,
      metadata: { questionId: result.question.id, sourceRef },
      ip: actor.ip ?? null,
    });
    return result;
  }

  private async resolveSubject(syllabusCode: string | null) {
    if (!syllabusCode) return null;
    return this.prisma.subject.findFirst({ where: { code: syllabusCode } });
  }

  /**
   * Map a CIE paperVariant (e.g. "22") to a SyllabusComponent code.
   * Convention used in seeds: first digit identifies the component group.
   *   1x → P1   2x → P2   3x → P3   4x → P4   5x → P5   6x → P6
   * Falls back to null when the seeded component table doesn't have it.
   */
  private async resolveComponent(subjectId: string, paperVariant: string | null) {
    if (!paperVariant) return null;
    const m = paperVariant.match(/^(\d)/);
    if (!m) return null;
    const code = `P${m[1]}`;
    return this.prisma.syllabusComponent.findFirst({
      where: { subjectId, code },
    });
  }

  private buildSourceRef(
    sf: {
      syllabusCode: string | null;
      paperVariant: string | null;
      examSeason: string | null;
      examYear: number | null;
    },
    questionNumber: string | null,
  ): string {
    const parts: string[] = [];
    if (sf.syllabusCode) parts.push(sf.syllabusCode);
    if (sf.paperVariant) parts.push(sf.paperVariant);
    if (sf.examSeason) parts.push(SEASON_TO_LABEL[sf.examSeason] ?? sf.examSeason.toUpperCase());
    if (sf.examYear) parts.push(String(sf.examYear).slice(-2));
    if (questionNumber) parts.push(`Q${questionNumber}`);
    return parts.join('/');
  }
}
