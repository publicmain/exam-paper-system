import { describe, it, expect, vi, afterEach } from 'vitest';
import { track } from '../track';
import { api } from '../api';

/**
 * 埋点的唯一契约：**永远不出事**。
 * 2026-08-13 首次接埋点时，四个自测页的测试被一个 undefined 方法调用
 * 炸掉 —— 生产里当然是有定义的，但这说明埋点具备"弄坏页面"的能力，
 * 而它不该有。下面四条把这个能力钉死。
 */

afterEach(() => vi.restoreAllMocks());

describe('track', () => {
  it('接口不存在（旧后端 / mock 不全）时静默返回，不抛', () => {
    vi.spyOn(api as any, 'recordPageView', 'get').mockReturnValue(undefined as any);
    expect(() => track('history', '测试学生')).not.toThrow();
  });

  it('接口 reject 时也不抛（网络错误、429、500）', async () => {
    const spy = vi
      .spyOn(api as any, 'recordPageView')
      .mockRejectedValue(new Error('network down'));
    expect(() => track('vocab', '测试学生')).not.toThrow();
    await Promise.resolve();
    expect(spy).toHaveBeenCalled();
  });

  it('接口同步抛异常时也不抛', () => {
    vi.spyOn(api as any, 'recordPageView').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => track('mistakes', '测试学生')).not.toThrow();
  });

  it('没有姓名时根本不发请求 —— 不产生无主记录', () => {
    const spy = vi.spyOn(api as any, 'recordPageView').mockResolvedValue({});
    track('history', '');
    expect(spy).not.toHaveBeenCalled();
  });

  it('正常路径带上 kind 与姓名', () => {
    const spy = vi.spyOn(api as any, 'recordPageView').mockResolvedValue({});
    track('submission_detail', '孙爱迪', 'sid-1');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'submission_detail', studentName: '孙爱迪', studentId: 'sid-1' }),
    );
  });
});
