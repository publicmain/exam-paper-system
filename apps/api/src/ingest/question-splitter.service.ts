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

  /**
   * Pages we feed to the splitter. CIE always reserves page 1 for the
   * cover sheet (READ THESE INSTRUCTIONS FIRST, duration, additional
   * materials, candidate-number boxes). For Paper-1 multiple choice it
   * also reserves pages 2–3 for the formula sheet (rendered by PyMuPDF
   * as a long string of equations with no English narrative). Pages
   * containing the phrase "Formulae" near the top are skipped too.
   *
   * Per page, we also strip the standard CIE page header
   *   "<pageNo>\n© UCLES <year>\n<syllabus>/<variant>/<season>/<yy>\n"
   * (and the "[Turn over" trailer when present), so the splitter doesn't
   * mistake the page-number for a question number.
   */
  /**
   * CIE 9702 QP layout (verified for 2019):
   *   page 1     cover sheet (READ THESE INSTRUCTIONS FIRST)
   *   page 2     candidate-number boxes / blank
   *   page 3     Data + Formulae sheets
   *   page 4+    questions
   * We always drop pages 1–3. Per remaining page we strip the standard
   * header so a leading page-number doesn't get parsed as a question.
   */
  private contentPages(pages: { pageNo: number; rawText: string | null }[]) {
    const cleaned: { pageNo: number; rawText: string | null }[] = [];
    for (const p of pages) {
      if (p.pageNo <= 3) continue;
      const raw = p.rawText ?? '';
      const text = raw
        .replace(/^\s*\d{1,2}\s*\n/, '') // leading page number on its own line
        .replace(/©\s*UCLES\s*\d{4}\s*\n/g, '') // copyright line
        .replace(/\d{4}\/\d{1,2}\/[A-Za-z]\/[A-Za-z]\/\d{2}\s*\n/g, '') // 9702/12/M/J/19
        .replace(/\[\s*Turn\s+over\s*\n?/gi, ''); // [Turn over
      cleaned.push({ pageNo: p.pageNo, rawText: text });
    }
    return cleaned;
  }

  /**
   * MCQ splitter — regex-based with full ABCD enforcement.
   *
   * CIE PyMuPDF text often flattens multi-line content within a question
   * (the question number, stem, and four options end up on multiple lines
   * but boundaries aren't reliable). A pure line-by-line `^\d+\s+` scan
   * picks up false positives like "2 ns" or "3 m s–1" inside option text.
   *
   * Instead, we scan the whole concatenated text for the canonical CIE
   * MCQ shape: number → stem → 4 distinct options A/B/C/D → next number
   * (or end). Anything that doesn't fit the four-option pattern is
   * dropped, which kills both front-matter false-Q1 and unit-suffix
   * false-positives.
   */
  /**
   * MCQ splitter — handles the actual PyMuPDF output for CIE MCQ papers.
   *
   * The text PyMuPDF extracts puts each MCQ in this shape (note: option
   * labels stand alone on their own line, with the option text on the
   * line(s) that follow):
   *
   *   1
   *   What is equivalent to 2000 microvolts?
   *   A
   *   2 µJ C-1
   *   B
   *   2 mV
   *   C
   *   2 pV
   *   D
   *   2000 mV
   *
   *   2
   *   ...
   *
   * The regex below matches that exact shape. It enforces all four
   * option labels, drops dupes by question number, and bails out at the
   * next standalone-number-on-its-own-line.
   */
  /**
   * MCQ splitter — runs the question regex page-by-page so a question
   * boundary never bleeds across pages. CIE Paper-1 lays each MCQ to
   * fit fully on one page (typically 2 per page), so per-page scanning
   * does not lose questions and avoids matching a "number" on one page
   * with ABCD options that belong to a different question on the next.
   */
  private splitMcq(pages: { pageNo: number; rawText: string | null }[]): RawSplit[] {
    const items: RawSplit[] = [];
    const seen = new Set<number>();
    // PyMuPDF emits CIE MCQs in two layouts depending on page format:
    //   1. number on its own line, stem on next line(s)
    //         "1\nWhat is equivalent to ...\nA\n2 µJ C-1\nB\n..."
    //   2. number + space + stem on the same line
    //         "11 Two bar magnets P and Q ...\nA\nDuring the ...\nB\n..."
    // Using \s+ (matches space OR newline) for the separators handles both.
    // Stem must start with a non-whitespace char so a pure "11\n12\n13"
    // page-number column doesn't match.
    const re = new RegExp(
      [
        '(?:^|\\n)\\s*(\\d{1,2})\\s+',     // 1: question number
        '(\\S[\\s\\S]*?)',                  // 2: stem
        '\\n\\s*A\\s+([\\s\\S]*?)',        // 3: option A body
        '\\n\\s*B\\s+([\\s\\S]*?)',        // 4: option B body
        '\\n\\s*C\\s+([\\s\\S]*?)',        // 5: option C body
        '\\n\\s*D\\s+([\\s\\S]*?)',        // 6: option D body
        '(?=\\n\\s*\\d{1,2}\\s+\\S|\\s*$)', // boundary: next Q-num+stem or EOF
      ].join(''),
      'g',
    );

    for (const page of this.contentPages(pages)) {
      const text = (page.rawText ?? '').replace(/\r/g, '');
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const n = parseInt(m[1], 10);
        if (!Number.isFinite(n) || n < 1 || n > MAX_MCQ_NUMBER) continue;
        if (seen.has(n)) continue;

        const stem = (m[2] ?? '').trim();
        if (stem.length < 6) continue;

        seen.add(n);
        items.push({
          questionNumber: String(n),
          pageStart: page.pageNo,
          pageEnd: page.pageNo,
          text: m[0].trim(),
          detectedType: QuestionType.mcq,
          detectedMarks: 1,
        });
      }
    }
    return items;
  }

  /**
   * Structured splitter. CIE structured papers number their main questions
   * 1, 2, 3 … at the left margin. Sub-parts use lowercase letters in
   * parentheses ("(a)", "(b)") which we deliberately do not split on —
   * they live inside the parent QuestionItem.
   *
   * We skip page 1 (cover sheet); some papers also have a formula sheet
   * page 2 (Paper 4/5). To avoid catching the formula reference page as
   * "Q1" we additionally require that the first 200 chars after the
   * starter contain at least one alphabetic word ≥ 4 chars long, which
   * filters numeric-symbol formula dumps.
   */
  private splitStructured(pages: { pageNo: number; rawText: string | null }[]): RawSplit[] {
    const items: RawSplit[] = [];
    let current: RawSplit | null = null;
    let lastNumber = 0;
    const starter = /^\s*(\d{1,2})\s*[.)]?\s+(?=\S)/;
    const totalMarks = /\[(?:total[:\s]*)?\s*(\d{1,2})\s*\]/i;

    for (const page of this.contentPages(pages)) {
      const text = page.rawText ?? '';
      for (const line of text.split('\n')) {
        const m = line.match(starter);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n === lastNumber + 1 && n <= MAX_STRUCTURED_NUMBER) {
            if (current) {
              current.detectedMarks = this.guessMarks(current.text, totalMarks);
              if (this.looksLikeRealStructured(current.text)) items.push(current);
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
      if (this.looksLikeRealStructured(current.text)) items.push(current);
    }
    return items;
  }

  private looksLikeRealStructured(body: string): boolean {
    if (body.length < 60) return false;
    // Must contain at least one substantive English word (kills pages
    // that are pure formulas / Greek symbols / equations only).
    if (!/[A-Za-z]{4,}/.test(body)) return false;
    return true;
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
