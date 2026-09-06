import { useCallback, useEffect, useState } from 'react';

/** A sticky note attached to the passage panel. We deliberately don't
 *  anchor each note to a specific paragraph (the IELTS CD app keeps notes
 *  free-floating in a side rail) — the friction of picking an anchor
 *  point isn't worth the extra placement code at this stage. The student
 *  uses the sticky as a scratch area. */

export interface Note {
  id: string;
  text: string;
  /** Epoch ms — used for ordering. */
  createdAt: number;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useStoredNotes(key: string): [
  Note[],
  (text: string) => void,
  (id: string, text: string) => void,
  (id: string) => void,
] {
  const [notes, setNotes] = useState<Note[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
  });
  // Re-hydrate when key changes — same reasoning as useStoredHighlights.
  // Round-7 agent-5 P1.
  useEffect(() => {
    try { setNotes(JSON.parse(localStorage.getItem(key) ?? '[]')); }
    catch { setNotes([]); }
  }, [key]);

  // The setters all read the latest `notes` via setState's updater form so
  // they don't need `notes` in their deps array — that would re-create the
  // setter on every state change and defeat the useCallback identity.
  const persist = useCallback((updater: (prev: Note[]) => Note[]) => {
    setNotes((prev) => {
      const next = updater(prev);
      try { localStorage.setItem(key, JSON.stringify(next)); }
      catch { /* localStorage full / disabled */ }
      return next;
    });
  }, [key]);

  const add = useCallback((text: string) => {
    if (!text.trim()) return;
    persist((prev) => [...prev, { id: uid(), text: text.trim(), createdAt: Date.now() }]);
  }, [persist]);

  const edit = useCallback((id: string, text: string) => {
    if (!text.trim()) {
      persist((prev) => prev.filter((n) => n.id !== id));
      return;
    }
    persist((prev) => prev.map((n) => (n.id === id ? { ...n, text: text.trim() } : n)));
  }, [persist]);

  const remove = useCallback((id: string) => {
    persist((prev) => prev.filter((n) => n.id !== id));
  }, [persist]);

  return [notes, add, edit, remove];
}

/** Compact note rail. Renders a list of yellow stickies and provides an
 *  "+ 添加" button. Editing is an inline textarea —— 2026-09-06 第五轮盲测 3：
 *  原来用 window.prompt()，内嵌浏览器 / 部分 WebView 直接抛
 *  "prompt() is not supported"，学生看到的就是按钮坏了。 */
export function StickyNoteRail({
  notes,
  onAdd,
  onEdit,
  onRemove,
}: {
  notes: Note[];
  onAdd: (text: string) => void;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}) {
  // 有便笺就默认展开 —— 刷新后收着，学生以为丢了（2026-09-06 第五轮复测）
  const [open, setOpen] = useState(notes.length > 0);
  /** 正在编辑的便笺：`id` 为空表示新建。 */
  const [draft, setDraft] = useState<{ id: string | null; text: string } | null>(null);

  const save = () => {
    if (!draft) return;
    const text = draft.text.trim();
    if (draft.id == null) {
      if (text) onAdd(text);
    } else if (!text) {
      onRemove(draft.id);
    } else {
      onEdit(draft.id, text);
    }
    setDraft(null);
    setOpen(true);
  };

  return (
    <div className="border-t pt-3 mt-4">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          /* 2026-08-11 触屏：原来是 text-xs 下划线文字,实测仅 16px 高,
             远低于 44pt。改成有实体触控区的按钮。 */
          className="hit press text-[15px] text-gray-600 font-medium px-2 -ml-2 rounded-lg"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          便笺 ({notes.length})
        </button>
        <button
          type="button"
          data-testid="sticky-add"
          className="text-sm text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 active:bg-blue-100 touch-manipulation min-h-[44px] font-medium press"
          onClick={() => {
            setDraft({ id: null, text: '' });
            setOpen(true);
          }}
        >
          + 添加
        </button>
      </div>
      {draft && (
        <div data-testid="sticky-editor" className="mb-2 rounded-lg border border-yellow-300 bg-yellow-50 p-2">
          <textarea
            autoFocus
            aria-label="便笺内容"
            value={draft.text}
            onChange={(e) => setDraft({ id: draft.id, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setDraft(null);
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                save();
              }
            }}
            rows={3}
            placeholder="写点什么…"
            className="w-full resize-none rounded-md border border-yellow-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
          />
          <div className="mt-1.5 flex items-center gap-2">
            <button type="button" data-testid="sticky-save" onClick={save} className="min-h-[36px] rounded-md bg-blue-600 px-3 text-sm font-medium text-white">
              保存
            </button>
            <button type="button" onClick={() => setDraft(null)} className="min-h-[36px] rounded-md px-3 text-sm text-slate-600">
              取消
            </button>
            {draft.id != null && (
              <button
                type="button"
                data-testid="sticky-delete"
                onClick={() => {
                  onRemove(draft.id as string);
                  setDraft(null);
                }}
                className="ml-auto min-h-[36px] rounded-md px-3 text-sm text-rose-600"
              >
                删除
              </button>
            )}
          </div>
        </div>
      )}
      {open && notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className="w-full text-left text-sm bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 touch-manipulation whitespace-pre-wrap"
                aria-label={`便笺：${n.text}（点击编辑）`}
                onClick={() => setDraft({ id: n.id, text: n.text })}
                title="点击编辑/删除"
              >
                {n.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
