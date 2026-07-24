import { useEffect, useRef, useState, useCallback } from 'react';
import { hwApi, hwFileContentPath } from '../lib/api-homework';
import { finishInkDrafts, resolveBgUrl } from '../lib/ink-flatten';
import { HandwritingCanvas, Stroke } from './HandwritingCanvas';
import { AuthImage } from './AuthImage';
import { PdfPreview } from './PdfPreview';

/**
 * 手写作答工作区（M2）。整屏弹层，学生用 Apple Pencil 逐页书写。
 * - 多页：可加空白页，或「以题目图为底」在题目上直接写。
 * - 自动保存：每页笔迹变化后 debounce 900ms 存服务端（断网续写）。
 * - 完成手写：把每页(背景+墨迹)展平成 PNG，走 addPages?source=ink 变成答卷页。
 */

const PEN_COLORS = [
  { name: '黑', value: '#111111' },
  { name: '蓝', value: '#1554d1' },
  { name: '红', value: '#d11515' },
];
const PEN_SIZES = [3, 6, 10];
const A4 = { w: 794, h: 1123 }; // ~A4 at 96dpi

interface InkPageState {
  id: string;
  strokes: Stroke[];
  width: number;
  height: number;
  backgroundFileId: string | null;
  backgroundPage: number | null; // PDF page (1-based) when bg is a PDF
  bgUrl: string | null; // authorized object URL
  dirty: boolean;
  saving: boolean;
}

