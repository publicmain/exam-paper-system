import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatSubjectLabel } from '../lib/labels';

/**
 * Templates list page.
 *
 * Fix #13: previously this page was read-only — admins could see existing
 * templates but had no way to create one. Added a "+ New Template" button
 * + modal with the minimum required fields (name, subject, optional
 * component, durationMin, totalMarks). The richer per-section / topic
 * config still has to be edited via API or DB; this MVP form unblocks the
 * common case of creating a fresh template for a quiz preset.
 */
export default function TemplatesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  async function reload() {
    setItems(await api.listTemplates());
  }
  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Templates</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + New Template
        </button>
      </div>
      <div className="card divide-y">
        {items.length === 0 && (
          <div className="py-6 text-center text-gray-500">
            No templates yet. (Built-in presets are available in the paper wizard.)
          </div>
        )}
        {items.map((t: any) => (
          <div key={t.id} className="py-3">
            <div className="font-medium">
              {t.name}
              {t.isSchoolDefault && <span className="badge ml-2">default</span>}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {[
                t.subject?.name,
                t.component?.code,
                t.durationMin ? `${t.durationMin} min` : null,
                `${t.totalMarks} marks`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
        ))}
      </div>
      {creating && (
        <CreateTemplateModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function CreateTemplateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [components, setComponents] = useState<any[]>([]);
  const [componentId, setComponentId] = useState('');
  const [durationMin, setDurationMin] = useState(60);
  const [totalMarks, setTotalMarks] = useState(50);
  const [isSchoolDefault, setIsSchoolDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.subjects().then(setSubjects);
  }, []);
  useEffect(() => {
    if (subjectId) api.components(subjectId).then(setComponents);
    else setComponents([]);
    setComponentId('');
  }, [subjectId]);

  async function save() {
    if (!name.trim() || !subjectId) {
      setErr('Name and subject are required.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.createTemplate({
        name: name.trim(),
        subjectId,
        componentId: componentId || null,
        durationMin,
        totalMarks,
        isSchoolDefault,
        // Minimum config — sections + topic mix can be added later via API.
        config: { sections: [] },
      });
      onSaved();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-[480px] max-w-full p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-lg">New Template</h2>
          <button className="btn btn-ghost text-xl" onClick={onClose}>
            ×
          </button>
        </div>
        <label className="block text-sm">
          <span className="text-xs text-gray-500">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded px-2 py-1 w-full"
            placeholder="Weekly Quiz — Math P1"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs text-gray-500">Subject</span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="border rounded px-2 py-1 w-full"
          >
            <option value="">— pick —</option>
            {subjects.map((s: any) => (
              <option key={s.id} value={s.id}>
                {formatSubjectLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs text-gray-500">Component (optional)</span>
          <select
            value={componentId}
            onChange={(e) => setComponentId(e.target.value)}
            className="border rounded px-2 py-1 w-full"
            disabled={!subjectId}
          >
            <option value="">— any —</option>
            {components.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-xs text-gray-500">Duration (min)</span>
            <input
              type="number"
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className="border rounded px-2 py-1 w-full"
              min={5}
              max={360}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-gray-500">Total marks</span>
            <input
              type="number"
              value={totalMarks}
              onChange={(e) => setTotalMarks(Number(e.target.value))}
              className="border rounded px-2 py-1 w-full"
              min={1}
              max={500}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isSchoolDefault}
            onChange={(e) => setIsSchoolDefault(e.target.checked)}
          />
          School default (visible to all teachers)
        </label>
        {err && <div className="text-sm text-red-700">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
