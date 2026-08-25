import { describe, expect, it, vi } from 'vitest';
import { VocabReviewService } from './vocab-review.service';

/**
 * 「已掌握」不等于「永久消失」（2026-08-25 外部审查发现的 P0）。
 *
 * 原来 due / stats / quiz 的查询全都带 `state != 'known'`，于是一个词
 * 的间隔一旦涨到 21 天被标成 known，**即使 FSRS 算出的 due 日到了也
 * 永远不再出现** —— 文档里写的「以后仍会在更长间隔上考它」是假的。
 *
 * 发现时生产库有 16 个 known 词，due 全在未来（最早 8/31）：bug 已经
 * 装好定时器但尚未爆发。
 *
 * 本文件锁住修复后的契约：**到期与否只看 `due <= now`**，state 纯粹是
 * 给学生看的标签。
 */

function makeSvc(rows: any[]) {
  const seenWhere: any[] = [];
  const match = (w: any) => {
    // 极简的 where 求值器，只支持本用例需要的算子
    return rows.filter((r) => {
      if (w.due?.lte && !(r.due <= w.due.lte)) return false;
      if (w.reps?.gt !== undefined && !(r.reps > w.reps.gt)) return false;
      if (w.reps === 0 && r.reps !== 0) return false;
      if (w.state?.not && r.state === w.state.not) return false;
      if (w.id?.notIn && w.id.notIn.includes(r.id)) return false;
      return true;
    });
  };
  const prisma: any = {
    studentWord: {
      count: vi.fn().mockImplementation(({ where }: any) => {
        seenWhere.push(where);
        return Promise.resolve(match(where).length);
      }),
      findMany: vi.fn().mockImplementation(({ where, take }: any) => {
        seenWhere.push(where);
        return Promise.resolve(match(where).slice(0, take ?? 999));
      }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    dictEntry: { findMany: vi.fn().mockResolvedValue([]) },
    wordReviewLog: { count: vi.fn().mockResolvedValue(0) },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  const words: any = { resolveStudent: vi.fn().mockResolvedValue({ id: 's1', name: '张三' }) };
  return { svc: new VocabReviewService(prisma, words), seenWhere };
}

const past = new Date(Date.now() - 86_400_000);
const future = new Date(Date.now() + 30 * 86_400_000);

const word = (over: Partial<any> = {}) => ({
  id: 'w1', headword: 'interference', surfaceForm: 'interference',
  contextSentence: '', sourcePassageTitle: null, sourceType: 'click',
  state: 'review', due: past, reps: 2, createdAt: past, ...over,
});

describe('known 词到期后必须回到队列', () => {
  it('due 已到的 known 词出现在今日复习队列里', async () => {
    const { svc } = makeSvc([word({ state: 'known', due: past, scheduledDays: 21 })]);
    const out = await svc.due({ studentName: '张三' });
    expect(out.cards.map((c) => c.headword)).toContain('interference');
    expect(out.totalDue).toBe(1);
  });

  it('due 还没到的 known 词不出现（正常的间隔重复，不是被过滤）', async () => {
    const { svc } = makeSvc([word({ state: 'known', due: future, scheduledDays: 21 })]);
    const out = await svc.due({ studentName: '张三' });
    expect(out.cards).toHaveLength(0);
    expect(out.totalDue).toBe(0);
  });

  it('任何到期查询都不再按 state 过滤 —— 防止过滤条件被改回来', async () => {
    const { svc, seenWhere } = makeSvc([word({ state: 'known', due: past })]);
    await svc.due({ studentName: '张三' });
    const withStateFilter = seenWhere.filter((w) => w?.state?.not === 'known');
    expect(withStateFilter).toHaveLength(0);
  });

  it('stats 的 totalDue 同口径：算上到期的 known 词', async () => {
    const { svc } = makeSvc([
      word({ id: 'a', state: 'known', due: past }),
      word({ id: 'b', state: 'review', due: past }),
      word({ id: 'c', state: 'known', due: future }),
    ]);
    const out = await svc.stats({ studentName: '张三' });
    expect(out.totalDue).toBe(2); // a + b，c 还没到期
  });
});
