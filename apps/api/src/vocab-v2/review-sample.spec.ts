/**
 * 正式测试的抽查题（2026-09-10）。
 *
 * 在这之前，一个词的一生是「被推送一次、当天被考一次、再也不见」——
 * 生产实测首发三天推了 1630 张卡，1569 个词只在一天出现过，被推过两天的
 * 只有 23 个。抽查让学过的旧词自己轮着回来，不用另造一条复习队列。
 *
 * 叶老师定的每次 3 个。下面钉死的是抽谁、不抽谁、以及抽不到时怎么办。
 */
import { describe, expect, it, vi } from 'vitest';
import { REVIEW_SAMPLE_SIZE, VocabularyV2Service } from './vocabulary-v2.service';

const STUDENT = 'stu-1';

function lexeme(headword: string) {
  return { headword, phonetic: `/${headword}/`, listName: 'ngsl', rank: 100, attribution: 'NGSL' };
}

/** 今天学完的一张卡（已冻结的快照，抽查题不该动它们）。 */
function todayItem(headword: string, position: number) {
  return {
    senseId: `today-${headword}`,
    position,
    source: 'level_gap',
    contextId: null,
    masteryBefore: 1,
    contentVersion: 1,
    status: 'completed',
    contentSnapshot: {
      headword, phonetic: `/${headword}/`, pos: 'noun', senseKey: 'noun:01',
      translation: `${headword}的中文`, definition: '', sentence: null, sentenceTranslation: null,
      collocations: [], wordFamily: [], confusionWords: [], memoryHint: null, imageUrl: null,
      audioText: headword, list: 'ngsl', rank: 100, attribution: 'NGSL',
    },
  };
}

/** 学生名下一个学过的旧词。 */
function ownedSense(input: {
  headword: string;
  reps?: number;
  masteryStage?: number;
  translation?: string | null;
}) {
  return {
    senseId: `sense-${input.headword}`,
    reps: input.reps ?? 1,
    masteryStage: input.masteryStage ?? 2,
    sense: {
      id: `sense-${input.headword}`,
      pos: 'noun',
      senseKey: 'noun:01',
      translation: input.translation === undefined ? `${input.headword}的中文` : input.translation,
      definition: '',
      contexts: [],
      collocations: [],
      wordFamily: [],
      confusionWords: [],
      memoryHint: null,
      imageUrl: null,
      contentVersion: 1,
      lexeme: lexeme(input.headword),
    },
  };
}

function makeSvc(input: {
  today?: ReturnType<typeof todayItem>[];
  owned?: ReturnType<typeof ownedSense>[];
  /** senseId → 上次被考的时刻 */
  priorTests?: Array<{ senseId: string; createdAt: Date }>;
}) {
  const today = input.today ?? [todayItem('alpha', 1), todayItem('beta', 2)];
  const created: any[] = [];
  const ownedFindMany = vi.fn().mockResolvedValue(input.owned ?? []);
  const prisma: any = {
    vocabularyV2Session: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'daily-1',
        sessionKey: 'stu-1:2026-09-10:daily',
        version: 'V2-20260910-001',
        date: new Date('2026-09-10T00:00:00.000Z'),
        items: today,
      }),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async (args: any) => {
        created.push(args);
        return {
          id: 'test-1',
          version: args.data.version,
          date: args.data.date,
          sessionType: 'formal_test',
          status: 'in_progress',
          target: args.data.target,
          items: args.data.items.create.map((item: any, index: number) => ({
            ...item,
            id: `t-${index + 1}`,
            status: 'pending',
            isCorrect: null,
          })),
        };
      }),
    },
    studentVocabularySense: { findMany: ownedFindMany },
    vocabularyV2SessionItem: { findMany: vi.fn().mockResolvedValue(input.priorTests ?? []) },
    user: { findUnique: vi.fn().mockResolvedValue({ englishLevel: 'olevel' }) },
  };
  const svc = new VocabularyV2Service(prisma, {} as any);
  /** 真正写进考卷的题目（按 position 排好）。 */
  const paper = () => created[0]?.data?.items?.create ?? [];
  return { svc, paper, prisma, ownedFindMany, created };
}

