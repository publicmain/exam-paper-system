import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  enqueueVocabularyContent,
  runVocabularyContentBatch,
  vocabularyContentProviderConfigured,
} from './content-producer';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('vocabulary content producer configuration', () => {
  it('runs with either complete Azure OpenAI settings or Azure Translator corpus mode', () => {
    vi.stubEnv('AZURE_TRANSLATOR_KEY', '');
    vi.stubEnv('AZURE_OPENAI_ENDPOINT', 'https://school.openai.azure.com');
    vi.stubEnv('AZURE_OPENAI_API_KEY', 'test-key');
    vi.stubEnv('AZURE_OPENAI_DEPLOYMENT', '');
    expect(vocabularyContentProviderConfigured()).toBe(false);

    vi.stubEnv('AZURE_OPENAI_DEPLOYMENT', 'vocab-content');
    expect(vocabularyContentProviderConfigured()).toBe(true);

    vi.stubEnv('AZURE_OPENAI_ENDPOINT', '');
    vi.stubEnv('AZURE_OPENAI_API_KEY', '');
    vi.stubEnv('AZURE_OPENAI_DEPLOYMENT', '');
    vi.stubEnv('AZURE_TRANSLATOR_KEY', 'translator-key');
    expect(vocabularyContentProviderConfigured()).toBe(true);
  });
});

describe('vocabulary content queue', () => {
  it('queues only senses whose two student-facing contexts are incomplete', async () => {
    const findMany = vi.fn()
      .mockResolvedValueOnce([
        { id: 'sense-1', contentVersion: 3 },
        { id: 'sense-2', contentVersion: 1 },
      ])
      .mockResolvedValue([]);
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = {
      vocabularySense: { findMany },
      vocabularyContentJob: { upsert },
    } as any;

    await expect(enqueueVocabularyContent(prisma, 20)).resolves.toBe(2);
    expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([expect.objectContaining({ qualityStatus: 'ready' })]),
      }),
      take: 8,
    }));
    expect(findMany).toHaveBeenCalledTimes(3);
    expect(upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { senseId_requestedVersion: { senseId: 'sense-1', requestedVersion: 4 } },
    }));
    expect(upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { senseId_requestedVersion: { senseId: 'sense-2', requestedVersion: 2 } },
    }));
  });
});

