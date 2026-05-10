import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { EmptyState } from '../components/EmptyState';

interface TeacherTodo {
  generatedAt: string;
  summary: {
    pendingReviewPapers: number;
    pendingMarkScripts: number;
    consecutiveAbsentStudents: number;
    unaccountedStudentsToday: number;
  };
}

export default function DashboardPage() {
  const [papers, setPapers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalQuestions: 0 });
  // F1 — top-of-page teacher today card.
  const [todo, setTodo] = useState<TeacherTodo | null>(null);

  useEffect(() => {
    api.listPapers().then(setPapers);
    api.listTemplates().then(setTemplates);
    api.listQuestions({ pageSize: 1 }).then((r: any) => setStats({ totalQuestions: r.total }));
    api.teacherTodoToday().then(
      (r: any) => setTodo(r),
      () => {/* non-fatal — older deployments may not have the endpoint */},
    );
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/papers/new" className="btn btn-primary">+ Create New Paper</Link>
      </div>

      {/* F1 — today's teacher-todo card.
          U2 — responsive: stacks on small screens, grid on lg+. */}
      {todo && (
        <section
          aria-labelledby="todo-card-heading"
          className="bg-amber-50 border border-amber-200 rounded-lg p-4 lg:p-5"
        >
          <h2
            id="todo-card-heading"
            className="text-base font-semibold text-amber-900 mb-3 flex items-center gap-2"
          >
            <span aria-hidden>⏰</span> 今日待办
          </h2>
          {/* R10-Bug4: was grid-cols-2 lg:grid-cols-4. iPad portrait
              (768) and landscape (1024) both fell into the 2-col branch
              with cards too wide. Add md (768) → 4-col so iPad lands on
              the 4-up layout teachers expect, and xl bumps gap. */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-3 md:gap-4 xl:gap-5 text-sm">
            <TodoStat label="待复核卷子" value={todo.summary.pendingReviewPapers} href="/morning-quiz/qa-review" />
            <TodoStat label="待批改答题" value={todo.summary.pendingMarkScripts} href="/marker" />
            <TodoStat label="连续缺勤" value={todo.summary.consecutiveAbsentStudents} href="/attendance/admin" />
            <TodoStat label="今日未签到" value={todo.summary.unaccountedStudentsToday} href="/attendance/admin" />
          </div>
        </section>
      )}

      {/* R10-Bug4: stretch the breakpoint ladder — sm 3-up still good but
          add xl gap bump so wide monitors don't look cramped between cards. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-3 gap-3 md:gap-4 xl:gap-5">
        <div className="card">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Papers</div>
          <div className="text-3xl font-bold mt-1">{papers.length}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Templates</div>
          <div className="text-3xl font-bold mt-1">{templates.length}</div>
        </div>
        <div className="card col-span-2 sm:col-span-1">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Questions in Bank</div>
          <div className="text-3xl font-bold mt-1">{stats.totalQuestions}</div>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Recent Papers</h2>
        <div className="card divide-y">
          {papers.length === 0 ? (
            <EmptyState
              variant="no-paper"
              title="还没有卷子"
              description="点击右上角创建第一份卷子。"
              action={{ label: 'Create New Paper', onClick: () => (window.location.href = '/papers/new') }}
            />
          ) : (
            papers.slice(0, 8).map((p) => (
              <Link
                key={p.id}
                to={`/papers/${p.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-4 px-4 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{p.name}</div>
                  {/* Fix #4: filter null/undefined parts before joining so a missing
                      component doesn't render as " ·  · " (double middle dot). */}
                  <div className="text-xs text-gray-500 truncate">
                    {[
                      p.subject?.name,
                      p.component?.name,
                      p.durationMin ? `${p.durationMin}min` : null,
                      `${p.totalMarksActual}/${p.totalMarksTarget} marks`,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className={`badge ml-2 shrink-0 ${p.status === 'published' ? 'badge-success' : ''}`}>{p.status}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function TodoStat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  const isAlert = value > 0;
  return (
    <Link
      to={href}
      className={`block rounded-md px-3 py-2 transition-all duration-100 ease-out hover:shadow-sm ${
        isAlert
          ? 'bg-white border border-amber-300 hover:border-amber-500'
          : 'bg-amber-100/40 border border-amber-200/40 hover:bg-white'
      }`}
      data-testid={`todo-stat-${label}`}
    >
      <div className="text-xs text-amber-900/70 leading-snug">{label}</div>
      <div className={`text-2xl font-bold mt-0.5 ${isAlert ? 'text-amber-900' : 'text-amber-700/60'}`}>
        {value}
      </div>
    </Link>
  );
}
