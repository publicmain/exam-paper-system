import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, BASE } from '../lib/api';
import AppealReviewModal from '../components/AppealReviewModal';
import { Spinner, ErrorState } from '../components/AsyncState';

/**
 * Marker queue page. Lists submitted submissions that still have ungraded
 * structured scripts. Shows current claim holder if any, with a Claim button
 * (turns into Continue if I already hold the claim, Locked if someone else
 * does).
 */
export default function MarkerQueuePage() {
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  // ROUND 14 — Feature 10: open-appeals state. `appeals` is a flat list
  // of open appeals (status='open' or similar — backend filters); the
  // count per submission is derived from there for the per-row badge,
  // and the modal target picks one appeal to review.
  const [appeals, setAppeals] = useState<any[]>([]);
  const [activeAppeal, setActiveAppeal] = useState<any | null>(null);

  async function load() {
    try {
      const [queue, who, ap] = await Promise.all([
        (api as any).markerQueue
          ? (api as any).markerQueue()
          : fetch(`${BASE}/api/marker/queue`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
            }).then((r) => r.json()),
        api.me(),
        api.morningQuizListAppeals({ status: 'open' }).catch(() => ({ items: [] as any[] })),
      ]);
      setData(queue);
      setMe(who);
      setAppeals(ap?.items ?? []);
    } catch (e: any) {
      setErr(String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Map submissionId → open appeals (so each row can show its count
  // and clicking the badge can pick the first open appeal to review).
  const appealsBySubmission: Record<string, any[]> = {};
  for (const a of appeals) {
    const k = a.submissionId;
    if (!k) continue;
    (appealsBySubmission[k] ||= []).push(a);
  }
  const totalOpenAppeals = appeals.length;

  async function claim(submissionId: string) {
    setBusy(submissionId);
    try {
      const fn = (api as any).markerClaim;
      if (fn) {
        await fn(submissionId);
      } else {
        const r = await fetch(`${BASE}/api/marker/claim`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify({ submissionId }),
        });
        if (!r.ok) throw new Error(await r.text());
      }
      await load();
    } catch (e: any) {
      alert(`Claim failed: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  if (err) return <ErrorState message={err} onRetry={load} />;
  if (!data) return <Spinner label="加载评分队列…" />;
  if (!data.items || data.items.length === 0) {
    // R15-followup-8 — even when the marker queue is empty, the teacher
    // still has work to do if appeals are pending. The previous version
    // returned ONLY the "✅ no submissions" card, hiding open appeals
    // entirely; an appeal filed against an auto-graded paper (where the
    // marker queue stays empty because there were no structured items)
    // had no teacher entry point at all. Now surface the appeals strip
    // here too, with the same AppealReviewModal integration as the
    // populated-queue path.
    return (
      <div className="space-y-3">
        {totalOpenAppeals > 0 && (
          <div className="card border-amber-300 bg-amber-50">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-amber-900">
                📢 待审申诉 · Open Appeals
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300 font-medium">
                {totalOpenAppeals}
              </span>
            </div>
            <ul className="divide-y divide-amber-200">
              {appeals.map((a: any) => (
                <li key={a.id} className="py-2 flex items-start justify-between gap-3">
                  <div className="text-sm min-w-0 flex-1">
                    <div className="text-gray-900 truncate">
                      {a.student?.name ?? a.studentId ?? 'unknown'}
                      {a.paperQuestionSortOrder != null && (
                        <span className="text-gray-500"> · Q{a.paperQuestionSortOrder}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 truncate mt-0.5">
                      {a.message?.slice(0, 100) ?? ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveAppeal(a)}
                    className="shrink-0 text-xs px-2 py-1 rounded bg-amber-200 hover:bg-amber-300 text-amber-900 border border-amber-300 font-medium"
                  >
                    查看 · Review
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-gray-700">No submissions awaiting marking.</div>
        </div>
        {activeAppeal && (
          <AppealReviewModal
            appeal={activeAppeal}
            onClose={() => setActiveAppeal(null)}
            onResolved={() => {
              setActiveAppeal(null);
              load();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">
          Marker Queue
          {/* ROUND 14 — Feature 10: header badge showing open appeals count */}
          {totalOpenAppeals > 0 && (
            <span
              className="ml-3 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300"
              title="待审申诉数量"
            >
              📢 我的待审申诉: {totalOpenAppeals}
            </span>
          )}
        </h1>
        <div className="text-sm text-gray-500">
          {data.total} submission{data.total === 1 ? '' : 's'} awaiting marking
        </div>
      </div>

      {data.items.map((it: any) => {
        const claim = it.claim;
        const claimedByMe = claim && claim.status === 'active' && me && claim.markerId === me.id;
        const claimedByOther = claim && claim.status === 'active' && me && claim.markerId !== me.id;
        // ROUND 14 — Feature 10: per-row appeal badge.
        const rowAppeals = appealsBySubmission[it.id] ?? [];
        return (
          <div key={it.id} className="card flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{it.assignment?.paper?.name ?? 'Paper'}</div>
              <div className="text-xs text-gray-600 mt-1">
                Student: {it.student?.name ?? it.student?.email ?? 'unknown'} · Class:{' '}
                {it.assignment?.class?.name} ({it.assignment?.class?.classCode})
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Submitted: {it.submittedAt ? new Date(it.submittedAt).toLocaleString() : '—'} ·{' '}
                {it.ungradedCount}/{it.structuredCount} structured items ungraded · auto-score:{' '}
                {it.autoScore ?? 0} / {it.maxScore}
              </div>
              {claim && (
                <div className="text-xs mt-1">
                  {claimedByMe ? (
                    <span className="text-green-700">✓ claimed by you</span>
                  ) : claimedByOther ? (
                    <span className="text-amber-700">
                      🔒 claimed by {claim.marker?.name ?? claim.markerId}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 items-end">
              {rowAppeals.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveAppeal(rowAppeals[0])}
                  className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                  title={`${rowAppeals.length} 条未处理申诉,点击查看`}
                >
                  📢 申诉 {rowAppeals.length}
                </button>
              )}
              {claimedByMe ? (
                <Link to={`/marker/submission/${it.id}`} className="btn btn-primary">
                  Continue marking
                </Link>
              ) : claimedByOther ? (
                <button className="btn btn-ghost" disabled>
                  Locked
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  disabled={busy === it.id}
                  onClick={() => claim(it.id)}
                >
                  {busy === it.id ? 'Claiming…' : 'Claim'}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {activeAppeal && (
        <AppealReviewModal
          appeal={activeAppeal}
          onClose={() => setActiveAppeal(null)}
          onResolved={() => {
            setActiveAppeal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
