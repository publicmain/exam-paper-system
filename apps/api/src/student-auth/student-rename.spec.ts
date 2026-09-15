import { describe, expect, it, vi } from 'vitest';
import { normalizeName } from './pilot-levels';
import { renameStudentAccount, selfRegisterEmail } from './student-rename';

const ACTOR = { id: 'stu-1', role: 'student' };

function world(opts: { user?: any; enrollments?: any[]; classmates?: any[]; emailTaken?: boolean; updated?: number } = {}) {
  const user = opts.user ?? {
    id: 'stu-1',
    role: 'student',
    name: '第一每亩',
    nickname: '第一每亩',
    email: selfRegisterEmail('c1', normalizeName('第一每亩')),
    avatar: null,
    studentAuthVersion: 3,
  };
  const tx = {
    user: {
      findUnique: vi.fn(async () => user),
      findMany: vi.fn(async () => opts.classmates ?? [{ name: '王小明' }]),
      findFirst: vi.fn(async () => (opts.emailTaken ? { id: 'someone' } : null)),
      updateMany: vi.fn(async () => ({ count: opts.updated ?? 1 })),
    },
    classEnrollment: {
      findMany: vi.fn(async () => opts.enrollments ?? [{ classId: 'c1', class: { archivedAt: null } }]),
    },
    auditLog: { create: vi.fn(async () => ({})) },
  };
  return { tx, user };
}

describe('改学生登录名', () => {
  it('**姓名、昵称（原来等于旧名）、注册邮箱一起改**；条件更新按旧名；同一事务写审计', async () => {
    const { tx } = world();
    const r = await renameStudentAccount(tx, { studentId: 'stu-1', newName: '  喻耀程 ', actor: ACTOR, source: 'student_self' });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'stu-1', name: '第一每亩' },
      data: { name: '喻耀程', nickname: '喻耀程', email: selfRegisterEmail('c1', normalizeName('喻耀程')) },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'stu-1',
        actorRole: 'student',
        action: 'student.rename',
        entityId: 'stu-1',
        diff: { name: ['第一每亩', '喻耀程'], nickname: ['第一每亩', '喻耀程'], selfRegEmailRederived: true },
        metadata: { source: 'student_self' },
      }),
    });
    expect(r).toMatchObject({ name: '喻耀程', nickname: '喻耀程', previousName: '第一每亩', studentAuthVersion: 3 });
  });

  it('学生自己另起的昵称不动；不是自助注册算出来的邮箱不动', async () => {
    const { tx } = world({ user: { id: 'stu-1', role: 'student', name: '张三', nickname: '三三', email: 'zhangsan@school.local', avatar: null, studentAuthVersion: 0 } });
    await renameStudentAccount(tx, { studentId: 'stu-1', newName: '张珊', actor: { id: 't1', role: 'teacher' }, source: 'teacher_roster' });
    expect(tx.user.updateMany).toHaveBeenCalledWith({ where: { id: 'stu-1', name: '张三' }, data: { name: '张珊' } });
  });

  it('**同一个在读班里已经有人叫这个名字（忽略大小写和多余空格）→ 409，一个字都不改**', async () => {
    const { tx } = world({ classmates: [{ name: 'Yu  Yaocheng' }] });
    await expect(renameStudentAccount(tx, { studentId: 'stu-1', newName: 'yu yaocheng', actor: ACTOR, source: 'student_self' })).rejects.toMatchObject({ status: 409, response: { code: 'name_taken_in_class' } });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('同名只查**在读**的班；归档班里的同名不拦', async () => {
    const { tx } = world({ enrollments: [{ classId: 'old', class: { archivedAt: new Date() } }] });
    await renameStudentAccount(tx, { studentId: 'stu-1', newName: '喻耀程', actor: ACTOR, source: 'student_self' });
    expect(tx.user.findMany).not.toHaveBeenCalled();
    expect(tx.user.updateMany).toHaveBeenCalled();
  });

  it('只改大小写 / 空格：不查重、不动邮箱', async () => {
    const { tx } = world({ user: { id: 'stu-1', role: 'student', name: 'zhang san', nickname: null, email: selfRegisterEmail('c1', 'zhang san'), avatar: null, studentAuthVersion: 0 } });
    await renameStudentAccount(tx, { studentId: 'stu-1', newName: 'Zhang San', actor: ACTOR, source: 'student_self' });
    expect(tx.user.findMany).not.toHaveBeenCalled();
    expect(tx.user.updateMany).toHaveBeenCalledWith({ where: { id: 'stu-1', name: 'zhang san' }, data: { name: 'Zhang San', nickname: 'Zhang San' } });
  });

  it('空名字 / 超长 / 和现在一样 → 400；不是学生 → 404；按新名算出的邮箱被占 → 409', async () => {
    await expect(renameStudentAccount(world().tx, { studentId: 'stu-1', newName: '   ', actor: ACTOR, source: 'student_self' })).rejects.toMatchObject({ status: 400, response: { code: 'name_required' } });
    await expect(renameStudentAccount(world().tx, { studentId: 'stu-1', newName: '名'.repeat(51), actor: ACTOR, source: 'student_self' })).rejects.toMatchObject({ status: 400, response: { code: 'name_too_long' } });
    await expect(renameStudentAccount(world().tx, { studentId: 'stu-1', newName: '第一每亩', actor: ACTOR, source: 'student_self' })).rejects.toMatchObject({ status: 400, response: { code: 'name_unchanged' } });
    const teacher = world({ user: { id: 't1', role: 'teacher', name: 'T', nickname: null, email: 't@x', avatar: null, studentAuthVersion: 0 } });
    await expect(renameStudentAccount(teacher.tx, { studentId: 't1', newName: '新名字', actor: ACTOR, source: 'teacher_roster' })).rejects.toMatchObject({ status: 404 });
    await expect(renameStudentAccount(world({ emailTaken: true }).tx, { studentId: 'stu-1', newName: '喻耀程', actor: ACTOR, source: 'student_self' })).rejects.toMatchObject({ status: 409 });
  });

  it('**两处同时改（条件更新没命中）→ 409 rename_conflict，不写审计**', async () => {
    const { tx } = world({ updated: 0 });
    await expect(renameStudentAccount(tx, { studentId: 'stu-1', newName: '喻耀程', actor: ACTOR, source: 'student_self' })).rejects.toMatchObject({ status: 409, response: { code: 'rename_conflict' } });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
