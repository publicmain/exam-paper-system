/**
 * 按钮（IOS-02 / IOS-03 / IOS-11）。
 *
 * 四种语义，不按「好不好看」选：
 *   · primary   —— 这一屏唯一的主动作（实色主色底，白字 ≥ 4.5:1）
 *   · secondary —— 次动作（浅主色底 + 主色字）
 *   · plain     —— 行内文字按钮（无底，主色字）
 *   · destructive —— 删除 / 移出这类不可轻易撤回的动作
 *
 * 命中区至少 44×44 CSS px（主按钮 50px 高）。禁用态保留可读的字，旁边另给原因，
 * 不把字淡到几乎看不见（审计 IOS-02：「禁用不能只把字变得几乎看不见」）。
 * `busy` 时显示进度并阻止重复点击，但按钮文字由调用方换成「正在交卷…」这类具体说法。
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'plain' | 'destructive' | 'destructive-plain' | 'neutral';
export type ButtonSize = 'lg' | 'md' | 'sm';

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-fill text-accent-on font-semibold hover:bg-accent-hover active:bg-accent-pressed disabled:bg-fill disabled:text-ink-3',
  secondary: 'bg-accent-soft text-accent font-semibold hover:brightness-[0.97] disabled:bg-fill disabled:text-ink-3',
  neutral: 'bg-fill text-ink font-medium hover:bg-fill-strong disabled:text-ink-3',
  plain: 'bg-transparent text-accent font-medium hover:bg-accent-soft disabled:text-ink-3',
  destructive: 'bg-danger-fill text-accent-on font-semibold hover:brightness-95 disabled:bg-fill disabled:text-ink-3',
  'destructive-plain': 'bg-transparent text-danger font-medium hover:bg-danger-soft disabled:text-ink-3',
};

const SIZE: Record<ButtonSize, string> = {
  lg: 'min-h-[50px] px-5 text-body rounded-control',
  md: 'min-h-[44px] px-4 text-callout rounded-control',
  // 视觉紧凑，但命中区仍 ≥ 44px（外边距补足）
  sm: 'min-h-[44px] px-3 text-footnote rounded-control',
};

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  busy?: boolean;
  icon?: IconName;
  iconAfter?: IconName;
  children: ReactNode;
};

/**
 * 按钮外观的类名 —— 给「长得像按钮的链接」用（`<Link>` 去别的页面），
 * 与 `<Button>` 同一套变体与尺寸，免得同一排里两种按钮字重、高度对不上。
 */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'lg', block = false): string {
  return ['inline-flex items-center justify-center gap-2 select-none text-center leading-snug no-underline', VARIANT[variant], SIZE[size], block ? 'w-full' : ''].join(' ');
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'lg', block = false, busy = false, icon, iconAfter, children, className, type, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 select-none text-center leading-snug',
        VARIANT[variant],
        SIZE[size],
        block ? 'w-full' : '',
        className ?? '',
      ].join(' ')}
      {...rest}
    >
      {busy ? <span className="spinner !h-4 !w-4 !border-2" aria-hidden="true" /> : icon ? <Icon name={icon} size={20} /> : null}
      <span className="min-w-0">{children}</span>
      {iconAfter && !busy ? <Icon name={iconAfter} size={18} /> : null}
    </button>
  );
});

/**
 * 纯图标按钮 —— **必须**有 `label`，它就是读屏念出来的名字。
 * 视觉 36px 的圆也有 44×44 的命中区。
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
    icon: IconName;
    label: string;
    tone?: 'plain' | 'filled';
  }
>(function IconButton({ icon, label, tone = 'plain', className, type, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={[
        'inline-grid h-11 w-11 shrink-0 place-items-center rounded-full',
        tone === 'filled' ? 'bg-fill text-ink-2 hover:bg-fill-strong' : 'text-accent hover:bg-accent-soft',
        'disabled:text-ink-3 disabled:bg-transparent',
        className ?? '',
      ].join(' ')}
      {...rest}
    >
      <Icon name={icon} size={22} />
    </button>
  );
});
