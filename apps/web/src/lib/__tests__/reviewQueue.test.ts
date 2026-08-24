import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { flushPending, pendingCount, submitReview } from '../reviewQueue';

/**
 * 弱网评分队列（学生十问修复 #10）的行为契约：
 * - 成功：原样返回服务端响应，不入队
 * - 失败：入队并返回 { queued: true }，下次 flushPending 补传
 * - 补传时 4xx（这条本身不合法）丢弃，网络错误留队
 * - 每条评分带 requestId，重放靠服务端唯一约束去重
 */

vi.mock('../api', () => ({
  api: { vocabReview: vi.fn() },
}));

const base = { studentName: '张三', headword: 'coax', rating: 'good' };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('reviewQueue', () => {
  it('成功：透传响应、带 requestId、不入队', async () => {
    (api.vocabReview as any).mockResolvedValue({ headword: 'coax', intervalDays: 2, state: 'review', reps: 1 });
    const r: any = await submitReview(base);
    expect(r.intervalDays).toBe(2);
    expect(pendingCount()).toBe(0);
    expect(api.vocabReview).toHaveBeenCalledWith(
      expect.objectContaining({ headword: 'coax', requestId: expect.any(String) }),
    );
  });

  it('失败：入队并返回 queued', async () => {
    (api.vocabReview as any).mockRejectedValue(new Error('network'));
    const r: any = await submitReview(base);
    expect(r.queued).toBe(true);
    expect(pendingCount()).toBe(1);
  });

  it('flushPending：补传成功后清队，requestId 与入队时一致', async () => {
    (api.vocabReview as any).mockRejectedValueOnce(new Error('network'));
    await submitReview(base);
    const queuedId = JSON.parse(localStorage.getItem('vocab:pendingReviews')!)[0].requestId;
    (api.vocabReview as any).mockResolvedValue({});
    await flushPending();
    expect(pendingCount()).toBe(0);
    expect(api.vocabReview).toHaveBeenLastCalledWith(
      expect.objectContaining({ requestId: queuedId }),
    );
  });

  it('flushPending：4xx 丢弃（这条不合法），网络错误留队', async () => {
    (api.vocabReview as any).mockRejectedValue(new Error('network'));
    await submitReview(base);
    await submitReview({ ...base, headword: 'gone' });
    expect(pendingCount()).toBe(2);
    // 第一条 404（词被删了）→ 丢弃；第二条网络错误 → 留队
    (api.vocabReview as any)
      .mockRejectedValueOnce(Object.assign(new Error('not found'), { status: 404 }))
      .mockRejectedValueOnce(new Error('network again'));
    await flushPending();
    expect(pendingCount()).toBe(1);
  });
});
