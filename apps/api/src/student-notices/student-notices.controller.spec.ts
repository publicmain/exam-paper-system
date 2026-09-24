import { describe, expect, it, vi } from 'vitest';
import { StudentNoticesController } from './student-notices.controller';

const req = (id = 'stu-1') => ({ studentAuth: { id } }) as any;

function make(rows: any[] = []) {
  const prisma: any = {
    notification: {
      findMany: vi.fn(async ({ where }: any) =>
        rows.filter((r) => r.userId === where.userId && where.type.in.includes(r.type) && r.readAt === null),
      ),
      findFirst: vi.fn(async ({ where }: any) =>
        rows.find((r) => r.id === where.id && r.userId === where.userId && where.type.in.includes(r.type)) ?? null,
      ),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  return { prisma, ctl: new StudentNoticesController(prisma) };
}

const warn = (id: string, userId = 'stu-1', extra: any = {}) => ({
  id, userId, type: 'effort_warning', title: '严重警告', body: '正文', readAt: null, createdAt: new Date('2026-09-24T02:00:00Z'), ...extra,
});

describe('学生警告弹窗接口', () => {
  it('只给自己的、没确认过的警告；旧作业通知（hw_assigned）不会弹到新 App', async () => {
    const { ctl, prisma } = make([warn('w1'), warn('w-other', 'stu-2'), warn('w-read', 'stu-1', { readAt: new Date() }), { ...warn('hw'), type: 'hw_assigned' }]);
    const r = await ctl.list(req());
    expect(r.items.map((i: any) => i.id)).toEqual(['w1']);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'stu-1', type: { in: ['effort_warning'] }, readAt: null },
    }));
  });

  it('确认自己的警告：写 readAt，只动这一条、而且只动还没读的', async () => {
    const { ctl, prisma } = make([warn('w1')]);
    await expect(ctl.read(req(), 'w1')).resolves.toEqual({ ok: true });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({ where: { id: 'w1', userId: 'stu-1', readAt: null }, data: { readAt: expect.any(Date) } });
  });

  it('**别人的警告：404，不写**', async () => {
    const { ctl, prisma } = make([warn('w1', 'stu-2')]);
    await expect(ctl.read(req('stu-1'), 'w1')).rejects.toMatchObject({ status: 404 });
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it('别的类型的通知不能借这个接口标已读', async () => {
    const { ctl, prisma } = make([{ ...warn('hw'), type: 'hw_assigned' }]);
    await expect(ctl.read(req(), 'hw')).rejects.toMatchObject({ status: 404 });
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it('重复确认：幂等，不再写', async () => {
    const { ctl, prisma } = make([warn('w1', 'stu-1', { readAt: new Date() })]);
    await expect(ctl.read(req(), 'w1')).resolves.toEqual({ ok: true });
    expect(prisma.notification.updateMany).not.toHaveBeenCalled();
  });

  it('没有学生身份：400', async () => {
    const { ctl } = make();
    await expect(ctl.list({} as any)).rejects.toMatchObject({ status: 400 });
  });
});
