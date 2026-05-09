import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Selection-driven yellow-highlight overlay over a body of plain text.
 *
 * Stores highlights as character offsets into the source string. We render
 * by splicing <mark> spans on read; the source string never mutates, so
 * stored offsets stay valid across re-renders (and across page reloads —
 * the host wires `key` to a localStorage slot to persist).
 *
 * Selecting overlapping or adjacent ranges merges into one highlight.
 * Clicking an existing <mark> removes that highlight.
 *
 * Touch support: works on iPad because we listen to mouseup AND touchend,
 * and the body has `select-text` + the iOS user-select unlock style.
 */

export interface Highlight {
  id: string;
  start: number;
  end: number;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function textOffset(root: HTMLElement, node: Node, offset: number): number {
  let total = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let cur: Node | null;
  while ((cur = walker.nextNode())) {
    if (cur === node) return total + offset;
    total += (cur.textContent ?? '').length;
  }
  return total;
}

function mergeHighlight(existing: Highlight[], add: Highlight): Highlight[] {
  const out: Highlight[] = [];
  let merged: Highlight = { ...add };
  for (const h of existing) {
    if (h.end < merged.start || h.start > merged.end) {
      out.push(h);
    } else {
      merged = {
        id: merged.id,
        start: Math.min(merged.start, h.start),
        end: Math.max(merged.end, h.end),
      };
    }
  }
  out.push(merged);
  return out;
}

function renderHighlighted(
  body: string,
  highlights: Highlight[],
  onRemove: (id: string) => void,
): React.ReactNode {
  if (highlights.length === 0) return body;
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const h of sorted) {
    if (h.start > cursor) parts.push(body.slice(cursor, h.start));
    parts.push(
      <mark
        key={h.id}
        className="bg-yellow-200 cursor-pointer"
        onClick={() => onRemove(h.id)}
        title="点击移除高亮 · click to remove"
      >
        {body.slice(h.start, h.end)}
      </mark>,
    );
    cursor = h.end;
  }
  if (cursor < body.length) parts.push(body.slice(cursor));
  return parts;
}

export function Highlighter({
  body,
  highlights,
  onChange,
  className = '',
  style,
}: {
  body: string;
  highlights: Highlight[];
  onChange: (next: Highlight[]) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  function captureSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const root = containerRef.current;
    if (!root) return;
    const range = sel.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
    const start = textOffset(root, range.startContainer, range.startOffset);
    const end = textOffset(root, range.endContainer, range.endOffset);
    if (start === end) return;
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    onChange(mergeHighlight(highlights, { id: uid(), start: lo, end: hi }));
    sel.removeAllRanges();
  }

  function removeHighlight(id: string) {
    onChange(highlights.filter((h) => h.id !== id));
  }

  // Round-3 H21: only left-click should grab a selection (right-click on
  // desktop and long-press on iOS often pop the system context menu, which
  // collapses the selection just before mouseup fires; we don't want to
  // capture an empty range and quietly do nothing).
  function onMouseUpGuarded(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    captureSelection();
  }
  // B3-H10/iOS — Safari fires touchend BEFORE the OS finalises the selection,
  // so window.getSelection() is still empty / collapsed at that moment.
  // The previous single rAF tick was unreliable on slower devices and on
  // selection edges that drag past a popover.
  //
  // Hardened approach:
  //   1. Listen for the next `selectionchange` event after touchend — the
  //      OS fires this once the range commits. Capture there.
  //   2. Fall back to a 250ms timeout if no selectionchange arrives (e.g.
  //      tap without selection); the timeout no-ops via captureSelection's
  //      isCollapsed early-return.
  //   3. Always tear down the listener so we don't leak across remounts.
  function onTouchEndGuarded() {
    let captured = false;
    const onChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return; // wait for next event
      // Selection has settled — pull it on the next animation frame so
      // any internal Range bookkeeping has flushed first (some iOS builds
      // momentarily expose a stale anchor/focus).
      if (captured) return;
      captured = true;
      requestAnimationFrame(() => {
        captureSelection();
        document.removeEventListener('selectionchange', onChange);
      });
    };
    document.addEventListener('selectionchange', onChange);
    // Hard cleanup: if the user tapped without selecting, OR if no
    // selectionchange ever fires, drop the listener after 250ms.
    setTimeout(() => {
      if (captured) return;
      document.removeEventListener('selectionchange', onChange);
      // Defensive: still try to capture in case iOS skipped the event.
      captureSelection();
    }, 250);
  }

  return (
    <div
      ref={containerRef}
      onMouseUp={onMouseUpGuarded}
      onTouchEnd={onTouchEndGuarded}
      className={`select-text whitespace-pre-wrap ${className}`}
      style={{ WebkitUserSelect: 'text', userSelect: 'text', ...style }}
    >
      {renderHighlighted(body, highlights, removeHighlight)}
    </div>
  );
}

/** Convenience hook that backs a Highlighter with localStorage.
 *
 *  Two non-obvious things:
 *  1. The setter is wrapped with useCallback so its identity is stable —
 *     any consumer that puts it in a useEffect/useMemo deps array won't
 *     re-fire on every parent re-render. (Round-7 agent-5 P1)
 *  2. When `storageKey` changes (e.g. the user navigates from one paper's
 *     passage to another's, the hook is the same instance), we re-hydrate
 *     from the new key so we don't accidentally write old highlights into
 *     the new bucket. */
export function useStoredHighlights(storageKey: string): [
  Highlight[],
  (next: Highlight[]) => void,
] {
  const [hs, setHs] = useState<Highlight[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    } catch {
      return [];
    }
  });
  // Re-hydrate when the storageKey changes.
  useEffect(() => {
    try {
      setHs(JSON.parse(localStorage.getItem(storageKey) ?? '[]'));
    } catch {
      setHs([]);
    }
  }, [storageKey]);
  const set = useCallback(
    (next: Highlight[]) => {
      setHs(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* localStorage full / disabled */
      }
    },
    [storageKey],
  );
  return [hs, set];
}
