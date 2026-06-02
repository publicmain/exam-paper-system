import { ReactNode } from 'react';
import { EmptyState } from './EmptyState';

/**
 * U-Phase1 (docs/PRD §6.3) — one place that renders the four states every
 * data view needs: loading / error+retry / empty / content. Replaces the
 * inconsistent inline `if (loading) return …` scattered across 30 pages so
 * the whole app degrades the same, accessible way ("大厂感" comes from this
 * consistency, not model IQ).
 *
 * Precedence: loading → error → empty → content. Loading wins so a retry
 * (which sets loading=true while a stale error lingers) shows the spinner,
 * not the old error.
 *
 *   <AsyncState loading={loading} error={err} isEmpty={rows.length === 0}
 *               onRetry={reload} emptyTitle="还没有记录">
 *     {rows.map(...)}
 *   </AsyncState>
 */
export interface AsyncStateProps {
  loading: boolean;
  error?: string | null;
  isEmpty?: boolean;
  onRetry?: () => void;
  loadingLabel?: string;
  /** Empty-state props forwarded to <EmptyState>. */
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyVariant?: 'default' | 'no-paper' | 'no-history' | 'no-attendance' | 'no-students' | 'offline';
  emptyAction?: { label: string; onClick: () => void };
  className?: string;
  children: ReactNode;
}

export function Spinner({ label = '加载中…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-10 text-gray-500">
      <svg className="animate-spin h-7 w-7 text-blue-600" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <span className="mt-3 text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="max-w-md mx-auto py-8 px-6 text-center">
      <EmptyState
        variant="offline"
        title="出错了 · Something went wrong"
        description={message}
        {...(onRetry ? { action: { label: '重试 · Retry', onClick: onRetry } } : {})}
      />
    </div>
  );
}

export function AsyncState({
  loading,
  error,
  isEmpty,
  onRetry,
  loadingLabel,
  emptyTitle,
  emptyDescription,
  emptyVariant = 'default',
  emptyAction,
  className,
  children,
}: AsyncStateProps) {
  if (loading) return <Spinner label={loadingLabel} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (isEmpty) {
    return (
      <EmptyState
        variant={emptyVariant}
        title={emptyTitle ?? '暂无数据 · Nothing here yet'}
        description={emptyDescription}
        action={emptyAction}
        className={className}
      />
    );
  }
  return <>{children}</>;
}
