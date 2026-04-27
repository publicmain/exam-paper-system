import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { FileKind, ProcessStatus, QuestionType, ReviewStatus, SourceFile } from '@prisma/client';

interface RawSplit {
  questionNumber: string;
  pageStart: number;
  pageEnd: number;
  text: string;
  detectedType: QuestionType;
  detectedMarks?: number;
}

export interface SplitResult {
  sourceFileId: string;
  splits: number;
  type: 'mcq' | 'structured' | 'unknown';
  notes: string[];
}

const MAX_MCQ_NUMBER = 45; // CIE MCQs have 30–40 questions; cap defensively
const MAX_STRUCTURED_NUMBER = 15;

@Injectable()
export class QuestionSplitterService {
  private readonly logger = new Logger('QuestionSplitter');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Split all processed question_paper SourceFiles for a repo. Idempotent:
   * existing QuestionItems for the file are wiped and rewritten so a fixed
   * splitter can be re-run without duplicates. Mark schemes are not split
   * here — they're linked to questions in Phase 4 instead.
   */
  async splitForRepo(repoId: string): Promise<SplitResult[]> {
    const files = await this.prisma.sourceFile.findMany({
      where: {
        repoId,
        fileKind: FileKind.question_paper,
        processStatus: ProcessStatus.processed,
      },
      include: { pages: { orderBy: { pageNo: 'asc' } } },
    });
    const out: SplitResult[] = [];
    for (const f of files) {
      try {
        out.push(await this.splitOne(f as any));
      } catch (e: any) {
        this.logger.warn(`split failed for ${f.id}: ${e?.message ?? e}`);
        out.push({
          sourceFileId: f.id,
          splits: 0,
          type: 'unknown',
          notes: [`error: ${e?.message ?? e}`],
        });
      }
    }
    return out;
  }

  async splitOne(
    file: SourceFile & { pages: { pageNo: number; rawText: string | null }[] },
  ): Promise<SplitResult> {
    const notes: string[] = [];
    if (!file.pages || file.pages.length === 0) {
      return { sourceFileId: file.id, splits: 0, type: 'unknown', notes: ['no pages rendered'] };
    }

    const isMcq = this.detectMcq(file);
    notes.push(`detected: ${isMcq ? 'mcq' : 'structured'}`);

    const splits = isMcq ? this.splitMcq(file.pages) : this.splitStructured(file.pages);
    notes.push(`raw splits: ${splits.length}`);

    // Idempotent rewrite. Drop QuestionItems that have not yet been
    // mirrored into Question (questionId IS NULL); approved ones are
    // immutable history and must not be touched.
    await this.prisma.questionItem.deleteMany({
      where: { sourceFileId: file.id, questionId: null },
    });

    for (const s of splits) {
      await this.prisma.questionItem.create({
        data: {
          sourceFileId: file.id,
          pageStart: s.pageStart,
          pageEnd: s.pageEnd,
          rawExtractedText: s.text.slice(0, 8000),
          questionNumber: s.questionNumber,
          suggestedType: s.detectedType,
          suggestedMarks: s.detectedMarks ?? null,
          // Inherit from source — admins can tighten per-item later.
          complianceStatus: file.complianceStatus,
          reviewStatus: ReviewStatus.pending_review,
        },
      });
    }

    return {
      sourceFileId: file.id,
      splits: splits.length,
      type: isMcq ? 'mcq' : 'structured',
      notes,
    };
  }

