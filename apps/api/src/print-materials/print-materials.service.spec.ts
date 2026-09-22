import { describe, expect, it, vi } from 'vitest';
import { PrintMaterialsService } from './print-materials.service';

const Q = (sortOrder: number, taskType: string, stem: string, extra: Record<string, unknown> = {}) => ({
  sortOrder,
  marks: 1,
  snapshotContent: { passage: 'Paragraph 1\nText.', passageTitle: `Title ${taskType}`, stem, taskType },
  snapshotOptions: [
    { key: 'A', text: 'TRUE', correct: true },
    { key: 'B', text: 'FALSE', correct: false },
  ],
  snapshotAnswer: {},
  overrideContent: null,
  overrideAnswer: null,
  question: { questionType: 'mcq' },
  ...extra,
});

function makePrisma(over: Record<string, any> = {}) {
  return {
    morningQuizSession: {
      findUnique: vi.fn(async () => ({
        id: 'mqs-1',
        date: new Date('2026-09-22T00:00:00.000Z'),
        level: 'olevel',
        class: { name: 'SEC27W', enrollments: [{ userId: 'stu-1' }] },
        paperAssignment: { paper: { questions: [Q(1, 'true_false_not_given', 'Instruction\n\nStatement one.')] } },
      })),
      findMany: vi.fn(async () => [
        { id: 'mqs-o', date: new Date('2026-09-22T00:00:00.000Z'), level: 'olevel', paperAssignment: { paper: { questions: [Q(1, 'multiple_choice', 'Pick one?')] } } },
        { id: 'mqs-s', date: new Date('2026-09-22T00:00:00.000Z'), level: 'ielts_simplified', paperAssignment: { paper: { questions: [Q(1, 'multiple_choice', 'Pick one?')] } } },
        { id: 'mqs-empty', date: new Date('2026-09-22T00:00:00.000Z'), level: 'ielts_light', paperAssignment: { paper: { questions: [] } } },
      ]),
    },
    vocabularyV2Session: {
      findUnique: vi.fn(async () => ({ items: [{ position: 1, contentSnapshot: { headword: 'calm', pos: 'adjective', translation: 'a. 平静的' } }] })),
      findMany: vi.fn(async () => [
        { studentId: 'stu-b', items: [{ position: 1, contentSnapshot: { headword: 'retain', pos: 'verb', translation: 'vt. 保持' } }] },
      ]),
    },
    classEnrollment: {
      findUnique: vi.fn(async () => ({ role: 'teacher' })),
      findMany: vi.fn(async () => [
        { user: { id: 'stu-b', name: '小明', englishLevel: 'olevel' } },
        { user: { id: 'stu-a', name: 'Amy', englishLevel: 'ielts_simplified' } },
      ]),
    },
    class: { findUnique: vi.fn(async () => ({ id: 'class-1', name: 'SEC27W' })) },
    ...over,
  };
}

describe('学生：打印自己的阅读 / 单词', () => {
  it('自己班的阅读：不带答案', async () => {
    const svc = new PrintMaterialsService(makePrisma() as any);
    const r = await svc.studentReading('stu-1', 'mqs-1');
    expect(r).toMatchObject({ sessionId: 'mqs-1', date: '2026-09-22', level: 'olevel', className: 'SEC27W' });
    expect(r.reading.groups[0].questions[0]).toMatchObject({ item: 'Statement one.', answer: null });
    expect(JSON.stringify(r)).not.toContain('correct');
  });

  it('**不是自己班的场次：403**', async () => {
    const prisma = makePrisma();
    prisma.morningQuizSession.findUnique.mockResolvedValueOnce({
      id: 'mqs-x', date: new Date(), level: 'olevel', class: { name: 'OTHER', enrollments: [] }, paperAssignment: { paper: { questions: [] } },
    } as any);
    await expect(new PrintMaterialsService(prisma as any).studentReading('stu-1', 'mqs-x')).rejects.toMatchObject({ status: 403 });
  });

  it('场次不存在：404', async () => {
    const prisma = makePrisma();
    prisma.morningQuizSession.findUnique.mockResolvedValueOnce(null as any);
    await expect(new PrintMaterialsService(prisma as any).studentReading('stu-1', 'nope')).rejects.toMatchObject({ status: 404 });
  });

  it('自己某天的单词：按本人的每日任务取（sessionKey 只拼自己的 id）', async () => {
    const prisma = makePrisma();
    const r = await new PrintMaterialsService(prisma as any).studentWords('stu-1', '2026-09-22');
    expect(prisma.vocabularyV2Session.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { sessionKey: 'v2:stu-1:2026-09-22:daily' } }));
    expect(r.words.map((w) => w.headword)).toEqual(['calm']);
  });

  it('那天没有单词任务：空列表，不报错；日期格式不对：400', async () => {
    const prisma = makePrisma();
    prisma.vocabularyV2Session.findUnique.mockResolvedValueOnce(null as any);
    const svc = new PrintMaterialsService(prisma as any);
    expect((await svc.studentWords('stu-1', '2026-09-20')).words).toEqual([]);
    await expect(svc.studentWords('stu-1', '9/20')).rejects.toMatchObject({ status: 400 });
  });
});

describe('老师：一个班某一天', () => {
  const teacher = { id: 't-1', role: 'teacher' };

  it('每个档位一份阅读（没有题的场次不出）；每个学生一份自己的单词，按名字排', async () => {
    const r = await new PrintMaterialsService(makePrisma() as any).classDay(teacher, 'class-1', '2026-09-22', false);
    expect(r.className).toBe('SEC27W');
    expect(r.readings.map((x) => x.level).sort()).toEqual(['ielts_simplified', 'olevel']);
    expect(r.students.map((s) => s.name)).toEqual(['Amy', '小明'].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')));
    expect(r.students.find((s) => s.name === '小明')!.words.map((w) => w.headword)).toEqual(['retain']);
    expect(r.students.find((s) => s.name === 'Amy')!.words).toEqual([]);
  });

  it('不要答案：不带；要答案：选择题给出正确选项', async () => {
    const svc = new PrintMaterialsService(makePrisma() as any);
    const plain = await svc.classDay(teacher, 'class-1', '2026-09-22', false);
    expect(plain.readings[0].reading.groups[0].questions[0].answer).toBeNull();
    const keyed = await svc.classDay(teacher, 'class-1', '2026-09-22', true);
    expect(keyed.readings[0].reading.groups[0].questions[0].answer).toBe('A  TRUE');
  });

  it('**不是这个班的任课老师：403，什么都不查**', async () => {
    const prisma = makePrisma();
    prisma.classEnrollment.findUnique.mockResolvedValueOnce(null as any);
    await expect(new PrintMaterialsService(prisma as any).classDay(teacher, 'class-1', '2026-09-22', true)).rejects.toMatchObject({ status: 403 });
    expect(prisma.morningQuizSession.findMany).not.toHaveBeenCalled();
    expect(prisma.vocabularyV2Session.findMany).not.toHaveBeenCalled();
  });

  it('学生账号拿不到：403', async () => {
    await expect(new PrintMaterialsService(makePrisma() as any).classDay({ id: 'stu-1', role: 'student' }, 'class-1', '2026-09-22', true)).rejects.toMatchObject({ status: 403 });
  });

  it('管理员 / 班主任不用是任课老师', async () => {
    const prisma = makePrisma();
    await new PrintMaterialsService(prisma as any).classDay({ id: 'a-1', role: 'admin' }, 'class-1', '2026-09-22', false);
    expect(prisma.classEnrollment.findUnique).not.toHaveBeenCalled();
  });
});
