import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Two-column layout with a draggable vertical divider in the middle.
 *
 * The split percentage is persisted in localStorage so it survives both a
 * page refresh and a fresh login on the same device. Below `mobileBreakpoint`
 * (default 1024px) the split collapses into a stack — the host controls
 * whether the left or right pane is currently visible via `mobileSide`.
 *
 * Why not a library? react-resizable-panels et al. pull a few KB and a peer
 * dep tree we don't need; this primitive is ~40 lines.
 */

export function DraggableSplit({
  left,
  right,
  storageKey = 'exam:split',
  initial = 0.5,
  min = 0.25,
  max = 0.75,
  mobileSide = 'right',
  mobileBreakpoint = 1024,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  storageKey?: string;
  initial?: number;
  min?: number;
  max?: number;
  mobileSide?: 'left' | 'right';
  mobileBreakpoint?: number;
}) {
  const [pct, setPct] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const n = raw ? Number(raw) : initial;
      if (Number.isFinite(n) && n >= min && n <= max) return n;
    } catch { /* ignore */ }
    return initial;
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const persist = useCallback((p: number) => {
    setPct(p);
    try { localStorage.setItem(storageKey, String(p)); } catch { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    function handleMove(clientX: number) {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const raw = (clientX - rect.left) / rect.width;
      persist(Math.max(min, Math.min(max, raw)));
    }
    function onMouse(e: MouseEvent) {
      if (!draggingRef.current) return;
      e.preventDefault();
      handleMove(e.clientX);
    }
    function onTouch(e: TouchEvent) {
      if (!draggingRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      handleMove(t.clientX);
    }
    function stop() { draggingRef.current = false; document.body.style.cursor = ''; }
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('mouseup', stop);
    window.addEventListener('touchmove', onTouch, { passive: false });
    window.addEventListener('touchend', stop);
    return () => {
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('mouseup', stop);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', stop);
    };
  }, [persist, min, max]);

  const leftPct = `${pct * 100}%`;
  const rightPct = `${(1 - pct) * 100}%`;

  // Host can hide the pane it doesn't want shown on mobile.
  const showLeftMobile = mobileSide === 'left';
  const showRightMobile = mobileSide === 'right';

  return (
    <div
      ref={containerRef}
      className="lg:flex lg:items-stretch lg:h-full lg:relative"
      style={{ minHeight: 0 }}
    >
      <div
        className={`${showLeftMobile ? 'block' : 'hidden'} lg:block`}
        style={{ width: typeof window !== 'undefined' && window.innerWidth >= mobileBreakpoint ? leftPct : '100%' }}
      >
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(pct * 100)}
        tabIndex={0}
        onMouseDown={(e) => {
          e.preventDefault();
          draggingRef.current = true;
          document.body.style.cursor = 'col-resize';
        }}
        onTouchStart={() => { draggingRef.current = true; }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') persist(Math.max(min, pct - 0.02));
          else if (e.key === 'ArrowRight') persist(Math.min(max, pct + 0.02));
        }}
        className="hidden lg:flex w-1.5 cursor-col-resize bg-transparent hover:bg-blue-200 active:bg-blue-300 transition-colors items-center justify-center group"
        title="拖动调整分栏 · drag to resize"
      >
        <div className="w-0.5 h-12 bg-gray-300 group-hover:bg-blue-500 rounded" />
      </div>
      <div
        className={`${showRightMobile ? 'block' : 'hidden'} lg:block`}
        style={{ width: typeof window !== 'undefined' && window.innerWidth >= mobileBreakpoint ? rightPct : '100%' }}
      >
        {right}
      </div>
    </div>
  );
}
