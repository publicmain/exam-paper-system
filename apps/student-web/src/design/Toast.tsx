/**
 * 就地反馈 + 撤销（IOS-06 / IOS-08）：「已加入我的单词 · 撤销」「已移出 · 撤销」。
 *
 * 一次只显示一条（新的替换旧的），`role="status"` 让读屏念出来但不打断；
 * 6 秒后自动收起，鼠标悬停 / 键盘焦点在上面时不收。带撤销的提示要比纯提示多留一会儿。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

type ToastInput = {
  message: ReactNode;
  tone?: 'neutral' | 'success' | 'error';
  action?: { label: string; onAction: () => void };
  /** 毫秒；默认 6000，有撤销时 8000 */
  duration?: number;
};

type Ctx = { show: (t: ToastInput) => void; dismiss: () => void };

const ToastContext = createContext<Ctx>({ show: () => undefined, dismiss: () => undefined });

export function useToast(): Ctx {
  return useContext(ToastContext);
}

export function ToastProvider({ children, bottomOffset = 'calc(12px + env(safe-area-inset-bottom))' }: { children: ReactNode; bottomOffset?: string }) {
  const [toast, setToast] = useState<(ToastInput & { id: number }) | null>(null);
  const [held, setHeld] = useState(false);
  const seq = useRef(0);
  const dismiss = useCallback(() => setToast(null), []);
  const show = useCallback((t: ToastInput) => {
    seq.current += 1;
    setToast({ ...t, id: seq.current });
  }, []);

  useEffect(() => {
    if (!toast || held) return;
    const ms = toast.duration ?? (toast.action ? 8000 : 6000);
    const t = window.setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), ms);
    return () => window.clearTimeout(t);
  }, [toast, held]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
        style={{ bottom: bottomOffset }}
      >
        {toast ? (
          <div
            key={toast.id}
            data-testid="toast"
            onMouseEnter={() => setHeld(true)}
            onMouseLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)}
            onBlur={() => setHeld(false)}
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-control bg-inverse px-4 py-2 text-callout text-inverse-on shadow-overlay"
          >
            {toast.tone === 'success' ? <Icon name="checkCircle" size={20} /> : toast.tone === 'error' ? <Icon name="alert" size={20} /> : null}
            <span className="min-w-0 flex-1 py-1.5">{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                data-testid="toast-action"
                className="-mr-2 min-h-[44px] shrink-0 rounded-control px-3 font-semibold underline-offset-2 hover:underline"
                onClick={() => {
                  toast.action?.onAction();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
