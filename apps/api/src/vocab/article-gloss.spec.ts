import { describe, expect, it, vi } from 'vitest';
import { VocabService } from './vocab.service';
import * as tsGloss from './article-gloss';

const sentence = 'The pupils felt ready.';
function setup(config: any = { wordGlosses: { felt: { pos: 'v.', zh: '感到；觉得', lemma: 'feel' } } }) {
  const prisma = {
    paper: { findMany: vi.fn(async (_args: any) => [{ config, questions: [
      { snapshotContent: { passage: `Paragraph 1\n${sentence}\nThey smiled.` }, overrideContent: null },
    ] }]) },
    dictEntry: {
      findMany: vi.fn(async () => [{ word: 'felt', phonetic: 'felt', translation: '词典释义', definition: 'dictionary text', tag: ['zk'] }]),
      findUnique: vi.fn(async () => null),
    },
  };
  const realtime = { translate: vi.fn(async () => '实时翻译'), translateDetailed: vi.fn(async () => ({ text: '学生们觉得准备好了。' })) };
  return { prisma, realtime, svc: new VocabService(prisma as any, realtime as any) };
}

describe('阅读点词只用本文释义', () => {
  it('空白归一后命中，用本文中文与 lemma；词典只读取音标', async () => {
    const { svc, prisma, realtime } = setup();
    expect(await svc.lookup('Felt,', 'The pupils\n felt ready.')).toMatchObject({
      word: 'feel', query: 'Felt,', translation: '感到；觉得', pos: 'v.', definition: null,
      phonetic: 'felt', tag: [], via: 'gloss', contextTranslation: '学生们觉得准备好了。',
    });
    expect(prisma.dictEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: { word: true, phonetic: true } }));
    expect(realtime.translate).not.toHaveBeenCalled();
  });

  it.each([{}, { felt: { pos: 'v.', zh: '' } }])('有释义卷子缺词或坏释义：未收录，绝不查词典或实时翻词', async (wordGlosses) => {
    const { svc, prisma, realtime } = setup({ wordGlosses });
    expect(await svc.lookup('felt', sentence)).toBeNull();
    expect(prisma.dictEntry.findMany).not.toHaveBeenCalled();
    expect(prisma.dictEntry.findUnique).not.toHaveBeenCalled();
    expect(realtime.translate).not.toHaveBeenCalled();
    expect(realtime.translateDetailed).not.toHaveBeenCalled();
  });

  it('无释义卷子仍走原来的词典逻辑', async () => {
    const { svc } = setup({ lessonWords: [] });
    expect(await svc.lookup('felt', sentence)).toMatchObject({ translation: '词典释义', via: 'direct' });
  });

  it('学生端把长原句截成「前 257 字…」发来：去掉省略号照样命中本文释义，不退回词典', async () => {
    const { svc, prisma } = setup();
    expect(await svc.lookup('felt', 'The pupils felt re…')).toMatchObject({ translation: '感到；觉得', via: 'gloss' });
    expect(await svc.lookup('felt', 'The pupils felt re...')).toMatchObject({ via: 'gloss' });
    expect(prisma.dictEntry.findUnique).not.toHaveBeenCalled();
  });

  it('原句不在带释义卷子里，仍走旧逻辑', async () => {
    const { svc } = setup();
    expect(await svc.lookup('felt', 'Another article.')).toMatchObject({ via: 'direct' });
  });

  it('查询限制最近 60 天已发布且未归档，缓存十分钟后重新加载', async () => {
    const { svc, prisma } = setup({ wordGlosses: {} });
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      await svc.lookup('felt', sentence);
      await svc.lookup('felt', sentence);
      expect(prisma.paper.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.paper.findMany.mock.calls[0][0]).toMatchObject({
        where: { status: 'published', archivedAt: null, createdAt: { gte: new Date(now - 60 * 86_400_000) } },
      });
      clock.mockReturnValue(now + 10 * 60_000 + 1);
      await svc.lookup('felt', sentence);
      expect(prisma.paper.findMany).toHaveBeenCalledTimes(2);
    } finally { clock.mockRestore(); }
  });

  it('加载释义失败时直接报错，不把数据库故障当成旧文章而回退词典', async () => {
    const { svc, prisma } = setup();
    prisma.paper.findMany.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(svc.lookup('felt', sentence)).rejects.toThrow('database unavailable');
    expect(prisma.dictEntry.findMany).not.toHaveBeenCalled();
  });
});

it('week11 全部 25 篇：TS 与唯一 JS 口径的逐词键、整篇去重与顺序相同', () => {
  const ts = tsGloss;
  const js = require('../../scripts/pilot/gloss/tokens');
  const { LEVELS } = require('../../scripts/pilot/content/week11');
  let articles = 0;
  for (const days of Object.values(LEVELS) as any[][]) for (const day of days) {
    articles++;
    expect(ts.articleTokens(day.passage)).toEqual(js.articleTokens(day.passage));
    for (const match of day.passage.matchAll(js.WORD_RE)) expect(ts.glossKey(match[0])).toBe(js.glossKey(match[0]));
    for (const word of day.passage.split(/\s+/)) expect(ts.glossKey(word)).toBe(js.glossKey(word));
  }
  expect(articles).toBe(25);
  for (const raw of [null, undefined, '', 'Ｓｉｎｇａｐｏｒｅ’s', '‘Teacher’s’', "students'", 'time-saving', 'ʼwordʼ', '—']) {
    expect(ts.glossKey(raw)).toBe(js.glossKey(raw));
  }
});
