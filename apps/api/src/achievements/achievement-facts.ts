import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { sgtKey } from './badge-time';
import { headwordKey } from '../vocab-v2/unified-vocabulary-rules';
import { emptyTieredFacts, type MetricEvent, type TieredAchievementFacts } from './tiered-badge-rules';

const PAGE_SIZE = 250;
const object = (value: unknown): Record<string, unknown> => value != null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const nonblank = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
export function validFormalResponse(snapshot: unknown, response: unknown): boolean {
  const question = object(snapshot), value = object(response).value;
  if (question.type === 'meaning_choice') {
    if (!(typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value.trim())))) return false;
    const index = Number(value);
    return Number.isInteger(index) && index >= 0 && Array.isArray(question.options) && index < question.options.length;
  }
  return question.type === 'spelling' && nonblank(value);
}
const validAt = (value: Date | null | undefined, now: Date): value is Date => value instanceof Date && Number.isFinite(value.getTime()) && value <= now;
const dateKey = (value: Date) => value.toISOString().slice(0, 10);

/** Cursor paging deliberately has no 400/600 lifetime truncation. No writes or grade calculation. */
export async function loadTieredAchievementFacts(prisma: PrismaService, studentId: string, now = new Date()): Promise<TieredAchievementFacts> {
  const user = await prisma.user.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!user) throw new NotFoundException({ code: 'student_not_found' });
  const today = new Date(`${sgtKey(now)}T00:00:00.000Z`);
  const facts = emptyTieredFacts();
  const readings = new Map<string, MetricEvent & { date: string }>();
  const readingTasks: Array<MetricEvent & { date: string }> = [];
  let after: string | undefined;
  for (;;) {
    const rows = await prisma.studentSubmission.findMany({
      where: { studentId, status: { in: ['submitted', 'marked'] }, submitSource: { in: ['student', 'teacher'] },
        finalSubmittedAt: { not: null, lte: now },
        assignment: { morningQuizSession: { is: { date: { lte: today }, status: { not: 'cancelled' } } } } },
      orderBy: { id: 'asc' }, take: PAGE_SIZE, ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      select: { id: true, finalSubmittedAt: true, status: true, submitSource: true,
        scripts: { select: { selectedOption: true, textAnswer: true } },
        assignment: { select: { paperId: true, morningQuizSession: { select: { date: true, status: true } } } } },
    });
    for (const row of rows) {
      const session = row.assignment.morningQuizSession;
      if (!session || session.status === 'cancelled' || !validAt(row.finalSubmittedAt, now) ||
        !['submitted', 'marked'].includes(row.status) || !['student', 'teacher'].includes(row.submitSource ?? '') ||
        !row.scripts.some((script) => nonblank(script.selectedOption) || nonblank(script.textAnswer))) continue;
      const key = row.assignment.paperId;
      const event = { key, submissionId: row.id, at: row.finalSubmittedAt, date: dateKey(session.date) };
      readingTasks.push(event);
      if (!readings.has(key) || readings.get(key)!.at > event.at) readings.set(key, event);
    }
    if (rows.length < PAGE_SIZE) break;
    after = rows[rows.length - 1].id;
  }
  facts.readings = [...readings.values()];

  // Question structure is used only to validate a real response. Neither answer
  // keys nor published grades are used or returned in the compact event evidence.
  const daily = new Map<string, { key: string; date: string; at: Date | null; completed: boolean; learned: number }>();
  const candidates: Array<MetricEvent & { dailyId: string; date: string }> = [];
  const words = new Map<string, MetricEvent>();
  const learningEvents: MetricEvent[] = [];
  after = undefined;
  for (;;) {
    const rows = await prisma.vocabularyV2Session.findMany({
      where: { studentId, sessionType: { in: ['daily_learning', 'formal_test'] }, date: { lte: today }, createdAt: { lte: now } },
      orderBy: { id: 'asc' }, take: PAGE_SIZE, ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      select: { id: true, sessionKey: true, date: true, sessionType: true, status: true, target: true, completedAt: true, settingsSnapshot: true,
        items: { select: { id: true, status: true, completedAt: true, response: true, contentSnapshot: true, questionSnapshot: true,
          sense: { select: { lexeme: { select: { headword: true } } } } } } },
    });
    for (const row of rows) {
      if (row.date > today) continue;
      if (row.sessionType === 'daily_learning') {
        let learned = 0;
        for (const item of row.items) {
          if (item.status !== 'completed' || !['normal', 'hard'].includes(String(object(item.response).action ?? '')) || !validAt(item.completedAt, now)) continue;
          const key = headwordKey(String(object(item.contentSnapshot).headword ?? item.sense.lexeme.headword));
          if (!key) continue;
          learned++;
          const event = { key, at: item.completedAt, sessionId: row.id, itemId: item.id };
          learningEvents.push(event);
          if (!words.has(key) || words.get(key)!.at > event.at) words.set(key, event);
        }
        daily.set(row.id, { key: row.sessionKey, date: dateKey(row.date), learned,
          completed: row.status === 'completed', at: validAt(row.completedAt, now) ? row.completedAt : null });
      } else if (row.sessionType === 'formal_test' && row.status === 'submitted' && validAt(row.completedAt, now) &&
        row.items.length > 0 && row.target === row.items.length && row.items.every((item) => item.status === 'answered' && validFormalResponse(item.questionSnapshot, item.response))) {
        const dailyId = object(row.settingsSnapshot).dailySessionId;
        if (typeof dailyId === 'string') candidates.push({ key: dailyId, dailyId, sessionId: row.id, date: dateKey(row.date), at: row.completedAt });
      }
    }
    if (rows.length < PAGE_SIZE) break;
    after = rows[rows.length - 1].id;
  }
  facts.words = [...words.values()];
  const tests = new Map<string, typeof candidates[number]>();
  for (const candidate of candidates) {
    const learning = daily.get(candidate.dailyId);
    if (!learning?.completed || !learning.at || learning.learned < 1 || learning.date !== candidate.date || candidate.at < learning.at) continue;
    if (!tests.has(candidate.dailyId) || tests.get(candidate.dailyId)!.at > candidate.at) tests.set(candidate.dailyId, candidate);
  }
  facts.tests = [...tests.values()];
  const fullDays = new Map<string, MetricEvent>();
  for (const test of tests.values()) {
    // A repeated teacher assignment is still a real task. Deduplication of the
    // reading-collection medal must not erase the student's completed task date.
    const matching = readingTasks.filter((reading) => reading.date === test.date).sort((a, b) => a.at.getTime() - b.at.getTime());
    if (!matching.length) continue;
    const reading = matching[0], at = new Date(Math.max(reading.at.getTime(), test.at.getTime(), daily.get(test.dailyId)!.at!.getTime()));
    const event = { key: test.date, at, submissionId: reading.submissionId, sessionId: test.sessionId };
    if (!fullDays.has(event.key) || fullDays.get(event.key)!.at > at) fullDays.set(event.key, event);
  }
  facts.fullDays = [...fullDays.values()];
  const days = new Map<string, MetricEvent>();
  for (const event of [...readingTasks, ...learningEvents, ...facts.tests]) {
    const key = sgtKey(event.at);
    if (!days.has(key) || days.get(key)!.at > event.at) days.set(key, { ...event, key });
  }
  facts.activeDays = [...days.values()];
  return facts;
}
