import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { VocabularyV2Service } from './vocabulary-v2.service';

/**
 * 「这句有问题」（2026-10-20，白名单改造第五条）。
 *
 * 「What is oral sex?」推了三周，是学生截图给叶老师才知道的。现在学生一点：这句立刻对
 * 所有学生下架（回到待审），老师后台收到通知。
 */

function setup(item: Record<string, unknown> | null, hiddenCount = 1) {
  const updateMany = vi.fn().mockResolvedValue({ count: hiddenCount });
  const executeRaw = vi.fn().mockResolvedValue(3);
  const createMany = vi.fn().mockResolvedValue({ count: 2 });
  const prisma: any = {
    vocabularyV2SessionItem: { findFirst: vi.fn().mockResolvedValue(item) },
    vocabularyContext: { updateMany },
    $executeRaw: executeRaw,
    user: {
      findUnique: vi.fn().mockResolvedValue({ name: '郑稀瑜', classEnrollments: [{ class: { name: 'OL26W' } }] }),
      findMany: vi.fn().mockResolvedValue([{ id: 'teacher-1' }, { id: 'admin-1' }]),
    },
    notification: { createMany },
  };
  const svc = new VocabularyV2Service(prisma, {} as any);
  return { svc, prisma, updateMany, executeRaw, createMany };
}

const oralItem = {
  senseId: 'sense-oral',
  contentSnapshot: { headword: 'oral', sentence: 'What is oral sex?', sentenceTranslation: '什麼是口交？' },
  sense: { lexeme: { headword: 'oral' } },
};

describe('学生反馈「这句有问题」', () => {
  it('只能报自己的题：按 itemId + 本人 studentId 查', async () => {
    const { svc, prisma } = setup(oralItem);
    await svc.reportContent('stu-1', 'item-1');
    expect(prisma.vocabularyV2SessionItem.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'item-1', session: { studentId: 'stu-1' } },
    }));
  });

  it('不是自己的 / 不存在：404，什么都不改', async () => {
    const { svc, updateMany, createMany } = setup(null);
    await expect(svc.reportContent('stu-1', 'someone-else')).rejects.toBeInstanceOf(NotFoundException);
    expect(updateMany).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it('这句立刻对所有学生下架：只动审过的语料例句，课程文章原句不碰', async () => {
    const { svc, updateMany, executeRaw } = setup(oralItem);
    const out = await svc.reportContent('stu-1', 'item-1', '这句不合适');
    expect(updateMany).toHaveBeenCalledWith({
      where: { senseId: 'sense-oral', sentence: 'What is oral sex?', kind: { not: 'article_original' }, qualityStatus: 'ready' },
      data: { qualityStatus: 'pending_review' },
    });
    expect(executeRaw).toHaveBeenCalledTimes(1); // 还没做的题里冻住的这句一起擦
    expect(out).toEqual({ ok: true, hidden: true });
  });

  it('通知每个教职工账号，写明谁、哪个词、哪句、学生说了什么、已经下架', async () => {
    const { svc, createMany } = setup(oralItem);
    await svc.reportContent('stu-1', 'item-1', '这句不合适');
    const rows = createMany.mock.calls[0][0].data;
    expect(rows.map((r: any) => r.userId)).toEqual(['teacher-1', 'admin-1']);
    expect(rows[0]).toMatchObject({ type: 'content_report', title: '学生反馈：oral 的内容有问题' });
    expect(rows[0].body).toContain('郑稀瑜（OL26W）');
    expect(rows[0].body).toContain('What is oral sex?');
    expect(rows[0].body).toContain('学生说：这句不合适');
    expect(rows[0].body).toContain('已经自动下架');
  });

  it('课程文章原句（或已经不在线上）：不下架，但照样通知', async () => {
    const { svc, executeRaw, createMany } = setup(oralItem, 0);
    const out = await svc.reportContent('stu-1', 'item-1');
    expect(out).toEqual({ ok: true, hidden: false });
    expect(executeRaw).not.toHaveBeenCalled();
    expect(createMany.mock.calls[0][0].data[0].body).toContain('没有自动处理');
  });

  it('卡片没有例句（反馈的是释义 / 搭配）：不动例句，照样通知', async () => {
    const { svc, updateMany, createMany } = setup({ ...oralItem, contentSnapshot: { headword: 'oral', sentence: null } });
    await svc.reportContent('stu-1', 'item-1');
    expect(updateMany).not.toHaveBeenCalled();
    expect(createMany.mock.calls[0][0].data[0].body).toContain('反馈的是卡片本身');
  });
});
