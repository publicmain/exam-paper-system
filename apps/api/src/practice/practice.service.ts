import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

// Heuristics for stripping CIE-paper boilerplate that PyMuPDF leaves in
// the extracted text. Margin watermarks, page barcodes, and the vertical
// "DO NOT WRITE IN THIS MARGIN" rail show up as repeating strings or as
// garbled mojibake when fonts can't be decoded. None of it is content;
// we keep it out of the student-facing display text but leave it in
// rawExtractedText for the admin debug view.
const DROP_LINE_PATTERNS: RegExp[] = [
  /DO\s*NOT\s*WRITE\s*IN\s*THIS\s*MARGIN/i,
  /^\s*\*\s*\d{10,}\s*\*\s*$/,                 // page barcode tokens
  /^\s*[\s,.\-]+\s*$/,                          // pure punctuation/whitespace
  /^\s*DFD\s*$/i,                               // page corner code
  /^\s*©\s*UCLES\s+\d{4}\s*$/i,            // copyright footer
  /^\s*9618\/\d{2}\/[A-Z]\/[A-Z]\/\d{2}\s*$/i, // CIE paper ref code
  /^\s*\[?Turn\s*over\]?\s*$/i,
  /^\s*\d+\s*$/,                                // bare page numbers
];

// Lines that are mostly non-ASCII (mojibake from font-stripped strokes).
// We tolerate up to a third weird chars before discarding.
function looksLikeMojibake(line: string): boolean {
  if (!line) return false;
  const total = line.length;
  if (total < 4) return false;
  let weird = 0;
  for (const ch of line) {
    const c = ch.codePointAt(0)!;
    if (c > 0x7e && (c < 0x2010 || c > 0x2122)) weird++;
  }
  return weird / total > 0.35;
}

export function cleanExtractedText(raw: string): string {
  if (!raw) return '';
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  let blanks = 0;
  for (const line of lines) {
    const trimmed = line.replace(/\s+$/, '');
    if (DROP_LINE_PATTERNS.some((re) => re.test(trimmed))) continue;
    if (looksLikeMojibake(trimmed)) continue;
    if (trimmed === '') {
      // Collapse runs of blank lines so cleaned text doesn't look stretched.
      if (blanks++ < 1) out.push('');
      continue;
    }
    blanks = 0;
    out.push(trimmed);
  }
  return out.join('\n').trim();
}

