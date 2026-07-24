import { useEffect, useRef, useState, useCallback } from 'react';
import { getStroke } from 'perfect-freehand';

/**
 * 手写画布（M2）— Apple Pencil 优先。
 *
 * 设计要点：
 * - 输入用 PointerEvents。默认只接受 `pointerType === 'pen'`（Apple Pencil），
 *   手指(touch)只用于滚动页面，从而实现可靠的防误触（palm rejection）——这是
 *   Web 手写被吐槽的点，按「仅 pen」策略就能规避。可用「允许手指」开关放宽。
 * - 压感：event.pressure 传给 perfect-freehand，得到变宽的墨迹轮廓。
 * - 存储：矢量 strokes（逻辑坐标，随 width/height 缩放重放），父组件负责自动保存。
 * - 展平：父组件在「完成手写」时调用 exportPng() 把背景图+墨迹合成为 PNG。
 */

export interface Stroke {
  pts: number[][]; // [[x, y, pressure], ...] in logical coords
  color: string;
  size: number;
}

const STROKE_OPTIONS = {
  smoothing: 0.55,
  streamline: 0.45,
  thinning: 0.6,
};

function strokeToPath(pts: number[][], size: number): Path2D | null {
  if (pts.length === 0) return null;
  const outline = getStroke(pts, { ...STROKE_OPTIONS, size });
  if (!outline.length) return null;
  const p = new Path2D();
  p.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) p.lineTo(outline[i][0], outline[i][1]);
  p.closePath();
  return p;
}

/**
 * Flatten one ink page to a PNG blob off-screen — independent of what's
 * mounted, so "finish" can export every page (not just the active one).
 * Draws white → background image (if any) → strokes, at logical resolution.
 */
export async function flattenInkToPng(
  strokes: Stroke[],
  width: number,
  height: number,
  bgUrl: string | null,
): Promise<Blob | null> {
  const cv = document.createElement('canvas');
  cv.width = width;
  cv.height = height;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  if (bgUrl) {
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = bgUrl;
    });
    if (img) ctx.drawImage(img, 0, 0, width, height);
  }
  for (const s of strokes) {
    const path = strokeToPath(s.pts, s.size);
    if (path) {
      ctx.fillStyle = s.color;
      ctx.fill(path);
    }
  }
  return new Promise<Blob | null>((resolve) => cv.toBlob((b) => resolve(b), 'image/png'));
}

export function HandwritingCanvas({
  width,
  height,
  strokes,
  backgroundUrl,
  color,
  size,
  tool,
  penOnly,
  onChange,
}: {
  width: number;
  height: number;
  strokes: Stroke[];
  backgroundUrl: string | null;
  color: string;
  size: number;
  tool: 'pen' | 'eraser';
  penOnly: boolean;
  onChange: (strokes: Stroke[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const [bgReady, setBgReady] = useState(false);
  const drawingRef = useRef(false);
  const currentRef = useRef<Stroke | null>(null);
  // Keep the latest strokes in a ref so pointer handlers (bound once) see them.
  const strokesRef = useRef<Stroke[]>(strokes);
  strokesRef.current = strokes;

  // Display scale: logical (width×height) → CSS pixels of the element.
  const scaleRef = useRef(1);

  // Load background image (already an authorized object URL from the parent).
  useEffect(() => {
    if (!backgroundUrl) {
      bgImgRef.current = null;
      setBgReady(false);
      redraw();
      return;
    }
    const img = new Image();
    img.onload = () => {
      bgImgRef.current = img;
      setBgReady(true);
      redraw();
    };
    img.src = backgroundUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundUrl]);

  const redraw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (bgImgRef.current) {
      ctx.drawImage(bgImgRef.current, 0, 0, cv.width, cv.height);
    }
    for (const s of strokesRef.current) {
      const path = strokeToPath(s.pts, s.size);
      if (path) {
        ctx.fillStyle = s.color;
        ctx.fill(path);
      }
    }
    const cur = currentRef.current;
    if (cur) {
      const path = strokeToPath(cur.pts, cur.size);
      if (path) {
        ctx.fillStyle = cur.color;
        ctx.fill(path);
      }
    }
  }, []);

  // Size the canvas backing store to logical size (crisp at any zoom because
  // we flatten at this resolution anyway).
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.width = width;
    cv.height = height;
    redraw();
  }, [width, height, redraw]);

  useEffect(() => {
    redraw();
  }, [strokes, bgReady, redraw]);

  function toLogical(e: React.PointerEvent): [number, number, number] {
    const cv = canvasRef.current!;
    const rect = cv.getBoundingClientRect();
    const sx = cv.width / rect.width;
    const sy = cv.height / rect.height;
    scaleRef.current = sx;
    const x = (e.clientX - rect.left) * sx;
    const y = (e.clientY - rect.top) * sy;
    // pressure: pen gives 0..1; mouse reports 0.5 constant, 0 on some browsers.
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    return [x, y, pressure];
  }

  function accepts(e: React.PointerEvent): boolean {
    if (e.pointerType === 'pen') return true;
    if (e.pointerType === 'mouse') return true; // desktop authoring/testing
    return !penOnly; // touch (finger) only when the toggle is off
  }

  function eraseAt(x: number, y: number) {
    // Stroke-erase: drop any stroke with a point within a small radius.
    const r = Math.max(12, size * 3);
    const next = strokesRef.current.filter(
      (s) => !s.pts.some((p) => Math.hypot(p[0] - x, p[1] - y) <= r),
    );
    if (next.length !== strokesRef.current.length) onChange(next);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!accepts(e)) return; // let the finger scroll the page
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const [x, y, p] = toLogical(e);
    if (tool === 'eraser') {
      drawingRef.current = true;
      eraseAt(x, y);
      return;
    }
    drawingRef.current = true;
    currentRef.current = { pts: [[x, y, p]], color, size };
    redraw();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    if (!accepts(e)) return;
    e.preventDefault();
    const [x, y, p] = toLogical(e);
    if (tool === 'eraser') {
      eraseAt(x, y);
      return;
    }
    const cur = currentRef.current;
    if (!cur) return;
    cur.pts.push([x, y, p]);
    redraw();
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (tool === 'eraser') return;
    const cur = currentRef.current;
    currentRef.current = null;
    if (cur && cur.pts.length > 0) {
      onChange([...strokesRef.current, cur]);
    } else {
      redraw();
    }
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      className="block bg-white border rounded touch-none select-none w-full"
      style={{ aspectRatio: `${width} / ${height}`, touchAction: penOnly ? 'auto' : 'none' }}
    />
  );
}
