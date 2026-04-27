import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function PapersPage() {
  const [papers, setPapers] = useState<any[]>([]);
  useEffect(() => { api.listPapers().then(setPapers); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Papers</h1>
        <Link to="/papers/new" className="btn btn-primary">+ Create New Paper</Link>
      </div>
      <div className="card divide-y">
        {papers.length === 0 && <div className="py-6 text-center text-gray-500">No papers yet.</div>}
        {papers.map(p => (
          <Link key={p.id} to={`/papers/${p.id}`} className="flex items-center justify-between py-3 -mx-4 px-4 hover:bg-gray-50">
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                <span>{p.subject?.name}</span>
                {p.component && <span>{p.component.code}</span>}
                {p.classLabel && <span>{p.classLabel}</span>}
                <span>{p.durationMin} min</span>
                <span>{p.totalMarksActual}/{p.totalMarksTarget} marks</span>
                <span>{p._count?.questions ?? 0} questions</span>
              </div>
            </div>
            <span className={`badge ${p.status === 'published' ? 'badge-success' : ''}`}>{p.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
