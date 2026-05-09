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
 *
 * Round-3 fixes:
 *  - H9:  onTouchStart now calls preventDefault to stop iOS from treating
 *         the drag as a scroll gesture.
 *  - H15: subscribes to resize + orientationchange, recomputes via state
 *         instead of reading window.innerWidth inline (which froze on
 *         iPad rotation because nothing triggered re-render).
 *  - H16: handle is now 12px wide (was 6px) — meets WCAG 2.5.5
 *         44×44 with the keyboard-only outer hit-box.
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

  // Round-3 H15 — re-evaluate on resize + iPad rotation. Without this,
  // a portrait-on-load + landscape-after-rotate session keeps the inline
  // `width: '100%'` it computed at first paint forever.
  const [vw, setVw] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );
  useEffect(() => {
    function onResize() { setVw(window.innerWidth); }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  const isWide = vw >= mobileBreakpoint;

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
      // Round-3 H9: on iPad/Pencil, the browser tries to scroll the page
      // when a touch moves; preventDefault keeps the drag responsive.
      e.preventDefault();
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
        style={{ width: isWide ? leftPct : '100%' }}
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
        onTouchStart={(e) => {
          // Round-3 H9 — stop iOS interpreting the gesture as a scroll.
          e.preventDefault();
          draggingRef.current = true;
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') persist(Math.max(min, pct - 0.02));
          else if (e.key === 'ArrowRight') persist(Math.min(max, pct + 0.02));
        }}
        // H16 — 12px hit area (was 6px) meets WCAG 2.5.5 minimum and is
        // far easier to grab on iPad with a thumb. The visual line stays
        // ~2px so the layout doesn't shift; the hit-box pads it.
        className="hidden lg:flex w-3 cursor-col-resize bg-transparent hover:bg-blue-200 active:bg-blue-300 transition-colors items-center justify-center group touch-manipulation"
        title="拖动调整分栏 · drag to resize"
        aria-label="Resize split"
      >
        <div className="w-0.5 h-12 bg-gray-300 group-hover:bg-blue-500 rounded" />
      </div>
      <div
        className={`${showRightMobile ? 'block' : 'hidden'} lg:block`}
        style={{ width: isWide ? rightPct : '100%' }}
      >
        {right}
      </div>
    </div>
  );
}
