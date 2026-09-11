/**
 * 模态对话框 / 临时面板（IOS-06 / IOS-11 / UI12）。
 *
 * 依据：WAI-ARIA APG「Dialog (Modal)」模式 —— 打开后焦点进入，Tab / Shift+Tab 不跑到背景，
 * Esc 可关闭，关闭后焦点回到打开它的那个控件，名称与模态语义准确。HIG · Sheets / Alerts：
 * 关闭 / 取消 / 完成语义清楚、动作名具体、错误出现在用户正在操作的这一层。
 *
 * 三种摆法（同一个组件，不另写第二套焦点逻辑）：
 *   · `center`  —— 居中的小窗（确认交卷、退出提醒）
 *   · `sheet`   —— 窄屏从底部升起、宽屏居中（查词、筛选、自助抽查表单）
 *   · 传 `anchor` —— 宽屏（≥ 768px）贴着触发点弹出（iPad 上查词不遮住整篇文章）；窄屏仍是底部面板
 *
 * 忙碌（`busy`）时 Esc 与点遮罩都不关闭 —— 请求在途时关掉窗口，学生就看不见结果了。
 * 背景用 `inert` 屏蔽点击与焦点；叠第二层时第一层也一起 inert（但我们尽量不叠）。
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';

const FOCUSABLE =
  'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

/** 打开中的对话框容器，后开的在后面。只有最上面那层可以交互。 */
const stack: HTMLElement[] = [];

function setInert(el: Element | null, on: boolean) {
  if (!el) return;
  if (on) {
    el.setAttribute('inert', '');
    el.setAttribute('aria-hidden', 'true');
  } else {
    el.removeAttribute('inert');
    el.removeAttribute('aria-hidden');
  }
}

export type DialogPlacement = 'center' | 'sheet';

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  error,
  placement = 'center',
  anchor,
  initialFocusRef,
  dismissible = true,
  busy = false,
  showClose = placement === 'sheet',
  closeLabel = '关闭',
  size = 'md',
  testId,
}: {
  open: boolean;
  /** 用户要求关闭（Esc / 遮罩 / 关闭按钮）。`dismissible=false` 时只有调用方自己的按钮能关。 */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** 底部动作区。按钮写具体动作名（「确认交卷」「继续答题」），不写「确定」。 */
  footer?: ReactNode;
  /** 这一层发生的错误 —— 就显示在窗口里，不在被遮住的页面上。 */
  error?: ReactNode;
  placement?: DialogPlacement;
  /** 宽屏时贴近这个矩形（触发词的位置）。 */
  anchor?: DOMRect | null;
  initialFocusRef?: RefObject<HTMLElement>;
  dismissible?: boolean;
  busy?: boolean;
  showClose?: boolean;
  closeLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  testId?: string;
}) {
  const titleId = useId();
  const descId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 768px)').matches);

  useEffect(() => {
    if (!open || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [open]);

  // 打开：记下打开者、屏蔽背景、锁滚动、把焦点放进来
  useLayoutEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;
    openerRef.current = document.activeElement;
    const root = document.getElementById('root');
    const below = stack[stack.length - 1] ?? null;
    stack.push(container);
    setInert(root, true);
    setInert(below, true);
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    const target =
      initialFocusRef?.current ??
      (panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ||
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ||
        panelRef.current);
    target?.focus({ preventScroll: true });

    return () => {
      const i = stack.indexOf(container);
      if (i >= 0) stack.splice(i, 1);
      const nowTop = stack[stack.length - 1] ?? null;
      setInert(nowTop, false);
      if (!nowTop) setInert(root, false);
      document.documentElement.style.overflow = prevOverflow;
      const opener = openerRef.current as HTMLElement | null;
      if (opener && document.contains(opener) && typeof opener.focus === 'function') {
        opener.focus({ preventScroll: true });
      }
    };
    // 只在开 / 关时运行；initialFocusRef 是 ref，不参与依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const requestClose = () => {
    if (dismissible && !busy) onClose();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => !el.closest('[hidden],[inert]'),
    );
    if (items.length === 0) {
      e.preventDefault();
      panelRef.current.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const sheet = placement === 'sheet';
  const anchored = sheet && wide && anchor;
  const maxW = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';

  let panelStyle: CSSProperties | undefined;
  if (anchored && anchor) {
    const width = Math.min(420, window.innerWidth - 32);
    const left = Math.max(16, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - 16));
    const spaceBelow = window.innerHeight - anchor.bottom;
    const placeBelow = spaceBelow > 320 || spaceBelow > anchor.top;
    panelStyle = placeBelow
      ? { position: 'fixed', left, top: anchor.bottom + 8, width, maxHeight: Math.max(240, spaceBelow - 24) }
      : { position: 'fixed', left, bottom: window.innerHeight - anchor.top + 8, width, maxHeight: Math.max(240, anchor.top - 24) };
  }

  const panelClass = anchored
    ? 'bg-surface text-ink rounded-sheet shadow-overlay flex flex-col overflow-hidden'
    : sheet && !wide
      ? `bg-surface text-ink w-full rounded-t-sheet shadow-overlay flex flex-col max-h-[88dvh] safe-bottom`
      : `bg-surface text-ink w-full ${maxW} rounded-sheet shadow-overlay flex flex-col max-h-[85dvh]`;

  return createPortal(
    <div
      ref={containerRef}
      className={`fixed inset-0 z-50 ${anchored ? '' : sheet && !wide ? 'flex items-end' : 'grid place-items-center p-4'}`}
      onKeyDown={onKeyDown}
    >
      <div
        className={`absolute inset-0 ${anchored ? 'bg-scrim/10' : 'bg-scrim/40'}`}
        aria-hidden="true"
        onMouseDown={requestClose}
        data-testid={testId ? `${testId}-scrim` : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        aria-busy={busy || undefined}
        tabIndex={-1}
        data-testid={testId}
        className={`relative outline-none ${panelClass}`}
        style={panelStyle}
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-2">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-title3 text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1 text-callout text-ink-2">
                {description}
              </p>
            ) : null}
          </div>
          {showClose ? (
            <IconButton icon="close" label={closeLabel} tone="filled" onClick={requestClose} disabled={busy} className="-mr-2 -mt-2" />
          ) : null}
        </div>
        {children ? <div className="scroll-contain min-h-0 flex-1 overflow-y-auto px-5 pb-2">{children}</div> : null}
        {error ? (
          <div role="alert" className="mx-5 mt-2 rounded-control bg-danger-soft px-4 py-3 text-callout text-danger">
            {error}
          </div>
        ) : null}
        {footer ? <div className="flex flex-col-reverse gap-2 px-5 pb-5 pt-3 sm:flex-row sm:justify-end">{footer}</div> : <div className="h-3" />}
      </div>
    </div>,
    document.body,
  );
}
