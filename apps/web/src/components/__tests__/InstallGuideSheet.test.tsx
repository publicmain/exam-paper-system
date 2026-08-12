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
 * 步骤与截图来自老师 2026-08-12 的真机逐步实拍：iPhone 从扫码小窗口
 * 的「···」→「共享」直达（不需要逃回 Safari）；安卓的第一步是
 * **必须用 Chrome 的相机扫码**（系统相机打开的页面装不了 App）——
 * 这一步没做对后面全部白搭,所以必须是第一步。
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
  it('iPhone 第一步是扫码小窗口的「···」,配拷贝网址兜底', () => {
    setUA(IPHONE);
    render(<InstallGuideSheet onDone={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /iPhone/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('点右下角的「···」')).toBeTruthy();
    expect(screen.getByText(/拷贝网址/)).toBeTruthy();
    // 一步一屏：后面的步骤此刻不该出现
    expect(screen.queryByText('点「共享」')).toBeNull();
  });

  it('下一步/上一步逐屏推进,最后一步变成「开始答题」', async () => {
    setUA(IPHONE);
    const u = userEvent.setup();
    const onDone = vi.fn();
    render(<InstallGuideSheet onDone={onDone} />);
    await u.click(screen.getByText('下一步 · 1/5'));
    expect(screen.getByText('点「共享」')).toBeTruthy();
    await u.click(screen.getByText('上一步'));
    expect(screen.getByText('点右下角的「···」')).toBeTruthy();
    for (const n of [1, 2, 3, 4]) await u.click(screen.getByText(`下一步 · ${n}/5`));
    expect(screen.getByText('点右上角「添加」，完成！')).toBeTruthy();
    await u.click(screen.getByText('知道了，开始答题'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('iPad（桌面 UA + 触控）：第一步分享按钮在右上角', () => {
    setUA(IPAD_DESKTOP_UA, 5);
    render(<InstallGuideSheet onDone={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /iPad/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/右上角的「分享」按钮/)).toBeTruthy();
  });

  it('安卓第一步必须是「用 Chrome 的相机扫码」—— 顺序错了后面全白搭', () => {
    setUA(ANDROID);
    render(<InstallGuideSheet onDone={vi.fn()} />);
    expect(screen.getByText(/必须用 Chrome 的相机扫码/)).toBeTruthy();
    expect(screen.getByText(/系统相机或其他扫码工具打开的页面装不了/)).toBeTruthy();
  });

  it('切机型回到第一步 —— 步骤不通用', async () => {
    setUA(IPHONE);
    const u = userEvent.setup();
    render(<InstallGuideSheet onDone={vi.fn()} />);
    await u.click(screen.getByText('下一步 · 1/5'));
    await u.click(screen.getByRole('tab', { name: /安卓/ }));
    expect(screen.getByText(/必须用 Chrome 的相机扫码/)).toBeTruthy();
    expect(screen.getByText('下一步 · 1/5')).toBeTruthy();
  });

  it('「跳过」在任何一步都立即放行', async () => {
    setUA(ANDROID);
    const u = userEvent.setup();
    const onDone = vi.fn();
    render(<InstallGuideSheet onDone={onDone} />);
    await u.click(screen.getByText('下一步 · 1/5'));
    await u.click(screen.getByText('跳过'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('看过标记只写一次口径', () => {
    expect(hasSeenInstallGuide()).toBe(false);
    markInstallGuideSeen();
    expect(hasSeenInstallGuide()).toBe(true);
  });
});
