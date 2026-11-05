import { describe, expect, it } from 'vitest';
import { dateOnly } from '../common/school-calendar';
import { orderedEvidence, vocabularyMastered, unresolvedVocabularyMistake, VocabularyMasteryService, type MemoryEvidence } from './mastery';
import { makeService, newDb, seedOfficialWords, seedStudent } from './testing/vocab-fixtures';

const proof = (day: string, overrides: Partial<MemoryEvidence> = {}): MemoryEvidence => ({
  kind: 'formal_first', subject: 'vocab_sense', sourceKey: day, isCorrect: true, hinted: false,
  schoolDate: dateOnly(day), occurredAt: new Date(`${day}T04:00:00Z`), ...overrides,
});

describe('独立掌握的统一定义', () => {
  it('必须两次独立正确，跨两教学日；同日、翌日和重复来源均不够', () => {
    const first = proof('2026-11-05');
    expect(vocabularyMastered([])).toBe(false);
    expect(vocabularyMastered([first])).toBe(false);
    expect(vocabularyMastered([first, first])).toBe(false);
    expect(vocabularyMastered([first, proof('2026-11-05', { sourceKey: 'other' })])).toBe(false);
    expect(vocabularyMastered([first, proof('2026-11-06')])).toBe(false);
    expect(vocabularyMastered([first, proof('2026-11-09')])).toBe(true);
  });
  it('周末和停课不算间隔；最近独立作答错误撤回掌握', () => {
    const rows = [proof('2026-11-06'), proof('2026-11-10')];
    expect(vocabularyMastered(rows)).toBe(true);
    expect(vocabularyMastered(rows, (d) => !['2026-11-07', '2026-11-08', '2026-11-09'].includes(d))).toBe(false);
    expect(vocabularyMastered([...rows, proof('2026-11-11', { isCorrect: false })])).toBe(false);
  });
  it.each(['practice_first', 'practice_retry', 'self_report', 'pronunciation'])('%s 不增加掌握', (kind) => {
    expect(vocabularyMastered([proof('2026-11-02'), proof('2026-11-05', { kind })])).toBe(false);
  });
  it('提示、缺考、阅读题不增加独立正确；两种外部正式来源可计入', () => {
    const first = proof('2026-11-02');
    for (const extra of [{ hinted: true }, { isCorrect: null }, { subject: 'reading_question' }]) {
      expect(vocabularyMastered([first, proof('2026-11-05', extra)])).toBe(false);
    }
    expect(vocabularyMastered([proof('2026-11-02', { kind: 'paper_dictation' }), proof('2026-11-05', { kind: 'mistake_redo' })])).toBe(true);
  });
  it('当天订正与提示不消错词，隔日无提示正确才消', () => {
    const rows = [proof('2026-11-02', { isCorrect: false })];
    rows.push(proof('2026-11-02', { sourceKey: 'same-day' }));
    rows.push(proof('2026-11-03', { hinted: true }));
    expect(unresolvedVocabularyMistake(rows)).toBe('2026-11-02');
    rows.push(proof('2026-11-04', { kind: 'mistake_redo' }));
    expect(unresolvedVocabularyMistake(rows)).toBeNull();
  });
  it('默写改录只保留同学生、同一行、同一词的最新结果参与计算；读取顺序和重复记录不影响结果', () => {
    const old = proof('2026-11-02', { kind: 'paper_dictation', studentId: 'one', senseId: 'word',
      isCorrect: false, detail: { rowId: 'row' } });
    const latest = { ...old, sourceKey: 'amend', isCorrect: true, occurredAt: new Date('2026-11-02T05:00:00Z') };
    const independent = [
      { ...old, sourceKey: 'other-student', studentId: 'two' },
      { ...old, sourceKey: 'other-word', senseId: 'second-word' },
      { ...old, sourceKey: 'other-sheet', detail: { rowId: 'second-row' } },
      { ...old, sourceKey: 'formal', kind: 'formal_first' },
    ];
    const rows = [old, latest, ...independent];
    const keys = (records: MemoryEvidence[]) => orderedEvidence(records).map((e) => e.sourceKey).sort();
    expect(keys(rows)).toEqual(keys([latest, ...independent]));
    expect(keys([...rows].reverse().concat(old))).toEqual(keys(rows));
    expect(unresolvedVocabularyMistake([old, latest])).toBeNull();
    expect(unresolvedVocabularyMistake([old, latest, independent[3]])).toBe('2026-11-02');
  });
  it('改为缺考先撤回旧默写成绩，再判断掌握；历史不计成多次成功或未消错误', () => {
    const first = proof('2026-11-02');
    const mark = proof('2026-11-05', { kind: 'paper_dictation', studentId: 'one', senseId: 'word', detail: { rowId: 'row' } });
    const absent = { ...mark, sourceKey: 'absent', isCorrect: null, occurredAt: new Date('2026-11-05T05:00:00Z') };
    expect(vocabularyMastered([first, mark])).toBe(true);
    expect(vocabularyMastered([first, mark, absent])).toBe(false);
    expect(unresolvedVocabularyMistake([{ ...mark, isCorrect: false }, absent])).toBeNull();
  });
  it('无行号的独立默写仍逐条计入，不与改录混淆', () => {
    const first = proof('2026-11-02', { kind: 'paper_dictation' });
    const second = proof('2026-11-05', { kind: 'paper_dictation' });
    expect(orderedEvidence([second, first])).toEqual([first, second]);
    expect(vocabularyMastered([first, second])).toBe(true);
  });
});

