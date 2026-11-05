import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtraPracticeService, buildExtraWord } from './extra-practice';
import { ExtraPracticeController } from './extra-practice.controller';
import { VocabularyMemoryService } from './vocabulary-memory.service';
import { sentenceHash } from '../audio/sentence-audio';

const context = { id: 'c', kind: 'article_original', position: 1, difficulty: 1,
  qualityStatus: 'ready', sentence: 'We take care.', translation: '我们会小心。' };
const sense = { id: 's', qualityStatus: 'ready', translation: '小心', lexeme: { headword: 'care' },
  collocations: ['take care'], contexts: [context], items: [{ contextId: 'c', completedAt: new Date() }] };
function setup() {
  const rows = new Map<string, any>();
  const db = { studentVocabularySense: { findMany: vi.fn(async () => [{ senseId: 's', due: new Date(), sense }]) },
    vocabularyV2SessionItem: { findMany: vi.fn(async () => []) },
    learningEvidence: { findMany: vi.fn(async () => []), createMany: vi.fn(async ({ data }: any) => {
      const row = data[0]; if (rows.has(row.sourceKey)) return { count: 0 };
      rows.set(row.sourceKey, row); return { count: 1 };
    }) }, mistakeEntry: { findFirst: vi.fn(async () => null) } };
  return { service: new ExtraPracticeService(db as any), db, rows };
}
afterEach(() => { delete process.env.EXTRA_PRACTICE_FEATURE; vi.restoreAllMocks(); });
describe('extra practice', () => {
  it('skips unsafe, unready and unlearned words; missing ladder steps stay absent', () => {
    expect(buildExtraWord({ ...sense, items: [] }, 'ladder')).toBeNull();
    expect(buildExtraWord({ ...sense, qualityStatus: 'pending_review' }, 'type')).toBeNull();
    expect(buildExtraWord({ ...sense, lexeme: { headword: 'fuck' } }, 'type')).toBeNull();
    expect(buildExtraWord({ ...sense, translation: '' }, 'ladder')).toBeNull();
    expect(buildExtraWord({ ...sense, contexts: [], collocations: [] }, 'ladder')?.steps.map(s => s.step)).toEqual([1]);
    expect(buildExtraWord(sense, 'ladder')?.steps.map(s => s.step)).toEqual([1, 2, 3]);
    expect(buildExtraWord({ ...sense, contexts: [{ ...context, qualityStatus: 'blocked_school' }] }, 'ladder')?.steps.map(s => s.step)).toEqual([1]);
  });
  it('bounds selection, requires completed daily learning, skips unresolved errors', async () => {
    const { service, db } = setup();
    db.mistakeEntry.findFirst.mockResolvedValueOnce({ id: 'wrong' } as any);
    expect((await service.round('student', 'type')).items).toEqual([]);
    const query = db.studentVocabularySense.findMany.mock.calls[0] as any;
    expect(query[0].take).toBeLessThanOrEqual(60);
    expect(JSON.stringify(query[0].where)).toContain('daily_learning');
    expect(JSON.stringify(query[0].where)).toContain('completed');
    db.studentVocabularySense.findMany.mockResolvedValue(Array.from({ length: 60 }, (_, i) => ({ senseId: `s${i}`, due: new Date(), sense: { ...sense, id: `s${i}` } })));
    expect((await service.round('student', 'type')).items).toHaveLength(10);
  });
  it('filters formal unresolved mistakes, unsafe context/Chinese and long sentence steps', async () => {
    const { service, db } = setup();
    db.learningEvidence.findMany.mockResolvedValue([{ studentId: 'student', senseId: 's', kind: 'formal_first', subject: 'vocab_sense',
      isCorrect: false, hinted: false, sourceKey: 'wrong', schoolDate: new Date('2026-11-01'), occurredAt: new Date('2026-11-01') }] as any);
    expect((await service.round('student', 'type')).items).toHaveLength(0);
    expect(buildExtraWord({ ...sense, translation: 'oral sex' }, 'ladder')).toBeNull();
    expect(buildExtraWord({ ...sense, contexts: [{ ...context, sentence: 'oral sex' }] }, 'ladder')?.steps.map(s => s.step)).toEqual([1]);
    expect(buildExtraWord({ ...sense, contexts: [{ ...context, sentence: Array(15).fill('care').join(' ') }] }, 'ladder')?.steps.some(s => s.step === 3)).toBe(false);
    const seen = { ...context, id: 'seen', sentence: 'Please take care.', kind: 'short_same_meaning' };
    expect(buildExtraWord({ ...sense, contexts: [context, seen], items: [{ contextId: 'seen', completedAt: new Date() }] }, 'ladder')?.steps.at(-1)?.answer).toBe(seen.sentence);
    expect(buildExtraWord({ ...sense, contexts: [], items: [{ contextId: 'seen', completedAt: new Date(), context: seen }] }, 'ladder')?.steps.at(-1)?.answer).toBe(seen.sentence);
  });
  it('shadow uses the latest assigned level, recorded sentences only, short first and max five', async () => {
    const { service, db, rows } = setup();
    const sentences = ['We take care.', 'We read every day.', 'I like this book.', 'They are at school.', 'It is a nice day.', 'Please come here.'];
    Object.assign(db, {
      user: { findUnique: vi.fn(async () => ({ englishLevel: 'olevel' })) },
      classEnrollment: { findMany: vi.fn(async () => [{ classId: 'class', joinedAt: new Date('2026-01-01') }]) },
      studentLevelChange: { findMany: vi.fn(async () => []) },
      paperAssignment: { findMany: vi.fn(async () => ['olevel', 'ielts_authentic'].map((level, i) => ({
        id: `assignment${i}`, classId: 'class', paperId: `paper${i}`, assignedAt: new Date('2026-11-06'), submissions: [],
        morningQuizSession: { id: `reading${i}`, date: new Date('2026-11-06'), level, status: 'active' },
      }))) },
      paperQuestion: { findMany: vi.fn(async () => [{ snapshotContent: { passage: sentences.join(' ') + ' This has no audio.' } }]) },
      sentenceAudio: { findMany: vi.fn(async ({ where }: any) => where.textHash.in.filter((h: string) => sentences.some(s => sentenceHash(s) === h)).map((textHash: string) => ({ textHash }))) },
    });
    const round = await service.round('student', 'shadow', new Date('2026-11-06T08:00:00Z'));
    expect(round.items).toHaveLength(5);
    expect(round.items.every(i => i.audioUrl && i.text !== 'This has no audio.')).toBe(true);
    expect((db as any).paperQuestion.findMany.mock.calls[0][0].where).toEqual({ paperId: 'paper0' });
    const item = round.items[0];
    await service.result('student', { roundId: round.roundId, roundToken: round.roundToken, drill: 'shadow', textHash: item.textHash,
      attempt: 'first', isCorrect: null, hinted: false, timeBucket: 'normal' }, new Date('2026-11-06T17:00:00Z'));
    expect([...rows.values()][0]).toMatchObject({ subject: 'reading_sentence', isCorrect: null, schoolDate: new Date('2026-11-07') });
    expect(db.studentVocabularySense.findMany).not.toHaveBeenCalled();
  });
  it('deduplicates concurrent first/retry delivery and never invokes memory', async () => {
    const memory = vi.spyOn(VocabularyMemoryService.prototype, 'record');
    const transactionMemory = vi.spyOn(VocabularyMemoryService.prototype, 'recordInTransaction');
    const { service, rows } = setup();
    const round = await service.round('student', 'type');
    const body = { roundId: round.roundId, roundToken: round.roundToken, drill: 'type' as const, senseId: 's', step: 1,
      attempt: 'first' as const, isCorrect: false, hinted: false, timeBucket: 'normal' as const };
    await Promise.all([service.result('student', body), service.result('student', { ...body, isCorrect: true })]);
    expect(rows.size).toBe(1); expect([...rows.values()][0].isCorrect).toBe(false);
    const retry = { ...body, attempt: 'retry' as const, retryN: 1 };
    await Promise.all([service.result('student', retry), service.result('student', retry)]);
    expect(rows.size).toBe(2); expect(memory).not.toHaveBeenCalled();
    expect(transactionMemory).not.toHaveBeenCalled();
    expect([...rows.values()][0].detail).toMatchObject({ roundItemCount: 1, itemSteps: [1] });
    expect([...rows.values()][0].schoolDate.toISOString()).toMatch(/T00:00:00.000Z$/);
  });
  it('rejects forged student, round, item, step, retry number and token', async () => {
    const { service } = setup(); const r = await service.round('student', 'type');
    const body = { roundId: r.roundId, roundToken: r.roundToken, drill: 'type' as const, senseId: 's', step: 1,
      attempt: 'first' as const, hinted: false, isCorrect: true, timeBucket: 'fast' as const };
    for (const patch of [{ roundId: crypto.randomUUID() }, { senseId: 'other' }, { step: 3 },
      { roundToken: r.roundToken + 'x' }, { drill: 'shadow' }, { attempt: 'retry' }]) {
      await expect(service.result('student', { ...body, ...patch } as any)).rejects.toThrow();
    }
    await expect(service.result('someone-else', body)).rejects.toThrow();
    const another = await service.round('student', 'type');
    await expect(service.result('student', { ...body, roundId: another.roundId })).rejects.toThrow();
  });
  it('feature off rejects GET/POST including malformed input before work', async () => {
    const { service, db } = setup(); const controller = new ExtraPracticeController(service);
    process.env.EXTRA_PRACTICE_FEATURE = 'off';
    expect(() => controller.round({ studentAuth: { id: 's' } } as any, 'wrong')).toThrow();
    expect(() => controller.result({ studentAuth: { id: 's' } } as any, {})).toThrow();
    await expect(service.round('student', 'type')).rejects.toMatchObject({ status: 404 });
    expect(db.studentVocabularySense.findMany).not.toHaveBeenCalled();
  });
});
