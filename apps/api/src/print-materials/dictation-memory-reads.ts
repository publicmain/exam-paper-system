import type { Prisma } from '@prisma/client';
import type { MemoryEvidence } from '../vocab-v2/mastery';

/** Only used after acquiring this student's profile lock. Keep the existing
 * memory writer/rating rules, but read all affected word histories together.
 * Calendar reads are immutable during this transaction and shared by its words.
 * Every write still goes through the real transaction; nothing survives rollback.
 */
export async function dictationMemoryReads(tx: Prisma.TransactionClient, studentId: string, senseIds: string[]) {
  let history: MemoryEvidence[] = await tx.learningEvidence.findMany({
    where: { studentId, subject: 'vocab_sense', senseId: { in: senseIds } },
  });
  const senses = new Set(senseIds);
  const calendarDelegate = <T extends { findMany: (...args: any[]) => any }>(delegate: T): T => {
    const reads = new Map<string, Promise<unknown>>();
    return new Proxy(delegate, { get(target, property) {
      if (property !== 'findMany') return Reflect.get(target, property);
      return (args: unknown) => {
        const key = JSON.stringify(args);
        if (!reads.has(key)) reads.set(key, Promise.resolve(target.findMany(args)));
        return reads.get(key);
      };
    } });
  };
  const learningEvidence = new Proxy(tx.learningEvidence, { get(target, property) {
    if (property === 'findMany') return (args: Prisma.LearningEvidenceFindManyArgs) => {
      const where = args.where;
      // The exact read used by VocabularyMemoryService. Any future/new query
      // falls through rather than silently receiving incomplete cached history.
      if (Object.keys(args).length === 1 && where && Object.keys(where).length === 3
        && where.studentId === studentId && where.subject === 'vocab_sense'
        && typeof where.senseId === 'string' && senses.has(where.senseId)) {
        return Promise.resolve(history.filter((e) => e.senseId === where.senseId));
      }
      return target.findMany(args);
    };
    if (property === 'createMany') return async (args: Prisma.LearningEvidenceCreateManyArgs) => {
      const result = await target.createMany(args);
      const data = Array.isArray(args.data) ? args.data : [args.data];
      if (result.count === data.length) history.push(...data as MemoryEvidence[]);
      else if (result.count) history = await target.findMany({
        where: { studentId, subject: 'vocab_sense', senseId: { in: senseIds } },
      });
      return result;
    };
    return Reflect.get(target, property);
  } });
  const classEnrollment = calendarDelegate(tx.classEnrollment);
  const classNoSchoolDay = calendarDelegate(tx.classNoSchoolDay);
  return new Proxy(tx, { get(target, property) {
    if (property === 'learningEvidence') return learningEvidence;
    if (property === 'classEnrollment') return classEnrollment;
    if (property === 'classNoSchoolDay') return classNoSchoolDay;
    return Reflect.get(target, property);
  } });
}
