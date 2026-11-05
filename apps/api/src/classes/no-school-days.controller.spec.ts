import { describe, expect, it, vi } from 'vitest';
import { NoSchoolDaysController } from './no-school-days.controller';
import { newDb, seedStudent } from '../vocab-v2/testing/vocab-fixtures';

const admin = { id: 'admin', role: 'admin' };
function setup() {
  const db = newDb(); seedStudent(db);
  db.seed('classEnrollment', { classId: 'class-1', userId: 'teacher', role: 'subject_teacher' });
  return { db, svc: new NoSchoolDaysController(db as never) };
}
describe('停课日管理', () => {
  it('任课老师可一次加五天；并发和重复提交不重复写入或审计', async () => {
    const { db, svc } = setup(); const teacher = { id: 'teacher', role: 'teacher' };
    const input = { from: '2026-11-02', to: '2026-11-06', reason: '期中考试' };
    const results = await Promise.all([svc.add(teacher, 'class-1', input), svc.add(teacher, 'class-1', input)]);
    expect(results.reduce((n, r) => n + r.added, 0)).toBe(5);
    expect(db.rows('classNoSchoolDay')).toHaveLength(5);
    const logs = db.rows('auditLog');
    expect(logs.reduce((n, r) => n + r.metadata.added, 0)).toBe(5);
    expect(await svc.add(teacher, 'class-1', input)).toEqual({ added: 0 });
    expect(db.rows('auditLog')).toHaveLength(logs.length);
  });
  it.each(['student', 'teacher'])('其他班 / %s 不可读写', async (role) => {
    const { svc } = setup(); const actor = { id: 'outsider', role };
    await expect(svc.list(actor, 'class-1')).rejects.toMatchObject({ status: 403 });
    await expect(svc.add(actor, 'class-1', {})).rejects.toMatchObject({ status: 403 });
    await expect(svc.remove(actor, 'class-1', '2026-11-05')).rejects.toMatchObject({ status: 403 });
  });
  it('管理员可删除；重复删除只记一次审计', async () => {
    const { db, svc } = setup();
    await svc.add(admin, 'class-1', { from: '2026-11-05', to: '2026-11-05' });
    const results = await Promise.all([svc.remove(admin, 'class-1', '2026-11-05'), svc.remove(admin, 'class-1', '2026-11-05')]);
    expect(results.reduce((n, r) => n + r.removed, 0)).toBe(1);
    expect(db.rows('auditLog').filter((r) => r.action.endsWith('remove'))).toHaveLength(1);
  });
  it.each([
    { from: '2026-02-30', to: '2026-03-01' }, { from: '2026-11-06', to: '2026-11-05' },
    { from: '2026-01-01', to: '2027-01-02' }, { from: 'bad', to: 'bad' },
  ])('拒绝无效日期或过长日期段 %j', async (body) => {
    const { svc } = setup(); await expect(svc.add(admin, 'class-1', body)).rejects.toMatchObject({ status: 400 });
  });
  it('未来含今天，过去不含今天；按新加坡午夜分界', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-04T16:00:00Z'));
    try {
      const { svc } = setup();
      await svc.add(admin, 'class-1', { from: '2026-11-04', to: '2026-11-06' });
      expect((await svc.list(admin, 'class-1', 'future')).map((r) => r.date.toISOString().slice(0, 10))).toEqual(['2026-11-05', '2026-11-06']);
      expect(await svc.list(admin, 'class-1', 'past')).toHaveLength(1);
      expect(await svc.list(admin, 'class-1')).toHaveLength(3);
    } finally { vi.useRealTimers(); }
  });
  it('审计失败会回滚主写入', async () => {
    const { db, svc } = setup();
    const transaction = db.$transaction.bind(db);
    db.$transaction = (fn: any) => transaction((tx: any) => { tx.auditLog.create = vi.fn().mockRejectedValue(new Error('audit failed')); return fn(tx); });
    await expect(svc.add(admin, 'class-1', { from: '2026-11-05', to: '2026-11-05' })).rejects.toThrow('audit failed');
    expect(db.rows('classNoSchoolDay')).toHaveLength(0);
  });
});
