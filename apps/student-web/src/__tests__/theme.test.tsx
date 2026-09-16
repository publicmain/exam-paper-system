import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import App from '../App';
import { __resetForTest } from '../lib/auth-store';
import { clearIdentity, readToken, writeToken } from '../lib/identity';
import { THEME_KEY, applyTheme, initTheme, readThemePref, resolveAppearance, setThemePref } from '../lib/theme';

/**
 * 明暗外观（2026-09-16）——「学生端加一个明暗切换」。
 *
 * 判据是**跑起来做了什么**：点一下之后 <html> 上是什么、localStorage 里剩什么、
 * 重开应用还认不认、隐私模式下会不会崩、退出登录会不会把它一起清掉。
 * 不测「源码里有没有某个字符串」，只有首屏内联脚本那一组例外 ——
 * 它不经过打包器，在 jsdom 里没有别的办法证明它真的跑得动。
 */

const PROFILE = { id: 's9', name: '测试九号', nickname: '九号', avatar: null };
const TOKEN = 'theme-token';
const HTML = path.resolve(__dirname, '..', '..', 'index.html');

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

/** 只答账号页要用的那一个；其余一律 404 —— 提醒那一节因此不渲染，不影响本文件。 */
function stubFetch() {
  const f = vi.fn((url: string) => {
    const r = String(url).replace(/^.*\/api/, '');
    if (r.startsWith('/student-auth/me')) return jsonResponse(200, { ...PROFILE, englishLevel: 'olevel' });
    return jsonResponse(404, { code: 'not_found' });
  });
  vi.stubGlobal('fetch', f as unknown as typeof fetch);
  return f;
}

/** jsdom 没有 matchMedia —— 系统深浅要自己给。 */
function setSystemDark(dark: boolean) {
  const listeners: Array<(e: { matches: boolean }) => void> = [];
  const mql = {
    matches: dark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
      listeners.push(fn);
    },
    removeEventListener: () => undefined,
    addListener: (fn: (e: { matches: boolean }) => void) => {
      listeners.push(fn);
    },
    removeListener: () => undefined,
    dispatchEvent: () => true,
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mql) as unknown as typeof window.matchMedia);
  return {
    /** 系统在前台切换（iOS 自动深色到点） */
    flip(next: boolean) {
      mql.matches = next;
      for (const fn of listeners) fn({ matches: next });
    },
  };
}

function bar(): string | null {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
}
const themeAttr = () => document.documentElement.getAttribute('data-theme');

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'theme-color');
  meta.setAttribute('content', '#007aff');
  document.head.appendChild(meta);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// 模块行为
// ─────────────────────────────────────────────────────────────

