import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

/**
 * Teacher tool: pick a paper assignment, generate variants for the
 * class, then preview which student got which question order /
 * option shuffle.
 *
 * Why this page calls fetch directly instead of going through
 * lib/api.ts:
 *   lib/api.ts is owned by another track (frontend agent) and
 *   marked read-only for B7. To avoid touching it, the variant
 *   endpoints are called via raw fetch with the same auth-header
 *   helper pattern.
 */

const BASE = (import.meta as any).env?.VITE_API_URL || '';

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

async function jsonFetch(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `${method} ${path} failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

interface Assignment {
  id: string;
  paper?: { id: string; name: string };
  class?: { id: string; name: string };
}

interface VariantRow {
  id: string;
  studentId: string;
  seed: number;
  questionOrder: string[];
  optionShuffles: Record<string, Record<string, string>>;
  generatedAt: string;
  student?: { id: string; name: string; email: string };
}

export default function VariantPreviewPage() {
  const [papers, setPapers] = useState<any[]>([]);
  const [paperId, setPaperId] = useState<string>('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentId, setAssignmentId] = useState<string>('');
  const [mode, setMode] = useState<'shuffle_options' | 'shuffle_questions' | 'both'>('both');
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [selected, setSelected] = useState<VariantRow | null>(null);
  const [paperDetail, setPaperDetail] = useState<any | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // ---- step 1: pick a paper ----
  useEffect(() => {
    api.listPapers().then(setPapers).catch((e: any) => setErr(String(e)));
  }, []);

  // ---- step 2: load that paper's assignments + full structure ----
  useEffect(() => {
    if (!paperId) {
      setAssignments([]);
      setAssignmentId('');
      setPaperDetail(null);
      return;
    }
    (async () => {
      try {
        const detail = await api.getPaper(paperId);
        setPaperDetail(detail);
        setAssignments((detail?.assignments ?? []) as Assignment[]);
        setAssignmentId('');
        setVariants([]);
        setSelected(null);
      } catch (e: any) { setErr(String(e)); }
    })();
  }, [paperId]);

  // ---- step 3: load existing variants for the chosen assignment ----
  useEffect(() => {
    if (!assignmentId) { setVariants([]); setSelected(null); return; }
    (async () => {
      try {
        const rows: VariantRow[] = await jsonFetch('GET', `/paper-variants/assignment/${assignmentId}`);
        setVariants(rows ?? []);
        setSelected(null);
      } catch (e: any) { setErr(String(e)); }
    })();
  }, [assignmentId]);

  async function generate() {
    if (!assignmentId) return;
    setBusy('generate');
    setErr(null);
    setInfo(null);
    try {
      const r = await jsonFetch('POST', '/paper-variants/generate-for-class', { assignmentId, mode });
      setInfo(`Generated ${r.studentsProcessed} variant(s) in mode "${r.mode}".`);
      const rows: VariantRow[] = await jsonFetch('GET', `/paper-variants/assignment/${assignmentId}`);
      setVariants(rows ?? []);
    } catch (e: any) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  }

  /** Pre-compute lookup of paperQuestionId → display info for the
   *  selected paper, so the "Preview" panel below can resolve a
   *  student's questionOrder array into stems + options. */
  const pqIndex = useMemo(() => {
    const map: Record<string, any> = {};
    for (const pq of paperDetail?.questions ?? []) {
      map[pq.id] = pq;
    }
    return map;
  }, [paperDetail]);

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-xl font-bold">Paper Variants (anti-cheat)</h1>
        <p className="text-sm text-gray-600 mt-1">
          Generate per-student variants of an assigned paper so adjacent
          students see different MCQ option letters and / or different
          question orders. Variants are deterministic: a student who
          refreshes mid-exam will see the same form.
        </p>
      </div>

      {err && <div className="card text-red-700">{err}</div>}
      {info && <div className="card text-green-700">{info}</div>}

      <div className="card space-y-3">
        <div>
          <label className="block text-sm font-semibold mb-1">Paper</label>
          <select
            className="border rounded px-2 py-1 text-sm w-full"
            value={paperId}
            onChange={(e) => setPaperId(e.target.value)}
          >
            <option value="">— pick a paper —</option>
            {papers.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {paperId && (
          <div>
            <label className="block text-sm font-semibold mb-1">Assignment (class binding)</label>
            <select
              className="border rounded px-2 py-1 text-sm w-full"
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
            >
              <option value="">— pick an assignment —</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.class?.name ?? a.id}
                </option>
              ))}
            </select>
            {assignments.length === 0 && (
              <div className="text-xs text-gray-500 mt-1">
                No assignments for this paper yet. Assign it to a class first.
              </div>
            )}
          </div>
        )}

        {assignmentId && (
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Mode</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
              >
                <option value="both">Shuffle questions + MCQ options</option>
                <option value="shuffle_questions">Shuffle question order only</option>
                <option value="shuffle_options">Shuffle MCQ option letters only</option>
              </select>
            </div>
            <button
              className="btn btn-primary"
              disabled={busy === 'generate'}
              onClick={generate}
            >
              {busy === 'generate' ? 'Generating…' : 'Generate variants for class'}
            </button>
          </div>
        )}
      </div>

      {variants.length > 0 && (
        <div className="card">
          <h2 className="font-bold mb-2">Variants ({variants.length})</h2>
          <div className="overflow-x-auto">
            <table className="text-sm w-full">
              <thead className="text-left text-gray-600">
                <tr>
                  <th className="py-1 pr-3">Student</th>
                  <th className="py-1 pr-3">Email</th>
                  <th className="py-1 pr-3">Seed</th>
                  <th className="py-1 pr-3">Question count</th>
                  <th className="py-1 pr-3">Option-shuffled MCQs</th>
                  <th className="py-1 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="py-1 pr-3">{v.student?.name ?? v.studentId}</td>
                    <td className="py-1 pr-3 text-gray-600">{v.student?.email ?? ''}</td>
                    <td className="py-1 pr-3 font-mono text-xs">{v.seed}</td>
                    <td className="py-1 pr-3">{(v.questionOrder ?? []).length}</td>
                    <td className="py-1 pr-3">{Object.keys(v.optionShuffles ?? {}).length}</td>
                    <td className="py-1 pr-3">
                      <button className="btn btn-ghost text-xs" onClick={() => setSelected(v)}>Preview</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">
              Preview: {selected.student?.name ?? selected.studentId}
            </h2>
            <button className="btn btn-ghost text-xs" onClick={() => setSelected(null)}>Close</button>
          </div>
          <div className="text-xs text-gray-600 mb-3">
            Seed {selected.seed} · {selected.questionOrder.length} questions
          </div>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            {selected.questionOrder.map((pqId, idx) => {
              const pq = pqIndex[pqId];
              const isMcq = pq?.question?.questionType === 'mcq';
              const optsOrig = (pq?.snapshotOptions ?? pq?.question?.options) as Array<{ key: string; text: string }> | undefined;
              const map = selected.optionShuffles?.[pqId] ?? null;
              return (
                <li key={pqId}>
                  <div className="font-mono text-xs text-gray-500">pq={pqId.slice(0, 8)}…</div>
                  <div className="text-gray-800">
                    {(pq?.snapshotContent?.stem ?? pq?.question?.content?.stem ?? '(stem unavailable)').toString().slice(0, 200)}
                  </div>
                  {isMcq && Array.isArray(optsOrig) && (
                    <div className="ml-4 mt-1 text-xs text-gray-700 space-y-0.5">
                      {optsOrig.map((o) => {
                        const display = map?.[o.key] ?? o.key;
                        return (
                          <div key={o.key}>
                            <span className="font-mono">{display}.</span>{' '}
                            <span className="text-gray-500">(was {o.key})</span>{' '}
                            {o.text}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {idx === 0 && <span className="sr-only">first</span>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
