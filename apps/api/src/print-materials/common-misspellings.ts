import type { PrismaService } from '../common/prisma.service';

export type Misspelling = { spelling: string; count: number };
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Only spelling-shaped input is printable. Free text, names and choice answers are excluded. */
export function spellingOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.normalize('NFKC').trim().toLowerCase();
  return /^[a-z]+(?:['-][a-z]+)*$/.test(text) && text.length <= 64 ? text : null;
}

export async function commonMisspellings(prisma: PrismaService, studentIds: string[], senseIds: string[]) {
  const result = new Map<string, Misspelling[]>();
  if (!studentIds.length || !senseIds.length) return result;
  const records = await prisma.learningEvidence.findMany({
    where: { studentId: { in: studentIds }, senseId: { in: senseIds }, subject: 'vocab_sense',
      kind: { in: ['practice_first', 'practice_retry', 'formal_first'] }, isCorrect: false },
    select: { senseId: true, kind: true, detail: true, sessionItemId: true },
  });
  // Formal-first records intentionally do not copy response. Read the immutable first answer.
  const ids = [...new Set(records.filter((r) => r.kind === 'formal_first' && r.sessionItemId).map((r) => r.sessionItemId!))];
  const items = ids.length ? await prisma.vocabularyV2SessionItem.findMany({
    where: { id: { in: ids }, session: { studentId: { in: studentIds } } },
    select: { id: true, firstResponse: true, firstIsCorrect: true, firstAnsweredAt: true, response: true, isCorrect: true, questionSnapshot: true },
  }) : [];
  const byId = new Map(items.map((item) => [item.id, item]));
  const counts = new Map<string, Map<string, number>>();
  for (const record of records) {
    if (!record.senseId) continue;
    let typed: unknown = object(record.detail).typed;
    if (record.kind === 'formal_first') {
      const item = byId.get(record.sessionItemId ?? '');
      // Only a spelling question is a misspelling; MCQ values such as "A" are not.
      const question = object(item?.questionSnapshot);
      if (question.type !== 'spelling' && question.type !== 'listening_spelling') continue;
      if (item?.firstResponse && item.firstIsCorrect === false) typed = object(item.firstResponse).value;
      else if (!item?.firstAnsweredAt && item?.isCorrect === false) typed = object(item.response).value;
      else continue;
    }
    const spelling = spellingOf(typed);
    if (!spelling) continue;
    const bucket = counts.get(record.senseId) ?? new Map<string, number>();
    bucket.set(spelling, (bucket.get(spelling) ?? 0) + 1);
    counts.set(record.senseId, bucket);
  }
  for (const [id, bucket] of counts) result.set(id, [...bucket].filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 2).map(([spelling, count]) => ({ spelling, count })));
  return result;
}