  /**
   * MCQ heuristic: 9702 papers whose variant starts with "1" (11, 12, 13)
   * are multiple choice. Fallback: scan first page text for the phrase
   * "Multiple Choice" or option-letter patterns A/B/C/D in close vertical
   * proximity. Belt and suspenders so a mistyped variant doesn't fool us.
   */
  private detectMcq(
    file: SourceFile & { pages: { pageNo: number; rawText: string | null }[] },
  ): boolean {
    if (file.syllabusCode === '9702' && file.paperVariant && /^1\d$/.test(file.paperVariant)) {
      return true;
    }
    const firstFew = file.pages
      .slice(0, 3)
      .map((p) => p.rawText ?? '')
      .join('\n');
    if (/multiple\s*choice/i.test(firstFew)) return true;
    // Strong indicator: many "  A " / "  B " / "  C " / "  D " line starts.
    const optionLines = (firstFew.match(/^\s+[A-D]\s+\S/gm) ?? []).length;
    if (optionLines >= 8) return true;
    return false;
  }

  private splitMcq(pages: { pageNo: number; rawText: string | null }[]): RawSplit[] {
    const items: RawSplit[] = [];
    let current: RawSplit | null = null;
    let lastNumber = 0;
    const starter = /^\s*(\d{1,2})\s+(?=\S)/;

    for (const page of pages) {
      const text = page.rawText ?? '';
      for (const line of text.split('\n')) {
        const m = line.match(starter);
        if (m) {
          const n = parseInt(m[1], 10);
          // Accept only monotonically increasing numbers within MCQ range.
          if (n === lastNumber + 1 && n <= MAX_MCQ_NUMBER) {
            if (current) items.push(current);
            current = {
              questionNumber: String(n),
              pageStart: page.pageNo,
              pageEnd: page.pageNo,
              text: line,
              detectedType: QuestionType.mcq,
              detectedMarks: 1,
            };
            lastNumber = n;
            continue;
          }
        }
        if (current) {
          current.text += '\n' + line;
          current.pageEnd = page.pageNo;
        }
      }
    }
    if (current) items.push(current);
    return items.filter((q) => this.looksLikeMcq(q.text));
  }

  private looksLikeMcq(body: string): boolean {
    // A real CIE MCQ has 4 option lines starting with A B C D.
    const opts = ['A', 'B', 'C', 'D'].filter((k) =>
      new RegExp(`(?:^|\\n)\\s*${k}\\s+\\S`).test(body),
    );
    return opts.length >= 3;
  }

  private splitStructured(pages: { pageNo: number; rawText: string | null }[]): RawSplit[] {
    const items: RawSplit[] = [];
    let current: RawSplit | null = null;
    let lastNumber = 0;
    // A structured question typically begins at the left margin with the
    // number, sometimes followed by " ." or whitespace and the prompt.
    const starter = /^\s*(\d{1,2})\s*[.)]?\s+(?=\S)/;
    const totalMarks = /\[(?:total[:\s]*)?\s*(\d{1,2})\s*\]/i;

    for (const page of pages) {
      const text = page.rawText ?? '';
      for (const line of text.split('\n')) {
        const m = line.match(starter);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n === lastNumber + 1 && n <= MAX_STRUCTURED_NUMBER) {
            if (current) {
              current.detectedMarks = this.guessMarks(current.text, totalMarks);
              items.push(current);
            }
            current = {
              questionNumber: String(n),
              pageStart: page.pageNo,
              pageEnd: page.pageNo,
              text: line,
              detectedType: QuestionType.structured,
            };
            lastNumber = n;
            continue;
          }
        }
        if (current) {
          current.text += '\n' + line;
          current.pageEnd = page.pageNo;
        }
      }
    }
    if (current) {
      current.detectedMarks = this.guessMarks(current.text, totalMarks);
      items.push(current);
    }
    return items.filter((q) => q.text.length > 30);
  }

  private guessMarks(body: string, pattern: RegExp): number | undefined {
    // Sum every "[N]" token at end of lines — these are CIE per-part marks.
    // If a "[Total: N]" is present, prefer that.
    const totalMatch = body.match(/\[\s*total[:\s]*\s*(\d{1,2})\s*\]/i);
    if (totalMatch) return parseInt(totalMatch[1], 10);
    let sum = 0;
    const re = /\[\s*(\d{1,2})\s*\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) sum += parseInt(m[1], 10);
    return sum > 0 ? sum : undefined;
  }
}
