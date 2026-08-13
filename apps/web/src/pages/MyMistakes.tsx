import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Spinner } from '../components/AsyncState';

/**
 * 我的错题本（2026-08-13）。
 *
 * 收录门槛在服务端（mistake.service）：空白不收、同题型反复错才收、
 * 词义题和长答题一律收。所以这一页看到的每一条都是**值得回看的**，
 * 不是流水账 —— 这是它和「答题历史」最根本的区别。
 *
 * 页面结构照着「学生真正会做的动作」排：
 *   1. 顶部按题型统计 —— 回答"我到底哪类题一直错"（可行动）
 *   2. 每条错题：题干 → 我当时写的 → 正确答案 → 老师评语
 *      老师评语放在最后、样式最重，因为它是整个流程里最贵的东西
 *   3.「已弄懂」按钮 —— 错题本必须能清空，否则只会一直变长到没人看
 */

interface MistakeEntry {
  id: string;
  taskType: string;
  passageTitle: string;
  stem: string;
  studentAnswer: string;
  correctAnswer: string;
  markerComment: string;
  awarded: number;
  maxMarks: number;
  vocabWord: string;
  reason: 'repeated_tasktype' | 'vocabulary' | 'long_answer';
  resolved: boolean;
  quizDay: string;
}

const TASK_LABEL: Record<string, string> = {
  matching_information: '段落匹配',
  matching_headings: '标题配对',
  true_false_not_given: '判断题 T/F/NG',
  sentence_completion: '句子填空',
  summary_completion: '摘要填空',
  flow_chart_completion: '流程图填空',
  short_answer: '简答题',
  multiple_choice: '选择题',
  mcq: '选择题',
  multi_match: '情绪/信息配对',
};
const label = (t: string) => TASK_LABEL[t] ?? t;

