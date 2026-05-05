import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

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

  async function load() {
    try {
      const [queue, who] = await Promise.all([
        (api as any).markerQueue
          ? (api as any).markerQueue()
          : fetch('/api/marker/queue', {
              headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
            }).then((r) => r.json()),
        api.me(),
      ]);
      setData(queue);
      setMe(who);
    } catch (e: any) {
      setErr(String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function claim(submissionId: string) {
    setBusy(submissionId);
    try {
      const fn = (api as any).markerClaim;
      if (fn) {
        await fn(submissionId);
      } else {
        const r = await fetch('/api/marker/claim', {
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

  if (err) return <div className="card text-red-700">{err}</div>;
  if (!data) return <div className="text-gray-500">Loading…</div>;
  if (!data.items || data.items.length === 0) {
    return (
      <div className="card text-center py-12">
        <div className="text-4xl mb-3">✅</div>
        <div className="text-gray-700">No submissions awaiting marking.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Marker Queue</h1>
        <div className="text-sm text-gray-500">
          {data.total} submission{data.total === 1 ? '' : 's'} awaiting marking
        </div>
      </div>

      {data.items.map((it: any) => {
        const claim = it.claim;
        const claimedByMe = claim && claim.status === 'active' && me && claim.markerId === me.id;
        const claimedByOther = claim && claim.status === 'active' && me && claim.markerId !== me.id;
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
    </div>
  );
}
