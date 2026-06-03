import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api, downloadPdf } from '../lib/api';
import { MathHtml } from '../components/MathHtml';
import { AuthImage } from '../components/AuthImage';
import { prettifyPaperName } from '../lib/paperName';

export default function PaperEditPage() {
  const { id } = useParams<{ id: string }>();
  const [paper, setPaper] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);
  const [editingPq, setEditingPq] = useState<any>(null);
  const [replacing, setReplacing] = useState<{ pqId: string; candidates: any[] } | null>(null);
  const [busy, setBusy] = useState(false);
  // Fix #14: paper-to-class assign modal.
  const [assigning, setAssigning] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    const [p, v] = await Promise.all([api.getPaper(id), api.validatePaper(id)]);
    setPaper(p); setValidation(v);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  if (!paper) return <div className="text-gray-500">Loading…</div>;

  async function move(pqId: string, dir: -1 | 1) {
    const idx = paper.questions.findIndex((q: any) => q.id === pqId);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= paper.questions.length) return;
    setBusy(true);
    try {
      await api.updatePaperQuestion(id!, pqId, { action: 'reorder', newSortOrder: next });
      await reload();
    } finally { setBusy(false); }
  }

  async function remove(pqId: string) {
    if (!confirm('Delete this question from the paper?')) return;
    setBusy(true);
    try {
      await api.updatePaperQuestion(id!, pqId, { action: 'delete' });
      await reload();
    } finally { setBusy(false); }
  }

  async function startReplace(pqId: string) {
    setBusy(true);
    try {
      const candidates = await api.findReplacements(id!, pqId);
      setReplacing({ pqId, candidates });
    } finally { setBusy(false); }
  }

  async function applyReplace(replacementId: string) {
    if (!replacing) return;
    setBusy(true);
    try {
      await api.updatePaperQuestion(id!, replacing.pqId, { action: 'replace', replacementQuestionId: replacementId });
      setReplacing(null);
      await reload();
    } finally { setBusy(false); }
  }

  async function saveEdit() {
    if (!editingPq) return;
    setBusy(true);
    try {
      await api.updatePaperQuestion(id!, editingPq.id, {
        action: 'edit',
        overrideContent: editingPq.overrideContent || editingPq.snapshotContent,
      });
      setEditingPq(null);
      await reload();
    } finally { setBusy(false); }
  }

  async function publish() {
    if (!confirm('Publish this paper? It will be marked as ready for use.')) return;
    setBusy(true);
    try {
      await api.updatePaper(id!, { status: 'published' });
      await api.saveVersion(id!, 'Published');
      await reload();
    } finally { setBusy(false); }
  }

  function exportPdf(type: 'paper' | 'answer_key') {
    downloadPdf(api.exportUrl(id!, type),
      type === 'answer_key' ? `${paper.name}-answer-key.pdf` : `${paper.name}.pdf`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{prettifyPaperName(paper.name)}</h1>
          <div className="text-sm text-gray-600">
            {paper.subject?.name} · {paper.component?.name || '—'} · {paper.durationMin} min · {paper.totalMarksActual}/{paper.totalMarksTarget} marks ·{' '}
            <span className={`badge ${paper.status === 'published' ? 'badge-success' : ''}`}>{paper.status}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => exportPdf('paper')}>Export PDF</button>
          <button className="btn" onClick={() => exportPdf('answer_key')}>Answer Key PDF</button>
          {/* Fix #14: previously this critical action lived only in the API */}
          <button className="btn" onClick={() => setAssigning(true)}>Assign to class…</button>
          {paper.status !== 'published' && <button className="btn btn-primary" onClick={publish}>Publish</button>}
        </div>
      </div>

      {validation && (
        <div className="card">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-500 uppercase">Total marks</div>
              <div className="text-lg font-bold">{validation.totalMarksActual} / {paper.totalMarksTarget}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Estimated time</div>
              <div className="text-lg font-bold">{validation.estimatedTimeMin.toFixed(0)} / {paper.durationMin} min</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Difficulty (marks)</div>
              <div className="flex gap-2 mt-0.5">
                <span className="badge badge-success">E {validation.difficultySpread.easy}</span>
                <span className="badge">M {validation.difficultySpread.medium}</span>
                <span className="badge badge-warn">H {validation.difficultySpread.hard}</span>
              </div>
            </div>
          </div>
          {validation.warnings?.length > 0 && (
            <div className="mt-3 text-sm">
              <div className="font-semibold text-amber-700">⚠ Warnings</div>
              <ul className="list-disc pl-5 text-xs">
                {validation.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
          {validation.topicCoverage.length > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              Topics: {validation.topicCoverage.map((t: any) => `${t.topicName} (${t.questionCount}q, ${t.marks}m)`).join(' · ')}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {paper.questions.map((pq: any, i: number) => {
          const content = pq.overrideContent ?? pq.snapshotContent;
          const opts = pq.snapshotOptions;
          return (
            <div key={pq.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">Q{i + 1}.</span>
                    <span className="badge">{pq.question.questionType}</span>
                    <span className="badge">[{pq.marks}]</span>
                    <span className="text-xs text-gray-500">{pq.question.primaryTopic?.code} {pq.question.primaryTopic?.name}</span>
                    {pq.overrideContent && <span className="badge badge-warn">edited</span>}
                  </div>
                  <div className="q-stem text-sm">
                    <MathHtml source={content?.stem || ''} />
                  </div>
                  {pq.question.assets && pq.question.assets.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {pq.question.assets.map((a: any) => (
                        <div key={a.id}>
                          <AuthImage src={a.storageUrl} alt={a.altText || ''} />
                          {a.aiGenerated && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              AI · {a.aiModel}
                              {typeof a.aiCostUsd === 'number' && ` · $${a.aiCostUsd.toFixed(3)}`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {opts && Array.isArray(opts) && (
                    <ol className="list-[upper-alpha] ml-6 mt-2 text-sm space-y-0.5">
                      {opts.map((o: any) => (
                        <li key={o.key}>
                          <MathHtml source={o.text} />
                          {o.correct && <span className="ml-2 text-green-700 text-xs">✓</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                  {content?.parts?.length > 0 && (
                    <div className="ml-4 mt-2 space-y-1">
                      {content.parts.map((p: any) => (
                        <div key={p.label} className="text-sm">
                          <span className="font-semibold">({p.label})</span>{' '}
                          <MathHtml source={p.content} /> <span className="text-gray-500 text-xs">[{p.marks}]</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button className="btn text-xs" disabled={busy} onClick={() => move(pq.id, -1)} title="Move up">↑</button>
                  <button className="btn text-xs" disabled={busy} onClick={() => move(pq.id, 1)} title="Move down">↓</button>
                  <button className="btn text-xs" disabled={busy} onClick={() => setEditingPq({ ...pq })}>Edit</button>
                  <button className="btn text-xs" disabled={busy} onClick={() => startReplace(pq.id)}>Replace</button>
                  <button className="btn btn-danger text-xs" disabled={busy} onClick={() => remove(pq.id)}>Delete</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      {editingPq && (
        <Modal onClose={() => setEditingPq(null)} title={`Edit Q${(paper.questions.findIndex((q: any) => q.id === editingPq.id) + 1)}`}>
          <div className="space-y-3">
            <div className="text-xs text-gray-500">Edits here apply only to this paper. The master question in the bank is not modified.</div>
            <textarea className="textarea h-32 font-mono text-sm"
              value={(editingPq.overrideContent ?? editingPq.snapshotContent)?.stem || ''}
              onChange={e => setEditingPq({
                ...editingPq,
                overrideContent: { ...((editingPq.overrideContent ?? editingPq.snapshotContent) || {}), stem: e.target.value },
              })} />
            <div className="card max-h-48 overflow-auto">
              <div className="text-xs text-gray-500 mb-1">Preview:</div>
              <MathHtml source={(editingPq.overrideContent ?? editingPq.snapshotContent)?.stem || ''} />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setEditingPq(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={busy}>Save edit</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Replace modal */}
      {replacing && (
        <Modal onClose={() => setReplacing(null)} title="Replace question">
          <div className="space-y-2">
            <div className="text-xs text-gray-500">Showing same-topic, same-marks, same-difficulty alternatives.</div>
            {replacing.candidates.length === 0 && <div className="text-gray-500">No suitable alternatives.</div>}
            {replacing.candidates.map(c => (
              <div key={c.id} className="card hover:bg-gray-50 cursor-pointer" onClick={() => applyReplace(c.id)}>
                <div className="text-sm"><MathHtml source={c.content?.stem || ''} /></div>
                <div className="text-xs text-gray-500 mt-1">
                  {c.questionType} · {c.marks} marks · diff {c.difficulty} · {c.primaryTopic?.code}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {assigning && id && (
        <AssignModal paperId={id} onClose={() => setAssigning(false)} />
      )}
    </div>
  );
}

function AssignModal({ paperId, onClose }: { paperId: string; onClose: () => void }) {
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [durationMin, setDurationMin] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.listClasses().then(setClasses).catch((e) => setErr(String(e?.message ?? e)));
  }, []);

  async function save() {
    if (!classId) {
      setErr('Pick a class.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      // ISO datetime if provided. Empty => null on the server.
      const body: any = { classId };
      if (startAt) body.startAt = new Date(startAt).toISOString();
      if (dueAt) body.dueAt = new Date(dueAt).toISOString();
      if (durationMin !== '' && Number(durationMin) > 0) body.durationMin = Number(durationMin);
      await api.assignPaperToClass(paperId, body);
      setDone(true);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Assign paper to class">
      {done ? (
        <div className="space-y-3">
          <div className="text-sm text-green-700">Assigned. Students will see this in their My Papers list.</div>
          <div className="flex justify-end">
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-xs text-gray-500">Class</span>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="border rounded px-2 py-1 w-full">
              <option value="">— pick —</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.classCode}) · {c._count?.enrollments ?? 0} students
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-xs text-gray-500">Open at (optional)</span>
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="border rounded px-2 py-1 w-full" />
            </label>
            <label className="block text-sm">
              <span className="text-xs text-gray-500">Due at (optional)</span>
              <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="border rounded px-2 py-1 w-full" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-xs text-gray-500">Time limit (minutes, optional)</span>
            <input
              type="number"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value === '' ? '' : Number(e.target.value))}
              className="border rounded px-2 py-1 w-full"
              min={5}
              max={360}
            />
          </label>
          {err && <div className="text-sm text-red-700">{err}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="border-b px-5 py-3 flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="btn btn-ghost text-xl">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
