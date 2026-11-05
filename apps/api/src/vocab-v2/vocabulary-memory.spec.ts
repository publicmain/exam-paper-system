import { describe, expect, it } from 'vitest';
import { dateOnly, singaporeDate } from '../common/school-calendar';
import { evidenceRating, VocabularyMemoryService } from './vocabulary-memory.service';
import { unresolvedVocabularyMistake } from './mastery';
import { makeService, newDb, seedOfficialWords, seedStudent } from './testing/vocab-fixtures';

function setup() {
  const db = newDb(); const id = seedStudent(db);
  const [word] = seedOfficialWords(db, 'ngsl', 1801, 1);
  const service = new VocabularyMemoryService(db as any);
  const evidence = (key: string, date = '2026-11-05', extra: Record<string, any> = {}) => ({
    studentId: id, senseId: word.senseId, subject: 'vocab_sense', kind: 'formal_first',
    sourceKey: key, schoolDate: dateOnly(date), occurredAt: new Date(`${date}T04:00:00Z`),
    isCorrect: true, hinted: false, ...extra,
  });
  const card = () => db.rows('studentVocabularySense')[0];
  return { db, id, word, service, evidence, card };
}

describe('正式作答驱动调度', () => {
  it.each([
    ['formal_first', true, false, 'good'], ['formal_first', true, true, 'hard'], ['formal_first', false, true, 'again'],
    ['mistake_redo', true, false, 'good'], ['mistake_redo', true, true, 'hard'], ['mistake_redo', false, false, 'again'],
    ['paper_dictation', true, true, 'good'], ['paper_dictation', false, false, 'again'], ['paper_dictation', null, false, null],
    ['practice_first', true, false, null], ['practice_retry', false, false, null], ['self_report', true, false, null],
  ])('%s / %s / 提示 %s → %s', (kind, isCorrect, hinted, rating) => {
    const { evidence } = setup();
    expect(evidenceRating(evidence('e', undefined, { kind, isCorrect, hinted }))).toBe(rating);
  });
  it('同来源并发与重试只推进一次；不同来源并发无丢失', async () => {
    const { db, service, evidence, card } = setup();
    await Promise.all([1, 2, 3].map(() => service.record(evidence('same'))));
    expect(db.rows('learningEvidence')).toHaveLength(1);
    expect(card().reps).toBe(1);
    const before = card();
    await service.record(evidence('same', undefined, { isCorrect: false }));
    expect(card()).toEqual(before);
    await Promise.all([service.record(evidence('a')), service.record(evidence('b'))]);
    expect(card().reps).toBe(3);
    expect(db.rows('learningEvidence')).toHaveLength(3);
  });
  it('写卡失败时证据一起回滚，重试才推进', async () => {
    const { db, service, evidence, card } = setup();
    const transact = db.$transaction;
    db.$transaction = (run: any) => transact(async (tx: any) => {
      tx.studentVocabularySense.upsert = async () => { throw new Error('card failed'); };
      return run(tx);
    });
    await expect(service.record(evidence('one'))).rejects.toThrow('card failed');
    expect(db.rows('learningEvidence')).toHaveLength(0);
    expect(card()).toBeUndefined();
    db.$transaction = transact;
    await service.record(evidence('one'));
    expect(card().reps).toBe(1);
  });
  it('练习 / 自报 / 缺考留原记录但不建卡；旧阶段、练习次数不伪造历史', async () => {
    const { db, id, word, service, evidence, card } = setup();
    for (const kind of ['practice_first', 'practice_retry', 'self_report']) await service.record(evidence(kind, undefined, { kind }));
    await service.record(evidence('absent', undefined, { kind: 'paper_dictation', isCorrect: null, detail: { absent: true } }));
    expect(card()).toBeUndefined();
    db.seed('studentVocabularySense', { studentId: id, senseId: word.senseId, masteryStage: 8, reps: 80, stability: 99 });
    await service.record(evidence('first'));
    expect(card()).toMatchObject({ reps: 1, lastReview: dateOnly('2026-11-05') });
  });
  it('Hard 比 Good 更早回来；错误次教学日再考，同日和提示订正不消', async () => {
    const a = setup(); const b = setup();
    await a.service.record(a.evidence('g'));
    await b.service.record(b.evidence('h', undefined, { hinted: true }));
    expect(b.card().due.getTime()).toBeLessThan(a.card().due.getTime());
    await a.service.record(a.evidence('wrong', '2026-11-06', { isCorrect: false }));
    expect(a.card().due).toEqual(dateOnly('2026-11-09'));
    await a.service.record(a.evidence('same-day', '2026-11-06', { occurredAt: new Date('2026-11-06T05:00:00Z') }));
    expect(a.card().due).toEqual(dateOnly('2026-11-09'));
    await a.service.record(a.evidence('hinted', '2026-11-09', { hinted: true }));
    expect(unresolvedVocabularyMistake(a.db.rows('learningEvidence') as any)).toBe('2026-11-06');
    await a.service.record(a.evidence('clear', '2026-11-10', { kind: 'mistake_redo' }));
    expect(unresolvedVocabularyMistake(a.db.rows('learningEvidence') as any)).toBeNull();
  });
  it('停课只顺延，不增加遗忘惩罚；多班有一个开课就照常计日', async () => {
    const a = setup(); const b = setup();
    b.db.seed('classNoSchoolDay', { classId: 'class-1', date: dateOnly('2026-11-09') });
    await a.service.record(a.evidence('first', '2026-11-06', { isCorrect: false }));
    await b.service.record(b.evidence('first', '2026-11-06', { isCorrect: false }));
    expect(a.card().due).toEqual(dateOnly('2026-11-09'));
    expect(b.card().due).toEqual(dateOnly('2026-11-10'));
    await a.service.record(a.evidence('next', '2026-11-09'));
    await b.service.record(b.evidence('next', '2026-11-10'));
    expect(b.card().elapsedDays).toBe(a.card().elapsedDays);
    expect(b.card().stability).toBe(a.card().stability);
    b.db.seed('class', { id: 'second' });
    b.db.seed('classEnrollment', { classId: 'second', userId: b.id, joinedAt: dateOnly('2026-11-01') });
    await b.service.record(b.evidence('later', '2026-11-06', { isCorrect: false }));
    // Late entries replay actual dates, lastReview remains the latest date.
    expect(b.card().lastReview).toEqual(dateOnly('2026-11-10'));
  });
  it('跨 UTC 午夜同一教学日；晚录入默写与按时间录入得到同样卡片', async () => {
    const a = setup(); const b = setup();
    const early = new Date('2026-11-04T23:59:59Z'); const late = new Date('2026-11-05T00:00:01Z');
    expect(singaporeDate(early)).toBe(singaporeDate(late));
    const one = a.evidence('one', singaporeDate(early), { occurredAt: early, kind: 'paper_dictation' });
    const two = a.evidence('two', singaporeDate(late), { occurredAt: late });
    await a.service.record(one); await a.service.record(two);
    await b.service.record(two); await b.service.record(one);
    for (const key of ['due', 'stability', 'difficulty', 'elapsedDays', 'scheduledDays', 'reps', 'lapses', 'lastReview']) expect(b.card()[key]).toEqual(a.card()[key]);
  });
  it('加入或稍后再学不能改写已有正式调度', async () => {
    const { db, id, word, service, evidence, card } = setup();
    await service.record(evidence('first'));
    const before = card(); const svc = makeService(db);
    for (const action of ['learn', 'later'] as const) {
      await svc.collect(id, { senseId: word.senseId, headword: word.headword, action });
      for (const key of ['due', 'stability', 'difficulty', 'elapsedDays', 'scheduledDays', 'reps', 'lapses', 'lastReview']) expect(card()[key]).toEqual(before[key]);
    }
  });
});
