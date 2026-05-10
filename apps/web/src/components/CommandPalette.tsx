import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * R10-Bug3 — global Ctrl+K / Cmd+K command palette.
 *
 * Round-9 found ZERO ctrlKey/metaKey handlers in the codebase, so the
 * "regression test for Ctrl+K" the user mentioned never had a target.
 * This implementation is the first live one. Behavior is the standard
 * Linear / Notion shape:
 *   - Ctrl/Cmd+K toggles visibility from anywhere
 *   - Esc closes
 *   - ↑/↓ navigate list
 *   - Enter opens highlighted entry
 *   - Mouse click also opens an entry
 *   - Empty query: show full action list (NOT a stuck dead-state — this
 *     is the Student-system bug class the user warned about)
 */

type Action = {
  id: string;
  label: string;
  hint?: string;
  // Either an in-app route or a free-form callback. We use a route in
  // every built-in entry below so Enter / click both navigate without
  // surprising the user.
  route: string;
  scopes: ReadonlyArray<'admin' | 'head_teacher' | 'teacher' | 'student'>;
};

const BUILTIN: ReadonlyArray<Action> = [
  { id: 'dash', label: 'Dashboard', route: '/', scopes: ['admin', 'head_teacher', 'teacher'] },
  { id: 'practice', label: 'Practice (past papers)', route: '/practice', scopes: ['admin', 'head_teacher', 'teacher', 'student'] },
  { id: 'papers', label: 'Papers', route: '/papers', scopes: ['admin', 'head_teacher', 'teacher'] },
  { id: 'questions', label: 'Questions', route: '/questions', scopes: ['admin', 'head_teacher', 'teacher'] },
  { id: 'templates', label: 'Templates', route: '/templates', scopes: ['admin', 'head_teacher', 'teacher'] },
  { id: 'review', label: 'Review queue', route: '/review', scopes: ['admin', 'head_teacher'] },
  { id: 'quick', label: 'Quick paper', hint: '⚡', route: '/quick-paper', scopes: ['admin', 'head_teacher'] },
  { id: 'aigen', label: 'AI generate', route: '/ai-generate', scopes: ['admin', 'head_teacher'] },
  { id: 'classes', label: 'Classes', route: '/classes', scopes: ['admin', 'head_teacher', 'teacher'] },
  { id: 'marker', label: 'Marker queue', route: '/marker', scopes: ['admin', 'head_teacher', 'teacher'] },
  { id: 'stats', label: 'Class stats', route: '/stats', scopes: ['admin', 'head_teacher', 'teacher'] },
  { id: 'mq', label: 'Morning quiz schedule', hint: '🌅', route: '/morning-quiz/schedule', scopes: ['admin', 'head_teacher', 'teacher'] },
  { id: 'qa', label: 'Morning quiz QA review', route: '/morning-quiz/qa-review', scopes: ['admin', 'head_teacher', 'teacher'] },
  { id: 'attendance', label: 'Attendance records', route: '/admin/attendance', scopes: ['admin', 'head_teacher', 'teacher'] },
  { id: 'quality', label: 'Quality feedback', route: '/quality', scopes: ['admin', 'head_teacher'] },
  { id: 'syllabus', label: 'Syllabus admin', route: '/syllabus', scopes: ['admin'] },
  { id: 'cost', label: 'AI cost dashboard', route: '/admin/cost', scopes: ['admin'] },
  { id: 'users', label: 'Users (RBAC)', route: '/admin/users', scopes: ['admin'] },
  { id: 'sources', label: 'Sources', route: '/sources', scopes: ['admin'] },
  { id: 'tutor', label: 'AI tutor', route: '/student/tutor', scopes: ['student'] },
  { id: 'student-home', label: 'My papers', route: '/student', scopes: ['student'] },
];

interface Props {
  role: 'admin' | 'head_teacher' | 'teacher' | 'student';
}

export function CommandPalette({ role }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  // Global Ctrl/Cmd+K toggle. Listen on window so it fires regardless of
  // which input the user is currently focused on.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isToggle = (e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey);
      if (isToggle) {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery('');
        setCursor(0);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      // Focus immediately after mount so the user can start typing.
      // setTimeout because React paints the input on the next tick.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo<Action[]>(() => {
    const scoped = BUILTIN.filter((a) => a.scopes.includes(role));
    const q = query.trim().toLowerCase();
    // R10 — explicitly handle the empty-query case: show ALL scoped
    // actions (no dead state). This is the Student-system bug pattern
    // the user warned about — leaving the empty branch returning a
    // truncated/empty list breaks Enter and click navigation.
    if (!q) return scoped;
    return scoped.filter((a) =>
      a.label.toLowerCase().includes(q) || a.id.toLowerCase().includes(q),
    );
  }, [query, role]);

  // Keep cursor inside the filtered range when query changes.
  useEffect(() => {
    if (cursor >= filtered.length) setCursor(0);
  }, [filtered.length, cursor]);

  if (!open) return null;

  function go(action: Action) {
    setOpen(false);
    setQuery('');
    setCursor(0);
    navigate(action.route);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      const a = filtered[cursor];
      if (a) go(a);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[60] flex items-start justify-center pt-24"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[560px] max-w-full max-h-[70vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="跳转到… (页面 / 操作)"
          className="border-b px-4 py-3 outline-none text-sm"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
          onKeyDown={onInputKey}
          aria-label="command palette query"
          data-testid="command-palette-input"
        />
        <div className="overflow-y-auto" data-testid="command-palette-list">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-500 text-center">没有匹配项</div>
          )}
          {filtered.map((a, i) => (
            <button
              key={a.id}
              type="button"
              data-testid={`command-palette-item-${a.id}`}
              className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${i === cursor ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(a)}
            >
              <span>{a.hint ? `${a.hint} ` : ''}{a.label}</span>
              <span className="text-xs text-gray-400 font-mono">{a.route}</span>
            </button>
          ))}
        </div>
        <div className="border-t px-4 py-2 text-xs text-gray-500 flex justify-between">
          <span>↑↓ 选择 · Enter 打开 · Esc 关闭</span>
          <span>{filtered.length} 项</span>
        </div>
      </div>
    </div>
  );
}