describe('掌握查询服务与词汇中心', () => {
  it('阶段 8 / 移出不等于掌握；阶段 1 也可按真实作答掌握；筛选、计数、自助练习一致', async () => {
    const db = newDb(); const id = seedStudent(db);
    const [old, real, removed] = seedOfficialWords(db, 'ngsl', 1801, 3);
    for (const [word, stage, active] of [[old, 8, true], [real, 1, true], [removed, 8, false]] as const) {
      db.seed('studentVocabularySense', { studentId: id, senseId: word.senseId, masteryStage: stage, inNotebook: active });
    }
    for (const day of ['2026-11-02', '2026-11-05']) db.seed('learningEvidence', { ...proof(day), studentId: id, senseId: real.senseId });
    const svc = makeService(db);
    const center = await svc.vocabularyCenter(id, { stage: 'mastered' });
    expect(center.stats).toMatchObject({ mastered: 1, removed: 1, new: 0, learning: 1 });
    expect(center.items.map((i) => i.senseId)).toEqual([real.senseId]);
    const practice = await svc.startCustomTest(id, { count: 'all', scope: 'mastered' });
    expect(db.rows('vocabularyV2SessionItem', { sessionId: practice.id }).map((i) => i.senseId)).toEqual([real.senseId]);
    const progress = await svc.teacherClassProgress({ id: 'admin', role: 'admin' }, 'class-1', new Date('2026-11-05T04:00:00Z'));
    expect(progress.students[0].vocabulary).toMatchObject({ mastered: 1, removed: 1 });
    expect(progress.students[0].vocabulary).not.toHaveProperty('masteredOrRemoved');
  });
  it('统计按学生隔离，支持报告截止日，停课日不虚增间隔', async () => {
    const db = newDb(); const id = seedStudent(db); seedStudent(db, { id: 'other' });
    const [word] = seedOfficialWords(db, 'ngsl', 1801, 1);
    for (const day of ['2026-11-06', '2026-11-10']) db.seed('learningEvidence', { ...proof(day), studentId: id, senseId: word.senseId });
    const service = new VocabularyMasteryService(db as any);
    expect((await service.forStudents([id, 'other'])).get(id)?.size).toBe(1);
    expect((await service.forStudents([id], '2026-11-09')).get(id)?.size).toBe(0);
    expect((await service.forStudents([id, 'other'])).get('other')?.size).toBe(0);
    db.seed('classNoSchoolDay', { classId: 'class-1', date: dateOnly('2026-11-09') });
    expect((await service.forStudents([id])).get(id)?.size).toBe(0);
  });
});