export interface PracticeQuery {
  syllabusCode?: string;
  paperVariants?: string[];   // ['1', '2', '3', '4'] or ['11', '12', ...]
  topicCodes?: string[];
  years?: number[];
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class PracticeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List approved past-paper QuestionItems for the student-facing /practice
   * page. Filters cascade: syllabus -> paper number -> topic -> year. Search
   * is a case-insensitive substring match on the extracted question text
   * (we deliberately keep it dumb - tokenisation can come later).
   */
  async listQuestions(q: PracticeQuery) {
    const where: any = {
      reviewStatus: 'approved',
      sourceFile: {
        ...(q.syllabusCode ? { syllabusCode: q.syllabusCode } : {}),
        ...(q.paperVariants?.length
          ? {
              OR: q.paperVariants.map((v) =>
                v.length === 1
                  ? { paperVariant: { startsWith: v } } // '1' -> 11/12/13
                  : { paperVariant: v },
              ),
            }
          : {}),
        ...(q.years?.length ? { examYear: { in: q.years } } : {}),
        // QPs only - we don't show MSs as standalone practice items.
        fileKind: 'question_paper',
      },
      ...(q.topicCodes?.length
        ? { suggestedTopicCode: { in: q.topicCodes } }
        : {}),
      ...(q.search
        ? { rawExtractedText: { contains: q.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.questionItem.findMany({
        where,
        include: {
          sourceFile: {
            select: {
              id: true,
              rawFilename: true,
              syllabusCode: true,
              examYear: true,
              examSeason: true,
              paperVariant: true,
            },
          },
          parts: { orderBy: { sortOrder: 'asc' } },
          markSchemeItems: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: [
          { sourceFile: { examYear: 'desc' } },
          { sourceFile: { examSeason: 'desc' } },
          { sourceFile: { paperVariant: 'asc' } },
          { questionNumber: 'asc' },
        ],
        take: Math.min(q.limit ?? 50, 200),
        skip: q.offset ?? 0,
      }),
      this.prisma.questionItem.count({ where }),
    ]);

    // Apply the boilerplate scrubber to display text. Raw text is left
    // untouched in DB so admins can still see what PyMuPDF gave us.
    const cleaned = items.map((it) => ({
      ...it,
      rawExtractedText: cleanExtractedText(it.rawExtractedText ?? ''),
    }));

    return { total, items: cleaned };
  }

  /**
   * Teacher-facing manual override: re-tag a question's primary topic.
   * Bumps confidence to 1.0 and records `taggedBy: teacher` so the
   * teacher's choice always beats heuristic / AI labels on re-runs.
   * Pass `null` to clear the topic entirely.
   */
  async updateTopic(questionItemId: string, topicCode: string | null) {
    const item = await this.prisma.questionItem.findUnique({
      where: { id: questionItemId },
      include: { sourceFile: true },
    });
    if (!item) throw new NotFoundException('question not found');

    let topicId: string | null = null;
    if (topicCode) {
      const topic = await this.prisma.topic.findFirst({
        where: {
          code: topicCode,
          component: { subject: { code: item.sourceFile?.syllabusCode ?? '' } },
        },
      });
      if (!topic) {
        throw new BadRequestException(
          `topic ${topicCode} not found in syllabus ${item.sourceFile?.syllabusCode}`,
        );
      }
      topicId = topic.id;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.questionItem.update({
        where: { id: questionItemId },
        data: {
          suggestedTopicCode: topicCode,
          confidenceTopic: topicCode ? 1.0 : null,
        },
      });
      // Drop existing rule/AI links for this item so the teacher's choice
      // is the only one that remains. Teacher links survive across
      // classifier re-runs because the classifier guards on
      // `suggestedTopicCode IS NULL` unless overwrite is forced.
      await tx.questionItemTopic.deleteMany({ where: { questionItemId } });
      if (topicId) {
        await tx.questionItemTopic.create({
          data: {
            questionItemId,
            topicId,
            confidence: 1.0,
            taggedBy: 'teacher',
          },
        });
      }
    });
    return { ok: true, topicCode };
  }

  /**
   * Topic tree for the filter sidebar, with question counts so the UI can
   * disable empty topics and show "(42)" badges.
   */
  async listTopics(syllabusCode: string) {
    const subject = await this.prisma.subject.findFirst({ where: { code: syllabusCode } });
    if (!subject) return { components: [] };

    const components = await this.prisma.syllabusComponent.findMany({
      where: { subjectId: subject.id },
      orderBy: { code: 'asc' },
      include: {
        topics: {
          where: { parentTopicId: null }, // top-level only; UI can fetch sub-tree separately
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // Single grouped query for counts so we don't fan out N queries.
    const counts = await this.prisma.questionItem.groupBy({
      by: ['suggestedTopicCode'],
      where: {
        reviewStatus: 'approved',
        suggestedTopicCode: { not: null },
        sourceFile: { syllabusCode, fileKind: 'question_paper' },
      },
      _count: { _all: true },
    });
    const countByCode = new Map(
      counts.map((c) => [c.suggestedTopicCode!, c._count._all]),
    );

    return {
      components: components.map((c) => ({
        code: c.code,
        name: c.name,
        topics: c.topics.map((t) => ({
          code: t.code,
          name: t.name,
          questionCount: countByCode.get(t.code) ?? 0,
        })),
      })),
    };
  }
}
