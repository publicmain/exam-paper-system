import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WhatsNewSheet, { hasSeenWhatsNew, markWhatsNewSeen } from '../WhatsNewSheet';

/**
 * 这一屏挡在全班和考卷之间，倒计时挂的是固定的 9:00 —— 它多拦一秒，
 * 学生就少一秒答题时间。所以测的重点不是"长得好不好看"，而是
 * **任何情况下都放得走人**，以及不会重复打扰。
 */

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('WhatsNewSheet', () => {
  it('聚光灯巡礼进行中，「跳过」和「开始答题」依然点得动', async () => {
    // 巡礼会盖一层半透明黑幕。它只该压住三条内容，绝不能连出口一起压住 ——
    // 那等于用一段动画把学生锁在考试外面。
    const u = userEvent.setup();
    const onDone = vi.fn();
    render(<WhatsNewSheet onDone={onDone} />);
    const overlay = document.querySelector('.wn-fade');
    expect(overlay).not.toBeNull(); // 确认此刻确实在巡礼
    await u.click(screen.getByText('开始答题'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('点遮罩只打断巡礼，不会把整屏关掉', async () => {
    const u = userEvent.setup();
    const onDone = vi.fn();
    render(<WhatsNewSheet onDone={onDone} />);
    const overlay = document.querySelector('.wn-fade') as HTMLElement;
    await u.click(overlay);
    expect(onDone).not.toHaveBeenCalled();
    expect(document.querySelector('.wn-fade')).toBeNull();
  });

  it('「跳过」和「开始答题」都能立刻放行', async () => {
    const u = userEvent.setup();
    const onDone = vi.fn();
    const { unmount } = render(<WhatsNewSheet onDone={onDone} />);
    await u.click(screen.getByText('跳过'));
    expect(onDone).toHaveBeenCalledTimes(1);
    unmount();

    const onDone2 = vi.fn();
    render(<WhatsNewSheet onDone={onDone2} />);
    await u.click(screen.getByText('开始答题'));
    expect(onDone2).toHaveBeenCalledTimes(1);
  });

  it('点演示句里的词会出现释义，且提示语从"试试看"变成完成态', async () => {
    const u = userEvent.setup();
    render(<WhatsNewSheet onDone={vi.fn()} />);

    expect(screen.getByText(/试试看/)).toBeTruthy();
    expect(screen.queryByText(/迁徙/)).toBeNull();

    await u.click(screen.getByText('migration'));

    expect(screen.getByText(/n\. 迁徙/)).toBeTruthy();
    expect(screen.getByText('已存入生词本')).toBeTruthy();
    expect(screen.queryByText(/试试看/)).toBeNull();
    expect(screen.getByText(/任何一个词都可以点/)).toBeTruthy();
  });

  it('演示句里每个实词都能点开，不是只有被高亮的那个', async () => {
    const u = userEvent.setup();
    render(<WhatsNewSheet onDone={vi.fn()} />);
    // 高亮引导的是 migration，但学生点别的词也必须有反应 ——
    // 否则会误以为"只有某些词能查"。
    await u.click(screen.getByText('scientists'));
    expect(screen.getByText(/n\. 科学家/)).toBeTruthy();
  });

  it('演示区不发任何网络请求（考场 WiFi 卡住也不能影响它）', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const u = userEvent.setup();
    render(<WhatsNewSheet onDone={vi.fn()} />);
    await u.click(screen.getByText('migration'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('看过之后标记住，不再重复打扰', () => {
    expect(hasSeenWhatsNew()).toBe(false);
    markWhatsNewSeen();
    expect(hasSeenWhatsNew()).toBe(true);
  });

  it('localStorage 不可用时不抛错，且宁可多弹一次也不吞掉引导', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: localStorage disabled');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: localStorage disabled');
    });
    expect(hasSeenWhatsNew()).toBe(false);
    expect(() => markWhatsNewSeen()).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});
