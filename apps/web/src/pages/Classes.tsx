import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Class management page (Fix #14).
 *
 * Before: there was no UI to create / view classes; the entire student
 * workflow (assign paper -> student takes paper) required hitting the API
 * directly with curl. This page exposes:
 *
 *   - List of classes (admin / head sees all; teacher sees own)
 *   - Create class
 *   - Per-class roster: bulk add students (paste email + name, one per line)
 *   - Per-class roster: remove a student
 *
 * The teacher-facing "Assign paper" workflow is wired into PaperEdit.tsx
 * via an Assign modal (also added in this fix); we don't duplicate that
 * here.
 */
export default function ClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setErr(null);
    try {
      const list = await api.listClasses();
      setClasses(list);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Classes</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + New Class
        </button>
      </div>

      {err && <div className="card text-sm text-red-700">{err}</div>}

      <div className="card divide-y">
        {loading && <div className="py-6 text-center text-gray-500">Loading…</div>}
        {!loading && classes.length === 0 && (
          <div className="py-6 text-center text-gray-500">
            No classes yet. Create one above to start assigning papers to students.
          </div>
        )}
        {classes.map((c: any) => (
          // Row is a flex container, not a single <button>, so we can
          // host two distinct interactive areas: the click-to-open
          // detail area on the left and a delete affordance on the
          // right. (Nested <button> is invalid HTML.)
          <div
            key={c.id}
            className="flex items-center justify-between py-3 -mx-4 px-4 hover:bg-gray-50"
          >
            <button
              onClick={() => setSelectedId(c.id)}
              className="flex-1 text-left"
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {[c.classCode, c.englishLevel?.level, `${c._count?.enrollments ?? 0} students`]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </button>
            <div className="flex items-center gap-3 shrink-0 ml-3">
              <button
                onClick={async () => {
                  // Two-step confirm because delete cascades to
                  // attendance/submissions, which is irreversible.
                  const c1 = window.confirm(
                    `永久删除「${c.name}」?\n这会一并删除该班所有学生注册、卷子分配、早测 session 及考勤记录,且不可恢复。`,
                  );
                  if (!c1) return;
                  const typed = window.prompt(
                    `请再次输入班级代码「${c.classCode}」以确认删除:`,
                  );
                  if (typed?.trim() !== c.classCode) {
                    if (typed != null) alert('班级代码不匹配,已取消');
                    return;
                  }
                  try {
                    await api.deleteClass(c.id);
                    await reload();
                  } catch (e: any) {
                    alert('删除失败: ' + (e?.message ?? String(e)));
                  }
                }}
                className="text-xs text-rose-600 hover:text-rose-800 hover:underline"
                title="永久删除该班级及其所有关联数据"
              >
                删除
              </button>
              <span className="text-xs text-gray-400">→</span>
            </div>
          </div>
        ))}
      </div>

      {creating && (
        <CreateClassModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
      {selectedId && (
        <ClassDetailModal
          classId={selectedId}
          onClose={() => setSelectedId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}

function CreateClassModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || !classCode.trim()) {
      setErr('Name and class code are required.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      // B3-H4: removed `level` field. Use the English-level mapping
      // (admin-syllabus → ClassEnglishLevel) for the morning-quiz program.
      await api.createClass({ name: name.trim(), classCode: classCode.trim() });
      onSaved();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="New Class" onClose={onClose}>
      <Field label="Name (e.g. Form 5B)">
        <input value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-2 py-1 w-full" />
      </Field>
      <Field label="Class code (short, A-Z 0-9, used as the class join key)">
        <input
          value={classCode}
          onChange={(e) => setClassCode(e.target.value.toUpperCase())}
          className="border rounded px-2 py-1 w-full font-mono"
          placeholder="FORM5B"
        />
      </Field>
      <p className="text-xs text-gray-500 leading-relaxed">
        Set the English proficiency mapping (IELTS / O-Level) on the
        Admin → Syllabus → Class English Levels page after creating.
      </p>
      {err && <div className="text-sm text-red-700">{err}</div>}
      <ModalFooter onClose={onClose} onSave={save} busy={busy} saveLabel="Create" />
    </ModalShell>
  );
}

function ClassDetailModal({
  classId,
  onClose,
  onChanged,
}: {
  classId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [cls, setCls] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rosterText, setRosterText] = useState('');
  // R10-Bug1: weeklyFocus textarea — schema + PATCH already exist server-
  // side; round-9 found UI never wired it. Local draft state mirrors the
  // class.weeklyFocus once loaded; "Save focus" persists.
  const [focusDraft, setFocusDraft] = useState('');
  const [savingFocus, setSavingFocus] = useState(false);
  const [focusSaved, setFocusSaved] = useState(false);

  async function reload() {
    setErr(null);
    try {
      const c = await api.getClass(classId);
      setCls(c);
      setFocusDraft(typeof c.weeklyFocus === 'string' ? c.weeklyFocus : '');
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function bulkAdd() {
    // R10 followup — accept three line shapes so Chinese-name rosters
    // can be pasted directly without forcing teachers to invent emails:
    //   1. "name only"               → auto-generate <classCode>-<idx>@school.local
    //   2. "email,Name"              → explicit
    //   3. "email Name"  (space-sep) → explicit
    //
    // For shape 1 we generate a synthetic email scoped to this class so
    // re-pasting the same student doesn't collide with a different
    // class's auto-emails.
    const lines = rosterText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const students: { email: string; name: string }[] = [];
    let autoIdx = 1;
    for (const line of lines) {
      // explicit forms first
      if (line.includes('@')) {
        const [first, ...rest] = line.split(/[,\s]+/);
        const name = rest.length ? rest.join(' ') : first.split('@')[0];
        students.push({ email: first, name });
      } else {
        // shape 1 — pure name. Auto-mint a deterministic-ish email.
        const epoch = Date.now().toString(36).slice(-4);
        const slug = `${(cls?.classCode || 'cls').toLowerCase().replace(/[^a-z0-9]/g, '')}-${epoch}-${autoIdx++}`;
        students.push({ email: `${slug}@school.local`, name: line });
      }
    }
    if (!students.length) {
      setErr('No valid lines found. Paste one per line — either a pure name (中文/English) or "email,Name".');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r: any = await api.rosterClass(classId, students);
      setRosterText('');
      onChanged();
      await reload();
      alert(`Created ${r.createdUsers} new accounts, enrolled ${r.enrolled}, ${r.alreadyIn} already in.`);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function renameStudent(userId: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr(null);
    try {
      await api.updateUser(userId, { name: trimmed });
      onChanged();
      await reload();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function saveFocus() {
    setSavingFocus(true);
    setErr(null);
    setFocusSaved(false);
    try {
      const trimmed = focusDraft.trim();
      await api.updateClass(classId, { weeklyFocus: trimmed.length ? trimmed : null });
      setFocusSaved(true);
      onChanged();
      await reload();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setSavingFocus(false);
    }
  }

  async function unenroll(userId: string) {
    if (!confirm('Remove this student from the class?')) return;
    setBusy(true);
    try {
      await api.unenrollClass(classId, userId);
      onChanged();
      await reload();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={cls ? `${cls.name} (${cls.classCode})` : 'Class'} onClose={onClose} wide>
      {err && <div className="text-sm text-red-700">{err}</div>}
      {cls && (
        <>
          <div className="text-xs text-gray-500">
            {cls.enrollments?.length ?? 0} enrolled · level: {cls.englishLevel?.level ?? '—'}
          </div>
          <div className="border rounded divide-y max-h-64 overflow-auto text-sm">
            {(cls.enrollments ?? []).length === 0 && (
              <div className="py-3 text-center text-gray-500">No students yet.</div>
            )}
            {(cls.enrollments ?? []).map((e: any) => (
              <EnrollmentRow
                key={e.id}
                enrollment={e}
                busy={busy}
                onRename={(newName) => renameStudent(e.userId, newName)}
                onRemove={() => unenroll(e.userId)}
              />
            ))}
          </div>

          {/* R10-Bug1: weeklyFocus textarea — flows into ai/quick-paper
              prompt builder so AI-generated weekly papers bias toward what
              the teacher wants emphasized this week. */}
          <Field label="本周重点 (Weekly focus — 用于 AI 生成卷子时的提示，可空)">
            <div className="space-y-1">
              <textarea
                value={focusDraft}
                onChange={(e) => { setFocusDraft(e.target.value); setFocusSaved(false); }}
                className="border rounded px-2 py-1 w-full text-sm"
                rows={3}
                placeholder="例：相对从句 / 倒装句 / 雅思阅读 matching headings"
                maxLength={2000}
                aria-label="weekly focus textarea"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  {focusDraft.length}/2000{focusSaved ? ' · 已保存' : ''}
                </span>
                <button
                  className="btn btn-ghost text-xs"
                  onClick={saveFocus}
                  disabled={savingFocus || focusDraft === (cls.weeklyFocus ?? '')}
                >
                  {savingFocus ? '保存中…' : '保存本周重点'}
                </button>
              </div>
            </div>
          </Field>

          <Field label="批量加学生 · Bulk add students (one per line — 仅姓名 / email / email,姓名 三种格式都行)">
            <textarea
              value={rosterText}
              onChange={(e) => setRosterText(e.target.value)}
              className="border rounded px-2 py-1 w-full font-mono text-xs"
              rows={6}
              placeholder={`于琳晶\n胡鑫瑜\n罗翾瑶\nalice@school.local,Alice Wong\nbob@school.local`}
            />
            <div className="text-xs text-gray-500 mt-1">
              中文 / English 姓名都可。无 @ 的行按"纯姓名"处理，自动生成账号邮箱。
            </div>
          </Field>
        </>
      )}
      <ModalFooter onClose={onClose} onSave={bulkAdd} busy={busy} saveLabel="Add to class" />
    </ModalShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </label>
  );
}

/**
 * Single enrollment row with inline ✎ rename. Click the pencil to flip
 * the row into edit mode, change the name, press Enter or click ✓ to
 * save. ESC to cancel. Avoids a separate "edit user" modal — the
 * common case is fixing a typo in a 中文 name copied from a paper
 * roster, which should be 2 clicks max.
 */
function EnrollmentRow({
  enrollment,
  busy,
  onRename,
  onRemove,
}: {
  enrollment: any;
  busy: boolean;
  onRename: (newName: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(enrollment.user?.name ?? '');
  const isStudent = enrollment.role === 'student';
  useEffect(() => { setDraft(enrollment.user?.name ?? ''); }, [enrollment.user?.name]);

  function save() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === enrollment.user?.name) {
      setEditing(false);
      return;
    }
    onRename(trimmed);
    setEditing(false);
  }
  function cancel() {
    setDraft(enrollment.user?.name ?? '');
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between px-3 py-2 gap-2">
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') cancel();
            }}
            autoFocus
            className="border rounded px-2 py-1 w-full text-sm"
            aria-label="edit student name"
          />
        ) : (
          <div className="truncate">{enrollment.user?.name}</div>
        )}
        <div className="text-xs text-gray-500 truncate">{enrollment.user?.email}</div>
      </div>
      <span className="flex gap-1 items-center shrink-0">
        <span className="text-xs text-gray-400 mr-1">{enrollment.role}</span>
        {isStudent && !editing && (
          <button
            className="btn btn-ghost text-xs text-blue-700"
            disabled={busy}
            onClick={() => setEditing(true)}
            aria-label="rename"
            title="改名 · Rename"
          >
            ✎
          </button>
        )}
        {editing && (
          <>
            <button
              className="btn btn-ghost text-xs text-emerald-700"
              disabled={busy}
              onClick={save}
              aria-label="save"
              title="保存 · Save (Enter)"
            >
              ✓
            </button>
            <button
              className="btn btn-ghost text-xs text-gray-500"
              disabled={busy}
              onClick={cancel}
              aria-label="cancel"
              title="取消 · Cancel (Esc)"
            >
              ✕
            </button>
          </>
        )}
        {isStudent && !editing && (
          <button
            className="btn btn-ghost text-xs text-red-700"
            disabled={busy}
            onClick={onRemove}
            aria-label="remove"
            title="移除 · Remove"
          >
            🗑
          </button>
        )}
      </span>
    </div>
  );
}
function ModalShell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  // R10-Bug1: ESC must close the modal — round-9 found ESC was inert.
  // WCAG 2.1.2 (no-keyboard-trap) + general UX. Listen on window so the
  // event fires regardless of focus location.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`bg-white rounded-lg shadow-lg ${wide ? 'w-[640px]' : 'w-[480px]'} max-w-full p-5 space-y-3 max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">{title}</h2>
          <button className="btn btn-ghost text-xl" onClick={onClose} aria-label="close modal">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ModalFooter({
  onClose,
  onSave,
  busy,
  saveLabel,
}: {
  onClose: () => void;
  onSave: () => void;
  busy: boolean;
  saveLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button className="btn" onClick={onClose} disabled={busy}>
        Cancel
      </button>
      <button className="btn btn-primary" onClick={onSave} disabled={busy}>
        {busy ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
}
