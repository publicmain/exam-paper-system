import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { EmptyState } from '../components/EmptyState';
import { prettifyPaperName } from '../lib/paperName';

interface TeacherTodo {
  generatedAt: string;
  summary: {
    pendingReviewPapers: number;
    pendingMarkScripts: number;
    consecutiveAbsentStudents: number;
    unaccountedStudentsToday: number;
  };
  // Optional so older API deployments (without the field) degrade gracefully.
  morningQuizToday?: Array<{
    sessionId: string;
    level: string;
    className: string;
    quizStart: string | null;
    status: string;
    enrolled: number;
    onTime: number;
    late: number;
    absent: number;
    submitted: number;
    pendingMark: number;
  }>;
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
        <h1 className="text-2xl font-bold">仪表盘</h1>
        <Link to="/papers/new" className="btn btn-primary">+ 新建卷子</Link>
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

      {/* 今日早测 — per-level overview of today's morning quizzes:
          attendance split, attendance rate, submitted count, pending marking. */}
      {todo?.morningQuizToday && todo.morningQuizToday.length > 0 && (
        <section aria-labelledby="mq-today-heading" className="space-y-3">
          <h2
            id="mq-today-heading"
            className="text-base font-semibold text-gray-800 flex items-center gap-2"
          >
            <span aria-hidden>🌅</span> 今日早测
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {todo.morningQuizToday.map((s) => (
              <MorningQuizCard key={s.sessionId} s={s} />
            ))}
          </div>
        </section>
      )}

      {/* R10-Bug4: stretch the breakpoint ladder — sm 3-up still good but
          add xl gap bump so wide monitors don't look cramped between cards. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-3 gap-3 md:gap-4 xl:gap-5">
        <div className="card">
          <div className="text-xs text-gray-500 uppercase tracking-wide">卷子</div>
          <div className="text-3xl font-bold mt-1">{papers.length}</div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500 uppercase tracking-wide">模板</div>
          <div className="text-3xl font-bold mt-1">{templates.length}</div>
        </div>
        <div className="card col-span-2 sm:col-span-1">
          <div className="text-xs text-gray-500 uppercase tracking-wide">题库题目数</div>
          <div className="text-3xl font-bold mt-1">{stats.totalQuestions}</div>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">最近卷子</h2>
        <div className="card divide-y">
          {papers.length === 0 ? (
            <EmptyState
              variant="no-paper"
              title="还没有卷子"
              description="点击右上角创建第一份卷子。"
              action={{ label: '新建卷子', onClick: () => (window.location.href = '/papers/new') }}
            />
          ) : (
            papers.slice(0, 8).map((p) => (
              <Link
                key={p.id}
                to={`/papers/${p.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-4 px-4 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate" title={p.name}>{prettifyPaperName(p.name)}</div>
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

const MQ_LEVEL_CN: Record<string, string> = {
  olevel: 'O-Level',
  ielts_authentic: '雅思',
  ielts_simplified: '轻雅思',
};
const MQ_STATUS_CN: Record<string, string> = {
  locked: '已锁定',
  scheduled: '待开始',
  active: '进行中',
  closed: '已结束',
  cancelled: '已取消',
};

function MorningQuizCard({
  s,
}: {
  s: NonNullable<TeacherTodo['morningQuizToday']>[number];
}) {
  const present = s.onTime + s.late;
  // Denominator = students with an attendance row for THIS level (present +
  // marked-absent), not the whole class — each student sits only one level,
  // so dividing by the full roster would understate every level's rate.
  const recorded = present + s.absent;
  const rate = recorded > 0 ? Math.round((present / recorded) * 100) : 0;
  const statusCls =
    s.status === 'active'
      ? 'bg-emerald-100 text-emerald-700'
      : s.status === 'scheduled'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-gray-100 text-gray-600';
  return (
    <Link
      to={`/morning-quiz/sessions/${s.sessionId}/dashboard`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-gray-900">{MQ_LEVEL_CN[s.level] ?? s.level}</div>
        <span className={`text-xs px-2 py-0.5 rounded ${statusCls}`}>
          {MQ_STATUS_CN[s.status] ?? s.status}
        </span>
      </div>
      <div className="text-xs text-gray-500 mt-0.5 truncate">{s.className}</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-emerald-700">{s.onTime}</div>
          <div className="text-[11px] text-gray-500">按时</div>
        </div>
        <div>
          <div className="text-lg font-bold text-amber-700">{s.late}</div>
          <div className="text-[11px] text-gray-500">迟到</div>
        </div>
        <div>
          <div className="text-lg font-bold text-rose-700">{s.absent}</div>
          <div className="text-[11px] text-gray-500">缺勤</div>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
        <span>
          出勤率 <b className="text-gray-900">{rate}%</b>
        </span>
        <span>
          已交 <b className="text-gray-900">{s.submitted}</b>
        </span>
        {s.pendingMark > 0 ? (
          <span className="text-rose-600 font-medium">待批 {s.pendingMark}</span>
        ) : (
          <span className="text-emerald-600">已判完</span>
        )}
      </div>
    </Link>
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
