/**
 * 状态标签（IOS-03 / IOS-04）：「已完成」「待老师批」「还没开始」「补做」。
 *
 * 状态不能只靠红绿区分（WCAG 1.4.1）：每个标签都有文字，完成 / 失败再配图形。
 */
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

const TONE: Record<BadgeTone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-accent-soft text-accent',
  neutral: 'bg-fill text-ink-2',
};

const DEFAULT_ICON: Partial<Record<BadgeTone, IconName>> = {
  success: 'check',
  danger: 'alert',
};

export function Badge({
  tone = 'neutral',
  icon,
  children,
  testId,
}: {
  tone?: BadgeTone;
  icon?: IconName | null;
  children: ReactNode;
  testId?: string;
}) {
  const shown = icon === null ? undefined : icon ?? DEFAULT_ICON[tone];
  return (
    <span
      data-testid={testId}
      className={`inline-flex min-h-[24px] items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-caption font-semibold ${TONE[tone]}`}
    >
      {shown ? <Icon name={shown} size={14} strokeWidth={2.2} /> : null}
      {children}
    </span>
  );
}
