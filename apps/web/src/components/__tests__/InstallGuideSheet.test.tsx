import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstallGuideSheet, {
  hasSeenInstallGuide,
  markInstallGuideSeen,
} from '../InstallGuideSheet';
import { detectPlatform } from '../../lib/pwa';

/**
 * 分机型教程的核心契约：机型检测选对步骤、检测错了能手动切、
 * 「跳过」和「开始答题」永远放行 —— 这一屏站在考试倒计时里。
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

describe('InstallGuideSheet', () => {
  it('iPhone：默认选中 iPhone 页签,显示 4 步 Safari 教程', () => {
    setUA(IPHONE);
    render(<InstallGuideSheet onDone={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /iPhone/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/底部中间的「分享」按钮/)).toBeTruthy();
    expect(screen.getAllByRole('img', { name: /第 \d 步/ })).toHaveLength(4);
  });

  it('iPad（桌面 UA + 触控）：分享按钮指向右上角', () => {
    setUA(IPAD_DESKTOP_UA, 5);
    render(<InstallGuideSheet onDone={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /iPad/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/右上角（地址栏旁边）/)).toBeTruthy();
  });

  it('检测错了可以手动切机型', async () => {
    setUA(IPHONE);
    const u = userEvent.setup();
    render(<InstallGuideSheet onDone={vi.fn()} />);
    await u.click(screen.getByRole('tab', { name: /安卓/ }));
    expect(screen.getByText(/「⋮」菜单/)).toBeTruthy();
  });

  it('「跳过」和「开始答题」都立即放行', async () => {
    setUA(ANDROID);
    const u = userEvent.setup();
    const onDone = vi.fn();
    render(<InstallGuideSheet onDone={onDone} />);
    await u.click(screen.getByText('跳过'));
    await u.click(screen.getByText('知道了，开始答题'));
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it('看过标记只写一次口径', () => {
    expect(hasSeenInstallGuide()).toBe(false);
    markInstallGuideSeen();
    expect(hasSeenInstallGuide()).toBe(true);
  });
});
