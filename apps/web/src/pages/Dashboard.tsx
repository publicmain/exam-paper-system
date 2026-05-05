import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function DashboardPage() {
  const [papers, setPapers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalQuestions: 0 });

  useEffect(() => {
    api.listPapers().then(setPapers);
    api.listTemplates().then(setTemplates);
    api.listQuestions({ pageSize: 1 }).then((r: any) => setStats({ totalQuestions: r.total }));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/papers/new" className="btn btn-primary">+ Create New Paper</Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Papers</div>
          <div className="text-3xl font-bold mt-1">{papers.length}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Templates</div>
          <div className="text-3xl font-bold mt-1">{templates.length}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Questions in Bank</div>
          <div className="text-3xl font-bold mt-1">{stats.totalQuestions}</div>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Recent Papers</h2>
        <div className="card divide-y">
          {papers.length === 0 && <div className="py-4 text-gray-500 text-center">No papers yet. Create your first one above.</div>}
          {papers.slice(0, 8).map(p => (
            <Link key={p.id} to={`/papers/${p.id}`} className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-4 px-4">
              <div>
                <div className="font-medium">{p.name}</div>
                {/* Fix #4: filter null/undefined parts before joining so a missing
                    component doesn't render as " ·  · " (double middle dot). */}
                <div className="text-xs text-gray-500">
                  {[
                    p.subject?.name,
                    p.component?.name,
                    p.durationMin ? `${p.durationMin}min` : null,
                    `${p.totalMarksActual}/${p.totalMarksTarget} marks`,
                  ].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span className={`badge ${p.status === 'published' ? 'badge-success' : ''}`}>{p.status}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
