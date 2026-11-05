import { describe, expect, it, vi } from 'vitest';
import { VocabularyV2Service } from './vocabulary-v2.service';

const now = new Date('2026-11-05T08:00:00Z');
function setup(status = 'submitted') {
  const item = (id: number, source: string, firstIsCorrect: boolean, legacy = false) => ({
    id: `q${id}`, position: id, source, status: 'answered', isCorrect: true,
    response: { value: 'corrected' }, firstResponse: { value: `original-${id}` },
    firstIsCorrect, firstAnsweredAt: legacy ? null : now,
    questionSnapshot: { type: 'spelling', answer: 'apple', options: [] }, contentSnapshot: { headword: 'apple' },
  });
  const row = { id: 'test', date: now, target: 4, sessionType: 'formal_test', status,
    items: [item(1, 'new', false), item(2, 'review', false), item(3, 'review', true), item(4, 'review', false, true)] };
  const db = { vocabularyV2Session: { findFirst: vi.fn(async () => structuredClone(row)) } };
  return { row, db, service: new VocabularyV2Service(db as never, {} as never) };
}
describe('词测交卷回顾', () => {
  it('重复和并发读取只展示首答与原判分；旧记录保留原来结果，复习旧词单独计数', async () => {
    const { service, row } = setup();
    const snapshot = structuredClone(row);
    const results = await Promise.all([1, 2, 3].map(() => service.testSession('s', 'test', now)));
    for (const r of results) {
      expect(r).toMatchObject({ total: 4, correct: 2, reviewWords: 3, reviewCorrect: 2 });
      expect(r.items[0]).toMatchObject({ response: { value: 'original-1' }, isCorrect: false });
      expect(r.items[3]).toMatchObject({ response: { value: 'corrected' }, isCorrect: true });
    }
    expect(row).toEqual(snapshot);
  });
  it('交卷前不发布总分或旧词正确数', async () => {
    expect(await setup('in_progress').service.testSession('s', 'test', now)).toMatchObject({ correct: null, reviewCorrect: null });
  });
  it('没有旧词时明确为零', async () => {
    const { service, row } = setup();
    row.items.forEach((i) => { i.source = 'new'; });
    expect(await service.testSession('s', 'test', now)).toMatchObject({ reviewWords: 0, reviewCorrect: 0 });
  });
});
