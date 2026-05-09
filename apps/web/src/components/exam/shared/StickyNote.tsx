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
 *  "+ Add" button. Editing/removal is via prompt() — minimal but works on
 *  every device including iPad with no keyboard plugged in. */
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
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t pt-3 mt-4">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          className="text-xs text-gray-500 underline"
          onClick={() => setOpen((v) => !v)}
        >
          便笺 · Notes ({notes.length})
        </button>
        <button
          type="button"
          className="text-sm text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 active:bg-blue-100 touch-manipulation min-h-[36px] font-medium"
          onClick={() => {
            const t = prompt('便笺内容 · Note text');
            if (t !== null) onAdd(t);
          }}
        >
          + Add
        </button>
      </div>
      {open && notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="text-sm bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 cursor-pointer touch-manipulation"
              onClick={() => {
                const t = prompt('Edit note (empty to delete):', n.text);
                if (t === null) return;
                if (!t.trim()) onRemove(n.id);
                else onEdit(n.id, t);
              }}
              title="点击编辑/删除"
            >
              {n.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
