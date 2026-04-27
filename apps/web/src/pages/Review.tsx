import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const STATUS_OPTIONS = [
  { value: 'pending_review', label: 'Pending review' },
  { value: 'needs_human_review', label: 'Needs human review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'on_hold', label: 'On hold' },
];

export default function ReviewPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ syllabusCode?: string; status?: string; page: number }>({
    syllabusCode: '',
    status: 'pending_review',
    page: 1,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listReviewItems({
        syllabusCode: filter.syllabusCode || undefined,
        status: filter.status,
        page: filter.page,
        pageSize: 25,
      });
      setItems(res.items);
      setTotal(res.total);
      if (res.items.length > 0 && !selectedId) setSelectedId(res.items[0].id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [filter.syllabusCode, filter.status, filter.page]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review queue</h1>
          <p className="text-sm text-gray-600">
            QuestionItems extracted from past papers. Approve to mirror into the live question bank.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="syllabus (e.g. 9702)"
            value={filter.syllabusCode}
            onChange={(e) => setFilter({ ...filter, syllabusCode: e.target.value, page: 1 })}
            style={{ width: 160 }}
          />
          <select
            className="select"
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value, page: 1 })}
            style={{ width: 200 }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <div className="card" style={{ background: '#fee2e2', borderColor: '#fecaca' }}>
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}
      <div className="grid gap-3" style={{ gridTemplateColumns: '320px 1fr' }}>
        <div className="card p-0 overflow-hidden">
          <div className="border-b text-xs px-3 py-2 text-gray-600">
            {loading ? 'Loading…' : `${items.length} of ${total}`}
          </div>
          <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => setSelectedId(it.id)}
                className={`w-full text-left px-3 py-2 border-b text-sm hover:bg-gray-50 ${
                  selectedId === it.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="font-mono text-xs text-gray-500">
                  {it.sourceFile?.syllabusCode}/{it.sourceFile?.paperVariant} ·{' '}
                  {it.sourceFile?.examSeason}
                  {String(it.sourceFile?.examYear ?? '').slice(-2)}
                </div>
                <div className="font-medium">
                  Q{it.questionNumber ?? '?'}
                  {it.suggestedType && (
                    <span className="ml-2 text-xs text-gray-500">{it.suggestedType}</span>
                  )}
                  {it.suggestedMarks && (
                    <span className="ml-1 text-xs text-gray-500">[{it.suggestedMarks}]</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {(it.rawExtractedText ?? '').slice(0, 80)}
                </div>
              </button>
            ))}
            {!loading && items.length === 0 && (
              <div className="px-3 py-6 text-sm text-gray-500">Nothing in this state.</div>
            )}
          </div>
          {total > 25 && (
            <div className="border-t flex justify-between items-center px-3 py-2 text-xs">
              <button
                className="btn btn-ghost"
                disabled={filter.page <= 1}
                onClick={() => setFilter({ ...filter, page: filter.page - 1 })}
              >
                ← Prev
              </button>
              <span>Page {filter.page}</span>
              <button
                className="btn btn-ghost"
                disabled={filter.page * 25 >= total}
                onClick={() => setFilter({ ...filter, page: filter.page + 1 })}
              >
                Next →
              </button>
            </div>
          )}
        </div>
        <div>
          {selectedId ? (
            <ReviewDetail id={selectedId} onChanged={refresh} />
          ) : (
            <div className="card text-gray-500">Select an item from the list.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [item, setItem] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<any>({});

  async function load() {
    setError(null);
    try {
      const data = await api.getReviewItem(id);
      setItem(data);
      setEdit({
        questionNumber: data.questionNumber ?? '',
        rawExtractedText: data.rawExtractedText ?? '',
        suggestedType: data.suggestedType ?? '',
        suggestedMarks: data.suggestedMarks ?? '',
        suggestedDifficulty: data.suggestedDifficulty ?? '',
        suggestedTopicCode: data.suggestedTopicCode ?? '',
      });
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.updateReviewItem(id, {
        questionNumber: edit.questionNumber || null,
        rawExtractedText: edit.rawExtractedText || null,
        suggestedType: edit.suggestedType || null,
        suggestedMarks: edit.suggestedMarks ? Number(edit.suggestedMarks) : null,
        suggestedDifficulty: edit.suggestedDifficulty ? Number(edit.suggestedDifficulty) : null,
        suggestedTopicCode: edit.suggestedTopicCode || null,
      });
      await load();
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await api.approveReviewItem(id);
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    const reason = prompt('Reject reason (optional):') ?? undefined;
    setBusy(true);
    setError(null);
    try {
      await api.rejectReviewItem(id, reason || undefined);
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!item) return <div className="card text-gray-500">Loading…</div>;

  const sf = item.sourceFile;
  const pages = (sf?.pages ?? []).filter(
    (p: any) =>
      (item.pageStart == null || p.pageNo >= item.pageStart) &&
      (item.pageEnd == null || p.pageNo <= item.pageEnd),
  );

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-xs text-gray-500">
            {sf?.rawFilename} · pages {item.pageStart ?? '?'}–{item.pageEnd ?? '?'}
          </div>
          <div className="text-lg font-bold">
            Q{item.questionNumber ?? '?'} ·{' '}
            <span className="text-sm font-normal text-gray-600">
              status: {item.reviewStatus} · compliance: {item.complianceStatus}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={save} disabled={busy}>
            Save edits
          </button>
          <button className="btn btn-danger" onClick={reject} disabled={busy}>
            Reject
          </button>
          <button className="btn btn-primary" onClick={approve} disabled={busy}>
            {busy ? '…' : 'Approve → bank'}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-700">{error}</div>}

      <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="space-y-2">
          <label className="text-xs text-gray-600">Extracted text</label>
          <textarea
            className="input font-mono text-xs"
            rows={20}
            value={edit.rawExtractedText}
            onChange={(e) => setEdit({ ...edit, rawExtractedText: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-600">Q#</label>
              <input
                className="input"
                value={edit.questionNumber}
                onChange={(e) => setEdit({ ...edit, questionNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Type</label>
              <select
                className="select"
                value={edit.suggestedType}
                onChange={(e) => setEdit({ ...edit, suggestedType: e.target.value })}
              >
                <option value="">—</option>
                <option value="mcq">MCQ</option>
                <option value="short_answer">Short answer</option>
                <option value="structured">Structured</option>
                <option value="essay">Essay</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Marks</label>
              <input
                className="input"
                type="number"
                value={edit.suggestedMarks}
                onChange={(e) => setEdit({ ...edit, suggestedMarks: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Difficulty</label>
              <input
                className="input"
                type="number"
                min={1}
                max={5}
                value={edit.suggestedDifficulty}
                onChange={(e) => setEdit({ ...edit, suggestedDifficulty: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600">Topic code</label>
              <input
                className="input"
                value={edit.suggestedTopicCode}
                onChange={(e) => setEdit({ ...edit, suggestedTopicCode: e.target.value })}
              />
            </div>
          </div>
          {item.markSchemeItems?.length > 0 && (
            <div>
              <div className="text-xs text-gray-600 font-semibold mt-3">
                Linked mark scheme ({item.markSchemeItems.length} part{item.markSchemeItems.length > 1 ? 's' : ''})
              </div>
              {item.markSchemeItems.map((m: any) => (
                <div key={m.id} className="text-xs bg-gray-50 p-2 rounded my-1 whitespace-pre-wrap">
                  {m.partLabel && (
                    <span className="inline-block font-mono font-semibold text-blue-700 mr-2">
                      {m.partLabel}
                    </span>
                  )}
                  <span className="font-mono mr-2">[{m.marks}]</span>
                  {m.pointText}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2 overflow-auto" style={{ maxHeight: '70vh' }}>
          <label className="text-xs text-gray-600">Source page(s)</label>
          {pages.length === 0 && (
            <div className="text-sm text-gray-500">No rendered pages for this range.</div>
          )}
          {pages.map((p: any) => (
            <AuthImage key={p.pageNo} src={p.imageUrl} alt={`page ${p.pageNo}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Image that fetches with the JWT and renders as a blob URL. The
 * /api/source-files/:id/pages/:n route requires auth, which native
 * <img> tags cannot supply via headers. We also prepend VITE_API_URL
 * because PdfPage.imageUrl is stored as a relative path on the API
 * (the API doesn't know the public host); without the prefix the
 * browser resolves against the WEB origin and gets a 404.
 */
function AuthImage({ src, alt }: { src: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;
    const token = localStorage.getItem('auth_token');
    const base = (import.meta as any).env?.VITE_API_URL || '';
    const fullSrc = src.startsWith('http') ? src : `${base}${src}`;
    fetch(fullSrc, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        const blob = await r.blob();
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
      })
      .catch((e) => !cancelled && setErr(String(e)));
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [src]);

  if (err) return <div className="text-xs text-red-600">image: {err}</div>;
  if (!url) return <div className="text-xs text-gray-400">loading image…</div>;
  return <img src={url} alt={alt} className="border rounded w-full" />;
}