describe('vocabulary content publication', () => {
  it('publishes licensed corpus examples with Azure translations when OpenAI is absent', async () => {
    vi.stubEnv('AZURE_OPENAI_ENDPOINT', '');
    vi.stubEnv('AZURE_OPENAI_API_KEY', '');
    vi.stubEnv('AZURE_OPENAI_DEPLOYMENT', '');
    vi.stubEnv('AZURE_TRANSLATOR_KEY', 'translator-key');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { id: 101, text: 'Sales decline when customers lose confidence.', owner: 'Alice', license: 'CC BY 2.0 FR', translations: [] },
        { id: 102, text: 'Several species decline after habitat loss.', owner: 'Bob', license: 'CC BY 2.0 FR', translations: [] },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { translations: [{ text: '顾客失去信心时，销量会下降。' }] },
        { translations: [{ text: '一些物种在栖息地丧失后数量下降。' }] },
      ]), { status: 200 })));

    const job = {
      id: 'job-corpus', senseId: 'sense-1', requestedVersion: 2,
      sense: {
        pos: 'verb', definition: 'to become smaller, fewer, or weaker', translation: '下降；减少',
        lexeme: { headword: 'decline' }, contexts: [],
      },
    };
    const contextUpsert = vi.fn().mockResolvedValue({});
    const txJobUpdate = vi.fn().mockResolvedValue({});
    const prisma = {
      vocabularySense: { findMany: vi.fn().mockResolvedValue([]) },
      vocabularyContentJob: {
        upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([job]), update: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback({
        vocabularyContext: { upsert: contextUpsert },
        vocabularySense: { update: vi.fn().mockResolvedValue({}) },
        vocabularyContentJob: { update: txJobUpdate },
      })),
    } as any;

    await expect(runVocabularyContentBatch(prisma, 1)).resolves.toEqual({ selected: 1, published: 1, rejected: 0, failed: 0 });
    expect(contextUpsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      create: expect.objectContaining({ provider: 'tatoeba+azure_translator', externalId: 'tatoeba:101' }),
    }));
    expect(contextUpsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      create: expect.objectContaining({ provider: 'tatoeba+azure_translator', externalId: 'tatoeba:102' }),
    }));
    expect(txJobUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'published', provider: 'tatoeba+azure_translator' }),
    }));
  });

  it('publishes two focused contexts only after the quality gate passes', async () => {
    vi.stubEnv('AZURE_OPENAI_ENDPOINT', 'https://school.openai.azure.com');
    vi.stubEnv('AZURE_OPENAI_API_KEY', 'test-key');
    vi.stubEnv('AZURE_OPENAI_DEPLOYMENT', 'vocab-content');

    const candidate = {
      definition: 'to become smaller, fewer, or weaker',
      shortExample: 'Sales decline when customers lose confidence.',
      shortTranslation: '顾客失去信心时，销量会下降。',
      alternateExample: 'The path begins to decline beyond the bridge.',
      alternateTranslation: '过桥后小路开始向下倾斜。',
      alternateTopic: 'travel',
      collocations: ['decline sharply', 'a steady decline'],
      wordFamily: ['declining'],
      confusionWords: ['decrease'],
      memoryHint: 'Think of a line moving down.',
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(candidate) } }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const senseFindMany = vi.fn().mockResolvedValue([]);
    const job = {
      id: 'job-1',
      senseId: 'sense-1',
      requestedVersion: 2,
      sense: {
        pos: 'verb',
        definition: 'to become smaller, fewer, or weaker',
        translation: '下降；减少',
        lexeme: { headword: 'decline' },
        contexts: [{ kind: 'article_original', sentence: 'Sales may decline this year.' }],
      },
    };
    const jobUpdate = vi.fn().mockResolvedValue({});
    const contextUpsert = vi.fn().mockResolvedValue({});
    const senseUpdate = vi.fn().mockResolvedValue({});
    const txJobUpdate = vi.fn().mockResolvedValue({});
    const prisma = {
      vocabularySense: { findMany: senseFindMany },
      vocabularyContentJob: {
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue([job]),
        update: jobUpdate,
      },
      $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback({
        vocabularyContext: { upsert: contextUpsert },
        vocabularySense: { update: senseUpdate },
        vocabularyContentJob: { update: txJobUpdate },
      })),
    } as any;

    await expect(runVocabularyContentBatch(prisma, 1)).resolves.toEqual({
      selected: 1,
      published: 1,
      rejected: 0,
      failed: 0,
    });
    expect(contextUpsert).toHaveBeenCalledTimes(2);
    expect(contextUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ kind: 'short_same_meaning', sentence: candidate.shortExample }),
    }));
    expect(contextUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ kind: 'alternate_topic', sentence: candidate.alternateExample }),
    }));
    expect(senseUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ contentVersion: 2, qualityStatus: 'ready' }),
    }));
    expect(txJobUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'published' }),
    }));
  });

  it('rejects invalid generated material without publishing student contexts', async () => {
    vi.stubEnv('AZURE_OPENAI_ENDPOINT', 'https://school.openai.azure.com');
    vi.stubEnv('AZURE_OPENAI_API_KEY', 'test-key');
    vi.stubEnv('AZURE_OPENAI_DEPLOYMENT', 'vocab-content');
    const invalid = {
      definition: 'to become smaller',
      shortExample: 'Numbers went down.',
      shortTranslation: '数字下降了。',
      alternateExample: 'The value became lower yesterday.',
      alternateTranslation: '昨天数值变低了。',
      alternateTopic: 'math',
      collocations: ['decline sharply'],
      wordFamily: [],
      confusionWords: ['decrease'],
      memoryHint: null,
    };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(invalid) } }],
      }), { status: 200 })));

    const jobUpdate = vi.fn().mockResolvedValue({});
    const transaction = vi.fn();
    const prisma = {
      vocabularySense: { findMany: vi.fn().mockResolvedValue([]) },
      vocabularyContentJob: {
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue([{
          id: 'job-1', senseId: 'sense-1', requestedVersion: 2,
          sense: {
            pos: 'verb', definition: 'to become smaller', translation: '下降',
            lexeme: { headword: 'decline' }, contexts: [],
          },
        }]),
        update: jobUpdate,
      },
      $transaction: transaction,
    } as any;

    await expect(runVocabularyContentBatch(prisma, 1)).resolves.toEqual({
      selected: 1,
      published: 0,
      rejected: 1,
      failed: 0,
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(jobUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'rejected', errorCode: 'publication_gate_failed' }),
    }));
  });
});
