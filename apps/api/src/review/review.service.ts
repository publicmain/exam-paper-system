import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  Prisma,
  QuestionItemSource,
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
  source?: string;
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
      ...(q.source && { source: q.source as QuestionItemSource }),
    };
    // Past-paper filters route through SourceFile; AI items don't have one.
    const isAiOnly = q.source === 'ai_generated';
    if (!isAiOnly && (q.repoId || q.syllabusCode)) {
      where.sourceFile = {
        ...(q.repoId ? { repoId: q.repoId } : {}),
        ...(q.syllabusCode ? { syllabusCode: q.syllabusCode } : {}),
      };
    }
    if (isAiOnly && q.syllabusCode) {
      where.suggestedSubjectCode = q.syllabusCode;
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
   *
   * Past-paper items: subject/component/topic resolved from the SourceFile
   * (syllabusCode + paperVariant). AI-generated items have no SourceFile —
   * subject/component/topic come from suggestedSubjectCode + suggestedTopicCode
   * set by the generator.
   */
  async approve(
    id: string,
    actor: ActorCtx,
    opts: { provenanceTag?: string | null } = {},
  ) {
    const item = await this.prisma.questionItem.findUnique({
      where: { id },
      include: {
        sourceFile: true,
        markSchemeItems: true,
        parts: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!item) throw new NotFoundException('review item not found');
    if (item.questionId) throw new BadRequestException('already approved');
    if (!item.suggestedType) {
      throw new BadRequestException('cannot approve: question type unset');
    }
    if (!item.suggestedMarks || item.suggestedMarks < 1) {
      throw new BadRequestException('cannot approve: marks unset');
    }

    const isAi = item.source === QuestionItemSource.ai_generated;
    if (!isAi && !item.sourceFile) {
      throw new BadRequestException('item missing sourceFile');
    }

    let subjectCode: string | null;
    let paperVariant: string | null;
    let sourceRef: string;
    let sourceType: SourceType;
    if (isAi) {
      subjectCode = item.suggestedSubjectCode ?? null;
      paperVariant = null;
      sourceRef = `AI/${item.aiModel ?? 'claude'}/${item.id.slice(-6)}`;
      sourceType = SourceType.ai_generated;
    } else {
      const sf = item.sourceFile!;
      subjectCode = sf.syllabusCode;
      paperVariant = sf.paperVariant;
      sourceRef = this.buildSourceRef(sf, item.questionNumber);
      sourceType = SourceType.past_paper_reference;
    }

    const subject = await this.resolveSubject(subjectCode);
    if (!subject) {
      throw new BadRequestException(
        `cannot approve: no Subject seeded for syllabus '${subjectCode}'`,
      );
    }
    let component = await this.resolveComponent(subject.id, paperVariant);
    const topic = item.suggestedTopicCode
      ? await this.prisma.topic.findFirst({
          where: {
            ...(component?.id ? { componentId: component.id } : { component: { subjectId: subject.id } }),
            code: item.suggestedTopicCode,
          },
          include: { component: true },
        })
      : null;
    // AI items have no paperVariant, so resolveComponent returned null. Fall
    // back to the topic's owning component so paper-generation filters that
    // require componentId (very common — Subject + Component is the default
    // teacher scope) actually match the approved Question.
    if (!component && topic?.component) {
      component = topic.component;
    }

    const stem = item.rawExtractedText ?? '';
    const partsContent =
      item.parts.length > 0
        ? item.parts.map((p) => ({
            label: p.partLabel,
            content: p.text,
            marks: p.marks,
          }))
        : null;
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
          sourceType,
          sourceRef,
          content: { stem, ...(partsContent ? { parts: partsContent } : {}) } as any,
          answerContent: { text: '' } as any,
          options: null as any,
          markScheme: markScheme as any,
          status: QuestionStatus.active,
          complianceStatus: item.complianceStatus,
          allowedUsage: 'internal_classroom_only' as any,
          provenanceTag: opts.provenanceTag ?? null,
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

  /**
   * Bulk-approve pending_review QuestionItems matching a filter, gated by
   * a deterministic quality check. Failures (gate or approve()) don't
   * abort the batch — each item gets its own row in the result so the
   * operator can review what fell out.
   *
   * Quality gate is purely mechanical (mark range, stem length, has [N],
   * letter count) so the AI is not making subjective decisions about
   * what's bank-worthy. Items that don't pass land in `skipped`; nothing
   * is silently dropped.
   */
  async bulkApprove(
    args: {
      filter: { repoId?: string; syllabusCode?: string; source?: string };
      qualityGate: {
        minMarks: number;
        maxMarks: number;
        minStemLength: number;
        minLetterCount: number;
        requireMarkIndicator: boolean;
        requireType: boolean;
      };
      dryRun: boolean;
      limit: number;
    },
    actor: ActorCtx,
  ) {
    const { filter, qualityGate: g, dryRun, limit } = args;
    const where: Prisma.QuestionItemWhereInput = {
      reviewStatus: ReviewStatus.pending_review,
      questionId: null,
      ...(filter.source && { source: filter.source as QuestionItemSource }),
      ...(filter.repoId && { sourceFile: { repoId: filter.repoId } }),
      ...(filter.syllabusCode && { sourceFile: { syllabusCode: filter.syllabusCode } }),
    };
    const items = await this.prisma.questionItem.findMany({
      where,
      include: { sourceFile: true },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    const skipped: { itemId: string; reason: string }[] = [];
    const approved: { itemId: string; questionId: string }[] = [];
    const errors: { itemId: string; error: string }[] = [];

    for (const item of items) {
      const stem = (item.rawExtractedText ?? '').trim();
      const reason = this.qualityCheck(item, stem, g);
      if (reason) {
        skipped.push({ itemId: item.id, reason });
        continue;
      }
      if (dryRun) {
        approved.push({ itemId: item.id, questionId: '(dry-run)' });
        continue;
      }
      try {
        const r = await this.approve(item.id, actor);
        approved.push({ itemId: item.id, questionId: r.question.id });
      } catch (e: any) {
        errors.push({ itemId: item.id, error: String(e?.message ?? e).slice(0, 200) });
      }
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: dryRun ? 'review.bulk_approve.dry_run' : 'review.bulk_approve',
      entityType: 'question_item',
      entityId: 'batch',
      metadata: {
        filter,
        qualityGate: g,
        scanned: items.length,
        approvedCount: approved.length,
        skippedCount: skipped.length,
        errorCount: errors.length,
      },
      ip: actor.ip ?? null,
    });

    this.logger.log(
      `bulk-approve ${dryRun ? '[dry] ' : ''}filter=${JSON.stringify(filter)} ` +
        `scanned=${items.length} approved=${approved.length} ` +
        `skipped=${skipped.length} errors=${errors.length}`,
    );

    return {
      dryRun,
      scanned: items.length,
      limited: items.length === limit,
      approved,
      skipped,
      errors,
    };
  }

  /** Mechanical quality gate. Returns a short reason string when the
   *  candidate fails, or null when it passes. */
  private qualityCheck(
    item: { suggestedType: QuestionType | null; suggestedMarks: number | null },
    stem: string,
    g: {
      minMarks: number;
      maxMarks: number;
      minStemLength: number;
      minLetterCount: number;
      requireMarkIndicator: boolean;
      requireType: boolean;
    },
  ): string | null {
    if (g.requireType && !item.suggestedType) return 'no suggestedType';
    const marks = item.suggestedMarks ?? 0;
    if (marks < g.minMarks) return `marks ${marks} < ${g.minMarks}`;
    if (marks > g.maxMarks) return `marks ${marks} > ${g.maxMarks}`;
    if (stem.length < g.minStemLength) return `stem too short (${stem.length} < ${g.minStemLength})`;
    const letters = (stem.match(/[A-Za-z]/g) ?? []).length;
    if (letters < g.minLetterCount) return `too few letters (${letters} < ${g.minLetterCount})`;
    if (g.requireMarkIndicator && !/\[\s*\d{1,2}\s*\]/.test(stem)) return 'no [N] mark indicator';
    return null;
  }

  /**
   * Backfill `componentId` on already-approved Question rows whose
   * component came out null (typically because they were approved before
   * the semantic 9709 component mapping landed in commit 62db09c). Walks
   * every active Question with `componentId IS NULL`, parses the paper
   * variant out of `sourceRef` (format like "9709/41/M/J/19/Q3"), runs
   * the same `resolveComponent` logic the approve flow uses, and
   * updates the row. Idempotent — runs that find nothing change nothing.
   */
  async backfillApprovedComponents(
    args: { syllabusCode?: string; limit?: number; dryRun?: boolean },
    actor: ActorCtx,
  ) {
    const limit = Math.max(1, Math.min(args.limit ?? 1000, 5000));
    const candidates = await this.prisma.question.findMany({
      where: {
        componentId: null,
        status: QuestionStatus.active,
        ...(args.syllabusCode
          ? { subject: { code: args.syllabusCode } }
          : {}),
        sourceRef: { not: null },
      },
      take: limit,
      include: { subject: true },
      orderBy: { createdAt: 'asc' },
    });

    const updated: Array<{ questionId: string; variant: string; componentCode: string }> = [];
    const skipped: Array<{ questionId: string; reason: string }> = [];

    for (const q of candidates) {
      // sourceRef pattern: "<syllabus>/<variant>/<season>/<region>/<year>/Q<n>"
      const m = (q.sourceRef ?? '').match(/^[^/]+\/(\d+)\//);
      if (!m) {
        skipped.push({ questionId: q.id, reason: 'sourceRef has no variant prefix' });
        continue;
      }
      const variant = m[1];
      const component = await this.resolveComponent(q.subjectId, variant);
      if (!component) {
        skipped.push({ questionId: q.id, reason: `no component matches variant ${variant}` });
        continue;
      }
      updated.push({ questionId: q.id, variant, componentCode: component.code });
      if (!args.dryRun) {
        await this.prisma.question.update({
          where: { id: q.id },
          data: { componentId: component.id },
        });
      }
    }

    await this.audit.log({
      actorId: actor.id,
      actorRole: actor.role,
      action: args.dryRun ? 'review.component_backfill.dry_run' : 'review.component_backfill',
      entityType: 'question',
      entityId: 'batch',
      metadata: {
        syllabusCode: args.syllabusCode,
        scanned: candidates.length,
        updatedCount: updated.length,
        skippedCount: skipped.length,
      },
      ip: actor.ip ?? null,
    });

    this.logger.log(
      `component-backfill ${args.dryRun ? '[dry] ' : ''}` +
        `scanned=${candidates.length} updated=${updated.length} skipped=${skipped.length}`,
    );

    return {
      dryRun: !!args.dryRun,
      scanned: candidates.length,
      updated,
      skipped,
    };
  }

  private async resolveSubject(syllabusCode: string | null) {
    if (!syllabusCode) return null;
    return this.prisma.subject.findFirst({ where: { code: syllabusCode } });
  }

  /**
   * Map a CIE paperVariant (e.g. "22") to a SyllabusComponent code.
   * Convention used in seeds: first digit identifies the component group.
   *   1x → P1   2x → P2   3x → P3   4x → P4   5x → P5   6x → P6
   *
   * 9709 A-Level Math uses semantic component names rather than P-numbers
   * (M1 for the mechanics paper at 4x, S1 for the stats paper at 6x), so
   * we try the literal P{digit} first and then fall back to a per-board
   * mapping. Returns null when nothing matches.
   */
  private async resolveComponent(subjectId: string, paperVariant: string | null) {
    if (!paperVariant) return null;
    const m = paperVariant.match(/^(\d)/);
    if (!m) return null;
    const firstDigit = m[1];

    const literalCode = `P${firstDigit}`;
    const literal = await this.prisma.syllabusComponent.findFirst({
      where: { subjectId, code: literalCode },
    });
    if (literal) return literal;

    // Fallback: 9709 uses semantic component codes. The seed has
    // P1, P3, M1, S1 — variant 4x → mechanics, 6x → stats.
    const semantic: Record<string, string> = { '4': 'M1', '5': 'M2', '6': 'S1', '7': 'S2' };
    const fallback = semantic[firstDigit];
    if (fallback) {
      return this.prisma.syllabusComponent.findFirst({
        where: { subjectId, code: fallback },
      });
    }
    return null;
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
