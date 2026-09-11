/**
 * 加载 / 错误 / 空态 / 局部失败（IOS-11 / UI05）。
 *
 * 规矩：
 *   · 有限等待 —— 超过 12 秒还在转，就换成「还在加载，网络可能较慢」并给出重试 / 返回；
 *     不留一个永远在转的圈，也不留一个点了没用的「重试」。
 *   · 说清三件事：发生了什么、东西保存了没有、下一步能做什么。
 *     不把服务端错误码、堆栈或一个空「出错了」直接抛给学生。
 *   · 「没加载出来」和「没有」是两回事：局部失败用 InlineStatus 标在那一块，不把未知当 0。
 */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

/** 超过 `ms` 还没结束就返回 true —— 用来把「载入中」换成「还在加载…」。 */
export function useSlow(active: boolean, ms = 12_000): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!active) return;
    const t = window.setTimeout(() => setSlow(true), ms);
    return () => window.clearTimeout(t);
  }, [active, ms]);
  return slow;
}

export function Spinner({ label = '载入中' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-callout text-ink-3">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export type StatusKind = 'loading' | 'error' | 'offline' | 'expired' | 'forbidden' | 'notFound' | 'empty' | 'info' | 'paused';

const ICON: Record<Exclude<StatusKind, 'loading'>, IconName> = {
  error: 'alert',
  offline: 'offline',
  expired: 'lock',
  forbidden: 'lock',
  notFound: 'search',
  empty: 'info',
  info: 'info',
  paused: 'pause',
};

const TONE: Record<Exclude<StatusKind, 'loading'>, string> = {
  error: 'text-danger bg-danger-soft',
  offline: 'text-warning bg-warning-soft',
  expired: 'text-ink-2 bg-fill',
  forbidden: 'text-ink-2 bg-fill',
  notFound: 'text-ink-2 bg-fill',
  empty: 'text-ink-2 bg-fill',
  info: 'text-accent bg-accent-soft',
  paused: 'text-ink-2 bg-fill',
};

/**
 * 整块区域的状态（一整页、或一整张卡）。
 *
 * `loading` 时自己管有限等待：12 秒后换成慢网说明，给 `onRetry`（若有）和 `secondary`。
 */
export function StatusView({
  kind,
  title,
  message,
  onRetry,
  retryLabel = '重试',
  secondary,
  compact = false,
  testId,
}: {
  kind: StatusKind;
  title?: ReactNode;
  message?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  /** 次要出路：返回、去登录、回首页…… */
  secondary?: ReactNode;
  compact?: boolean;
  testId?: string;
}) {
  const slow = useSlow(kind === 'loading');
  if (kind === 'loading' && !slow) {
    return (
      <div data-testid={testId} className={`grid place-items-center ${compact ? 'py-8' : 'min-h-[40dvh] py-12'}`}>
        <Spinner label={typeof title === 'string' ? title : '载入中'} />
      </div>
    );
  }
  const k = kind === 'loading' ? 'offline' : kind;
  const heading = kind === 'loading' ? '还在加载' : title;
  const body = kind === 'loading' ? '网络可能比较慢。可以再等一会儿，或者重新加载。' : message;
  return (
    <div
      data-testid={testId}
      role={k === 'error' || k === 'offline' || k === 'expired' ? 'alert' : undefined}
      className={`mx-auto flex max-w-md flex-col items-center text-center ${compact ? 'py-6' : 'min-h-[40dvh] justify-center py-12'}`}
    >
      <span className={`mb-4 grid h-12 w-12 place-items-center rounded-full ${TONE[k]}`}>
        <Icon name={ICON[k]} size={24} />
      </span>
      {heading ? <h2 className="text-title3 text-ink">{heading}</h2> : null}
      {body ? <div className="mt-2 text-callout text-ink-2">{body}</div> : null}
      {onRetry || secondary ? (
        <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
          {onRetry ? (
            <Button block onClick={onRetry} icon="refresh">
              {retryLabel}
            </Button>
          ) : null}
          {secondary}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 卡片里的一行局部状态：「单词信息没加载出来 · 重试」。
 * 只影响这一块，别的模块照常可用（UI05）。
 */
export function InlineStatus({
  tone = 'error',
  children,
  onRetry,
  retryLabel = '重试',
  busy = false,
  testId,
  role,
  retryTestId,
}: {
  tone?: 'error' | 'warning' | 'info' | 'success' | 'neutral';
  children: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  busy?: boolean;
  testId?: string;
  /** 默认：错误 / 提醒是 alert，其余是 status。重要的信息性提示（登录已失效）可以显式给 alert。 */
  role?: 'alert' | 'status';
  retryTestId?: string;
}) {
  const cls = {
    error: 'bg-danger-soft text-danger',
    warning: 'bg-warning-soft text-warning',
    info: 'bg-accent-soft text-accent',
    success: 'bg-success-soft text-success',
    neutral: 'bg-fill text-ink-2',
  }[tone];
  const icon: IconName = tone === 'error' ? 'alert' : tone === 'warning' ? 'alert' : tone === 'success' ? 'checkCircle' : 'info';
  return (
    <div
      data-testid={testId}
      role={role ?? (tone === 'error' || tone === 'warning' ? 'alert' : 'status')}
      className={`flex items-start gap-2.5 rounded-control px-3.5 py-3 text-callout ${cls}`}
    >
      <Icon name={icon} size={20} className="mt-0.5" />
      <div className="min-w-0 flex-1">{children}</div>
      {onRetry ? (
        <button
          type="button"
          data-testid={retryTestId}
          onClick={onRetry}
          disabled={busy}
          className="-my-2 -mr-1.5 min-h-[44px] shrink-0 rounded-control px-3 font-semibold underline-offset-2 hover:underline disabled:cursor-wait"
        >
          {busy ? '正在重试…' : retryLabel}
        </button>
      ) : null}
    </div>
  );
}
