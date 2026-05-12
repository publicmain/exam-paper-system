import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';

/**
 * ROUND 14 — Feature 8: Audit log viewer.
 *
 * Generic paginated table over the AuditLog table. Filterable by action
 * (free-text), actor id, entity-type, and date range. Used by admins to
 * trace bulk-correction storms, mysterious soft-deletes, transfer events,
 * etc.
 */

interface AuditRow {
  id: string;
  createdAt: string;
  action: string;
  actorId: string | null;
  actor?: { id: string; name?: string; email?: string };
  entityType: string | null;
  entityId: string | null;
  metadata: any;
}

const PAGE_SIZE = 50;

export default function AuditLog() {
  const [items, setItems] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Filters
  const [action, setAction] = useState('');
  const [actorQuery, setActorQuery] = useState('');
  const [actorCandidates, setActorCandidates] = useState<any[]>([]);
  const [actorId, setActorId] = useState<string | null>(null);
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.auditList({
        action: action.trim() || undefined,
        actorId: actorId ?? undefined,
        entityType: entityType.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setItems(r.items ?? []);
      setTotal(r.total ?? 0);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [action, actorId, entityType, from, to, page]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Debounced actor autocomplete via admin RBAC user list.
  useEffect(() => {
    const q = actorQuery.trim();
    if (!q) {
      setActorCandidates([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .listAdminUsers({ q, limit: 8 })
        .then((r: any) => setActorCandidates(r?.items ?? r ?? []))
        .catch(() => setActorCandidates([]));
    }, 300);
    return () => clearTimeout(t);
  }, [actorQuery]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">审计日志 · Audit Log</h1>

      {err && (
        <div className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded text-sm">
          {err}
        </div>
      )}

      <div className="bg-white border rounded-lg p-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <div className="text-xs text-gray-500">Action</div>
          <input
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(0);
            }}
            placeholder="e.g. attendance_correct"
            className="border rounded px-2 py-1 w-56"
          />
        </label>

        <label className="text-sm relative">
          <div className="text-xs text-gray-500">
            Actor {actorId && <span className="text-blue-600">(选中: {actorId.slice(0, 8)})</span>}
          </div>
          <input
            value={actorQuery}
            onChange={(e) => {
              setActorQuery(e.target.value);
              setActorId(null);
              setPage(0);
            }}
            placeholder="姓名或 email"
            className="border rounded px-2 py-1 w-56"
          />
          {actorCandidates.length > 0 && !actorId && (
            <div className="absolute z-10 top-full left-0 mt-0.5 bg-white border rounded shadow w-72 max-h-60 overflow-y-auto">
              {actorCandidates.map((u: any) => (
                <button
                  key={u.id}
                  className="block w-full text-left px-2 py-1 hover:bg-gray-100 text-xs"
                  onClick={() => {
                    setActorId(u.id);
                    setActorQuery(u.name ?? u.email ?? u.id);
                    setActorCandidates([]);
                  }}
                >
                  {u.name ?? '—'} · <span className="text-gray-500">{u.email}</span>
                </button>
              ))}
            </div>
          )}
        </label>

        <label className="text-sm">
          <div className="text-xs text-gray-500">Entity type</div>
          <input
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(0);
            }}
            placeholder="class / submission / user…"
            className="border rounded px-2 py-1 w-44"
          />
        </label>
        <label className="text-sm">
          <div className="text-xs text-gray-500">From</div>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <div className="text-xs text-gray-500">To</div>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
            className="border rounded px-2 py-1"
          />
        </label>

        <button className="btn btn-ghost text-sm ml-auto" onClick={() => reload()}>
          ↻ 刷新
        </button>
      </div>

      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b">
            <tr>
              <th className="px-3 py-2">时间</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  没有匹配的审计记录
                </td>
              </tr>
            )}
            {items.map((row) => (
              <tr key={row.id} className="border-b last:border-0 align-top">
                <td className="px-3 py-2 font-mono text-xs text-gray-600 whitespace-nowrap">
                  {new Date(row.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{row.action}</td>
                <td className="px-3 py-2 text-xs">
                  {row.actor?.name ?? row.actor?.email ?? row.actorId ?? '—'}
                </td>
                <td className="px-3 py-2 text-xs">
                  {row.entityType ? (
                    <>
                      <span className="text-gray-500">{row.entityType}</span>{' '}
                      <span className="font-mono">{row.entityId?.slice(0, 8)}</span>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {row.metadata ? (
                    <details>
                      <summary className="cursor-pointer text-blue-600 hover:underline">
                        view
                      </summary>
                      <pre className="mt-1 text-xs bg-gray-50 p-2 rounded max-w-lg overflow-auto">
                        {JSON.stringify(row.metadata, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-500">
          {total} 条 · 第 {page + 1} / {totalPages} 页
        </div>
        <div className="flex gap-2">
          <button
            className="btn btn-ghost"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ← 上一页
          </button>
          <button
            className="btn btn-ghost"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页 →
          </button>
        </div>
      </div>
    </div>
  );
}
