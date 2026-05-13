import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { MathHtml } from '../components/MathHtml';
import { AuthImage } from '../components/AuthImage';
import RetractQuestionModal from '../components/RetractQuestionModal';
import { clean } from '../components/exam/shared/textUtils';

/**
 * Marker script page. Per-submission view: each structured Q with the
 * student's textAnswer, plus an input for awardedMarks and a textarea for
 * markerComment. Save button calls PATCH per script. When all structured
 * scripts are graded, the Finalize button is enabled.
 */
export default function MarkerScriptPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const nav = useNavigate();
  const [sub, setSub] = useState<any | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Local edit-buffer per script id; flushed on Save.
  const [edits, setEdits] = useState<
    Record<string, { awardedMarks: string; markerComment: string }>
  >({});
  // ROUND 14 — Feature 15: question retraction modal target + local
  // optimistic "已作废" overlay keyed by paperQuestionId so the banner
  // appears before a reload completes.
  const [retracting, setRetracting] = useState<{ pqId: string; label: string } | null>(null);
  const [localRetracted, setLocalRetracted] = useState<Record<string, string>>({});

  const fetchToken = () => localStorage.getItem('auth_token');

  const fetchJson = useCallback(async (path: string, init?: RequestInit) => {
    const r = await fetch(`/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${fetchToken()}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!r.ok) throw new Error(await r.text());
    if (r.status === 204) return null;
    return r.json();
  }, []);

  const load = useCallback(async () => {
    if (!submissionId) return;
    try {
      const fn = (api as any).markerSubmission;
      const data = fn ? await fn(submissionId) : await fetchJson(`/marker/submissions/${submissionId}`);
      setSub(data);
      // Seed edits from existing scores.
      const e: Record<string, any> = {};
      for (const s of data.scripts ?? []) {
        e[s.id] = {
          awardedMarks: s.awardedMarks == null ? '' : String(s.awardedMarks),
          markerComment: s.markerComment ?? '',
        };
      }
      setEdits(e);
    } catch (ex: any) {
      setErr(String(ex));
    }
  }, [submissionId, fetchJson]);

  useEffect(() => {
    load();
  }, [load]);

  if (err) return <div className="card text-red-700">{err}</div>;
  if (!sub) return <div className="text-gray-500">Loading…</div>;

  const paper = sub.assignment?.paper;
  const myClaim = sub.myClaim;
  const status = sub.status;

  async function saveScript(scriptId: string) {
    const v = edits[scriptId];
    if (!v) return;
    if (v.awardedMarks === '' || isNaN(Number(v.awardedMarks))) {
      alert('Please enter a numeric mark.');
      return;
    }
    setBusy(scriptId);
    try {
      const fn = (api as any).markerScoreScript;
      const body = {
        awardedMarks: Number(v.awardedMarks),
        markerComment: v.markerComment || null,
      };
      if (fn) {
        await fn(scriptId, body);
      } else {
        await fetchJson(`/marker/scripts/${scriptId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
      await load();
    } catch (ex: any) {
      alert(`Save failed: ${String(ex)}`);
    } finally {
      setBusy(null);
    }
  }

  /** Bug 11: surface a "Claim this submission" entry point on the
   *  marker page when the current user doesn't hold the claim. Previously
   *  the marker had to first navigate to /marker (queue page) and click
   *  claim there — discoverability was poor and users hit the "scoring
   *  is read-only" banner without knowing what to do. */
  async function claim() {
    if (!submissionId) return;
    setBusy('claim');
    try {
      await api.markerClaim(submissionId);
      await load();
    } catch (ex: any) {
      alert(`Claim failed: ${String(ex?.message ?? ex)}`);
    } finally {
      setBusy(null);
    }
  }

  async function release() {
    if (!confirm('Release the claim on this submission? Another marker can pick it up.')) return;
    setBusy('release');
    try {
      const fn = (api as any).markerRelease;
      if (fn) await fn(submissionId!);
      else
        await fetchJson('/marker/release', {
          method: 'POST',
          body: JSON.stringify({ submissionId }),
        });
      nav('/marker');
    } catch (ex: any) {
      alert(`Release failed: ${String(ex)}`);
    } finally {
      setBusy(null);
    }
  }

  async function finalize() {
    if (!confirm('Finalize this submission? totalScore will be computed and locked.')) return;
    setBusy('finalize');
    try {
      const fn = (api as any).markerFinalize;
      const updated = fn
        ? await fn(submissionId!)
        : await fetchJson(`/marker/finalize/${submissionId}`, { method: 'POST' });
      alert(
        `Finalized. autoScore=${updated.autoScore ?? 0}, manualScore=${updated.manualScore ?? 0}, totalScore=${updated.totalScore ?? 0}`,
      );
      nav('/marker');
    } catch (ex: any) {
      alert(`Finalize failed: ${String(ex)}`);
    } finally {
      setBusy(null);
    }
  }

  const structuredScripts = (sub.scripts ?? []).filter(
    (s: any) =>
      ['structured', 'short_answer', 'essay'].includes(s.paperQuestion?.question?.questionType),
  );
  const allGraded = structuredScripts.length > 0 && structuredScripts.every((s: any) => s.awardedMarks != null);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{paper?.name ?? 'Paper'}</h1>
            <div className="text-xs text-gray-600 mt-1">
              Student: {sub.student?.name ?? sub.student?.email} · Class:{' '}
              {sub.assignment?.class?.name} ({sub.assignment?.class?.classCode})
            </div>
            <div className="text-xs text-gray-600">
              Status: <span className="badge">{status}</span> · auto-score: {sub.autoScore ?? 0} / {sub.maxScore}
              {sub.manualScore != null && ` · manual: ${sub.manualScore}`}
              {sub.totalScore != null && ` · total: ${sub.totalScore}`}
            </div>
          </div>
          <div className="flex gap-2">
            {status === 'submitted' && myClaim && (
              <button className="btn btn-ghost" onClick={release} disabled={busy === 'release'}>
                Release claim
              </button>
            )}
            {status === 'submitted' && myClaim && (
              <button
                className="btn btn-primary"
                onClick={finalize}
                disabled={!allGraded || busy === 'finalize'}
                title={allGraded ? 'Finalize submission' : 'Score every structured script first'}
              >
                {busy === 'finalize' ? 'Finalizing…' : 'Finalize'}
              </button>
            )}
          </div>
        </div>
        {!myClaim && status === 'submitted' && (
          <div className="mt-2 text-amber-700 text-sm flex items-center justify-between gap-2">
            <span>⚠ You don't hold the marker claim on this submission. Scoring is read-only.</span>
            <button
              className="btn btn-primary text-xs"
              onClick={claim}
              disabled={busy === 'claim'}
              title="把这份卷子领下来, 之后才能改分"
            >
              {busy === 'claim' ? '认领中…' : '🖐 认领这份 / Claim'}
            </button>
          </div>
        )}
      </div>

      {(paper?.questions ?? []).map((pq: any, i: number) => {
        const script = (sub.scripts ?? []).find((s: any) => s.paperQuestionId === pq.id);
        const qType = pq.question?.questionType;
        const isMcq = qType === 'mcq';
        const content = pq.snapshotContent ?? {};
        const opts = pq.snapshotOptions ?? pq.question?.options;
        const v = script ? edits[script.id] ?? { awardedMarks: '', markerComment: '' } : null;
        // ROUND 14 — Feature 15: question retraction state. Server-side
        // `retractedAt` / `retractedReason` if present win; local optimistic
        // state from this session also counts.
        const retractedReason: string | null =
          pq.retractedReason ?? localRetracted[pq.id] ?? null;
        const isRetracted = !!retractedReason || !!pq.retractedAt;

        return (
          <div key={pq.id} className="card">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-bold">Q{i + 1}.</span>
              <span className="badge">{qType}</span>
              <span className="badge">[{pq.marks} marks]</span>
              {script?.autoCorrect != null && (
                <span className={`badge ${script.autoCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                  {script.autoCorrect ? 'auto: correct' : 'auto: incorrect'}
                </span>
              )}
              {script?.awardedMarks != null && (
                <span className="badge bg-blue-100">awarded: {script.awardedMarks}</span>
              )}
              {!isRetracted && paper?.id && (
                <button
                  type="button"
                  className="ml-auto text-xs text-rose-600 hover:text-rose-800 hover:underline"
                  onClick={() => setRetracting({ pqId: pq.id, label: `Q${i + 1}` })}
                  title="作废此题 — 给所有学生加满分或仅标记无效"
                >
                  🚫 作废此题
                </button>
              )}
            </div>
            {isRetracted && (
              <div className="mb-2 px-3 py-2 bg-rose-50 border border-rose-300 text-rose-800 rounded text-sm">
                已作废: {retractedReason ?? '(无原因记录)'} · 该题不再计分
              </div>
            )}
            {/* R15-Audit#3 — markers couldn't judge short-answer
                comprehension because the passage wasn't rendered here.
                The student saw the passage in the take-paper UI but
                the marker UI only showed the stem. Now we render the
                passage in a collapsible card so markers can verify
                the answer against the source text. */}
            {typeof content.passage === 'string' && content.passage.length > 0 && (
              <details className="mb-3 bg-gray-50 border border-gray-200 rounded">
                <summary className="cursor-pointer px-3 py-2 text-xs uppercase tracking-wide text-gray-600 font-semibold select-none">
                  📖 Passage · {clean(content.passageTitle ?? 'Source text')}
                </summary>
                <div className="px-4 py-3 text-sm text-gray-800 font-serif leading-[1.7] whitespace-pre-wrap border-t border-gray-200">
                  {content.passage}
                </div>
              </details>
            )}
            <div className="text-sm">
              <MathHtml source={content.stem ?? ''} />
            </div>
            {pq.question?.assets?.length > 0 && (
              <div className="mt-2 space-y-2">
                {pq.question.assets.map((a: any) => (
                  <AuthImage key={a.id} src={a.storageUrl} alt={a.altText ?? ''} />
                ))}
              </div>
            )}
            {!isMcq && content.parts?.length > 0 && (
              <div className="ml-2 mt-2 text-sm space-y-1">
                {content.parts.map((p: any) => (
                  <div key={p.label}>
                    <span className="font-semibold">({p.label})</span> <MathHtml source={p.content} />
                    <span className="text-xs text-gray-500 ml-2">[{p.marks}]</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 border-t pt-3">
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                Student answer
              </div>
              {isMcq ? (
                <div className="text-sm">
                  Selected option: <span className="font-mono">{script?.selectedOption ?? '—'}</span>
                  {Array.isArray(opts) && (
                    <ul className="mt-1 ml-4 text-xs text-gray-600">
                      {opts.map((o: any) => (
                        <li key={o.key}>
                          <span className="font-mono">{o.key}.</span>{' '}
                          <span className={o.correct ? 'text-green-700' : ''}>
                            {o.text} {o.correct ? '✓' : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm bg-gray-50 p-2 rounded">
                  {script?.textAnswer ?? <span className="text-gray-400">— blank —</span>}
                </pre>
              )}
            </div>

            {!isMcq && script && (
              <div className="mt-3 border-t pt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold">Marks</label>
                  <input
                    type="number"
                    min={0}
                    max={pq.marks}
                    step="0.5"
                    className="border rounded px-2 py-1 w-24 text-sm"
                    value={v?.awardedMarks ?? ''}
                    disabled={!myClaim || status !== 'submitted' || isRetracted}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [script.id]: { ...(prev[script.id] ?? { markerComment: '' }), awardedMarks: e.target.value },
                      }))
                    }
                  />
                  <span className="text-xs text-gray-500">/ {pq.marks}</span>
                </div>
                <textarea
                  className="w-full border rounded p-2 text-sm font-sans"
                  placeholder="Marker comment (optional)"
                  rows={3}
                  value={v?.markerComment ?? ''}
                  disabled={!myClaim || status !== 'submitted' || isRetracted}
                  onChange={(e) =>
                    setEdits((prev) => ({
                      ...prev,
                      [script.id]: { ...(prev[script.id] ?? { awardedMarks: '' }), markerComment: e.target.value },
                    }))
                  }
                />
                <div>
                  <button
                    className="btn btn-primary"
                    disabled={!myClaim || status !== 'submitted' || busy === script.id || isRetracted}
                    onClick={() => saveScript(script.id)}
                  >
                    {busy === script.id ? 'Saving…' : 'Save score'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ROUND 14 — Feature 15: question retraction modal */}
      {retracting && paper?.id && (
        <RetractQuestionModal
          paperId={paper.id}
          paperQuestionId={retracting.pqId}
          questionLabel={retracting.label}
          onClose={() => setRetracting(null)}
          onDone={(r) => {
            setLocalRetracted((prev) => ({ ...prev, [retracting.pqId]: r.reason }));
            // Reload async so server-side retractedReason replaces the
            // optimistic local one once persisted.
            load();
          }}
        />
      )}
    </div>
  );
}
