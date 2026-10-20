import { afterEach, describe, expect, it, vi } from 'vitest';
import { collocationsBackedByApproved, isApprovedContext, PENDING_REVIEW_STATUS } from './content-review';
import { contextForEncounter, type ContextCandidate } from './context-progression';
import { enqueueVocabularyContent } from './content-producer';
import { VocabularyV2ContentCron } from './content-producer.cron';

/**
 * 白名单（2026-10-20）：默认不上，审过的才放。
 *
 * 这几组用例守的是「永不再犯」的四个口子：读取方不能把没审的给出去、搭配词不能绕过
 * 例句的审核、自动补句不能覆盖被拦/待审的行、自动补句的定时任务默认不跑。
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const row = (over: Partial<ContextCandidate>): ContextCandidate => ({
  id: 'c1', kind: 'short_same_meaning', position: 1,
  sentence: 'She passed her oral exam.', translation: '她通过了口试。',
  difficulty: 2, qualityStatus: 'ready', ...over,
});

describe('只有审过的（ready）才给学生', () => {
  it('状态判定', () => {
    expect(isApprovedContext({ qualityStatus: 'ready' })).toBe(true);
    expect(isApprovedContext({})).toBe(true); // 没带字段的旧调用方 / 测试，和原来一致
    expect(isApprovedContext({ qualityStatus: PENDING_REVIEW_STATUS })).toBe(false);
    expect(isApprovedContext({ qualityStatus: 'blocked_school' })).toBe(false);
    expect(isApprovedContext({ qualityStatus: 'needs_translation' })).toBe(false);
  });

  it('唯一一条是待审的：不给，返回 null —— 不再「挑不出就退回」', () => {
    expect(contextForEncounter([row({ qualityStatus: PENDING_REVIEW_STATUS })], 1, 5, 'oral')).toBeNull();
  });

  it('缺中文的也不给（原来会作为兜底退回去）', () => {
    expect(contextForEncounter([row({ qualityStatus: 'needs_translation' })], 1, 5, 'oral')).toBeNull();
  });

  it('待审和审过的并存：只给审过的那条，即使待审那条难度更合适', () => {
    const rows = [
      row({ id: 'pending', qualityStatus: PENDING_REVIEW_STATUS, difficulty: 1, sentence: 'Oral tradition matters.' }),
      row({ id: 'approved', qualityStatus: 'ready', difficulty: 5, position: 2 }),
    ];
    expect(contextForEncounter(rows, 1, 1, 'oral')?.id).toBe('approved');
  });

  it('老师写的课程文章原句（ready）照常给', () => {
    const article = row({ id: 'a', kind: 'article_original', sentence: 'The oral history project began in May.' });
    expect(contextForEncounter([article], 1, 5, 'oral')?.id).toBe('a');
  });
});

describe('搭配词只显示出现在已审例句里的', () => {
  // oral 的真实搭配：["is oral", "oral sex", "has oral", "oral thrush"]
  const raw = ['is oral', 'oral sex', 'has oral', 'oral thrush', 'oral exam'];

  it('已审例句里有的才留下', () => {
    const contexts = [{ sentence: 'She passed her oral exam.', qualityStatus: 'ready' }];
    expect(collocationsBackedByApproved(raw, contexts)).toEqual(['oral exam']);
  });

  it('只出现在待审 / 被拦例句里的不算 —— "oral sex" 绕不过去', () => {
    const contexts = [
      { sentence: 'What is oral sex?', qualityStatus: 'blocked_school' },
      { sentence: 'Oral thrush is common in babies.', qualityStatus: PENDING_REVIEW_STATUS },
    ];
    expect(collocationsBackedByApproved(raw, contexts)).toEqual([]);
  });

  it('必须连续、整词出现：两个词分散在句子里不算', () => {
    const contexts = [{ sentence: 'Oral answers about sex education were short.', qualityStatus: 'ready' }];
    expect(collocationsBackedByApproved(['oral sex'], contexts)).toEqual([]);
    expect(collocationsBackedByApproved(['oral answers'], contexts)).toEqual(['oral answers']);
  });

  it('没有已审例句：一个搭配都不显示', () => {
    expect(collocationsBackedByApproved(raw, [])).toEqual([]);
    expect(collocationsBackedByApproved(raw, null)).toEqual([]);
  });

  it('大小写、标点不影响', () => {
    const contexts = [{ sentence: 'ORAL EXAM tomorrow!', qualityStatus: 'ready' }];
    expect(collocationsBackedByApproved(['Oral Exam'], contexts)).toEqual(['Oral Exam']);
  });
});

describe('自动补句不覆盖被拦 / 待审的行', () => {
  it('「缺例句」只认这一槽根本没有行，不再看是不是 ready', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { vocabularySense: { findMany }, vocabularyContentJob: { upsert: vi.fn() } } as any;
    await enqueueVocabularyContent(prisma, 10);
    const where = findMany.mock.calls[0][0].where;
    const missing = where.AND.find((clause: any) => Array.isArray(clause.OR));
    // 10-20：被下架那一行被复用写进 "I need to go poop."，就是因为这里原来带着 qualityStatus: 'ready'
    for (const branch of missing.OR) {
      expect(branch.contexts.none).not.toHaveProperty('qualityStatus');
    }
  });
});

describe('自动补句的定时任务默认不跑', () => {
  // 记录有没有被访问，而不是访问时抛错 —— produce() 自己有 try/catch，抛错会被吞掉，
  // 那样老代码也能让测试「通过」。
  const tripwire = (touched: string[]) => new Proxy({}, { get: (_t, key) => { touched.push(String(key)); return undefined; } });

  it('不设 VOCAB_AUTO_CONTENT_ENABLED：就算翻译 key 配好了也不跑', async () => {
    vi.stubEnv('AZURE_TRANSLATOR_KEY', 'translator-key');
    vi.stubEnv('VOCAB_AUTO_CONTENT_ENABLED', '');
    const touched: string[] = [];
    const cron = new VocabularyV2ContentCron(tripwire(touched) as any);
    await cron.produce();
    expect(touched).toEqual([]);
  });

  it('设了才跑（会去碰数据库）', async () => {
    vi.stubEnv('AZURE_TRANSLATOR_KEY', 'translator-key');
    vi.stubEnv('VOCAB_AUTO_CONTENT_ENABLED', '1');
    const touched = vi.fn().mockResolvedValue([]);
    const prisma = {
      vocabularySense: { findMany: touched },
      vocabularyContentJob: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    };
    const cron = new VocabularyV2ContentCron(prisma as any);
    await cron.produce();
    expect(touched).toHaveBeenCalled();
  });
});