describe('外观偏好', () => {
  it('**默认跟随系统**：什么都不选时 <html> 上没有 data-theme，行为与这个开关上线前一致', () => {
    setSystemDark(false);
    initTheme();
    expect(readThemePref()).toBe('system');
    expect(themeAttr()).toBeNull();
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it('选「暗色」→ 打属性 + 存键；选「亮色」→ 换成 light', () => {
    setSystemDark(false);
    setThemePref('dark');
    expect(themeAttr()).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');

    setThemePref('light');
    expect(themeAttr()).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
  });

  it('**系统是深色、学生偏要亮色**：属性照打 light —— 手动选择必须压过系统', () => {
    setSystemDark(true);
    setThemePref('light');
    expect(themeAttr()).toBe('light');
    expect(resolveAppearance('light')).toBe('light');
    // 跟随系统时才轮到系统说话
    expect(resolveAppearance('system')).toBe('dark');
  });

  it('回到「跟随系统」：属性摘掉，键**删掉**而不是存成 system（默认只有一个状态）', () => {
    setSystemDark(false);
    setThemePref('dark');
    setThemePref('system');
    expect(themeAttr()).toBeNull();
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(readThemePref()).toBe('system');
  });

  it('**重开应用还认**：存着 dark，initTheme 一跑就恢复', () => {
    setSystemDark(false);
    setThemePref('dark');
    document.documentElement.removeAttribute('data-theme'); // 模拟新的一次加载
    initTheme();
    expect(themeAttr()).toBe('dark');
  });

  it('存储里是坏值（被人手改过）→ 当作跟随系统，不是崩', () => {
    localStorage.setItem(THEME_KEY, 'blue');
    setSystemDark(false);
    initTheme();
    expect(readThemePref()).toBe('system');
    expect(themeAttr()).toBeNull();
  });

  it('**隐私模式写不进 localStorage**：这一次照样换，不抛', () => {
    setSystemDark(false);
    const realSet = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };
    try {
      expect(() => setThemePref('dark')).not.toThrow();
      expect(themeAttr()).toBe('dark');
    } finally {
      Storage.prototype.setItem = realSet;
    }
    // 下次打开回到跟随系统（存不下就是存不下，不假装记住了）
    document.documentElement.removeAttribute('data-theme');
    initTheme();
    expect(themeAttr()).toBeNull();
  });

  it('没有 matchMedia 的老浏览器：固定档位照常，跟随系统退化成浅色，不抛', () => {
    vi.stubGlobal('matchMedia', undefined as unknown as typeof window.matchMedia);
    expect(() => initTheme()).not.toThrow();
    expect(resolveAppearance('system')).toBe('light');
    setThemePref('dark');
    expect(themeAttr()).toBe('dark');
  });
});

describe('状态栏 / 浏览器界面颜色', () => {
  it('暗色时状态栏跟着变深，回到亮色再变回首发时的蓝', () => {
    setSystemDark(false);
    applyTheme('dark');
    expect(bar()).toBe('#0e0e11');
    applyTheme('light');
    expect(bar()).toBe('#007aff');
  });

  it('**跟随系统时，系统当场切到深色**：状态栏跟着走（颜色变量本来就由媒体查询接管）', () => {
    const sys = setSystemDark(false);
    initTheme();
    expect(bar()).toBe('#007aff');
    sys.flip(true);
    expect(bar()).toBe('#0e0e11');
    expect(themeAttr()).toBeNull(); // 仍然是「跟随系统」，没有被钉死
  });

  it('学生已经固定了一档，系统再怎么切都不跟', () => {
    const sys = setSystemDark(false);
    setThemePref('light');
    initTheme();
    sys.flip(true);
    expect(themeAttr()).toBe('light');
    expect(bar()).toBe('#007aff');
  });

  it('页面上没有 theme-color 这个 meta 也不能崩', () => {
    setSystemDark(false);
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
    expect(() => setThemePref('dark')).not.toThrow();
    expect(themeAttr()).toBe('dark');
  });
});

// ─────────────────────────────────────────────────────────────
// 账号页
// ─────────────────────────────────────────────────────────────

async function openAccount() {
  writeToken(TOKEN);
  render(
    <MemoryRouter initialEntries={['/account']}>
      <App />
    </MemoryRouter>,
  );
  await screen.findByTestId('theme-box');
}

describe('账号页「外观」', () => {
  beforeEach(() => {
    setSystemDark(false);
  });

  it('三档都在，默认高亮「跟随系统」', async () => {
    stubFetch();
    await openAccount();
    expect(screen.getByTestId('theme-system')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('theme-light')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('theme-dark')).toHaveAttribute('aria-pressed', 'false');
  });

  it('**点「暗色」立刻生效**，不用保存，也不发任何请求', async () => {
    const f = stubFetch();
    await openAccount();
    const before = f.mock.calls.length;
    await userEvent.click(screen.getByTestId('theme-dark'));
    expect(themeAttr()).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(screen.getByTestId('theme-dark')).toHaveAttribute('aria-pressed', 'true');
    expect(f.mock.calls.length).toBe(before); // 外观是本机的事，不上服务端
  });

  it('点完再「重开应用」，还是暗色', async () => {
    stubFetch();
    await openAccount();
    await userEvent.click(screen.getByTestId('theme-dark'));
    document.documentElement.removeAttribute('data-theme');
    initTheme();
    expect(themeAttr()).toBe('dark');
  });

  it('选回「跟随系统」，属性和键都清掉', async () => {
    stubFetch();
    await openAccount();
    await userEvent.click(screen.getByTestId('theme-dark'));
    await userEvent.click(screen.getByTestId('theme-system'));
    await waitFor(() => expect(screen.getByTestId('theme-system')).toHaveAttribute('aria-pressed', 'true'));
    expect(themeAttr()).toBeNull();
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it('整组有读屏名字，用的是既有的分段控件（44px 命中区那一套）', async () => {
    stubFetch();
    await openAccount();
    const group = screen.getByRole('group', { name: '明暗外观' });
    expect(group.className).toContain('seg');
    expect(group.querySelectorAll('button')).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────
// 与退出登录的关系
// ─────────────────────────────────────────────────────────────

describe('退出登录不动外观', () => {
  it('**clearIdentity 清掉令牌和草稿，外观留着** —— 它属于这台设备，不属于某个学生', () => {
    setSystemDark(false);
    writeToken(TOKEN);
    localStorage.setItem('sw:reading:answers:sess:sub', JSON.stringify({ q1: 'a' }));
    setThemePref('dark');

    clearIdentity();

    expect(readToken()).toBeNull();
    expect(localStorage.getItem('sw:reading:answers:sess:sub')).toBeNull();
    expect(Object.keys(localStorage).filter((k) => k.startsWith('sw:'))).toEqual([THEME_KEY]);
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });

  it('留下来的这个键里没有任何身份信息', () => {
    setSystemDark(false);
    setThemePref('dark');
    const v = localStorage.getItem(THEME_KEY) ?? '';
    expect(v).toBe('dark');
    expect(v).not.toContain(PROFILE.id);
    expect(v).not.toContain(PROFILE.name);
    expect(v).not.toContain(TOKEN);
  });
});

// ─────────────────────────────────────────────────────────────
// 首屏防闪：index.html 里的内联脚本
// ─────────────────────────────────────────────────────────────

describe('首屏不闪白（index.html 内联脚本）', () => {
  const html = fs.readFileSync(HTML, 'utf8');
  const inline = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

  it('<head> 里有一段内联脚本，而且排在 theme-color 之后（否则改不到状态栏）', () => {
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toContain('<script>');
    expect(head.indexOf('name="theme-color"')).toBeLessThan(head.indexOf('<script>'));
    // 应用主脚本仍然是模块、仍然在 body 里 —— 别把它挪到 head 去
    expect(html).toContain('<script type="module" src="/src/main.tsx"></script>');
  });

  it('**读的是同一个键**（改了 theme.ts 的键名，这里必须跟着改）', () => {
    expect(inline).toContain(THEME_KEY);
  });

  it('是 ES5：没有箭头函数 / let / const / 可选链 —— 这段不经过打包器转译，旧 iPad 也要跑', () => {
    expect(inline).not.toMatch(/=>/);
    expect(inline).not.toMatch(/\b(let|const)\s/);
    expect(inline).not.toMatch(/\?\./);
  });

  it('**真的跑一遍**：存着 dark 时把属性和状态栏都定下来', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    new Function(inline)();
    expect(themeAttr()).toBe('dark');
    expect(bar()).toBe('#0e0e11');
  });

  it('跟随系统（没有键）时它什么都不做，坏值同理', () => {
    new Function(inline)();
    expect(themeAttr()).toBeNull();
    localStorage.setItem(THEME_KEY, 'blue');
    new Function(inline)();
    expect(themeAttr()).toBeNull();
    expect(bar()).toBe('#007aff');
  });

  it('localStorage 一读就抛（隐私模式）也不会让首屏挂掉', () => {
    const realGet = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new DOMException('SecurityError');
    };
    try {
      expect(() => new Function(inline)()).not.toThrow();
    } finally {
      Storage.prototype.getItem = realGet;
    }
  });
});
