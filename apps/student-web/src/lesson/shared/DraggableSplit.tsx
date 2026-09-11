import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Segmented } from '../../design/Segmented';

/**
 * 阅读工作区的左右分栏（IOS-05 / UI08）—— 答题页、刚交卷结果、历史详情共用这一个。
 *
 * ## 宽窄看的是**容器自己的宽度**，不是窗口
 *
 * 历史详情放在带侧栏的外壳里：1024 宽的 iPad 横屏减掉 232 的侧栏只剩 792，
 * 按窗口判断会硬塞两栏。这里用 ResizeObserver 量容器，够宽（默认 ≥ 900px）才分栏。
 *
 * ## 窄屏：两块都留在文档流里，顶上一个「原文 / 题目」跳转
 *
 * 2026-07-24 的事故是「窄屏只显示题目那一页，学生找不到原文」，所以窄屏不隐藏任何一块。
 * 顶部的分段控件是**跳转**：切到「题目」前记下原文读到哪，切回「原文」时回到那里；
 * 两块都不卸载，填了一半的答案不会丢。
 *
 * ## 拖动（审计 UI08）
 *
 * 改用 Pointer Events + setPointerCapture：取消（touchcancel / pointercancel）、失去捕获、
 * 窗口失焦、组件卸载都会结束拖动 —— 不再出现「取消之后普通移动还在改比例、还在拦截滚动」。
 * 拖柄视觉是一条细线，命中区是 44px 宽的透明条；键盘可以用 ← → 调整、Home / End 到两头。
 * 手柄上 `touch-action: none`，只拦它自己的手势，页面滚动不受影响。
 */
export function DraggableSplit({
  left,
  right,
  storageKey = 'exam:split',
  initial = 0.5,
  min = 0.3,
  max = 0.7,
  wideAt = 900,
  leftLabel = '原文',
  rightLabel = '题目',
  testId,
}: {
  left: ReactNode;
  right: ReactNode;
  storageKey?: string;
  initial?: number;
  min?: number;
  max?: number;
  /** 容器宽度到多少才分栏（CSS px） */
  wideAt?: number;
  leftLabel?: string;
  rightLabel?: string;
  testId?: string;
  /** 旧参数，保留兼容；现在看容器宽度。 */
  mobileBreakpoint?: number;
}) {
  const [pct, setPct] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const n = raw ? Number(raw) : initial;
      if (Number.isFinite(n) && n >= min && n <= max) return n;
    } catch {
      /* ignore */
    }
    return initial;
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));

  // 量容器宽度（旋转、分屏、侧栏出现都会触发）
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width || window.innerWidth);
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);
  const isWide = width >= wideAt;

  const persist = useCallback(
    (p: number) => {
      if (!Number.isFinite(p)) return;
      const clamped = Math.max(min, Math.min(max, p));
      setPct(clamped);
      try {
        localStorage.setItem(storageKey, String(clamped));
      } catch {
        /* ignore */
      }
    },
    [storageKey, min, max],
  );

  // ── 拖动：只认捕获了指针的那一次 ──
  const dragRef = useRef<{ pointerId: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const stopDrag = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);
  useEffect(() => {
    const onBlur = () => stopDrag();
    const onVis = () => {
      if (document.visibilityState !== 'visible') stopDrag();
    };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
      stopDrag();
    };
  }, [stopDrag]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 某些环境不支持捕获：仍按 pointerId 过滤 */
    }
    dragRef.current = { pointerId: e.pointerId };
    setDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId || !Number.isFinite(e.clientX)) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    persist((e.clientX - rect.left) / rect.width);
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) stopDrag();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowLeft') persist(pct - step);
    else if (e.key === 'ArrowRight') persist(pct + step);
    else if (e.key === 'Home') persist(min);
    else if (e.key === 'End') persist(max);
    else return;
    e.preventDefault();
  };

  // ── 窄屏跳转：记住两块各自读到哪 ──
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<'left' | 'right'>('left');
  const posRef = useRef<{ left: number | null; right: number | null }>({ left: null, right: null });
  const jump = (to: 'left' | 'right') => {
    posRef.current[view] = window.scrollY;
    setView(to);
    const saved = posRef.current[to];
    const target = to === 'left' ? leftRef.current : rightRef.current;
    if (saved != null) window.scrollTo({ top: saved });
    else if (target) {
      const top = target.getBoundingClientRect().top + window.scrollY - 112;
      window.scrollTo({ top: Math.max(0, top) });
    }
  };

  if (!isWide) {
    return (
      <div ref={containerRef} data-testid={testId} data-layout="stacked">
        <div className="sticky top-[var(--focus-header-h,56px)] z-10 -mx-px bg-canvas/95 px-3 py-2">
          <Segmented
            label="在原文和题目之间跳转"
            value={view}
            onChange={jump}
            options={[
              { value: 'left', label: leftLabel, testId: 'jump-left' },
              { value: 'right', label: rightLabel, testId: 'jump-right' },
            ]}
          />
        </div>
        <div ref={leftRef}>{left}</div>
        <div ref={rightRef} className="mt-4">
          {right}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} data-testid={testId} data-layout="split" className="relative flex h-full min-h-0 items-stretch">
      {/* 分栏时每一栏自己滚（原文读到哪、题目做到哪各自保留） */}
      <div className="scroll-contain h-full min-h-0 min-w-0 overflow-y-auto [scrollbar-gutter:stable]" style={{ width: `${pct * 100}%` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`调整${leftLabel}和${rightLabel}的宽度`}
        aria-valuemin={Math.round(min * 100)}
        aria-valuemax={Math.round(max * 100)}
        aria-valuenow={Math.round(pct * 100)}
        tabIndex={0}
        title="拖动或用左右方向键调整宽度"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        // 失去捕获 = 这次拖动一定结束了（系统收走了指针），不管是哪个 pointerId
        onLostPointerCapture={stopDrag}
        onKeyDown={onKeyDown}
        data-dragging={dragging || undefined}
        className="group relative z-10 flex w-3 shrink-0 cursor-col-resize items-center justify-center rounded-full outline-none"
        style={{ touchAction: 'none' }}
      >
        {/* 44px 宽的透明命中区，视觉只有中间一条细线 */}
        <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-11 -translate-x-1/2" />
        <span
          aria-hidden="true"
          className={`relative h-14 w-1 rounded-full transition-colors ${
            dragging ? 'bg-accent-fill' : 'bg-fill-strong group-hover:bg-accent-fill group-focus-visible:bg-accent-fill'
          }`}
        />
      </div>
      <div className="scroll-contain h-full min-h-0 min-w-0 overflow-y-auto [scrollbar-gutter:stable]" style={{ width: `${(1 - pct) * 100}%` }}>
        {right}
      </div>
    </div>
  );
}
