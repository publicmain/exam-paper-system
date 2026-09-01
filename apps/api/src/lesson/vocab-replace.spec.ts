import { describe, expect, it, vi } from 'vitest';
import { LessonService, lessonWordReservesFromConfig } from './lesson.service';

const RESERVES = [
  { headword: 'estuary', surfaceForm: 'estuary', context: 'An estuary meets the sea.', contextTranslation: '河口与海洋相接。' },
  { headword: 'tributary', surfaceForm: 'tributary', context: 'A tributary joins the river.', contextTranslation: '支流汇入河流。' },
];

function makeSvc(opts: { reserves?: typeof RESERVES; known?: string[] } = {}) {
  let queue = ['delta', 'nile', 'silt'];
  const calls = { queueWrites: [] as string[][], oldStates: [] as unknown[], creates: [] as unknown[] };
  const config = { lessonWords: [], lessonWordReserves: opts.reserves ?? RESERVES };
  const prisma: any = {
    user: { findUnique: vi.fn(async () => ({ englishLevel: 'olevel' })) },
    morningQuizSession: {
      findMany: vi.fn(async () => [{
        id: 'sess', level: 'olevel', quizEnd: null, makeupStart: null, makeupEnd: null,
        classId: 'class', date: new Date(), class: { name: '【测试】班' },
        paperAssignment: { id: 'asg', paper: { id: 'paper', name: 'River Study', config, totalMarksActual: 10, _count: { questions: 10 } } },
      }]),
    },
    studentSubmission: { findFirst: vi.fn(async () => null) },
    dailyLessonCompletion: {
      findUnique: vi.fn(async () => ({ id: 'dlc', stage: 'vocab_learn', vocabWords: queue, vocabCursor: 0 })),
      update: vi.fn(async ({ data }: any) => {
        if (data.vocabWords) { queue = [...data.vocabWords]; calls.queueWrites.push([...queue]); }
        return { id: 'dlc' };
      }),
    },
    studentWord: {
      findMany: vi.fn(async () => (opts.known ?? []).map((headword) => ({ headword }))),
      findUnique: vi.fn(async ({ where }: any) => {
        const h = where.studentId_headword.headword;
        return h === 'delta' ? { state: queue[0] === 'delta' ? 'new' : 'known' } : null;
      }),
      updateMany: vi.fn(async (args: any) => { calls.oldStates.push(args); return { count: 1 }; }),
      upsert: vi.fn(async (args: any) => { calls.creates.push(args); return {}; }),
    },
    dictEntry: { findUnique: vi.fn(async ({ where }: any) => ({ word: where.word })) },
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  };
  const words: any = { resolveStudent: vi.fn(async () => ({ id: 'student', name: 'Student' })) };
  const review: any = {
    lessonCards: vi.fn(async () => ({
      lessonContext: true, cursor: 0, totalDue: 3,
      cards: queue.map((headword) => ({ headword })),
    })),
  };
  const translation: any = { translate: vi.fn(async () => '自动句意') };
  return { svc: new LessonService(prisma, words, review, {} as any, translation), prisma, review, calls, getQueue: () => queue };
}

describe('lessonWordReservesFromConfig', () => {
  it('接收有英文原句的备用卡；句意可以等真正换入时实时翻译', () => {
    expect(lessonWordReservesFromConfig({ lessonWordReserves: [
      RESERVES[0],
      { ...RESERVES[0] },
      { headword: 'blank', context: 'Blank.', contextTranslation: '' },
    ] })).toEqual([RESERVES[0], { headword: 'blank', surfaceForm: 'blank', context: 'Blank.', contextTranslation: '' }]);
  });
});

describe('replaceKnownLessonWord', () => {
  it('原位替换、旧词标已掌握、cursor 和总数不变', async () => {
    const { svc, calls, getQueue, review } = makeSvc();
    const out = await svc.replaceKnownLessonWord({ studentName: '', authStudentId: 'student', headword: 'delta', cursor: 0 });
    expect(getQueue()).toEqual(['estuary', 'nile', 'silt']);
    expect(calls.queueWrites).toEqual([['estuary', 'nile', 'silt']]);
    expect(calls.oldStates[0]).toMatchObject({ data: { state: 'known' } });
    expect(calls.creates[0]).toMatchObject({ create: { headword: 'estuary', contextTranslation: '河口与海洋相接。' } });
    expect(out).toMatchObject({ ok: true, oldHeadword: 'delta', replacementHeadword: 'estuary', cursor: 0, totalDue: 3 });
    expect(review.lessonCards).toHaveBeenCalledTimes(1);
  });

  it('学生已掌握的备用词不会再塞回来', async () => {
    const { svc, getQueue } = makeSvc({ known: ['estuary'] });
    const out = await svc.replaceKnownLessonWord({ studentName: '', authStudentId: 'student', headword: 'delta', cursor: 0 });
    expect(getQueue()[0]).toBe('tributary');
    expect(out.replacementHeadword).toBe('tributary');
  });

  it('弱网重发不消耗第二个备用词', async () => {
    const { svc, getQueue, calls } = makeSvc();
    const input = { studentName: '', authStudentId: 'student', headword: 'delta', cursor: 0 };
    await svc.replaceKnownLessonWord(input);
    const second = await svc.replaceKnownLessonWord(input);
    expect(getQueue()[0]).toBe('estuary');
    expect(calls.queueWrites).toHaveLength(1);
    expect(second.alreadyReplaced).toBe(true);
  });

  it('没有备用词时失败关闭，不改旧词与队列', async () => {
    const { svc, getQueue, calls } = makeSvc({ reserves: [] });
    await expect(svc.replaceKnownLessonWord({ studentName: '', authStudentId: 'student', headword: 'delta', cursor: 0 }))
      .rejects.toMatchObject({ response: { code: 'vocab_replacement_unavailable' } });
    expect(getQueue()).toEqual(['delta', 'nile', 'silt']);
    expect(calls.oldStates).toHaveLength(0);
    expect(calls.creates).toHaveLength(0);
  });
});
