import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { MathHtml } from '../components/MathHtml';

export default function QuestionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [boards, setBoards] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [filters, setFilters] = useState<any>({ subjectId: '', componentId: '', questionType: '', includeDraft: true });

  useEffect(() => {
    api.examBoards().then(setBoards);
  }, []);

  useEffect(() => {
    api.subjects().then(setSubjects);
  }, []);

  useEffect(() => {
    if (filters.subjectId) api.components(filters.subjectId).then(setComponents);
    else setComponents([]);
  }, [filters.subjectId]);

  useEffect(() => {
    api.listQuestions(filters).then((r: any) => { setItems(r.items); setTotal(r.total); });
  }, [filters]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Question Bank <span className="text-gray-400 text-base font-normal">({total})</span></h1>
        <Link to="/questions/new" className="btn btn-primary">+ Add Question</Link>
      </div>

      <div className="card grid grid-cols-4 gap-3">
        <select className="select" value={filters.subjectId} onChange={e => setFilters({ ...filters, subjectId: e.target.value, componentId: '' })}>
          <option value="">All subjects</option>
          {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.examBoard.code} {s.code} {s.name} ({s.level})</option>)}
        </select>
        <select className="select" value={filters.componentId} onChange={e => setFilters({ ...filters, componentId: e.target.value })} disabled={!filters.subjectId}>
          <option value="">All components</option>
          {components.map((c: any) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
        </select>
        <select className="select" value={filters.questionType} onChange={e => setFilters({ ...filters, questionType: e.target.value })}>
          <option value="">All types</option>
          <option value="mcq">MCQ</option>
          <option value="short_answer">Short answer</option>
          <option value="structured">Structured</option>
          <option value="essay">Essay</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={filters.includeDraft} onChange={e => setFilters({ ...filters, includeDraft: e.target.checked })} />
          Include drafts
        </label>
      </div>

      <div className="card divide-y">
        {items.length === 0 && <div className="py-6 text-center text-gray-500">No questions found.</div>}
        {items.map((q: any) => (
          <Link key={q.id} to={`/questions/${q.id}`} className="block py-3 -mx-4 px-4 hover:bg-gray-50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  <MathHtml source={q.content?.stem || ''} />
                </div>
                <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="badge">{q.questionType}</span>
                  <span>{q.marks} marks</span>
                  <span>diff {q.difficulty}/5</span>
                  {q.primaryTopic && <span>{q.primaryTopic.code} — {q.primaryTopic.name}</span>}
                  {q.component && <span>{q.component.code}</span>}
                  <span className={`badge ${q.status === 'active' ? 'badge-success' : ''}`}>{q.status}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
