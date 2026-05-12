import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

/**
 * ROUND 14 — Feature 6: Archived (soft-deleted) classes list with
 * restore button. Lists Class rows with archivedAt != null. Same
 * pattern applied to archived papers in the bottom panel.
 *
 * Soft-delete is the default delete flow on Classes.tsx; this page
 * is the safety-net "I deleted the wrong class" recovery surface.
 */

export default function ArchivedClasses() {
  const [classes, setClasses] = useState<any[]>([]);
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setErr(null);
    try {
      const [cs, ps] = await Promise.all([
        api.listArchivedClasses().catch(() => []),
        api.listArchivedPapers().catch(() => []),
      ]);
      setClasses(Array.isArray(cs) ? cs : []);
      setPapers(Array.isArray(ps) ? ps : []);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function restoreClass(id: string, name: string) {
    if (!confirm(`恢复「${name}」?\n该班级和所有关联记录会重新可见。`)) return;
    setRestoring(id);
    try {
      await api.restoreClass(id);
      await reload();
    } catch (e: any) {
      alert('恢复失败: ' + String(e?.message ?? e));
    } finally {
      setRestoring(null);
    }
  }

  async function restorePaper(id: string, name: string) {
    if (!confirm(`恢复卷子「${name}」?`)) return;
    setRestoring(id);
    try {
      await api.restorePaper(id);
      await reload();
    } catch (e: any) {
      alert('恢复失败: ' + String(e?.message ?? e));
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🗑️ 已归档 · Archived</h1>
        <Link to="/classes" className="text-sm text-blue-600 hover:underline">
          ← 返回 Classes
        </Link>
      </div>

      {err && <div className="card text-sm text-red-700">{err}</div>}

      <div>
        <h2 className="text-lg font-semibold mb-2">已归档班级</h2>
        <div className="card divide-y">
          {loading && <div className="py-4 text-center text-gray-500">Loading…</div>}
          {!loading && classes.length === 0 && (
            <div className="py-6 text-center text-gray-500">
              没有已归档的班级。删除班级会先进入此处保留 30 天。
            </div>
          )}
          {classes.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {[c.classCode, c.archivedAt && `archivedAt ${new Date(c.archivedAt).toLocaleString()}`]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <button
                className="btn btn-primary text-sm"
                disabled={restoring === c.id}
                onClick={() => restoreClass(c.id, c.name)}
              >
                {restoring === c.id ? '恢复中…' : '↩️ 恢复'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">已归档卷子</h2>
        <div className="card divide-y">
          {loading && <div className="py-4 text-center text-gray-500">Loading…</div>}
          {!loading && papers.length === 0 && (
            <div className="py-6 text-center text-gray-500">没有已归档的卷子。</div>
          )}
          {papers.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {p.archivedAt && `archivedAt ${new Date(p.archivedAt).toLocaleString()}`}
                </div>
              </div>
              <button
                className="btn btn-primary text-sm"
                disabled={restoring === p.id}
                onClick={() => restorePaper(p.id, p.name)}
              >
                {restoring === p.id ? '恢复中…' : '↩️ 恢复'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
