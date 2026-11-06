import { describe, expect, it, vi } from 'vitest';
import { dateOnly } from '../common/school-calendar';
import { newDb, seedStudent } from '../vocab-v2/testing/vocab-fixtures';
import { freezeRedo, readingRedoState, readingRedoStatesForDay, redoSourceKey } from './reading-redo';

const date = '2026-11-05';
const now = new Date(`${date}T10:00:00+08:00`);
const midnight = new Date(`${date}T00:00:00+08:00`);
const snapshot = freezeRedo({ stem: 'Choose.', passage: 'Original.' }, [], { text: 'B' }, 'mcq');

function fixture() {
  const db = newDb();
  seedStudent(db, { id: 's1' }); seedStudent(db, { id: 's2' }); seedStudent(db, { id: 'other', classId: 'other-class' });
  const entry = (studentId: string, id: string, extra: Record<string, unknown> = {}) => db.seed('mistakeEntry', {
    studentId, id, paperQuestionId: `pq-${id}`, redoSnapshot: snapshot, createdAt: new Date('2026-11-04T01:00:00Z'), ...extra,
  });
  const answer = (studentId: string, id: string, schoolDate = date, extra: Record<string, unknown> = {}) => db.seed('learningEvidence', {
    studentId, subject: 'reading_question', kind: 'mistake_redo', schoolDate: dateOnly(schoolDate),
    sourceKey: redoSourceKey(studentId, id, schoolDate), isCorrect: false, hinted: true, ...extra,
  });
  return { db, entry, answer };
}

describe('阅读重做按班按日批量事实', () => {
  it('参考答案冻结记录不算学生或老师页重做完成，只有正式重做记录算', async () => {
    const { db, entry, answer } = fixture(); entry('s1', 'a');
    db.seed('learningEvidence', { studentId: 's1', subject: 'reading_question', kind: 'practice_first', schoolDate: dateOnly(date),
      sourceKey: `reading-redo-ref:s1:a:${date}`, detail: { mistakeId: 'a', answer: 'My answer.' } });
    expect(await readingRedoState(db as never, 's1', now)).toMatchObject({ target: 1, progress: 0 });
    expect((await readingRedoStatesForDay(db as never, ['s1'], date)).get('s1')).toEqual({ target: 1, progress: 0 });
    answer('s1', 'a');
    expect((await readingRedoStatesForDay(db as never, ['s1'], date)).get('s1')).toEqual({ target: 1, progress: 1 });
  });

  it('与 LessonService 使用的单人清单一致：最早三道、跨日边界、今天消除不补第四道', async () => {
    const { db, entry, answer } = fixture();
    entry('s1', 'a', { resolved: true, resolvedAt: midnight }); entry('s1', 'b'); entry('s1', 'c'); entry('s1', 'd');
    entry('s1', 'legacy', { redoSnapshot: null }); entry('s1', 'deleted-question', { paperQuestionId: null });
    entry('s1', 'collected-today', { createdAt: midnight });
    entry('s1', 'resolved-yesterday', { resolved: true, resolvedAt: new Date(midnight.getTime() - 1) });
    entry('s2', 'a2'); entry('other', 'foreign');
    answer('s1', 'a'); answer('s1', 'd'); // 第四道不占今天的进度。
    answer('s2', 'a2', '2026-11-04'); // 昨天的提交不算今天。
    const states = await readingRedoStatesForDay(db as never, ['s1', 's2'], date);
    expect(states.get('s1')).toEqual({ target: 3, progress: 1 });
    expect(states.get('s2')).toEqual({ target: 1, progress: 0 });
    expect(states.has('other')).toBe(false);
    for (const id of ['s1', 's2']) {
      const single = await readingRedoState(db as never, id, now);
      expect(states.get(id)).toEqual({ target: single.target, progress: single.progress });
    }
    expect(db.writes).toEqual([]);
  });

  it('错误、看提示的作答也完成当天题目；重读及并发读取不重复计数、不改变清单', async () => {
    const { db, entry, answer } = fixture();
    for (const id of ['a', 'b', 'c', 'd']) entry('s1', id);
    answer('s1', 'a');
    const states = await Promise.all(Array.from({ length: 3 }, () => readingRedoStatesForDay(db as never, ['s1'], date)));
    expect(states.map((s) => s.get('s1'))).toEqual(Array.from({ length: 3 }, () => ({ target: 3, progress: 1 })));
    answer('s1', 'b'); answer('s1', 'c');
    expect((await readingRedoStatesForDay(db as never, ['s1'], date)).get('s1')).toEqual({ target: 3, progress: 3 });
    expect(db.writes).toEqual([]);
  });

  it('分页越过 500 条旧快照，不能用全班总条数截断而漏掉排在后面的学生', async () => {
    const { db, entry, answer } = fixture();
    for (let i = 0; i < 501; i++) entry('s1', `legacy-${i}`, { redoSnapshot: null, createdAt: new Date('2026-11-03T01:00:00Z') });
    for (const id of ['a', 'b', 'c', 'd']) entry('s1', id);
    entry('s2', 'z', { createdAt: new Date('2026-11-04T02:00:00Z') }); answer('s2', 'z');
    const query = vi.spyOn(db.mistakeEntry, 'findMany');
    const states = await readingRedoStatesForDay(db as never, ['s1', 's2'], date);
    expect(states.get('s1')).toEqual({ target: 3, progress: 0 });
    expect(states.get('s2')).toEqual({ target: 1, progress: 1 });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.every(([args]) => (args as any).take === 500)).toBe(true);
    expect(query.mock.calls[1][0]).toMatchObject({ where: { AND: [{ OR: [
      { createdAt: { gt: expect.any(Date) } }, { createdAt: expect.any(Date), id: { gt: expect.any(String) } },
    ] }] } });
  });

  it('完成记录超过一页仍完整统计，每页最多 500 条', async () => {
    const { db, entry, answer } = fixture();
    const ids = Array.from({ length: 167 }, (_, i) => `s-${i}`);
    for (const id of ids) for (const item of ['a', 'b', 'c']) { entry(id, `${id}-${item}`); answer(id, `${id}-${item}`); }
    const query = vi.spyOn(db.learningEvidence, 'findMany');
    const states = await readingRedoStatesForDay(db as never, ids, date, { isTeachingDay: () => true });
    expect([...states.values()].every((state) => state.target === 3 && state.progress === 3)).toBe(true);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.every(([args]) => (args as any).take === 500)).toBe(true);
  });

  it.each(['2026-11-07', date])('周末 / 停课日 %s 不查询重做或作答；空班也不查', async (day) => {
    const { db, entry } = fixture(); entry('s1', 'a');
    db.seed('classNoSchoolDay', { classId: 'class-1', date: dateOnly(date), createdById: 'teacher' });
    const mistakes = vi.spyOn(db.mistakeEntry, 'findMany'); const evidence = vi.spyOn(db.learningEvidence, 'findMany');
    expect((await readingRedoStatesForDay(db as never, ['s1'], day)).get('s1')).toEqual({ target: 0, progress: 0 });
    expect(await readingRedoStatesForDay(db as never, [], day)).toEqual(new Map());
    expect(mistakes).not.toHaveBeenCalled(); expect(evidence).not.toHaveBeenCalled();
  });
});
