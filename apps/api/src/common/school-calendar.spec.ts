import { describe, expect, it } from 'vitest';
import { isTeachingDay, loadSchoolCalendar, singaporeDate, dateOnly, validDate } from './school-calendar';
import { newDb, seedStudent } from '../vocab-v2/testing/vocab-fixtures';
import { streakFromDays } from '../vocab/vocab-review.service';

describe('教学日日历', () => {
  it('多班全部停课才算；未来入班和归档班不影响', async () => {
    const db = newDb(); const id = seedStudent(db);
    db.seed('class', { id: 'class-2' }); db.seed('classEnrollment', { classId: 'class-2', userId: id, joinedAt: dateOnly('2026-11-01') });
    db.seed('classNoSchoolDay', { classId: 'class-1', date: dateOnly('2026-11-05'), createdById: 't' });
    expect((await loadSchoolCalendar(db as never, [id])).isNoSchoolDay(id, '2026-11-05')).toBe(false);
    db.seed('classNoSchoolDay', { classId: 'class-2', date: dateOnly('2026-11-05'), createdById: 't' });
    expect((await loadSchoolCalendar(db as never, [id])).isTeachingDay(id, '2026-11-05')).toBe(false);
    db.seed('class', { id: 'later' }); db.seed('classEnrollment', { classId: 'later', userId: id, joinedAt: dateOnly('2026-11-06') });
    db.seed('class', { id: 'archived', archivedAt: new Date() }); db.seed('classEnrollment', { classId: 'archived', userId: id, joinedAt: dateOnly('2026-11-01') });
    expect((await loadSchoolCalendar(db as never, [id])).isNoSchoolDay(id, '2026-11-05')).toBe(true);
  });
  it('新加坡日期边界、周末、空班和无班学生', async () => {
    expect(singaporeDate(new Date('2026-11-04T15:59:59Z'))).toBe('2026-11-04');
    expect(singaporeDate(new Date('2026-11-04T16:00:00Z'))).toBe('2026-11-05');
    expect(isTeachingDay('2026-11-07')).toBe(false); expect(isTeachingDay('2026-11-05', true)).toBe(false);
    const calendar = await loadSchoolCalendar(newDb() as never, []);
    expect(calendar.isNoSchoolDay('none', '2026-11-05')).toBe(false);
    expect(validDate('2026-02-30')).toBe(false);
  });
  it('停课跨多天不断连续学习，停课做了也不加一天、不消耗宽免', () => {
    const off = new Set(['2026-11-03', '2026-11-04', '2026-11-05']);
    expect(streakFromDays(['2026-11-06', '2026-11-04', '2026-11-02'], '2026-11-06', 0, off)).toBe(2);
    expect(streakFromDays(['2026-11-02'], '2026-11-05', 0, off)).toBe(1);
    expect(streakFromDays(['2026-11-04'], '2026-11-05', 0, off)).toBe(0);
  });
});
