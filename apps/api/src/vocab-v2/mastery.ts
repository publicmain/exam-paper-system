import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { dateOnly, isTeachingDay, loadSchoolCalendar, nextDate } from '../common/school-calendar';

export const MEMORY_KINDS = ['formal_first', 'paper_dictation', 'mistake_redo'] as const;
export interface MemoryEvidence {
  kind: string;
  subject: string;
  isCorrect: boolean | null;
  hinted: boolean;
  schoolDate: Date;
  occurredAt: Date;
  sourceKey: string;
  studentId?: string;
  senseId?: string | null;
  detail?: unknown;
}
export const gradedVocabularyEvidence = (e: MemoryEvidence) =>
  e.subject === 'vocab_sense' && (MEMORY_KINDS as readonly string[]).includes(e.kind) && e.isCorrect !== null;

export function orderedEvidence<T extends MemoryEvidence>(rows: readonly T[]): T[] {
  const distinct = new Map(rows.map((e) => [e.sourceKey, e]));
  const ordered = [...distinct.values()].sort((a, b) => a.schoolDate.getTime() - b.schoolDate.getTime()
    || a.occurredAt.getTime() - b.occurredAt.getTime() || a.sourceKey.localeCompare(b.sourceKey));
  // A teacher amendment replaces the result of that row/word, not another
  // recall attempt. Keep raw records intact; choose the latest BEFORE excluding
  // absences so changing a mark to absent also retracts the old grade.
  const paperKey = (e: T): string | null => {
    const detail = e.detail as { rowId?: unknown } | null;
    return e.kind === 'paper_dictation' && e.subject === 'vocab_sense'
      && typeof detail?.rowId === 'string' && e.senseId
      ? JSON.stringify([e.studentId, detail.rowId, e.senseId]) : null;
  };
  const latestPaper = new Map<string, T>();
  for (const e of ordered) { const key = paperKey(e); if (key) latestPaper.set(key, e); }
  return ordered.filter((e) => { const key = paperKey(e); return !key || latestPaper.get(key) === e; });
}

/** Teaching dates strictly after `from`, through `to` (Fri -> Tue = 2). */
export function teachingDistance(from: string, to: string, teaches: (date: string) => boolean): number {
  let count = 0;
  for (let day = nextDate(from, 1); day <= to; day = nextDate(day, 1)) if (teaches(day)) count++;
  return count;
}

export function vocabularyMastered(rows: readonly MemoryEvidence[], teaches = (d: string) => isTeachingDay(d)): boolean {
  const independent = orderedEvidence(rows).filter((e) => gradedVocabularyEvidence(e) && !e.hinted);
  if (independent.at(-1)?.isCorrect !== true) return false;
  const correct = independent.filter((e) => e.isCorrect === true);
  if (correct.length < 2) return false;
  return teachingDistance(correct[0].schoolDate.toISOString().slice(0, 10), correct.at(-1)!.schoolDate.toISOString().slice(0, 10), teaches) >= 2;
}

/** A same-day correction or a hinted answer never clears a prior error. */
export function unresolvedVocabularyMistake(rows: readonly MemoryEvidence[]): string | null {
  let wrong: string | null = null;
  for (const e of orderedEvidence(rows).filter(gradedVocabularyEvidence)) {
    const day = e.schoolDate.toISOString().slice(0, 10);
    if (e.isCorrect === false) wrong = day;
    else if (!e.hinted && wrong && day > wrong) wrong = null;
  }
  return wrong;
}

/** Batched reads; callers never infer mastery from stage, membership or known. */
@Injectable()
export class VocabularyMasteryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Legacy notebooks identify words by spelling rather than sense id. */
  async headwordsForStudents(studentIds: string[]): Promise<Map<string, Set<string>>> {
    const mastered = await this.forStudents(studentIds);
    const ids = [...new Set([...mastered.values()].flatMap((senses) => [...senses]))];
    const senses = ids.length ? await this.prisma.vocabularySense.findMany({ where: { id: { in: ids } }, include: { lexeme: true } }) : [];
    return new Map([...mastered].map(([studentId, senseIds]) => [studentId,
      new Set(senses.filter((sense) => senseIds.has(sense.id)).map((sense) => sense.lexeme.headword.trim().toLowerCase())),
    ]));
  }

  async forStudents(studentIds: string[], through?: string): Promise<Map<string, Set<string>>> {
    const result = new Map(studentIds.map((id) => [id, new Set<string>()]));
    if (!studentIds.length) return result;
    const [rows, calendar] = await Promise.all([
      this.prisma.learningEvidence.findMany({ where: {
        studentId: { in: studentIds }, subject: 'vocab_sense', kind: { in: [...MEMORY_KINDS] },
        ...(through ? { schoolDate: { lte: dateOnly(through) } } : {}),
      } }),
      loadSchoolCalendar(this.prisma, studentIds, undefined, through),
    ]);
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!row.senseId) continue;
      const key = JSON.stringify([row.studentId, row.senseId]);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    for (const [key, evidence] of groups) {
      const [studentId, senseId] = JSON.parse(key) as [string, string];
      if (vocabularyMastered(evidence, (date) => calendar.isTeachingDay(studentId, date))) result.get(studentId)!.add(senseId);
    }
    return result;
  }
}
