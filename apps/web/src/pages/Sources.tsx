import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const REPO_TYPES = [
  { value: 'with_pdfs', label: 'GitHub repo with PDFs' },
  { value: 'notes_only', label: 'Notes / study resources' },
  { value: 'downloader_script', label: 'Downloader script (do not sync)' },
  { value: 'topic_page', label: 'GitHub topic page (discovery only)' },
  { value: 'official', label: 'Official exam-board source' },
  { value: 'school_upload', label: 'School manual upload' },
  { value: 'ai_generator', label: 'AI generator' },
];

const COMPLIANCE_STATUSES = [
  { value: 'pending_review', label: 'Pending review', color: 'bg-gray-100 text-gray-700' },
  { value: 'approved_internal', label: 'Approved (internal)', color: 'bg-green-100 text-green-700' },
  { value: 'restricted_internal', label: 'Restricted (licensed only)', color: 'bg-amber-100 text-amber-700' },
  { value: 'blocked', label: 'Blocked', color: 'bg-red-100 text-red-700' },
  { value: 'expired', label: 'Expired', color: 'bg-red-100 text-red-700' },
];

const ALLOWED_USAGES = [
  { value: 'free_use', label: 'Free use (school owns)' },
  { value: 'internal_classroom_only', label: 'Internal classroom only' },
  { value: 'metadata_reference_only', label: 'Metadata reference only' },
  { value: 'none', label: 'None (not cleared)' },
];

function statusBadge(status: string) {
  const cfg = COMPLIANCE_STATUSES.find((s) => s.value === status);
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${cfg?.color ?? 'bg-gray-100'}`}>
      {cfg?.label ?? status}
    </span>
  );
}

export default function SourcesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setItems(await api.listSources());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    setError(null);
    try {
      await api.updateSourceCompliance(id, {
        complianceStatus: status,
        allowedUsage:
          status === 'approved_internal'
            ? 'free_use'
            : status === 'restricted_internal'
              ? 'internal_classroom_only'
              : 'none',
      });
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function block(id: string) {
    const reason = prompt('Block reason (e.g. "takedown notice from CIE"):');
    if (!reason) return;
    setBusy(id);
    setError(null);
    try {
      await api.blockSource(id, reason);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function sync(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await api.syncSource(id);
      alert(
        `Sync complete\n` +
          `Scanned: ${res.scanned}\n` +
          `New files: ${res.newFiles}\n` +
          `Duplicates: ${res.duplicates}\n` +
          `Errors: ${res.errors?.length ?? 0}`,
      );
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Source Repositories</h1>
          <p className="text-sm text-gray-600">
            Compliance gate for ingested past papers. Every new repo starts <b>pending_review</b>;
            the sync worker will refuse to clone until an admin approves it.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add repository
        </button>
      </div>

      {error && (
        <div className="card" style={{ background: '#fee2e2', borderColor: '#fecaca' }}>
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {showAdd && <AddSourceForm onClose={() => setShowAdd(false)} onSaved={refresh} />}

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="card text-gray-500">No source repositories yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={r.url} target="_blank" rel="noreferrer" className="font-mono text-sm break-all hover:underline">
                      {r.url}
                    </a>
                    {statusBadge(r.complianceStatus)}
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      {REPO_TYPES.find((t) => t.value === r.repoType)?.label ?? r.repoType}
                    </span>
                    {r.syncStatus !== 'idle' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        sync: {r.syncStatus}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Files: {r._count?.files ?? 0} · Added by {r.addedBy?.name ?? '—'} ·{' '}
                    {r.lastSyncedAt ? `Last sync ${new Date(r.lastSyncedAt).toLocaleString()}` : 'Never synced'}
                    {r.copyrightOwner && <> · Copyright: {r.copyrightOwner}</>}
                  </div>
                  {r.notesForTeachers && (
                    <div className="text-xs text-gray-600 mt-1">Note: {r.notesForTeachers}</div>
                  )}
                  {r.syncError && (
                    <div className="text-xs text-red-600 mt-1">Last sync error: {r.syncError}</div>
                  )}
                  {r.blockedReason && (
                    <div className="text-xs text-red-600 mt-1">Blocked: {r.blockedReason}</div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {r.complianceStatus === 'pending_review' && (
                    <>
                      <button className="btn btn-primary" disabled={busy === r.id} onClick={() => setStatus(r.id, 'approved_internal')}>
                        Approve (school-owned)
                      </button>
                      <button className="btn" disabled={busy === r.id} onClick={() => setStatus(r.id, 'restricted_internal')}>
                        Approve (licensed past papers)
                      </button>
                    </>
                  )}
                  {(r.complianceStatus === 'approved_internal' || r.complianceStatus === 'restricted_internal') && (
                    <>
                      <button className="btn" disabled={busy === r.id} onClick={() => sync(r.id)}>
                        {busy === r.id ? 'Syncing…' : 'Sync now'}
                      </button>
                      <button className="btn btn-danger" disabled={busy === r.id} onClick={() => block(r.id)}>
                        Block
                      </button>
                    </>
                  )}
                  {r.complianceStatus === 'blocked' && (
                    <span className="text-xs text-red-600">All derived files / questions are excluded.</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddSourceForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({
    url: '',
    repoType: 'with_pdfs',
    examBoardHint: '',
    copyrightOwner: '',
    notesForTeachers: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload: any = { url: form.url, repoType: form.repoType };
      if (form.examBoardHint) payload.examBoardHint = form.examBoardHint;
      if (form.copyrightOwner) payload.copyrightOwner = form.copyrightOwner;
      if (form.notesForTeachers) payload.notesForTeachers = form.notesForTeachers;
      await api.createSource(payload);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div className="font-semibold">Add new source repository</div>
      <div className="text-xs text-gray-500">
        New repos default to <b>pending_review</b>. Approval is a separate explicit step;
        the worker will not clone until you change status.
      </div>

      <div>
        <label className="text-xs text-gray-600">URL</label>
        <input
          className="input"
          placeholder="https://github.com/owner/repo"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
        />
      </div>
      <div>
        <label className="text-xs text-gray-600">Repository type</label>
        <select className="select" value={form.repoType} onChange={(e) => setForm({ ...form, repoType: e.target.value })}>
          {REPO_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600">Exam board hint</label>
          <input
            className="input"
            placeholder="CIE / Pearson"
            value={form.examBoardHint}
            onChange={(e) => setForm({ ...form, examBoardHint: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-gray-600">Copyright owner</label>
          <input
            className="input"
            placeholder="Cambridge Assessment Int'l Education"
            value={form.copyrightOwner}
            onChange={(e) => setForm({ ...form, copyrightOwner: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-600">Notes for teachers</label>
        <textarea
          className="input"
          rows={2}
          value={form.notesForTeachers}
          onChange={(e) => setForm({ ...form, notesForTeachers: e.target.value })}
        />
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex justify-end gap-2">
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy || !form.url} onClick={save}>
          {busy ? 'Saving…' : 'Add (pending review)'}
        </button>
      </div>
    </div>
  );
}
