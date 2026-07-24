import { useEffect, useRef, useState, useCallback } from 'react';
import { hwApi, hwFileContentPath } from '../lib/api-homework';
import { finishInkDrafts } from '../lib/ink-flatten';
import { HandwritingCanvas, Stroke } from './HandwritingCanvas';

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
  const [err, setErr] = useState('');
  const bgUrlCache = useRef<Record<string, string>>({});

  const imageQuestionFiles = questionFiles.filter((f) => f.mimeType.startsWith('image/'));

  // Fetch an authorized object URL for a question-image background.
  const bgUrlFor = useCallback(async (fileId: string): Promise<string | null> => {
    if (bgUrlCache.current[fileId]) return bgUrlCache.current[fileId];
    const token = localStorage.getItem('auth_token');
    const base = (import.meta as any).env?.VITE_API_URL || '';
    const res = await fetch(`${base}${hwFileContentPath(fileId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const url = URL.createObjectURL(await res.blob());
    bgUrlCache.current[fileId] = url;
    return url;
  }, []);

  // Initial load: existing ink pages for this submission.
  useEffect(() => {
    (async () => {
      try {
        const { pages: raw } = await hwApi.listInk(assignmentId);
        const loaded: InkPageState[] = [];
        for (const p of raw) {
          const bgUrl = p.backgroundFileId ? await bgUrlFor(p.backgroundFileId) : null;
          loaded.push({
            id: p.id,
            strokes: Array.isArray(p.strokes) ? p.strokes : [],
            width: p.width,
            height: p.height,
            backgroundFileId: p.backgroundFileId,
            bgUrl,
            dirty: false,
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
          setPages((ps) =>
            ps.map((x) => (x.id === p.id ? { ...x, saving: false, dirty: x.strokes !== p.strokes } : x)),
          );
        } catch {
          setPages((ps) => ps.map((x) => (x.id === p.id ? { ...x, saving: false } : x)));
        }
      }
    }, 900);
    return () => clearTimeout(t);
  }, [pages]);

  async function addPage(backgroundFileId?: string) {
    setErr('');
    try {
      let width = A4.w, height = A4.h;
      let bgUrl: string | null = null;
      if (backgroundFileId) {
        bgUrl = await bgUrlFor(backgroundFileId);
        if (bgUrl) {
          const dim = await imgDims(bgUrl);
          // fit within A4 width, preserve aspect
          width = A4.w;
          height = Math.round((dim.h / dim.w) * A4.w);
        }
      }
      const created = await hwApi.createInkPage(assignmentId, { width, height, backgroundFileId });
      setPages((ps) => [
        ...ps,
        {
          id: created.id,
          strokes: [],
          width,
          height,
          backgroundFileId: backgroundFileId ?? null,
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
    <div className="fixed inset-0 bg-gray-900/95 z-50 flex flex-col">
      {/* top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-semibold">✍️ 手写作答</span>
          {cur && (
            <span className="text-xs text-gray-300">
              {cur.saving ? '保存中…' : cur.dirty ? '待保存' : '已保存'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* tools */}
          <button className={`px-2 py-1 rounded text-sm ${tool === 'pen' ? 'bg-blue-600' : 'bg-gray-600'}`}
            onClick={() => setTool('pen')}>✏️ 笔</button>
          <button className={`px-2 py-1 rounded text-sm ${tool === 'eraser' ? 'bg-blue-600' : 'bg-gray-600'}`}
            onClick={() => setTool('eraser')}>🧽 橡皮</button>
          <span className="flex items-center gap-1">
            {PEN_COLORS.map((c) => (
              <button key={c.value} title={c.name}
                onClick={() => { setColor(c.value); setTool('pen'); }}
                className={`w-6 h-6 rounded-full border-2 ${color === c.value ? 'border-white' : 'border-transparent'}`}
                style={{ background: c.value }} />
            ))}
          </span>
          <span className="flex items-center gap-1">
            {PEN_SIZES.map((s) => (
              <button key={s} onClick={() => setSize(s)}
                className={`px-2 py-1 rounded text-sm ${size === s ? 'bg-blue-600' : 'bg-gray-600'}`}>{s}</button>
            ))}
          </span>
          {cur && <button className="px-2 py-1 rounded text-sm bg-gray-600" onClick={() => undo(cur.id)}>↩︎ 撤销</button>}
          {cur && <button className="px-2 py-1 rounded text-sm bg-gray-600" onClick={() => clearPage(cur.id)}>清空</button>}
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={penOnly} onChange={(e) => setPenOnly(e.target.checked)} />
            仅笔（防误触）
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 rounded bg-green-600 text-sm disabled:opacity-50"
            disabled={finishing} onClick={finish}>
            {finishing ? '处理中…' : '✅ 完成手写'}
          </button>
          <button className="px-3 py-1 rounded bg-gray-600 text-sm" onClick={onClose}>关闭</button>
        </div>
      </div>

      {err && <div className="bg-red-600 text-white text-sm px-4 py-1">{err}</div>}

      <div className="flex-1 flex min-h-0">
        {/* page rail */}
        <div className="w-40 shrink-0 bg-gray-800 text-white overflow-y-auto p-2 space-y-2">
          {pages.map((p, i) => (
            <div key={p.id} className="relative">
              <button onClick={() => setActive(i)}
                className={`w-full text-left px-2 py-3 rounded text-sm ${i === active ? 'bg-blue-600' : 'bg-gray-700'}`}>
                第 {i + 1} 页{p.backgroundFileId ? ' · 题图' : ''}
                <span className="block text-xs text-gray-300">{p.strokes.length} 笔</span>
              </button>
              <button className="absolute top-1 right-1 text-xs text-gray-300 hover:text-red-300"
                onClick={() => removePage(p.id)}>✕</button>
            </div>
          ))}
          <button className="w-full px-2 py-2 rounded bg-gray-700 text-sm hover:bg-gray-600"
            onClick={() => addPage()}>＋ 空白页</button>
          {imageQuestionFiles.length > 0 && (
            <div className="pt-1 border-t border-gray-600">
              <div className="text-xs text-gray-400 px-1 py-1">以题目图为底：</div>
              {imageQuestionFiles.map((f) => (
                <button key={f.id} className="w-full px-2 py-1 rounded bg-gray-700 text-xs hover:bg-gray-600 mb-1 truncate"
                  onClick={() => addPage(f.id)} title={f.filename}>＋ {f.filename}</button>
              ))}
            </div>
          )}
        </div>

        {/* canvas area */}
        <div className="flex-1 overflow-auto p-4 flex justify-center items-start">
          {loading ? (
            <div className="text-gray-300 mt-10">加载中…</div>
          ) : pages.length === 0 ? (
            <div className="text-gray-300 mt-10 text-center">
              还没有手写页。<br />点左侧「＋ 空白页」开始，或选一张题目图在上面直接写。
            </div>
          ) : cur ? (
            <div className="w-full max-w-3xl">
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
