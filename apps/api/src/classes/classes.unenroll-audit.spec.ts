/**
 * 「移出班级」要留审计（2026-10-01）。
 *
 * 09-30 有三个学生阅读做不了，原因是被移出了班级；当时这条路不写任何记录，
 * 查不到是谁、什么时候点的。这里守住：移出成功 → 同一个事务里多一条 class.unenroll。
 */
import { describe, expect, it } from 'vitest';
import { AuditService } from '../audit/audit.service';
import { ClassesService } from './classes.service';

function fakeDb(opts: { enrolled: boolean; auditFails?: boolean }) {
  const state = { enrolled: opts.enrolled, audits: [] as any[], committed: 0, rolledBack: 0 };
  const tx = {
    classEnrollment: {
      findUnique: async ({ where }: any) =>
        state.enrolled && where.classId_userId.classId === 'c1' && where.classId_userId.userId === 'u1'
          ? { role: 'student', joinedAt: new Date('2026-09-07T01:17:00.000Z'), class: { name: 'IAL27M' }, user: { name: '学生甲' } }
          : null,
      deleteMany: async () => {
        const count = state.enrolled ? 1 : 0;
        state.enrolled = false;
        return { count };
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        if (opts.auditFails) throw new Error('audit down');
        state.audits.push(data);
        return data;
      },
    },
  };
  const prisma = {
    ...tx,
    // 事务：回调抛错就算回滚（把「移出」还原），与真库一致
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
      const before = state.enrolled;
      try {
        const out = await fn(tx);
        state.committed += 1;
        return out;
      } catch (e) {
        state.enrolled = before;
        state.audits.length = 0;
        state.rolledBack += 1;
        throw e;
      }
    },
  };
  return { prisma, state };
}

function makeService(db: ReturnType<typeof fakeDb>) {
  return new ClassesService(db.prisma as any, new AuditService(db.prisma as any));
}

describe('移出班级留审计', () => {
  it('移出成功 → 一条 class.unenroll：谁、把谁、从哪个班', async () => {
    const db = fakeDb({ enrolled: true });
    const result = await makeService(db).removeEnrollment('c1', 'u1', { id: 'teacher-1', role: 'teacher', ip: '1.2.3.4' });
    expect(result).toEqual({ count: 1 });
    expect(db.state.enrolled).toBe(false);
    expect(db.state.audits).toEqual([
      {
        actorId: 'teacher-1',
        actorRole: 'teacher',
        action: 'class.unenroll',
        entityType: 'User',
        entityId: 'u1',
        diff: null,
        metadata: { classId: 'c1', className: 'IAL27M', userName: '学生甲', enrollmentRole: 'student', joinedAt: '2026-09-07T01:17:00.000Z' },
        ip: '1.2.3.4',
      },
    ]);
  });

  it('本来就不在这个班（重复点 / 已被移出）→ 不写审计', async () => {
    const db = fakeDb({ enrolled: false });
    const result = await makeService(db).removeEnrollment('c1', 'u1', { id: 'teacher-1', role: 'teacher' });
    expect(result).toEqual({ count: 0 });
    expect(db.state.audits).toEqual([]);
  });

  it('审计写不进去 → 移出也不生效（同一个事务）', async () => {
    const db = fakeDb({ enrolled: true, auditFails: true });
    await expect(makeService(db).removeEnrollment('c1', 'u1', { id: 'teacher-1', role: 'teacher' })).rejects.toThrow('audit down');
    expect(db.state.enrolled).toBe(true);
    expect(db.state.rolledBack).toBe(1);
  });
});
