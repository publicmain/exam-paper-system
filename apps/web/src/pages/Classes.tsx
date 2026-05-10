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
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className="flex items-center justify-between py-3 -mx-4 px-4 hover:bg-gray-50 w-full text-left"
          >
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {[c.classCode, c.englishLevel?.level, `${c._count?.enrollments ?? 0} students`]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <span className="text-xs text-gray-400">→</span>
          </button>
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
    // Parse "email,name" or "email name" lines.
    const lines = rosterText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const students: { email: string; name: string }[] = [];
    for (const line of lines) {
      const [first, ...rest] = line.split(/[,\s]+/);
      if (!first || !first.includes('@')) continue;
      const name = rest.length ? rest.join(' ') : first.split('@')[0];
      students.push({ email: first, name });
    }
    if (!students.length) {
      setErr('No valid emails found. Format: one per line, "email" or "email,Name".');
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
              <div key={e.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <div>{e.user?.name}</div>
                  <div className="text-xs text-gray-500">{e.user?.email}</div>
                </div>
                <span className="flex gap-2 items-center">
                  <span className="text-xs text-gray-400">{e.role}</span>
                  {e.role === 'student' && (
                    <button
                      className="btn btn-ghost text-xs text-red-700"
                      disabled={busy}
                      onClick={() => unenroll(e.userId)}
                    >
                      Remove
                    </button>
                  )}
                </span>
              </div>
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

          <Field label="Bulk add students (one per line: email or email,Full Name)">
            <textarea
              value={rosterText}
              onChange={(e) => setRosterText(e.target.value)}
              className="border rounded px-2 py-1 w-full font-mono text-xs"
              rows={6}
              placeholder={`alice@school.local,Alice Wong\nbob@school.local`}
            />
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
