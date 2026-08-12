import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstallAppCard from '../InstallAppCard';

/**
 * 安装引导卡的显隐矩阵。这张卡的价值全在"对的人、对的时机":
 * 推错了平台（桌面/微信）或推给已安装的人,都是打扰。
 */

const setUA = (ua: string) =>
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

let realUA: PropertyDescriptor | undefined;

beforeEach(() => {
  realUA = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
  localStorage.clear();
});
afterEach(() => {
  if (realUA) Object.defineProperty(navigator, 'userAgent', realUA);
  else setUA('');
});

describe('InstallAppCard', () => {
  it('iPhone Safari：显示三步手动安装教程（iOS 没有安装 API）', () => {
    setUA(IOS_UA);
    render(<InstallAppCard />);
    expect(screen.getByText(/装到主屏幕/)).toBeTruthy();
    expect(screen.getByText(/添加到主屏幕/)).toBeTruthy();
    expect(screen.getByText(/分享按钮/)).toBeTruthy();
  });

  it('点 × 关闭后永久隐藏', async () => {
    setUA(IOS_UA);
    const u = userEvent.setup();
    const { unmount } = render(<InstallAppCard />);
    await u.click(screen.getByLabelText('不再提示'));
    expect(screen.queryByText(/装到主屏幕/)).toBeNull();
    unmount();
    // 重新挂载也不再出现
    render(<InstallAppCard />);
    expect(screen.queryByText(/装到主屏幕/)).toBeNull();
  });

  it('桌面浏览器：不显示（学生场景是手机）', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0');
    render(<InstallAppCard />);
    expect(screen.queryByText(/装到主屏幕/)).toBeNull();
  });

  it('微信内置浏览器：装不了就不误导', () => {
    setUA(IOS_UA + ' MicroMessenger/8.0');
    render(<InstallAppCard />);
    expect(screen.queryByText(/装到主屏幕/)).toBeNull();
  });

  it('已在主屏幕模式（standalone）运行：任务完成，不再打扰', () => {
    setUA(IOS_UA);
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    render(<InstallAppCard />);
    expect(screen.queryByText(/装到主屏幕/)).toBeNull();
    Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true });
  });
});
