/**
 * 明暗外观（2026-09-16）。
 *
 * 学生自己选：跟随系统 / 亮色 / 暗色。**默认跟随系统** —— 和这个开关上线之前
 * 的行为一模一样，没动过它的人看不出任何区别。
 *
 * 怎么生效：
 *   · 选固定的一档 → 在 <html> 上打 `data-theme="light" | "dark"`，
 *     tokens.css 里的 `:root[data-theme='dark']` 覆盖整套颜色变量。
 *   · 跟随系统 → 把属性摘掉，回到 `@media (prefers-color-scheme: dark)`。
 *     那条媒体查询写成 `:root:not([data-theme='light'])`，所以「系统是暗的、
 *     学生偏要亮色」时学生赢 —— 手动选择必须压过系统，否则这个开关是假的。
 *
 * **首屏不能闪白**：index.html 的 <head> 里有一段内联脚本，读同一个键、
 * 在第一次绘制之前就把属性打上。这里的 initTheme 只是再算一遍并接管后续变化。
 * 两处读的是同一个键名，contract 测试钉住了这件事。
 *
 * 存储：`sw:theme`，值就是 'light' / 'dark'；跟随系统时**不存**（把键删掉），
 * 这样「默认」永远是一个状态，而不是两个（没有键 / 存着 'system'）。
 *
 * 它是**这台设备的显示偏好**，不是身份：不含姓名、id、答案，看见它也推不出
 * 上一个人是谁。所以它是 `clearIdentity()` 唯一不扫的 `sw:` 键 ——
 * 学生调好的明暗，一退出登录就弹回去，那是 bug 不是隐私。
 */

export type ThemePref = 'system' | 'light' | 'dark';
/** 算出来真正要显示的那一套（跟随系统时由系统决定）。 */
export type Appearance = 'light' | 'dark';

export const THEME_KEY = 'sw:theme';

export const THEME_OPTIONS: ReadonlyArray<{ value: ThemePref; label: string }> = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '亮色' },
  { value: 'dark', label: '暗色' },
];

/**
 * 浏览器 / 装到主屏后的状态栏颜色。
 *
 * 浅色保持首发时的主色蓝（`#007aff`，index.html 里写死的那个值）—— 这个开关
 * 不改亮色下的既有观感；深色给 `--c-canvas` 的值，不然暗界面顶着一条蓝边。
 */
const BAR_COLOR: Record<Appearance, string> = { light: '#007aff', dark: '#0e0e11' };

/** Safari 隐私模式下 localStorage 可能存在但一写就抛 —— 与 identity.ts 同一套做法。 */
function safeStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__sw_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function readThemePref(): ThemePref {
  const s = safeStorage();
  if (!s) return 'system';
  try {
    const v = s.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function systemPrefersDark(): boolean {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function resolveAppearance(pref: ThemePref): Appearance {
  if (pref === 'light' || pref === 'dark') return pref;
  return systemPrefersDark() ? 'dark' : 'light';
}

/** 只改 DOM：属性 + 状态栏颜色。不碰存储 —— 存不存得下是另一件事。 */
export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', BAR_COLOR[resolveAppearance(pref)]);
}

/**
 * 学生点了某一档。
 *
 * **先存后换，存不下也照换** —— 隐私模式下写不进 localStorage，界面这次还是
 * 得跟着变，只是下次打开回到跟随系统。宁可这一次好用，也不要一点没反应。
 */
export function setThemePref(pref: ThemePref): void {
  const s = safeStorage();
  if (s) {
    try {
      if (pref === 'system') s.removeItem(THEME_KEY);
      else s.setItem(THEME_KEY, pref);
    } catch {
      /* 存不下就只影响下一次打开，这一次照样换 */
    }
  }
  applyTheme(pref);
}

/**
 * 启动时调一次（main.tsx，渲染之前）。
 *
 * 内联脚本已经把属性打上了，这里重算一遍是为了两件内联脚本不该管的事：
 * 状态栏颜色，以及「跟随系统」时系统在前台切换（iOS 自动深色到点）要跟着动。
 * 颜色变量本来就由媒体查询直接接管，这个监听只是补状态栏那一条。
 */
export function initTheme(): void {
  applyTheme(readThemePref());
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (readThemePref() === 'system') applyTheme('system');
    };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    else if (typeof mq.addListener === 'function') mq.addListener(onChange); // 旧 Safari
  } catch {
    /* 没有 matchMedia：固定档位照常，跟随系统就退化成「打开时算一次」 */
  }
}
