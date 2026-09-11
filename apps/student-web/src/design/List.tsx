/**
 * 分组列表（IOS-02 / IOS-09）：账号设置、历史记录、生词列表这类「一行一件事」的界面。
 *
 * 参照 iOS 设置里的 inset grouped 列表：实色内容面、行间细分隔线、行高 ≥ 44px，
 * 可点的行整行是一个命中区，右侧 chevron 表示「进入下一层」。
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

export function Section({
  title,
  footer,
  children,
  trailing,
  id,
  testId,
}: {
  title?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** 标题行右侧（例如「查看全部」） */
  trailing?: ReactNode;
  id?: string;
  testId?: string;
}) {
  return (
    <section aria-labelledby={title && id ? `${id}-title` : undefined} data-testid={testId} className="mb-7 min-w-0">
      {title || trailing ? (
        <div className="mb-2 flex min-h-[28px] items-end justify-between gap-3 px-1">
          {title ? (
            <h2 id={id ? `${id}-title` : undefined} className="text-footnote font-semibold text-ink-3">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {trailing}
        </div>
      ) : null}
      {children}
      {footer ? <div className="mt-2 px-1 text-footnote text-ink-3">{footer}</div> : null}
    </section>
  );
}

/** 一组行。 */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`list-inset overflow-hidden rounded-group bg-surface ${className ?? ''}`}>{children}</div>;
}

type RowBody = {
  icon?: IconName;
  iconTone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
  title: ReactNode;
  subtitle?: ReactNode;
  /** 右侧的值 / 状态（不是动作） */
  value?: ReactNode;
};

const ICON_TONE = {
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-fill text-ink-2',
};

function Body({ icon, iconTone = 'accent', title, subtitle, value, chevron }: RowBody & { chevron?: boolean }) {
  return (
    <>
      {icon ? (
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[9px] ${ICON_TONE[iconTone]}`}>
          <Icon name={icon} size={19} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1 py-0.5">
        {/* 放大字号时长英文词也能断开，不把整行撑出视口 */}
        <span className="block text-body text-ink [overflow-wrap:anywhere]">{title}</span>
        {subtitle ? <span className="mt-0.5 block text-footnote text-ink-3">{subtitle}</span> : null}
      </span>
      {/* 值最多占半行：长徽标在窄屏折行，不把整页撑出横向滚动（320px 截图量出来的） */}
      {value != null ? <span className="max-w-[50%] shrink-0 text-right text-callout text-ink-3">{value}</span> : null}
      {chevron ? <Icon name="forward" size={18} className="shrink-0 text-ink-4" /> : null}
    </>
  );
}

const ROW = 'flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left';

/** 静态一行（只展示）。 */
export function Row(props: RowBody & { testId?: string; children?: ReactNode }) {
  return (
    <div data-testid={props.testId} className={ROW}>
      <Body {...props} />
      {props.children}
    </div>
  );
}

/** 整行可点 → 执行动作。 */
export function RowButton(
  props: RowBody & { onClick: () => void; disabled?: boolean; testId?: string; chevron?: boolean; ariaLabel?: string },
) {
  return (
    <button
      type="button"
      data-testid={props.testId}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.ariaLabel}
      className={`${ROW} hover:bg-surface-2 active:bg-fill disabled:cursor-not-allowed`}
    >
      <Body {...props} chevron={props.chevron ?? true} />
    </button>
  );
}

/** 整行可点 → 进入另一页。 */
export function RowLink(props: RowBody & { to: string; testId?: string; ariaLabel?: string; state?: unknown }) {
  return (
    <Link
      to={props.to}
      state={props.state}
      data-testid={props.testId}
      aria-label={props.ariaLabel}
      className={`${ROW} text-inherit no-underline hover:bg-surface-2 active:bg-fill`}
    >
      <Body {...props} chevron />
    </Link>
  );
}
