/**
 * 页面框架（IOS-01 / IOS-02）。
 *
 *   · `Page`        —— 四个顶层目的地（今日 / 我的单词 / 学习记录 / 账号）及其子页用。
 *                      大标题在内容顶上，返回（若有）在最上面，不在长页面底部。
 *   · `FocusLayout` —— 阅读、学词、正式词测这类专注任务：没有底部导航，顶栏固定显示
 *                      「回到哪里」、任务日期、实际难度、保存 / 提交状态。
 */
import type { ReactNode } from 'react';
import { IconButton } from './Button';
import { Icon } from './Icon';

const WIDTH = {
  narrow: 'max-w-md',
  default: 'max-w-3xl',
  wide: 'max-w-6xl',
  full: 'max-w-none',
} as const;

export function Page({
  title,
  subtitle,
  leading,
  trailing,
  children,
  width = 'default',
  testId,
  titleHidden = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** 标题上方的一行：返回按钮 */
  leading?: ReactNode;
  /** 标题右侧的动作 */
  trailing?: ReactNode;
  children: ReactNode;
  width?: keyof typeof WIDTH;
  testId?: string;
  /** 视觉上不显示大标题（仍给读屏一个 h1） */
  titleHidden?: boolean;
}) {
  return (
    <main
      id="main"
      data-testid={testId}
      className={`safe-x mx-auto w-full ${WIDTH[width]} pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]`}
    >
      {leading ? <div className="-ml-2 mb-1 flex min-h-[44px] items-center">{leading}</div> : <div className="h-2" />}
      <header className={`mb-5 flex items-end justify-between gap-3 ${titleHidden ? 'sr-only' : ''}`}>
        <div className="min-w-0">
          <h1 className="text-title1 text-ink md:text-large">{title}</h1>
          {subtitle ? <div className="mt-1 text-callout text-ink-3">{subtitle}</div> : null}
        </div>
        {trailing ? <div className="flex shrink-0 items-center gap-1">{trailing}</div> : null}
      </header>
      {children}
    </main>
  );
}

/** 顶部返回：chevron + 来源名。常用出口必须在顶部够得着（S12L）。 */
export function BackButton({ label, onClick, testId = 'top-back' }: { label: string; onClick: () => void; testId?: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center gap-0.5 rounded-control pl-1 pr-2.5 text-body text-accent hover:bg-accent-soft"
    >
      <Icon name="back" size={22} strokeWidth={2.2} />
      <span>{label}</span>
    </button>
  );
}

/**
 * 专注任务的顶栏。
 *
 * `meta` 是一行小字：「9月11日 · O-Level 标准 · 已保存」。实际难度与原日期取自**任务本身**，
 * 不取「现在的设置」或「今天」（UI01 / UI11）。
 */
export function FocusHeader({
  backLabel,
  onBack,
  title,
  meta,
  trailing,
  testId,
}: {
  backLabel: string;
  onBack: () => void;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  testId?: string;
}) {
  return (
    <header data-testid={testId} className="material-bar safe-top sticky top-0 z-30 border-b border-line">
      <div className="safe-x mx-auto flex min-h-[52px] w-full max-w-[1400px] items-center gap-2">
        <div className="-ml-2 hidden sm:block">
          <BackButton label={backLabel} onClick={onBack} />
        </div>
        <div className="-ml-2 sm:hidden">
          <IconButton icon="back" label={`返回${backLabel}`} onClick={onBack} />
        </div>
        <div className="min-w-0 flex-1 py-1">
          <div className="truncate text-headline text-ink">{title}</div>
          {meta ? <div className="truncate text-caption text-ink-3">{meta}</div> : null}
        </div>
        {trailing ? <div className="flex shrink-0 items-center gap-1">{trailing}</div> : null}
      </div>
    </header>
  );
}

export function FocusLayout({
  header,
  children,
  footer,
  width = 'default',
  testId,
}: {
  header: ReactNode;
  children: ReactNode;
  /** 固定在底部的主操作条（交卷、学完这个词） */
  footer?: ReactNode;
  width?: keyof typeof WIDTH | 'reading';
  testId?: string;
}) {
  const w = width === 'reading' ? 'max-w-[1400px]' : WIDTH[width];
  return (
    <div className="flex min-h-[100dvh] flex-col" data-testid={testId}>
      {header}
      <main id="main" className={`safe-x mx-auto w-full flex-1 ${w} py-4`}>
        {children}
      </main>
      {footer ? (
        <div className="material-bar safe-bottom sticky bottom-0 z-20 border-t border-line">
          <div className={`safe-x mx-auto w-full ${w} py-2`}>{footer}</div>
        </div>
      ) : null}
    </div>
  );
}

/** 内容卡片：实色内容面，不叠阴影不模糊（审计 IOS-02 / §3 `.app-glass`）。 */
export function Surface({ children, className, testId, as = 'div' }: { children: ReactNode; className?: string; testId?: string; as?: 'div' | 'section' | 'article' }) {
  const Tag = as;
  return (
    <Tag data-testid={testId} className={`rounded-group bg-surface p-4 sm:p-5 ${className ?? ''}`}>
      {children}
    </Tag>
  );
}
