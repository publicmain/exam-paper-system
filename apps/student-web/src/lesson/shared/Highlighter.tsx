import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * 阶段 12C —— **单击查词回来了**（阶段 7C 曾整体移除，因为旧实现把学生
 * 姓名当身份写生词本）。这里只提供**手势**：认出「学生轻点了哪个英文
 * 单词」，通过可选的 `onWordTap` 交给调用方。
 *
 * 这一层**不发任何请求、不认识身份、也不知道什么是生词本** —— 那些都在
 * 查词卡里，挂点见 `questions/IELTSReadingPassage.tsx`。这条分工是刻意的：
 * 手势判定要能被单独测，而身份边界要能被单独守。
 */

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
        title="点击移除高亮"
      >
        {body.slice(h.start, h.end)}
      </mark>,
    );
    cursor = h.end;
  }
  if (cursor < body.length) parts.push(body.slice(cursor));
  return parts;
}

/**
 * 按屏幕坐标反查点到了哪个英文单词。
 *
 * `caretRangeFromPoint` 是 WebKit/Blink 的（iOS Safari、Chrome 都有），
 * `caretPositionFromPoint` 是标准接口（Firefox）。两个都试一遍即可覆盖；
 * 都没有（jsdom）就返回 null —— **宁可不查，也不猜学生点了哪个词**。
 *
 * 拿到落点所在的文本节点和字符偏移后向两侧扩到词边界。词内的撇号和连字符
 * 算词的一部分（don't / self-reliant），与后端 `normalizeWord` /
 * `candidateForms` 的切词口径一致。
 */
export function wordAtPoint(
  x: number,
  y: number,
  root: HTMLElement,
): { word: string; range: Range } | null {
  const doc = document as unknown as {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  let node: Node | null = null;
  let offset = 0;
  if (typeof doc.caretRangeFromPoint === 'function') {
    const r = doc.caretRangeFromPoint(x, y);
    if (r) { node = r.startContainer; offset = r.startOffset; }
  } else if (typeof doc.caretPositionFromPoint === 'function') {
    const p = doc.caretPositionFromPoint(x, y);
    if (p) { node = p.offsetNode; offset = p.offset; }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  if (!root.contains(node)) return null;

  const text = node.textContent ?? '';
  if (!text) return null;
  const isWordChar = (ch: string) => /[A-Za-z'’-]/.test(ch);
  // 落点可能正好在词尾空格上，往左退一格再判
  let i = Math.min(offset, text.length - 1);
  if (!isWordChar(text[i] ?? '') && i > 0 && isWordChar(text[i - 1] ?? '')) i -= 1;
  if (!isWordChar(text[i] ?? '')) return null;

  let s = i;
  let e = i;
  while (s > 0 && isWordChar(text[s - 1])) s--;
  while (e < text.length - 1 && isWordChar(text[e + 1])) e++;
  // 去掉首尾的撇号 / 连字符（引号紧贴单词时会被扫进来）
  const raw = text.slice(s, e + 1).replace(/^['’-]+|['’-]+$/g, '');
  if (!/^[A-Za-z][A-Za-z'’-]*$/.test(raw)) return null;

  const r = document.createRange();
  r.setStart(node, s);
  r.setEnd(node, e + 1);
  return { word: raw, range: r };
}

/** 鼠标的拖动容差。拖选判定要灵，8px 是业界常用阈值。 */
const TAP_SLOP_MOUSE = 8;
/**
 * 触屏的拖动容差。
 *
 * 8px 对手指太苛刻 —— 指腹按下到抬起在 iPad 上常晃 10-15px，绝大多数
 * 「点词」会被当成拖动丢弃，表现为「触屏查词没反应」（旧端 2026-08-26
 * 的教师报修）。18px 仍远小于最短的滚动手势位移。
 */
const TAP_SLOP_TOUCH = 18;
/** 超过这个时长算长按 —— 长按是系统选词，让位给高亮流程。 */
const TAP_MAX_MS = 500;

export function Highlighter({
  body,
  highlights,
  onChange,
  className = '',
  style,
  onWordTap,
  testId,
}: {
  body: string;
  highlights: Highlight[];
  onChange: (next: Highlight[]) => void;
  className?: string;
  style?: React.CSSProperties;
  /**
   * 学生轻点了一个英文单词。**可选** —— 不传就完全没有这条路径，
   * 连事件都不挂（阅读页之外的用法一个字都不受影响）。
   */
  onWordTap?: (word: string, range: Range) => void;
  testId?: string;
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

  // ── 单击查词（阶段 12C）────────────────────────────────────
  //
  // 判定「单击」而不是「拖选 / 滚动 / 长按」：按下到抬起的位移小于容差、
  // 时长小于 500ms、而且抬起时**没有选中内容**。长按会先产生 selection，
  // 那时 `sel.isCollapsed` 为 false，这里自动让路，高亮流程照常走。
  const tapRef = useRef<{ x: number; y: number; t: number; touch: boolean } | null>(null);

  function onPointerDownForTap(e: React.PointerEvent) {
    if (!onWordTap) return;
    tapRef.current = {
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      touch: e.pointerType === 'touch',
    };
  }

  function onPointerUpForTap(e: React.PointerEvent) {
    if (!onWordTap) return;
    const s = tapRef.current;
    tapRef.current = null;
    if (!s) return;
    const slop = s.touch ? TAP_SLOP_TOUCH : TAP_SLOP_MOUSE;
    if (Math.abs(e.clientX - s.x) > slop || Math.abs(e.clientY - s.y) > slop) return; // 拖动 / 滚动
    if (Date.now() - s.t > TAP_MAX_MS) return;                                        // 长按
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;                                              // 已经在选中
    const root = containerRef.current;
    if (!root) return;
    const hit = wordAtPoint(e.clientX, e.clientY, root);
    if (hit) onWordTap(hit.word, hit.range);
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
      data-testid={testId}
      onMouseUp={onMouseUpGuarded}
      onTouchEnd={onTouchEndGuarded}
      onPointerDown={onPointerDownForTap}
      onPointerUp={onPointerUpForTap}
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
