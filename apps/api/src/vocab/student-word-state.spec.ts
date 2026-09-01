import { describe, expect, it, vi } from 'vitest';
import { StudentWordService } from './student-word.service';

function makeService(count = 1) {
  const prisma: any = {
    user: { findFirst: vi.fn(async () => ({ id: 'student', name: 'Student' })) },
    classEnrollment: { findFirst: vi.fn(async () => ({ id: 'enrollment' })) },
    studentWord: { updateMany: vi.fn(async () => ({ count })) },
  };
  const service = new StudentWordService(prisma, {} as any);
  return { service, prisma };
}

describe('StudentWordService.setWordState', () => {
  it('已掌握只改令牌对应学生的卡，并把近期复习移走', async () => {
    const { service, prisma } = makeService();
    const out = await service.setWordState({
      studentName: '', authStudentId: 'student', headword: ' Ferry ', state: 'known',
    });
    expect(prisma.studentWord.updateMany).toHaveBeenCalledWith({
      where: { studentId: 'student', headword: 'ferry' },
      data: { state: 'known', due: new Date('2100-01-01T00:00:00.000Z') },
    });
    expect(out).toMatchObject({ updated: true, headword: 'ferry', state: 'known' });
  });

  it('重新学习把卡放回当前时间附近', async () => {
    const { service, prisma } = makeService();
    const before = Date.now();
    await service.setWordState({
      studentName: '', authStudentId: 'student', headword: 'ferry', state: 'learning',
    });
    const due = prisma.studentWord.updateMany.mock.calls[0][0].data.due as Date;
    expect(due.getTime()).toBeGreaterThanOrEqual(before);
    expect(due.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('不存在的词失败关闭', async () => {
    const { service } = makeService(0);
    await expect(service.setWordState({
      studentName: '', authStudentId: 'student', headword: 'ghost', state: 'known',
    })).rejects.toMatchObject({ response: { code: 'word_not_found' } });
  });
});
