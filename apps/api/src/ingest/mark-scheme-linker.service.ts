import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { FileKind, ProcessStatus, SourceFile } from '@prisma/client';

interface MsRow {
  number: string;
  partLabel: string | null;
  text: string;
  marks: number;
  sortOrder: number;
}

export interface LinkResult {
  qpFileId: string;
  msFileId: string | null;
  matched: number;
  notes: string[];
}

@Injectable()
export class MarkSchemeLinkerService {
  private readonly logger = new Logger('MsLinker');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * For each processed question_paper in the repo, find the matching
   * mark_scheme by (syllabusCode, examYear, examSeason, paperVariant).
   * Then attach MarkSchemeItem rows to the QuestionItems by question
   * number. We re-run idempotently: existing MS items for the QuestionItem
   * are wiped before insert as long as the parent QuestionItem has not yet
   * been mirrored to a Question.
   */
  async linkForRepo(repoId: string): Promise<LinkResult[]> {
    const qpFiles = await this.prisma.sourceFile.findMany({
      where: {
        repoId,
        fileKind: FileKind.question_paper,
        processStatus: ProcessStatus.processed,
      },
    });
    const out: LinkResult[] = [];
    for (const qp of qpFiles) {
      try {
        out.push(await this.linkOne(qp));
      } catch (e: any) {
        this.logger.warn(`link failed for ${qp.id}: ${e?.message ?? e}`);
        out.push({ qpFileId: qp.id, msFileId: null, matched: 0, notes: [`error: ${e?.message ?? e}`] });
      }
    }
    return out;
  }

  async linkOne(qp: SourceFile): Promise<LinkResult> {
    const notes: string[] = [];
    if (!qp.syllabusCode || !qp.examYear || !qp.examSeason || !qp.paperVariant) {
      return { qpFileId: qp.id, msFileId: null, matched: 0, notes: ['qp filename not parseable'] };
    }
    const ms = await this.prisma.sourceFile.findFirst({
      where: {
        repoId: qp.repoId,
        fileKind: FileKind.mark_scheme,
        syllabusCode: qp.syllabusCode,
        examYear: qp.examYear,
        examSeason: qp.examSeason,
        paperVariant: qp.paperVariant,
        processStatus: ProcessStatus.processed,
      },
      include: { pages: { orderBy: { pageNo: 'asc' } } },
    });
    if (!ms) {
      return { qpFileId: qp.id, msFileId: null, matched: 0, notes: ['no matching mark_scheme'] };
    }

    const items = await this.prisma.questionItem.findMany({
      where: { sourceFileId: qp.id, questionId: null },
    });
    if (items.length === 0) {
      return { qpFileId: qp.id, msFileId: ms.id, matched: 0, notes: ['no QuestionItems to link'] };
    }

    const isMcq = qp.syllabusCode === '9702' && qp.paperVariant && /^1\d$/.test(qp.paperVariant);
    const fullText = (ms as any).pages.map((p: any) => p.rawText ?? '').join('\n');
    const rows = isMcq ? this.parseMcqMs(fullText) : this.parseStructuredMs(fullText);
    notes.push(`ms rows extracted: ${rows.length}`);

    let matched = 0;
    for (const item of items) {
      const matching = rows.filter((r) => r.number === item.questionNumber);
      if (matching.length === 0) continue;
      // Replace prior MS items so re-runs are idempotent.
      await this.prisma.markSchemeItem.deleteMany({ where: { questionItemId: item.id } });
      // Persist one row per sub-part (a/b/c…). For MCQs there's only one
      // row with no partLabel.
      for (const row of matching) {
        await this.prisma.markSchemeItem.create({
          data: {
            questionItemId: item.id,
            partLabel: row.partLabel,
            pointText: row.text.slice(0, 4000),
            marks: row.marks,
            sortOrder: row.sortOrder,
            matchConfidence: 0.8,
          },
        });
      }
      matched++;
    }

    return { qpFileId: qp.id, msFileId: ms.id, matched, notes };
  }

