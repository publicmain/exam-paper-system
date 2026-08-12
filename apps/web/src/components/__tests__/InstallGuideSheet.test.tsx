import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstallGuideSheet, {
  hasSeenInstallGuide,
  markInstallGuideSeen,
} from '../InstallGuideSheet';
import { detectPlatform } from '../../lib/pwa';

/**
 * 分机型安装向导（一步一屏）的行为契约。
 *
 * 最重要的一条：iPhone 的第一步必须是「逃回真 Safari」——
 * 2026-08-12 老师真机实测发现,扫码打开的是 iOS 的扫码小窗口,
 * 里面没有分享按钮,「添加到主屏幕」根本不存在。教程第一步若直接
 * 讲分享按钮,对不上学生眼前的屏幕,后面全部作废。
 */

const setUA = (ua: string, touch = 0) => {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touch, configurable: true });
};

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0 Mobile';

let saved: Array<[string, PropertyDescriptor | undefined]> = [];
beforeEach(() => {
  saved = ['userAgent', 'maxTouchPoints'].map((k) => [k, Object.getOwnPropertyDescriptor(navigator, k)]);
  localStorage.clear();
});
afterEach(() => {
  for (const [k, d] of saved) if (d) Object.defineProperty(navigator, k, d);
});

describe('detectPlatform', () => {
  it('iPadOS 自称 Mac,靠多点触控识破', () => {
    setUA(IPAD_DESKTOP_UA, 5);
    expect(detectPlatform()).toBe('ipad');
    setUA(IPAD_DESKTOP_UA, 0); // 真 Mac
    expect(detectPlatform()).toBe('other');
  });
  it('iPhone / Android 直判', () => {
    setUA(IPHONE);
    expect(detectPlatform()).toBe('iphone');
    setUA(ANDROID);
    expect(detectPlatform()).toBe('android');
  });
});

describe('InstallGuideSheet（一步一屏向导）', () => {
  it('iPhone 第一步是「逃回真 Safari」,不是分享按钮', () => {
    setUA(IPHONE);
    render(<InstallGuideSheet onDone={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /iPhone/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('先回到真正的 Safari')).toBeTruthy();
    expect(screen.getByText(/在 Safari 中打开/)).toBeTruthy();
    // 兜底：拷贝网址按钮
    expect(screen.getByText(/拷贝网址/)).toBeTruthy();
    // 一步一屏：分享按钮那一步此刻不该出现
    expect(screen.queryByText('点底部中间的「分享」按钮')).toBeNull();
  });

  it('下一步/上一步逐屏推进,最后一步变成「开始答题」', async () => {
    setUA(IPHONE);
    const u = userEvent.setup();
    const onDone = vi.fn();
    render(<InstallGuideSheet onDone={onDone} />);
    await u.click(screen.getByText('下一步 · 1/5'));
    expect(screen.getByText('点底部中间的「分享」按钮')).toBeTruthy();
    await u.click(screen.getByText('上一步'));
    expect(screen.getByText('先回到真正的 Safari')).toBeTruthy();
    for (const n of [1, 2, 3, 4]) await u.click(screen.getByText(`下一步 · ${n}/5`));
    expect(screen.getByText('完成！')).toBeTruthy();
    await u.click(screen.getByText('知道了，开始答题'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('iPad（桌面 UA + 触控）：第二步分享按钮指向右上角', async () => {
    setUA(IPAD_DESKTOP_UA, 5);
    const u = userEvent.setup();
    render(<InstallGuideSheet onDone={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /iPad/ }).getAttribute('aria-selected')).toBe('true');
    await u.click(screen.getByText('下一步 · 1/3'));
    expect(screen.getByText(/右上角的「分享」按钮/)).toBeTruthy();
  });

  it('切机型回到第一步 —— 步骤不通用', async () => {
    setUA(IPHONE);
    const u = userEvent.setup();
    render(<InstallGuideSheet onDone={vi.fn()} />);
    await u.click(screen.getByText('下一步 · 1/5'));
    await u.click(screen.getByRole('tab', { name: /安卓/ }));
    expect(screen.getByText('点右上角「⋮」菜单')).toBeTruthy();
    expect(screen.getByText('下一步 · 1/3')).toBeTruthy();
  });

  it('「跳过」在任何一步都立即放行', async () => {
    setUA(ANDROID);
    const u = userEvent.setup();
    const onDone = vi.fn();
    render(<InstallGuideSheet onDone={onDone} />);
    await u.click(screen.getByText('下一步 · 1/3'));
    await u.click(screen.getByText('跳过'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('看过标记只写一次口径', () => {
    expect(hasSeenInstallGuide()).toBe(false);
    markInstallGuideSeen();
    expect(hasSeenInstallGuide()).toBe(true);
  });
});
