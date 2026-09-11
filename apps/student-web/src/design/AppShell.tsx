/**
 * 学生端外壳与顶层导航（IOS-01）。
 *
 * 四个固定目的地：今日 / 我的单词 / 学习记录 / 账号。暂停的错题本不占 tab。
 *   · 窄于 1024px：底部标签栏（图标 + 文字），固定在安全区之上。
 *   · 1024px 及以上（iPad 横屏、桌面）：左侧栏，同一组目的地、同一套选中标记。
 * 断点看的是视口宽度 —— iPad 分屏 / 窄窗时视口本身变窄，布局会跟着收起（HIG · Layout）。
 *
 * 专注任务（阅读、学词、正式词测、今日总结）用 `focus` 外壳：没有标签栏，由页面自己的
 * FocusHeader 给出「回到哪里」。登录 / 注册是 `public` 外壳。
 *
 * 状态保留（HIG · Tab bars：切换区块应保留导航状态）：
 *   · 每个 tab 记住上次停在哪一页（含查询串，比如生词本的搜索与筛选）；
 *   · 每个地址记住滚动位置，回来时恢复；
 *   · 点当前已选中的 tab 回到它的根页面。
 * 这些都只存在内存里 —— 不落盘，换账号 / 刷新即清空，不会把 A 的筛选带给 B。
 */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigationType } from 'react-router-dom';
import { ROUTES } from '../routes.contract';
import { Icon, type IconName } from './Icon';
import { ToastProvider } from './Toast';

export type ShellKind = 'public' | 'tabs' | 'focus';

export type TabKey = 'today' | 'vocab' | 'records' | 'account';

type Tab = { key: TabKey; label: string; icon: IconName; root: string; prefixes: string[]; testId: string };

export const TABS: readonly Tab[] = [
  { key: 'today', label: '今日', icon: 'today', root: ROUTES.today, prefixes: [ROUTES.today], testId: 'tab-today' },
  { key: 'vocab', label: '我的单词', icon: 'words', root: ROUTES.vocab, prefixes: [ROUTES.vocab], testId: 'tab-vocab' },
  {
    key: 'records',
    label: '学习记录',
    icon: 'records',
    root: ROUTES.scores,
    prefixes: [ROUTES.scores, ROUTES.mistakes],
    testId: 'tab-records',
  },
  { key: 'account', label: '账号', icon: 'account', root: ROUTES.account, prefixes: [ROUTES.account], testId: 'tab-account' },
];

const FOCUS_PREFIXES = ['/lesson/', '/coach/'];

export function shellFor(pathname: string, authenticated: boolean): ShellKind {
  if (!authenticated || pathname === ROUTES.login || pathname === ROUTES.register) return 'public';
  if (FOCUS_PREFIXES.some((p) => pathname.startsWith(p))) return 'focus';
  return 'tabs';
}

export function tabFor(pathname: string): TabKey | null {
  const hit = TABS.find((t) => t.prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`)));
  return hit?.key ?? null;
}

// ── 内存里的导航记忆（不落盘） ──────────────────────────────
const lastByTab = new Map<TabKey, string>();
const scrollByUrl = new Map<string, number>();

/** 换账号 / 登出时清空，免得把上一个人的筛选和位置带给下一个人（UI15 / UI07 同一原则）。 */
export function resetNavigationMemory(): void {
  lastByTab.clear();
  scrollByUrl.clear();
}

const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);

function useNavigationMemory() {
  const loc = useLocation();
  const navType = useNavigationType();
  const url = `${loc.pathname}${loc.search}`;
  const urlRef = useRef(url);

  // 记住当前 tab 停在哪
  useEffect(() => {
    const tab = tabFor(loc.pathname);
    if (tab) lastByTab.set(tab, url);
  }, [loc.pathname, url]);

  // 滚动：离开时记下，回来时恢复；新开的页面从顶上开始
  useEffect(() => {
    if (isJsdom) return;
    urlRef.current = url;
    const saved = scrollByUrl.get(url);
    let raf = 0;
    const started = performance.now();
    const restore = () => {
      if (saved == null) return;
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      if (maxY >= saved || performance.now() - started > 1500) {
        window.scrollTo(0, Math.min(saved, Math.max(0, maxY)));
        return;
      }
      raf = requestAnimationFrame(restore);
    };
    if (saved != null) restore();
    else if (navType !== 'POP') window.scrollTo(0, 0);
    const onScroll = () => {
      scrollByUrl.set(urlRef.current, window.scrollY);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [url, navType]);
}

function tabTarget(tab: Tab, active: boolean): string {
  // 点当前 tab → 回根页；点别的 tab → 回到它上次停的地方
  if (active) return tab.root;
  return lastByTab.get(tab.key) ?? tab.root;
}

function TabBar({ active }: { active: TabKey | null }) {
  return (
    <nav
      aria-label="主导航"
      className="material-bar fixed inset-x-0 bottom-0 z-30 border-t border-line lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="safe-x mx-auto grid max-w-2xl grid-cols-4">
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                to={tabTarget(t, on)}
                data-testid={t.testId}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-tabbar flex-col items-center justify-center gap-0.5 rounded-control px-1 text-caption no-underline ${
                  on ? 'font-semibold text-accent' : 'font-medium text-ink-3 hover:text-ink-2'
                }`}
              >
                <Icon name={t.icon} size={24} strokeWidth={on ? 2.1 : 1.8} />
                <span className="leading-tight">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Sidebar({ active }: { active: TabKey | null }) {
  return (
    <nav
      aria-label="主导航"
      className="material-bar fixed inset-y-0 left-0 z-30 hidden w-sidebar flex-col border-r border-line lg:flex"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingLeft: 'env(safe-area-inset-left)' }}
    >
      <div className="px-5 pb-4 pt-2">
        <div className="text-headline text-ink">每日英语</div>
        <div className="text-caption text-ink-3">ESIC</div>
      </div>
      <ul className="flex flex-col gap-1 px-3">
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                to={tabTarget(t, on)}
                data-testid={`${t.testId}-side`}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-[44px] items-center gap-3 rounded-control px-3 text-body no-underline ${
                  on ? 'bg-accent-soft font-semibold text-accent' : 'text-ink-2 hover:bg-fill'
                }`}
              >
                <Icon name={t.icon} size={22} />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ kind, children }: { kind: ShellKind; children: ReactNode }) {
  const loc = useLocation();
  useNavigationMemory();
  const active = tabFor(loc.pathname);

  if (kind !== 'tabs') {
    return <ToastProvider>{children}</ToastProvider>;
  }
  return (
    <ToastProvider bottomOffset="calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 12px)">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-surface px-4 py-3 text-accent focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        跳到正文
      </a>
      <Sidebar active={active} />
      <div className="min-h-[100dvh] pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-sidebar">{children}</div>
      <TabBar active={active} />
    </ToastProvider>
  );
}