const REASON_BADGE: Record<MistakeEntry['reason'], { text: string; cls: string }> = {
  repeated_tasktype: { text: '这类题反复错', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  vocabulary: { text: '词义题', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  long_answer: { text: '长答题 · 有老师评语', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export default function MyMistakesPage() {
  const [params] = useSearchParams();
  const name = params.get('name') ?? '';
  const studentId = params.get('studentId') ?? '';
  const [data, setData] = useState<{
    total: number;
    byTaskType: Array<{ taskType: string; count: number }>;
    entries: MistakeEntry[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(() => {
    if (!name) return;
    api
      .mistakeList({ name, studentId: studentId || undefined })
      .then((r: any) => setData(r))
      .catch((e: any) => setError(String(e?.message ?? e)));
  }, [name, studentId]);

  useEffect(load, [load]);

  const shown = useMemo(
    () => (data?.entries ?? []).filter((e) => filter === 'all' || e.taskType === filter),
    [data, filter],
  );

  const resolve = async (id: string) => {
    setBusy(id);
    try {
      await api.mistakeResolve({ studentName: name, studentId: studentId || undefined, id, resolved: true });
      setData((d) =>
        d ? { ...d, total: d.total - 1, entries: d.entries.filter((e) => e.id !== id) } : d,
      );
    } catch { /* 下次刷新会纠正 */ } finally { setBusy(null); }
  };

  if (!name) {
    return (
      <div className="ui-ios min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center text-gray-600">
          <div className="mb-3">请从「我的记录」进入错题本。</div>
          <Link to="/my-history" className="text-blue-600 underline">→ 我的记录</Link>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="ui-ios min-h-screen bg-gray-50 px-6 py-12 text-center">
        <div className="text-rose-700 mb-4">⚠️ {error}</div>
        <Link to={`/my-history?name=${encodeURIComponent(name)}`} className="text-blue-600 underline text-sm">
          ← 返回我的记录
        </Link>
      </div>
    );
  }
  if (!data) {
    return <div className="ui-ios min-h-screen bg-gray-50"><Spinner label="加载错题本…" /></div>;
  }

  const backUrl = `/my-history?name=${encodeURIComponent(name)}${studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''}`;

  return (
    <div className="ui-ios min-h-screen bg-gray-50">
      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <Link to={backUrl} className="text-sm text-blue-600 hover:underline">← 返回我的记录</Link>

        <header className="bg-white rounded-xl border shadow-sm p-5">
          <h1 className="text-2xl font-bold text-gray-900">📕 我的错题本</h1>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{data.total}</span>
            <span className="text-sm text-gray-500">条待弄懂</span>
          </div>
          {data.total === 0 ? (
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              还没有错题。<strong>不是每道错题都会进这里</strong> —— 只收三类：
              这类题你反复错、考词义的题、还有老师写了评语的长答题。
              空着没做的题不收，那个要靠自己动笔解决。
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-gray-500 leading-relaxed">
              只收三类：<strong>反复错的题型</strong>、<strong>词义题</strong>、
              <strong>老师写了评语的长答题</strong>。弄懂一条就点「已弄懂」划掉它。
            </p>
          )}
        </header>

        {data.byTaskType.length > 0 && (
          <section className="bg-white rounded-xl border shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2.5">哪类题错得最多</div>
            <div className="space-y-1.5">
              {data.byTaskType.slice(0, 5).map((t) => {
                const pct = Math.round((t.count / Math.max(data.total, 1)) * 100);
                return (
                  <button
                    key={t.taskType}
                    type="button"
                    onClick={() => setFilter(filter === t.taskType ? 'all' : t.taskType)}
                    className={`w-full text-left ${filter === t.taskType ? 'opacity-100' : 'opacity-80'}`}
                  >
                    <div className="flex items-center justify-between text-[13px]">
                      <span className={filter === t.taskType ? 'font-bold text-blue-700' : 'text-gray-700'}>
                        {label(t.taskType)}
                      </span>
                      <span className="text-gray-500 tabular-nums">{t.count} 条</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-rose-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
            {filter !== 'all' && (
              <button type="button" onClick={() => setFilter('all')} className="mt-2.5 text-[13px] text-blue-600">
                显示全部
              </button>
            )}
          </section>
        )}

        <section className="space-y-3">
          {shown.map((e) => {
            const badge = REASON_BADGE[e.reason];
            return (
              <article key={e.id} className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className={`px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.text}</span>
                  <span className="text-gray-500">{label(e.taskType)}</span>
                  <span className="text-gray-400">{e.quizDay}</span>
                  <span className="ml-auto text-gray-500 tabular-nums">{e.awarded}/{e.maxMarks} 分</span>
                </div>
                {e.passageTitle && (
                  <div className="text-[11px] text-gray-400 mt-1">来自《{e.passageTitle}》</div>
                )}

                <p className="mt-2 text-[14px] text-gray-800 leading-relaxed">{e.stem}</p>

                <div className="mt-3 space-y-2 text-[13px]">
                  <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2">
                    <div className="text-[11px] text-rose-700 font-semibold mb-0.5">我当时写的</div>
                    <div className="text-gray-800 whitespace-pre-wrap">{e.studentAnswer || '（空白）'}</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                    <div className="text-[11px] text-emerald-700 font-semibold mb-0.5">正确答案</div>
                    <div className="text-gray-800 whitespace-pre-wrap">{e.correctAnswer || '—'}</div>
                  </div>
                  {e.markerComment && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
                      <div className="text-[11px] text-blue-800 font-bold mb-1">老师批语</div>
                      <div className="text-[13.5px] text-gray-900 whitespace-pre-wrap leading-relaxed">
                        {e.markerComment}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={busy === e.id}
                    onClick={() => resolve(e.id)}
                    className="press min-h-[40px] px-4 rounded-[12px] bg-gray-900 text-white text-[14px] font-semibold disabled:opacity-50"
                  >
                    {busy === e.id ? '…' : '已弄懂'}
                  </button>
                  {e.vocabWord && (
                    <Link
                      to={`/my-vocab?name=${encodeURIComponent(name)}`}
                      className="text-[13px] text-purple-700"
                    >
                      「{e.vocabWord}」→ 生词本
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
          {data.total > 0 && shown.length === 0 && (
            <div className="text-center text-sm text-gray-500 py-8">该题型下暂无错题。</div>
          )}
        </section>
      </main>
    </div>
  );
}