export function HandwritingWorkspace({
  assignmentId,
  questionFiles,
  onClose,
  onFinished,
}: {
  assignmentId: string;
  questionFiles: { id: string; filename: string; mimeType: string }[];
  onClose: () => void;
  onFinished: () => void; // called after flatten → pages created
}) {
  const [pages, setPages] = useState<InkPageState[]>([]);
  const [active, setActive] = useState(0);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState(PEN_COLORS[0].value);
  const [size, setSize] = useState(PEN_SIZES[1]);
  const [penOnly, setPenOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [showAdd, setShowAdd] = useState(false); // Examplify 式「＋添加页」抽屉
  // 审题-答题同屏：右侧题目参照面板（iPad 横屏左写右看）
  const [showRef, setShowRef] = useState(false);
  // 画布显示缩放（%）。笔坐标按 getBoundingClientRect 换算，缩放不影响精度。
  const [zoom, setZoom] = useState(100);
  // v2 双指捏合缩放：原生 non-passive touch listener（React 的 touchmove 是
  // passive，preventDefault 无效，会触发浏览器整页缩放）。
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    let startDist = 0;
    let startZoom = 100;
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        startZoom = zoomRef.current;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault(); // block browser page-zoom
        const next = Math.round(Math.max(50, Math.min(300, startZoom * (dist(e.touches) / startDist))));
        setZoom(next);
      }
    };
    const onEnd = () => { startDist = 0; };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []);
  const [err, setErr] = useState('');
  const bgUrlCache = useRef<Record<string, string>>({});

  const imageQuestionFiles = questionFiles.filter((f) => f.mimeType.startsWith('image/'));
  const pdfQuestionFiles = questionFiles.filter((f) => f.mimeType === 'application/pdf');

  // Background resolver (image blob OR pdf.js-rendered page), cached per file:page.
  const bgUrlFor = useCallback(async (fileId: string, page: number | null): Promise<string | null> => {
    const key = `${fileId}:${page ?? ''}`;
    if (bgUrlCache.current[key]) return bgUrlCache.current[key];
    const url = await resolveBgUrl(fileId, page);
    if (url) bgUrlCache.current[key] = url;
    return url;
  }, []);

  // Initial load: existing ink pages for this submission.
  useEffect(() => {
    (async () => {
      try {
        const { pages: raw } = await hwApi.listInk(assignmentId);
        const loaded: InkPageState[] = [];
        for (const p of raw) {
          const bgUrl = p.backgroundFileId
            ? await bgUrlFor(p.backgroundFileId, p.backgroundPage ?? null)
            : null;
          // v2 offline buffer: if a save failed earlier the freshest strokes
          // live in localStorage — prefer them over the (stale) server copy
          // and mark dirty so autosave re-tries immediately.
          let strokes = Array.isArray(p.strokes) ? p.strokes : [];
          let dirty = false;
          try {
            const buf = localStorage.getItem(`ink-buf-${p.id}`);
            if (buf) {
              const parsed = JSON.parse(buf);
              if (Array.isArray(parsed) && parsed.length >= strokes.length) {
                strokes = parsed;
                dirty = true;
              } else {
                localStorage.removeItem(`ink-buf-${p.id}`);
              }
            }
          } catch { /* corrupted buffer — ignore */ }
          loaded.push({
            id: p.id,
            strokes,
            width: p.width,
            height: p.height,
            backgroundFileId: p.backgroundFileId,
            backgroundPage: p.backgroundPage ?? null,
            bgUrl,
            dirty,
            saving: false,
          });
        }
        setPages(loaded);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      Object.values(bgUrlCache.current).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  // Debounced autosave of dirty pages.
  useEffect(() => {
    const dirty = pages.filter((p) => p.dirty && !p.saving);
    if (dirty.length === 0) return;
    const t = setTimeout(async () => {
      for (const p of dirty) {
        setPages((ps) => ps.map((x) => (x.id === p.id ? { ...x, saving: true } : x)));
        try {
          await hwApi.saveInk(p.id, p.strokes);
          localStorage.removeItem(`ink-buf-${p.id}`); // synced — drop buffer
          setPages((ps) =>
            ps.map((x) => (x.id === p.id ? { ...x, saving: false, dirty: x.strokes !== p.strokes } : x)),
          );
        } catch {
          // v2 offline buffer: network down — park strokes locally so a
          // reload (or reconnect) replays them instead of losing ink.
          try { localStorage.setItem(`ink-buf-${p.id}`, JSON.stringify(p.strokes)); } catch { /* quota */ }
          setPages((ps) => ps.map((x) => (x.id === p.id ? { ...x, saving: false } : x)));
        }
      }
    }, 900);
    return () => clearTimeout(t);
  }, [pages]);

  async function addPage(backgroundFileId?: string, backgroundPage?: number) {
    setErr('');
    try {
      let width = A4.w, height = A4.h;
      let bgUrl: string | null = null;
      if (backgroundFileId) {
        bgUrl = await bgUrlFor(backgroundFileId, backgroundPage ?? null);
        if (bgUrl) {
          const dim = await imgDims(bgUrl);
          // fit within A4 width, preserve aspect
          width = A4.w;
          height = Math.round((dim.h / dim.w) * A4.w);
        }
      }
      const created = await hwApi.createInkPage(assignmentId, {
        width,
        height,
        backgroundFileId,
        backgroundPage,
      });
      setPages((ps) => [
        ...ps,
        {
          id: created.id,
          strokes: [],
          width,
          height,
          backgroundFileId: backgroundFileId ?? null,
          backgroundPage: backgroundPage ?? null,
          bgUrl,
          dirty: false,
          saving: false,
        },
      ]);
      setActive(pages.length);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function removePage(id: string) {
    if (!confirm('删除这一页手写？')) return;
    try {
      await hwApi.deleteInkPage(id);
      setPages((ps) => {
        const next = ps.filter((p) => p.id !== id);
        setActive((a) => Math.max(0, Math.min(a, next.length - 1)));
        return next;
      });
    } catch (e: any) {
      setErr(e.message);
    }
  }

  function updateStrokes(id: string, updater: (prev: Stroke[]) => Stroke[]) {
    setPages((ps) =>
      ps.map((p) => {
        if (p.id !== id) return p;
        const next = updater(p.strokes);
        return next === p.strokes ? p : { ...p, strokes: next, dirty: true };
      }),
    );
  }

  function undo(id: string) {
    setPages((ps) =>
      ps.map((p) => (p.id === id ? { ...p, strokes: p.strokes.slice(0, -1), dirty: true } : p)),
    );
  }
  function clearPage(id: string) {
    if (!confirm('清空这一页的所有笔迹？')) return;
    setPages((ps) => ps.map((p) => (p.id === id ? { ...p, strokes: [], dirty: true } : p)));
  }

  async function finish() {
    const withInk = pages.filter((p) => p.strokes.length > 0);
    if (withInk.length === 0) {
      setErr('还没有任何手写内容');
      return;
    }
    setFinishing(true);
    setErr('');
    try {
      // Ensure latest strokes are saved first, then run the shared
      // flatten→upload→delete-drafts pipeline (same one the submit-time
      // rescue uses, so behaviour can't drift).
      for (const p of pages.filter((x) => x.dirty)) {
        await hwApi.saveInk(p.id, p.strokes).catch(() => {});
      }
      await finishInkDrafts(
        assignmentId,
        pages.map((p) => ({
          id: p.id,
          strokes: p.strokes,
          width: p.width,
          height: p.height,
          backgroundFileId: p.backgroundFileId,
          backgroundPage: p.backgroundPage,
        })),
      );
      onFinished();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setFinishing(false);
    }
  }

  const cur = pages[active] ?? null;

  return (
    <div className="fixed inset-0 bg-[#E9EDF2] z-50 flex flex-col">
      {/* Examplify 式考试顶栏 */}
      <div className="h-12 bg-[#12395B] text-white flex items-center px-3 gap-3 shrink-0">
        <button className="px-3 h-8 rounded border border-white/30 text-xs hover:bg-white/10"
          onClick={onClose}>退出</button>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">✍️ 手写作答</div>
        </div>
        <div className="flex-1 text-center text-sm text-white/90">
          {pages.length > 0 && <>第 <b>{active + 1}</b> 页 / 共 {pages.length} 页</>}
          {cur && (
            <span className="ml-3 text-xs text-white/50">
              {cur.saving ? '保存中…' : cur.dirty ? '待保存' : '已自动保存'}
            </span>
          )}
        </div>
        <button
          className="px-4 h-9 rounded-md bg-[#2E8540] text-white text-sm font-semibold hover:bg-[#267236] disabled:opacity-50"
          disabled={finishing} onClick={finish}>
          {finishing ? '处理中…' : '完成手写 ✓'}
        </button>
      </div>

      {/* Examplify 式工具条（Tool Kit 行） */}
      <div className="h-11 bg-[#F7F8FA] border-b border-[#C7CDD1] flex items-center px-3 gap-2 shrink-0 overflow-x-auto">
        <button className={`h-8 px-3 rounded-md text-sm border ${tool === 'pen' ? 'bg-[#0374B5] text-white border-[#0374B5]' : 'bg-white border-[#C7CDD1] text-[#2D3B45]'}`}
          onClick={() => setTool('pen')}>✏️ 笔</button>
        <button className={`h-8 px-3 rounded-md text-sm border ${tool === 'eraser' ? 'bg-[#0374B5] text-white border-[#0374B5]' : 'bg-white border-[#C7CDD1] text-[#2D3B45]'}`}
          onClick={() => setTool('eraser')}>🧽 橡皮</button>
        <span className="w-px h-6 bg-[#C7CDD1] mx-1" />
        <span className="flex items-center gap-1">
          {PEN_COLORS.map((c) => (
            <button key={c.value} title={c.name}
              onClick={() => { setColor(c.value); setTool('pen'); }}
              className={`w-6 h-6 rounded-full border-2 ${color === c.value ? 'border-[#0374B5] ring-2 ring-[#0374B5]/30' : 'border-white shadow'}`}
              style={{ background: c.value }} />
          ))}
        </span>
        <span className="flex items-center gap-1 ml-1">
          {PEN_SIZES.map((s) => (
            <button key={s} onClick={() => setSize(s)}
              className={`h-8 px-2.5 rounded-md text-sm border ${size === s ? 'bg-[#0374B5] text-white border-[#0374B5]' : 'bg-white border-[#C7CDD1] text-[#2D3B45]'}`}>{s}</button>
          ))}
        </span>
        <span className="w-px h-6 bg-[#C7CDD1] mx-1" />
        {cur && <button className="h-8 px-3 rounded-md text-sm bg-white border border-[#C7CDD1] text-[#2D3B45] hover:bg-gray-50"
          onClick={() => undo(cur.id)}>↩︎ 撤销</button>}
        {cur && <button className="h-8 px-3 rounded-md text-sm bg-white border border-[#C7CDD1] text-[#E0061F] hover:bg-red-50"
          onClick={() => clearPage(cur.id)}>清空本页</button>}
        <span className="w-px h-6 bg-[#C7CDD1] mx-1" />
        {/* 缩放：iPad 上写分数/根号等精细式子先放大 */}
        <span className="flex items-center gap-1">
          {[75, 100, 150, 200].map((z) => (
            <button key={z} onClick={() => setZoom(z)}
              className={`h-8 px-2 rounded-md text-xs border ${zoom === z ? 'bg-[#0374B5] text-white border-[#0374B5]' : 'bg-white border-[#C7CDD1] text-[#2D3B45]'}`}>
              {z}%
            </button>
          ))}
        </span>
        {questionFiles.length > 0 && (
          <button
            className={`h-8 px-3 rounded-md text-sm border whitespace-nowrap ${showRef ? 'bg-[#0374B5] text-white border-[#0374B5]' : 'bg-white border-[#C7CDD1] text-[#2D3B45]'}`}
            onClick={() => setShowRef(!showRef)}>
            📄 {showRef ? '收起题目' : '看题'}
          </button>
        )}
        <label className="flex items-center gap-1.5 text-xs text-[#2D3B45] ml-auto whitespace-nowrap">
          <input type="checkbox" checked={penOnly} onChange={(e) => setPenOnly(e.target.checked)} />
          仅笔模式（防误触）
        </label>
      </div>

      {err && <div className="bg-[#E0061F] text-white text-sm px-4 py-1">{err}</div>}

      <div className="flex-1 flex min-h-0 relative">
        {/* Examplify 式页号方块轨 */}
        <div className="w-[4.5rem] shrink-0 bg-white border-r border-[#C7CDD1] overflow-y-auto py-3 flex flex-col items-center gap-2">
          {pages.map((p, i) => {
            const answered = p.strokes.length > 0;
            const current = i === active;
            return (
              <div key={p.id} className="relative group">
                <button onClick={() => setActive(i)} title={`第 ${i + 1} 页${p.backgroundFileId ? '（卷面）' : ''} · ${p.strokes.length} 笔`}
                  className={`w-11 h-11 rounded-md text-sm font-semibold border-2 transition ${
                    current
                      ? answered
                        ? 'bg-[#0374B5] text-white border-[#12395B] ring-2 ring-[#0374B5]/40'
                        : 'bg-white text-[#0374B5] border-[#0374B5] ring-2 ring-[#0374B5]/30'
                      : answered
                        ? 'bg-[#0374B5] text-white border-[#0374B5]'
                        : 'bg-white text-[#6B7780] border-[#C7CDD1] hover:border-[#0374B5]'
                  }`}>
                  {i + 1}
                </button>
                {p.backgroundFileId && (
                  <span className="absolute -top-1 -right-1 text-[9px] bg-amber-400 text-white rounded-full w-4 h-4 flex items-center justify-center">卷</span>
                )}
                <button
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border border-[#C7CDD1] text-[9px] text-[#E0061F] hidden group-hover:flex items-center justify-center"
                  title="删除本页" onClick={() => removePage(p.id)}>✕</button>
              </div>
            );
          })}
          <button
            className="w-11 h-11 rounded-md border-2 border-dashed border-[#C7CDD1] text-[#6B7780] text-xl hover:border-[#0374B5] hover:text-[#0374B5]"
            title="添加页" onClick={() => setShowAdd(!showAdd)}>＋</button>
        </div>

        {/* 添加页抽屉 */}
        {showAdd && (
          <div className="absolute left-[4.5rem] top-2 z-20 w-64 bg-white rounded-lg border border-[#C7CDD1] shadow-lg p-3">
            <div className="text-xs font-semibold text-[#6B7780] uppercase tracking-wide mb-2">添加作答页</div>
            <button className="w-full text-left px-3 py-2 rounded-md border border-[#C7CDD1] text-sm hover:bg-gray-50 mb-1.5"
              onClick={() => { addPage(); setShowAdd(false); }}>▦ 空白页</button>
            {imageQuestionFiles.map((f) => (
              <button key={f.id} className="w-full text-left px-3 py-2 rounded-md border border-[#C7CDD1] text-sm hover:bg-gray-50 mb-1.5 truncate"
                onClick={() => { addPage(f.id); setShowAdd(false); }} title={f.filename}>🖼 {f.filename}</button>
            ))}
            {pdfQuestionFiles.map((f) => (
              <PdfBgPicker key={f.id} file={f}
                onPickPage={(page) => { addPage(f.id, page); setShowAdd(false); }}
                onPickAll={async (pageCount) => {
                  for (let p = 1; p <= pageCount; p++) await addPage(f.id, p);
                  setShowAdd(false);
                }} />
            ))}
          </div>
        )}

        {/* canvas area — 双指捏合缩放（zoom 50–300%），仅笔模式下手指只用于缩放/滚动 */}
        <div ref={canvasAreaRef} className="flex-1 overflow-auto p-5 flex justify-center items-start min-w-0">
          {loading ? (
            <div className="text-[#6B7780] mt-10">加载中…</div>
          ) : pages.length === 0 ? (
            <div className="text-[#6B7780] mt-14 text-center bg-white rounded-lg border border-[#C7CDD1] px-10 py-8">
              还没有作答页。<br />点左侧「＋」添加：空白页，或直接在题目卷面上写。
            </div>
          ) : cur ? (
            <div className="pb-20" style={{ width: `${Math.round(720 * zoom / 100)}px`, maxWidth: zoom <= 100 ? '100%' : undefined }}>
              <HandwritingCanvas
                key={cur.id}
                width={cur.width}
                height={cur.height}
                strokes={cur.strokes}
                backgroundUrl={cur.bgUrl}
                color={color}
                size={size}
                tool={tool}
                penOnly={penOnly}
                onChange={(updater) => updateStrokes(cur.id, updater)}
              />
            </div>
          ) : null}
        </div>

        {/* 题目参照面板：审题-答题同屏（iPad 横屏左写右看） */}
        {showRef && (
          <aside className="w-[38%] min-w-64 shrink-0 bg-white border-l border-[#C7CDD1] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#E8EAEC] px-3 py-2 flex items-center justify-between z-10">
              <span className="text-sm font-semibold text-[#2D3B45]">📄 题目</span>
              <button className="text-xs text-[#6B7780] hover:text-[#2D3B45]" onClick={() => setShowRef(false)}>收起 ✕</button>
            </div>
            <div className="p-3 space-y-4">
              {questionFiles.map((f) => (
                <div key={f.id}>
                  <div className="text-xs text-[#6B7780] mb-1 truncate">{f.filename}</div>
                  {f.mimeType === 'application/pdf' ? (
                    <div className="border border-[#E8EAEC] rounded">
                      <PdfPreview contentPath={hwFileContentPath(f.id)} />
                    </div>
                  ) : (
                    <AuthImage src={hwFileContentPath(f.id)} alt={f.filename}
                      className="w-full border border-[#E8EAEC] rounded" />
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Examplify 式 Previous / Next */}
        {pages.length > 1 && (
          <div className="absolute bottom-4 right-5 flex gap-2 z-10">
            <button
              className="h-10 px-4 rounded-md bg-white border border-[#C7CDD1] text-sm text-[#2D3B45] shadow disabled:opacity-40"
              disabled={active <= 0} onClick={() => setActive(active - 1)}>‹ 上一页</button>
            <button
              className="h-10 px-4 rounded-md bg-[#0374B5] text-white text-sm font-medium shadow hover:bg-[#02659F] disabled:opacity-40"
              disabled={active >= pages.length - 1} onClick={() => setActive(active + 1)}>下一页 ›</button>
          </div>
        )}
      </div>
    </div>
  );
}

function imgDims(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 794, h: img.naturalHeight || 1123 });
    img.onerror = () => resolve({ w: 794, h: 1123 });
    img.src = url;
  });
}

/**
 * PDF 卷子按页选底：点文件名懒加载页数，展开 P1..Pn + 「整卷」。
 * 老师上传的基本都是 PDF，这是手写作答的主路径。
 */
function PdfBgPicker({ file, onPickPage, onPickAll }: {
  file: { id: string; filename: string };
  onPickPage: (page: number) => void;
  onPickAll: (pageCount: number) => Promise<void>;
}) {
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  async function expand() {
    if (pageCount != null || loading) return;
    setLoading(true);
    try {
      const { pdfPageCount } = await import('../lib/pdf-render');
      const { hwFileContentPath } = await import('../lib/api-homework');
      setPageCount(await pdfPageCount(hwFileContentPath(file.id)));
    } catch {
      setPageCount(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-1.5">
      <button className="w-full text-left px-3 py-2 rounded-md border border-[#C7CDD1] text-sm hover:bg-gray-50 truncate"
        onClick={expand} title={file.filename}>
        📄 {file.filename}{loading ? ' …' : pageCount == null ? '（点开选页）' : ''}
      </button>
      {pageCount != null && pageCount > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 px-1">
          <button className="px-2.5 py-1 rounded-md bg-[#0374B5] text-white text-xs hover:bg-[#02659F] disabled:opacity-50"
            disabled={adding}
            onClick={async () => { setAdding(true); try { await onPickAll(pageCount); } finally { setAdding(false); } }}>
            {adding ? '…' : `整卷 ${pageCount} 页`}
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <button key={p} className="px-2 py-1 rounded-md border border-[#C7CDD1] text-xs text-[#2D3B45] hover:bg-gray-50"
              onClick={() => onPickPage(p)}>P{p}</button>
          ))}
        </div>
      )}
      {pageCount === 0 && <div className="text-xs text-[#E0061F] px-1 mt-1">PDF 读取失败</div>}
    </div>
  );
}
