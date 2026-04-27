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

  async function process(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await api.processSource(id);
      const d = res.dispatch;
      const total = (res.splits ?? []).reduce((s: number, x: any) => s + (x.splits ?? 0), 0);
      const linked = (res.links ?? []).reduce((s: number, x: any) => s + (x.matched ?? 0), 0);
      alert(
        `Re-process complete\n` +
          `pdf-worker: attempted ${d?.attempted ?? 0}, ok ${d?.succeeded ?? 0}, failed ${d?.failed ?? 0}\n` +
          `splits: ${total}\n` +
          `mark-scheme links: ${linked}`,
      );
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function tag(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await api.tagSource(id);
      alert(
        `AI tag complete\n` +
          `Attempted: ${res.attempted}\n` +
          `Tagged: ${res.tagged}\n` +
          `Skipped: ${res.skipped}\n` +
          `Errors: ${res.errors?.length ?? 0}`,
      );
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

  async function remove(id: string, url: string) {
    if (!confirm(`Hard-delete this repository?\n\n${url}\n\nThis wipes all SourceFile + PdfPage rows and un-approved QuestionItems, plus on-disk PDFs and rendered pages. Approved Questions in the bank are kept.`)) return;
    setBusy(id);
    setError(null);
    try {
      let res;
      try {
        res = await api.deleteSource(id, false);
      } catch (e: any) {
        if (String(e.message).includes('Refusing') && confirm('Some QuestionItems are already approved. Force delete (mirrored Questions stay)?')) {
          res = await api.deleteSource(id, true);
        } else {
          throw e;
        }
      }
      alert(
        `Deleted.\n` +
          `Files: ${res.filesDeleted}\n` +
          `Items: ${res.itemsDeleted}\n` +
          `Approved items dropped: ${res.approvedItemsDropped}\n` +
          `Disk PDFs cleaned: ${res.diskFilesDeleted}\n` +
          `Render dirs cleaned: ${res.diskDirsDeleted}`,
      );
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
      const d = res.dispatch;
      const s = res.split;
      alert(
        `Sync complete\n` +
          `Scanned: ${res.scanned}\n` +
          `New files: ${res.newFiles}\n` +
          `Duplicates: ${res.duplicates}\n` +
          `Skipped (syllabus): ${res.skippedByAllowlist ?? 0}\n` +
          `Skipped (year): ${res.skippedByYear ?? 0}\n` +
          `Errors: ${res.errors?.length ?? 0}\n` +
          (d
            ? `\nProcessed by pdf-worker:\n` +
              `  Attempted: ${d.attempted}\n` +
              `  Succeeded: ${d.succeeded}\n` +
              `  Failed: ${d.failed}\n` +
              `  Skipped (kind): ${d.skippedKind}`
            : '') +
          (s ? `\nQuestion splits: ${s.totalItems} items across ${s.files} files` : ''),
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
                      <button className="btn" disabled={busy === r.id} onClick={() => process(r.id)}>
                        Re-process pending
                      </button>
                      <button className="btn" disabled={busy === r.id} onClick={() => tag(r.id)}>
                        AI tag
                      </button>
                      <button className="btn btn-danger" disabled={busy === r.id} onClick={() => block(r.id)}>
                        Block
                      </button>
                      <button className="btn btn-danger" disabled={busy === r.id} onClick={() => remove(r.id, r.url)}>
                        Delete
                      </button>
                    </>
                  )}
                  {r.complianceStatus === 'blocked' && (
                    <>
                      <span className="text-xs text-red-600">All derived files / questions are excluded.</span>
                      <button className="btn btn-danger" disabled={busy === r.id} onClick={() => remove(r.id, r.url)}>
                        Delete
                      </button>
                    </>
                  )}
                  {r.complianceStatus === 'pending_review' && (
                    <button className="btn btn-danger" disabled={busy === r.id} onClick={() => remove(r.id, r.url)}>
                      Delete
                    </button>
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
    syllabusAllowlist: '9709, 9702',
    yearAllowlist: '',
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
      const codes = String(form.syllabusAllowlist ?? '')
        .split(/[\s,]+/)
        .map((c: string) => c.trim())
        .filter((c: string) => /^\d{4}$/.test(c));
      if (codes.length > 0) payload.syllabusAllowlist = codes;
      const years = String(form.yearAllowlist ?? '')
        .split(/[\s,]+/)
        .map((c: string) => c.trim())
        .filter((c: string) => /^\d{4}$/.test(c))
        .map((c: string) => Number(c))
        .filter((n: number) => n >= 1990 && n <= 2100);
      if (years.length > 0) payload.yearAllowlist = years;
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600">Syllabus allowlist</label>
          <input
            className="input"
            placeholder="9709, 9702"
            value={form.syllabusAllowlist}
            onChange={(e) => setForm({ ...form, syllabusAllowlist: e.target.value })}
          />
          <div className="text-[11px] text-gray-500 mt-0.5">
            Comma separated CIE codes. Empty = no syllabus gate.
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-600">Year allowlist</label>
          <input
            className="input"
            placeholder="2019, 2020"
            value={form.yearAllowlist}
            onChange={(e) => setForm({ ...form, yearAllowlist: e.target.value })}
          />
          <div className="text-[11px] text-gray-500 mt-0.5">
            Comma separated 4-digit years. Empty = all years.
          </div>
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