  /**
   * MCQ mark schemes are tabular. PyMuPDF can emit them in two shapes:
   *   "1 D"               (number and letter on the same line)
   *   "1\nD"              (number then letter on separate lines)
   * We scan with a regex that allows whitespace OR a newline between the
   * two, then walk a monotonic 1, 2, 3… chain so "letter B" inside an
   * option text doesn't pollute the chain. MCQs have no sub-parts so
   * partLabel stays null.
   */
  private parseMcqMs(text: string): MsRow[] {
    const rows: MsRow[] = [];
    const seen = new Set<number>();
    const re = /(?:^|\n)\s*(\d{1,2})\s*[\s\n]+([A-D])\b/g;
    type Hit = { n: number; letter: string };
    const hits: Hit[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const n = parseInt(m[1], 10);
      if (n < 1 || n > 45) continue;
      hits.push({ n, letter: m[2] });
    }
    // Greedy monotonic chain so we accept the FIRST occurrence of each
    // number in sequence; later "1"/"2" inside option bodies are skipped.
    let want = 1;
    for (const h of hits) {
      if (h.n !== want) continue;
      if (seen.has(h.n)) continue;
      seen.add(h.n);
      rows.push({
        number: String(h.n),
        partLabel: null,
        text: h.letter,
        marks: 1,
        sortOrder: 0,
      });
      want = h.n + 1;
      if (want > 45) break;
    }
    return rows;
  }

  /**
   * Structured mark schemes follow a strict CIE table layout that
   * PyMuPDF flattens into:
   *
   *   Question
   *   Answer
   *   Marks
   *   1(a)
   *   kilogram / kg
   *   B1
   *
   *   kelvin / K
   *   B1
   *   1(b)
   *   units for v: m s-1 ...
   *   C1
   *   ...
   *   2(a)(i)
   *   distance in a specified ...
   *   B1
   *
   * We scan for "part label" lines like "1(a)", "2(b)(i)", "3" and slice
   * the text between consecutive labels. Within each slice we sum mark
   * tokens like B1/A1/C2/M1 — these are the Cambridge mark-scheme codes.
   * One row per sub-part so the review UI shows the granular table.
   */
  private parseStructuredMs(text: string): MsRow[] {
    const rows: MsRow[] = [];
    // Match a line that consists ONLY of a part label, e.g.
    //   "1"       (whole-question label)
    //   "1(a)"    (part)
    //   "2(b)(i)" (sub-sub-part)
    // The /m flag anchors ^ and $ to line boundaries.
    const labelRe = /^\s*(\d{1,2})((?:\([a-z]\))?(?:\([ivx]+\))?)\s*$/gm;

    type Hit = { number: string; partLabel: string; offset: number; endOfLabel: number };
    const hits: Hit[] = [];
    let m: RegExpExecArray | null;
    while ((m = labelRe.exec(text)) !== null) {
      const n = parseInt(m[1], 10);
      if (n < 1 || n > 15) continue;
      hits.push({
        number: String(n),
        partLabel: m[2] || '',
        offset: m.index,
        endOfLabel: labelRe.lastIndex,
      });
    }

    // Walk the hits and slice the body for each. Skip duplicates that
    // hit twice in a row (rare PyMuPDF artefact).
    const partsSeen = new Set<string>();
    const orderByQ: Record<string, number> = {};
    for (let i = 0; i < hits.length; i++) {
      const cur = hits[i];
      const next = hits[i + 1];
      const key = `${cur.number}/${cur.partLabel}`;
      if (partsSeen.has(key)) continue;
      partsSeen.add(key);

      const sliceEnd = next ? next.offset : text.length;
      const body = text.slice(cur.endOfLabel, sliceEnd).trim();
      if (body.length === 0) continue;
      // Drop the table-header noise that appears between question groups.
      const cleaned = body
        .replace(/\b(?:Question|Answer|Marks)\b/g, '')
        .replace(/©\s*UCLES\s*\d{4}.*$/gm, '')
        .replace(/9702\/\d{1,2}.*$/gm, '')
        .replace(/Cambridge International.*$/gm, '')
        .replace(/PUBLISHED.*$/gm, '')
        .replace(/Page \d+ of \d+.*$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      if (cleaned.length < 2) continue;

      // Sum CIE mark codes: B1, B2, M1, A1, A2, C1, C2... The digit
      // immediately after the letter is the mark count for that point.
      let marks = 0;
      const markRe = /\b([ABCM])(\d)\b/g;
      let mm: RegExpExecArray | null;
      while ((mm = markRe.exec(cleaned)) !== null) marks += parseInt(mm[2], 10);

      const sortOrder = orderByQ[cur.number] ?? 0;
      orderByQ[cur.number] = sortOrder + 1;
      rows.push({
        number: cur.number,
        partLabel: cur.partLabel || null,
        text: cleaned,
        marks: marks || 1,
        sortOrder,
      });
    }
    return rows;
  }
}
