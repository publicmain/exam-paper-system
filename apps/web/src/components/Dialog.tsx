import { ReactNode, useEffect, useId, useRef } from 'react';

/**
 * 教师端模态对话框外壳（2026-09-11 审计 IOS-10 / IOS-11）。
 *
 * 按 WAI-ARIA 模态对话框模式（https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/）：
 *   · role="dialog" + aria-modal + aria-labelledby / aria-describedby；
 *   · 打开时焦点进入对话框（默认落在 initialFocusRef，没有就落在第一个可聚焦元素）；
 *   · Tab / Shift+Tab 在对话框内循环，不跑到背景；
 *   · Esc 关闭（busy 时不关，避免请求进行中把结果丢了）；
 *   · 关闭后焦点还给打开前的那个元素；
 *   · 错误显示在对话框里（role="alert"），不在背后的页面上。
 *
 * 只负责外壳与焦点，内容与按钮由调用方给。按钮命中区用 .tap（≥44×44 CSS px）。
 */
export interface DialogProps {
  open: boolean;
  title: string;
  /** 一句话说明「发生什么」。会被 aria-describedby 引用。 */
  description?: ReactNode;
  children?: ReactNode;
  /** 底部按钮区。 */
  footer: ReactNode;
  onClose: () => void;
  /** 请求进行中：Esc 与遮罩点击不关闭。 */
  busy?: boolean;
  /** 对话框内的错误（role=alert）。 */
  error?: string | null;
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** 测试 / 定位用。 */
  testId?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  busy = false,
  error,
  initialFocusRef,
  testId,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const panel = panelRef.current;
    const target =
      initialFocusRef?.current ?? (panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel);
    target?.focus();
    return () => {
      const back = restoreRef.current;
      // 打开前的元素若已被卸载（例如整页重渲染），就不强行聚焦
      if (back && document.contains(back)) back.focus();
    };
    // 只在打开 / 关闭时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!busyRef.current) onCloseRef.current();
      return;
    }
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) {
      e.preventDefault();
      panel.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busyRef.current) onCloseRef.current();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-testid={testId}
        className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl outline-none"
      >
        <h2 id={titleId} className="text-lg font-bold text-gray-900">
          {title}
        </h2>
        {description ? (
          <div id={descId} className="mt-2 text-sm text-gray-700">
            {description}
          </div>
        ) : null}
        {children ? <div className="mt-3">{children}</div> : null}
        {error ? (
          <p role="alert" className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}
