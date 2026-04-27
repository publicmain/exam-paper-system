import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { FileKind, ProcessStatus, SourceFile } from '@prisma/client';

interface MsRow {
  number: string;
  text: string;
  marks: number;
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
      const row = rows.find((r) => r.number === item.questionNumber);
      if (!row) continue;
      // Replace prior MS items so re-runs are idempotent.
      await this.prisma.markSchemeItem.deleteMany({ where: { questionItemId: item.id } });
      await this.prisma.markSchemeItem.create({
        data: {
          questionItemId: item.id,
          pointText: row.text.slice(0, 4000),
          marks: row.marks,
          matchConfidence: 0.7,
        },
      });
      matched++;
    }

    return { qpFileId: qp.id, msFileId: ms.id, matched, notes };
  }

  /**
   * MCQ mark schemes are tabular: number + letter + (sometimes) marks.
   * Lines look like "1 D 1" or "1   D" with 1 mark implied.
   */
  private parseMcqMs(text: string): MsRow[] {
    const rows: MsRow[] = [];
    const seen = new Set<string>();
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*(\d{1,2})\s+([A-D])(?:\s+(\d))?\s*$/);
      if (!m) continue;
      const n = m[1];
      if (seen.has(n)) continue;
      seen.add(n);
      rows.push({ number: n, text: m[2], marks: m[3] ? parseInt(m[3], 10) : 1 });
    }
    return rows;
  }

  /**
   * Structured mark schemes are messy. We do a line-pass split by question
   * number similar to QuestionSplitter; the entire body becomes one
   * MarkSchemeItem and a reviewer cleans up granular per-part rows later.
   */
  private parseStructuredMs(text: string): MsRow[] {
    const rows: MsRow[] = [];
    const lines = text.split('\n');
    let cur: { number: string; buf: string[] } | null = null;
    let last = 0;
    for (const line of lines) {
      const m = line.match(/^\s*(\d{1,2})\s*[.)]?\s+/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n === last + 1 && n <= 15) {
          if (cur) rows.push(this.finalizeStructuredRow(cur));
          cur = { number: String(n), buf: [line] };
          last = n;
          continue;
        }
      }
      if (cur) cur.buf.push(line);
    }
    if (cur) rows.push(this.finalizeStructuredRow(cur));
    return rows;
  }

  private finalizeStructuredRow(cur: { number: string; buf: string[] }): MsRow {
    const text = cur.buf.join('\n');
    const totalMatch = text.match(/\[\s*total[:\s]*\s*(\d{1,2})\s*\]/i);
    let marks = totalMatch ? parseInt(totalMatch[1], 10) : 0;
    if (!marks) {
      const re = /\[\s*(\d{1,2})\s*\]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) marks += parseInt(m[1], 10);
    }
    return { number: cur.number, text, marks: marks || 1 };
  }
}
