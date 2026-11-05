import { describe, expect, it, vi } from 'vitest';
import { VocabTeacherService } from './vocab-teacher.service';
import { VocabReviewService } from './vocab-review.service';
import { dateOnly } from '../common/school-calendar';
import { newDb, seedOfficialWords, seedStudent, sgtNoon } from '../vocab-v2/testing/vocab-fixtures';

describe('教师与旧统计入口共享独立掌握口径', () => {
  it('known 不算掌握；正式正确跨两教学日才算掌握人数和词数', async () => {
    const db = newDb(); const id = seedStudent(db);
    const [word] = seedOfficialWords(db, 'ngsl', 1801, 1);
    db.studentWord = {
      findMany: vi.fn().mockResolvedValue([{ studentId: id, headword: word.headword, state: 'known', sourceType: 'click' }]),
      groupBy: vi.fn().mockResolvedValue([{ studentId: id, state: 'known', _count: 1 }]), count: vi.fn().mockResolvedValue(0),
    };
    db.wordReviewLog = { groupBy: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) };
    db.$queryRaw = vi.fn().mockResolvedValue([]);
    const teacher = new VocabTeacherService(db as any, {} as any);
    const legacy = new VocabReviewService(db as any, { resolveStudent: async () => ({ id, name: 'student' }) } as any);
    expect((await teacher.classTop('class-1', { id: 'a', role: 'admin' })).items[0].mastered).toBe(0);
    expect((await teacher.classStats('class-1', { id: 'a', role: 'admin' })).rows[0].mastered).toBe(0);
    expect((await legacy.stats({ studentName: 'student' })).knownCount).toBe(0);
    for (const day of ['2026-11-02', '2026-11-05']) db.seed('learningEvidence', {
      studentId: id, senseId: word.senseId, subject: 'vocab_sense', kind: 'formal_first', sourceKey: day,
      schoolDate: dateOnly(day), occurredAt: sgtNoon(day), isCorrect: true, hinted: false,
    });
    expect((await teacher.classTop('class-1', { id: 'a', role: 'admin' })).items[0].mastered).toBe(1);
    expect((await teacher.classStats('class-1', { id: 'a', role: 'admin' })).rows[0].mastered).toBe(1);
    expect((await legacy.stats({ studentName: 'student' })).progress.mastered).toBe(1);
    db.seed('learningEvidence', { studentId: id, senseId: word.senseId, subject: 'vocab_sense', kind: 'mistake_redo', sourceKey: 'wrong',
      schoolDate: dateOnly('2026-11-06'), occurredAt: sgtNoon('2026-11-06'), isCorrect: false, hinted: false });
    expect((await teacher.classStats('class-1', { id: 'a', role: 'admin' })).rows[0].mastered).toBe(0);
  });
});
