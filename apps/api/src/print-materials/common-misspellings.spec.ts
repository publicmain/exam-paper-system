import { describe, expect, it } from 'vitest';
import { commonMisspellings, spellingOf } from './common-misspellings';
import { memoryPrisma } from '../vocab-v2/testing/memory-prisma';

describe('班里常见错拼', () => {
  it('只统计本班、同义项、错误的三类记录；至少2人次，取前2种且只返回拼法和次数', async () => {
    const db = memoryPrisma();
    let n = 0;
    const add = (typed: unknown, overrides = {}) => db.seed('learningEvidence', {
      studentId: 'one', senseId: 'sense', subject: 'vocab_sense', kind: 'practice_first', isCorrect: false,
      sourceKey: `spelling_${n++}`, detail: { typed, studentName: '不能泄露的名字' }, ...overrides,
    });
    for (const typed of ['recieve', ' RECIEVE ', 'recieve', 'receve', 'receve', 'recive', 'recive', 'once']) add(typed);
    add('recieve', { kind: 'practice_retry', studentId: 'two' });
    for (const overrides of [{ studentId: 'outsider' }, { senseId: 'other' }, { subject: 'reading_question' },
      { kind: 'self_report' }, { kind: 'paper_dictation' }, { kind: 'mistake_redo' }, { isCorrect: true }]) add('recieve', overrides);
    const result = await commonMisspellings(db as any, ['one', 'two'], ['sense']);
    expect(result.get('sense')).toEqual([{ spelling: 'recieve', count: 4 }, { spelling: 'receve', count: 2 }]);
    const printed = JSON.stringify([...result]);
    for (const value of ['one', 'two', 'outsider', '不能泄露的名字', 'studentId', 'studentName']) expect(printed).not.toContain(value);
  });
  it('正式拼写只取首答，不把订正、选择题字母、其他学生的题或缺失题混入', async () => {
    const db = memoryPrisma();
    db.seed('vocabularyV2Session', { id: 'formal', studentId: 'one' });
    db.seed('vocabularyV2Session', { id: 'outside', studentId: 'outside' });
    for (const [id, type, sessionId] of [['a', 'spelling', 'formal'], ['b', 'listening_spelling', 'formal'], ['mcq', 'word_choice', 'formal'], ['foreign', 'spelling', 'outside']]) {
      db.seed('vocabularyV2SessionItem', { id, sessionId, senseId: 'sense', position: id.charCodeAt(0),
        questionSnapshot: { type }, firstIsCorrect: false, firstResponse: { value: type === 'word_choice' ? 'A' : 'recieve' }, response: { value: 'receive' } });
    }
    for (const [index, sessionItemId] of ['a', 'b', 'mcq', 'foreign', 'missing', 'mcq'].entries()) db.seed('learningEvidence', {
      studentId: 'one', senseId: 'sense', kind: 'formal_first', subject: 'vocab_sense', isCorrect: false, sessionItemId,
      sourceKey: `formal_${index}`,
    });
    expect((await commonMisspellings(db as any, ['one'], ['sense'])).get('sense')).toEqual([{ spelling: 'recieve', count: 2 }]);
  });
  it('单次错拼不显示；空列表不查询；空白、自由文本、HTML、过长输入不显示', async () => {
    for (const value of [null, {}, '', ' ', '学生姓名', 'name surname', '<img src=x>', 'a'.repeat(65), 'hello\nworld']) expect(spellingOf(value)).toBeNull();
    expect(spellingOf(' Ｒｅｃｉｅｖｅ ')).toBe('recieve');
    expect(spellingOf("isn't")).toBe("isn't");
    expect((await commonMisspellings({} as any, [], ['sense'])).size).toBe(0);
    expect((await commonMisspellings({} as any, ['one'], [])).size).toBe(0);
    const db = memoryPrisma();
    db.seed('learningEvidence', { studentId: 'one', senseId: 'sense', subject: 'vocab_sense', kind: 'practice_first', isCorrect: false, sourceKey: 'once', detail: { typed: 'recieve' } });
    expect((await commonMisspellings(db as any, ['one'], ['sense'])).get('sense')).toEqual([]);
  });
  it('没有首答字段的旧记录可读原 response；有首答时间却缺原答时不猜测订正后的答案', async () => {
    const db = memoryPrisma();
    db.seed('vocabularyV2Session', { id: 'formal', studentId: 'one' });
    for (const [index, firstAnsweredAt] of [null, null, new Date(), new Date()].entries()) {
      db.seed('vocabularyV2SessionItem', { id: `item${index}`, sessionId: 'formal', senseId: 'sense', position: index + 1,
        firstAnsweredAt, firstResponse: null, firstIsCorrect: null, response: { value: 'recieve' }, isCorrect: false, questionSnapshot: { type: 'spelling' } });
      db.seed('learningEvidence', { studentId: 'one', senseId: 'sense', subject: 'vocab_sense', kind: 'formal_first', isCorrect: false, sourceKey: `old${index}`, sessionItemId: `item${index}` });
    }
    expect((await commonMisspellings(db as any, ['one'], ['sense'])).get('sense')).toEqual([{ spelling: 'recieve', count: 2 }]);
  });
});