describe('正式测试的抽查题', () => {
  it('今天的词之后追加 3 个抽查题', async () => {
    const { svc, paper } = makeSvc({
      owned: ['old1', 'old2', 'old3', 'old4'].map((h) => ownedSense({ headword: h })),
    });
    await svc.startFormalTest(STUDENT, 'daily-1');
    const items = paper();
    expect(items).toHaveLength(2 + REVIEW_SAMPLE_SIZE);
    // 今天的排前面，抽查的跟在后面
    expect(items.slice(0, 2).map((i: any) => i.source)).toEqual(['level_gap', 'level_gap']);
    expect(items.slice(2).map((i: any) => i.source)).toEqual(['review', 'review', 'review']);
    expect(items.map((i: any) => i.position)).toEqual([1, 2, 3, 4, 5]);
  });

  it('最久没被考过的先抽 —— 从没考过的排最前', async () => {
    const { svc, paper } = makeSvc({
      owned: ['recent', 'older', 'never'].map((h) => ownedSense({ headword: h })),
      priorTests: [
        { senseId: 'sense-recent', createdAt: new Date('2026-09-09T00:00:00.000Z') },
        { senseId: 'sense-older', createdAt: new Date('2026-09-07T00:00:00.000Z') },
      ],
    });
    await svc.startFormalTest(STUDENT, 'daily-1');
    expect(paper().slice(2).map((i: any) => i.contentSnapshot.headword)).toEqual([
      'never', 'older', 'recent',
    ]);
  });

  it('只抽真学过的、没点过「我会了」的 —— 条件写在查询里', async () => {
    const { svc, ownedFindMany } = makeSvc({ owned: [] });
    await svc.startFormalTest(STUDENT, 'daily-1');
    const where = ownedFindMany.mock.calls[0][0].where;
    expect(where.reps).toEqual({ gt: 0 });
    expect(where.masteryStage).toEqual({ lt: 8 });
    expect(where.inNotebook).toBe(true);
    expect(where.removedAt).toBeNull();
    expect(where.studentId).toBe(STUDENT);
    // 今天已经在卷子上的词不再抽一遍
    expect(where.senseId).toEqual({ notIn: ['today-alpha', 'today-beta'] });
  });

  it('没有可抽的（第一天、或词全掌握了）→ 只考今天的，不报错', async () => {
    const { svc, paper } = makeSvc({ owned: [] });
    await svc.startFormalTest(STUDENT, 'daily-1');
    expect(paper()).toHaveLength(2);
  });

  it('没有中文释义的词不进考卷 —— 那道题没法出', async () => {
    const { svc, paper } = makeSvc({
      owned: [
        ownedSense({ headword: 'blank', translation: '   ' }),
        ownedSense({ headword: 'good' }),
      ],
    });
    await svc.startFormalTest(STUDENT, 'daily-1');
    const review = paper().slice(2);
    expect(review).toHaveLength(1);
    expect(review[0].contentSnapshot.headword).toBe('good');
  });

  it('抽查题带着自己的掌握阶段进卷子，不是重置成新词', async () => {
    const { svc, paper } = makeSvc({
      owned: [ownedSense({ headword: 'old1', masteryStage: 5, reps: 3 })],
    });
    await svc.startFormalTest(STUDENT, 'daily-1');
    expect(paper()[2].masteryBefore).toBe(5);
  });

  it('抽查数量记在 sourceSummary 里 —— 事后能查这份卷子考了几个旧词', async () => {
    const { svc, created } = makeSvc({
      owned: ['old1', 'old2'].map((h) => ownedSense({ headword: h })),
    });
    await svc.startFormalTest(STUDENT, 'daily-1');
    expect(created[0].data.sourceSummary).toMatchObject({ frozenItemCount: 2, reviewSampleCount: 2 });
    expect(created[0].data.target).toBe(4);
  });

  it('每道抽查题都出了题 —— 不能只有卡片没有题目', async () => {
    const { svc, paper } = makeSvc({
      owned: ['old1', 'old2', 'old3'].map((h) => ownedSense({ headword: h })),
    });
    await svc.startFormalTest(STUDENT, 'daily-1');
    for (const item of paper()) {
      expect(item.questionSnapshot).toBeTruthy();
      expect(['spelling', 'meaning_choice']).toContain(item.questionSnapshot.type);
    }
  });
});
