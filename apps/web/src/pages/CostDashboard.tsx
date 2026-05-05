import { useEffect, useMemo, useState } from 'react';

/**
 * Admin-only AI cost dashboard.
 *
 * Shows total spend, top spenders by user, and a daily timeseries.
 *
 * Endpoint design: this page calls the backend directly via fetch()
 * rather than going through `lib/api.ts`. That's deliberate — B6 owns
 * its own page surface but is not allowed to modify the shared api
 * module (other agents depend on it). The lightweight `req()` helper
 * below mirrors the auth + JSON conventions of `lib/api.ts` so the
 * behaviour is identical.
 */

const BASE = (import.meta as any).env?.VITE_API_URL || '';

function token(): string | null {
  return localStorage.getItem('auth_token');
}

async function req<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

interface Summary {
  from: string;
  to: string;
  callCount: number;
  totalUsd: number;
  anthropicUsd: number;
  openaiImageUsd: number;
  svgUsd: number;
  anthropicInputTokens: number;
  anthropicOutputTokens: number;
  byModel: { model: string; calls: number; usd: number }[];
}

interface ByUser {
  from: string;
  to: string;
  users: {
    userId: string | null;
    email: string;
    name: string;
    role: string | null;
    calls: number;
    usd: number;
  }[];
}

interface ByDay {
  days: number;
  from: string;
  to: string;
  series: {
    date: string;
    calls: number;
    usd: number;
    anthropicUsd: number;
    openaiUsd: number;
  }[];
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0';
  if (Math.abs(n) >= 100) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export default function CostDashboardPage() {
  const [from, setFrom] = useState<string>(daysAgoIso(30));
  const [to, setTo] = useState<string>(todayIso());
  const [days, setDays] = useState<number>(30);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [byUser, setByUser] = useState<ByUser | null>(null);
  const [byDay, setByDay] = useState<ByDay | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [s, u, d] = await Promise.all([
        req<Summary>(`/admin-cost/summary?from=${from}&to=${to}`),
        req<ByUser>(`/admin-cost/by-user?from=${from}&to=${to}`),
        req<ByDay>(`/admin-cost/by-day?days=${days}`),
      ]);
      setSummary(s);
      setByUser(u);
      setByDay(d);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxBar = useMemo(() => {
    const series = byDay?.series ?? [];
    return series.reduce((m, s) => (s.usd > m ? s.usd : m), 0) || 1;
  }, [byDay]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Cost Dashboard</h1>
        <div className="flex items-end gap-2 text-sm">
          <label className="flex flex-col">
            <span className="text-xs text-gray-500">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-xs text-gray-500">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-xs text-gray-500">Daily window</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="border rounded px-2 py-1"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          <button className="btn btn-primary" onClick={refresh} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="card">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Total spend</div>
          <div className="text-3xl font-bold mt-1">{summary ? fmtUsd(summary.totalUsd) : '—'}</div>
          <div className="text-xs text-gray-500 mt-1">{summary?.callCount ?? 0} AI calls</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Anthropic</div>
          <div className="text-3xl font-bold mt-1">{summary ? fmtUsd(summary.anthropicUsd) : '—'}</div>
          <div className="text-xs text-gray-500 mt-1">
            in: {(summary?.anthropicInputTokens ?? 0).toLocaleString()} tok ·
            {' '}out: {(summary?.anthropicOutputTokens ?? 0).toLocaleString()} tok
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500 uppercase tracking-wide">OpenAI Image</div>
          <div className="text-3xl font-bold mt-1">{summary ? fmtUsd(summary.openaiImageUsd) : '—'}</div>
          <div className="text-xs text-gray-500 mt-1">image generation</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500 uppercase tracking-wide">SVG (free)</div>
          <div className="text-3xl font-bold mt-1">{summary ? fmtUsd(summary.svgUsd) : '—'}</div>
          <div className="text-xs text-gray-500 mt-1">in-process renders</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold mb-3">Top spenders</h2>
          {!byUser && <div className="text-gray-500 text-sm">Loading…</div>}
          {byUser && byUser.users.length === 0 && (
            <div className="text-gray-500 text-sm py-4 text-center">
              No AI activity in this window.
            </div>
          )}
          {byUser && byUser.users.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase">
                <tr className="text-left">
                  <th className="py-1">User</th>
                  <th className="py-1">Role</th>
                  <th className="py-1 text-right">Calls</th>
                  <th className="py-1 text-right">Spend</th>
                </tr>
              </thead>
              <tbody>
                {byUser.users.slice(0, 15).map((u, i) => (
                  <tr key={u.userId ?? `sys-${i}`} className="border-t">
                    <td className="py-1.5">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </td>
                    <td className="py-1.5">
                      {u.role && <span className="badge">{u.role}</span>}
                    </td>
                    <td className="py-1.5 text-right">{u.calls}</td>
                    <td className="py-1.5 text-right font-mono">{fmtUsd(u.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold mb-3">Daily spend (last {days} days)</h2>
          {!byDay && <div className="text-gray-500 text-sm">Loading…</div>}
          {byDay && (
            <div className="space-y-1">
              {byDay.series.map((s) => {
                const pct = (s.usd / maxBar) * 100;
                return (
                  <div key={s.date} className="flex items-center gap-2 text-xs">
                    <div className="w-20 text-gray-500 font-mono">{s.date}</div>
                    <div className="flex-1 bg-gray-100 rounded h-4 relative overflow-hidden">
                      <div
                        className="bg-blue-500 h-full"
                        style={{ width: `${pct}%` }}
                        title={`anthropic ${fmtUsd(s.anthropicUsd)}, openai ${fmtUsd(s.openaiUsd)}`}
                      />
                    </div>
                    <div className="w-20 text-right font-mono">{fmtUsd(s.usd)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">By model</h2>
        {!summary && <div className="text-gray-500 text-sm">Loading…</div>}
        {summary && summary.byModel.length === 0 && (
          <div className="text-gray-500 text-sm py-4 text-center">No data.</div>
        )}
        {summary && summary.byModel.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase">
              <tr className="text-left">
                <th className="py-1">Model / action</th>
                <th className="py-1 text-right">Calls</th>
                <th className="py-1 text-right">Spend</th>
              </tr>
            </thead>
            <tbody>
              {summary.byModel.map((m) => (
                <tr key={m.model} className="border-t">
                  <td className="py-1.5 font-mono">{m.model}</td>
                  <td className="py-1.5 text-right">{m.calls}</td>
                  <td className="py-1.5 text-right font-mono">{fmtUsd(m.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
