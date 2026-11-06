import type { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { dateOnly, loadSchoolCalendar, nextDate } from '../common/school-calendar';
import { scheduleV2Review, type V2ScheduleState } from './fsrs';
import { gradedVocabularyEvidence, orderedEvidence, teachingDistance, unresolvedVocabularyMistake, type MemoryEvidence } from './mastery';

type EvidenceInput = Prisma.LearningEvidenceCreateManyInput & MemoryEvidence;
export const evidenceRating = (e: MemoryEvidence): 'good' | 'hard' | 'again' | null =>
  !gradedVocabularyEvidence(e) ? null : !e.isCorrect ? 'again' : e.kind !== 'paper_dictation' && e.hinted ? 'hard' : 'good';

/** Shared entry point for formal answers, mistake redo and the 2C paper writer.
 * The evidence insertion and card update MUST share the caller's transaction.
 * All vocabulary writers acquire the profile lock before other row locks. */
export async function lockVocabularyStudent(tx: Prisma.TransactionClient, studentId: string) {
  await tx.studentVocabularyProfile.upsert({ where: { studentId }, create: { studentId }, update: { updatedAt: new Date() } });
}

@Injectable()
export class VocabularyMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  record(evidence: EvidenceInput) {
    return this.prisma.$transaction((tx) => this.recordInTransaction(tx, evidence));
  }

  async recordInTransaction(tx: Prisma.TransactionClient, evidence: EvidenceInput) {
    await lockVocabularyStudent(tx, evidence.studentId);
    const inserted = await tx.learningEvidence.createMany({ data: [evidence], skipDuplicates: true });
    const rating = evidenceRating(evidence);
    if (!inserted.count || !evidence.senseId || (!rating && evidence.kind !== 'paper_dictation'))
      return { inserted: inserted.count > 0, scheduled: false };
    const where = { studentId_senseId: { studentId: evidence.studentId, senseId: evidence.senseId } };
    const [calendar, history] = await Promise.all([
      loadSchoolCalendar(tx, [evidence.studentId]),
      tx.learningEvidence.findMany({ where: { studentId: evidence.studentId, senseId: evidence.senseId, subject: 'vocab_sense' } }),
    ]);
    const effective = orderedEvidence(history);
    const activeKeys = new Set(effective.map((entry) => entry.sourceKey));
    // An ordinary absence has no rating and leaves an existing schedule alone.
    // An amendment to absent must replay without its superseded grade.
    if (!rating && !history.some((entry) => gradedVocabularyEvidence(entry) && !activeKeys.has(entry.sourceKey)))
      return { inserted: true, scheduled: false };
    const teaches = (day: string) => calendar.isTeachingDay(evidence.studentId, day);
    // Replay actual records in school-date order. This also handles a paper
    // result entered late: no fabricated history, no backwards lastReview,
    // and concurrent sources give the same final card in either arrival order.
    let card: V2ScheduleState | null = null;
    const prefix: MemoryEvidence[] = [];
    for (const entry of effective.filter(gradedVocabularyEvidence)) {
      const today = entry.schoolDate.toISOString().slice(0, 10);
      const now = dateOnly(today);
      const current: V2ScheduleState | null = card ? { ...card,
        lastReview: new Date(now.getTime() - teachingDistance(card.lastReview!.toISOString().slice(0, 10), today, teaches) * 86400_000),
      } : null;
      const next = scheduleV2Review(current, evidenceRating(entry)!, now);
      prefix.push(entry);
      // A hinted or same-day correction keeps the error due the next class.
      const interval = unresolvedVocabularyMistake(prefix) ? 1 : Math.max(1, next.scheduledDays);
      let due = today;
      for (let left = interval; left > 0;) { due = nextDate(due, 1); if (teaches(due)) left--; }
      card = { ...next, due: dateOnly(due), scheduledDays: interval, createdAt: now };
    }
    if (!card) {
      // All graded records were retracted. Preserve notebook membership and
      // reps (the word was learned), but clear recalled-memory scheduling.
      // Reps alone keeps the word eligible for a future first formal recall.
      await tx.studentVocabularySense.updateMany({ where: { studentId: evidence.studentId, senseId: evidence.senseId }, data: {
        due: evidence.schoolDate, stability: 0, difficulty: 0, elapsedDays: 0, scheduledDays: 0, lapses: 0, lastReview: null,
      } });
      return { inserted: true, scheduled: false };
    }
    const { createdAt: _createdAt, ...data } = card;
    await tx.studentVocabularySense.upsert({ where,
      create: { studentId: evidence.studentId, senseId: evidence.senseId, ...data }, update: data,
    });
    return { inserted: true, scheduled: true };
  }
}
