import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { track } from '../lib/track';
import { Spinner } from '../components/AsyncState';

/**
 * 我的错题本 v2（2026-08-13 全面重做）。
 *
 * v1 上线首日的真机走查暴露的问题，这一版逐条对应：
 *   - 判断题正确答案显示裸字母（"C"）→ 服务端读取时翻译成 TRUE/FALSE/NOT GIVEN
 *   - 客观题只有「你写B、正确F」学不到任何东西 → 每道题带手写解析 + 原文证据句
 *   - 「看原文」落在 8000px 长页顶部 → 链接带 #q-<id> 锚点直达那道题
 *   - 标题写 58 条列表只有 30 条 → 全量下发，前端分批渲染「加载更多」
 *   - 「已弄懂」误触即消失 → 6 秒撤销条 + 底部「已弄懂」列表可恢复
 *   - 只能读不能练 → 顶部「今日练一轮」进练习模式（做对+隔天再对=自动销账）
 */

interface MistakeEntry {
  id: string;
  submissionId: string | null;
  paperQuestionId: string | null;
  taskType: string;
  passageTitle: string;
  stem: string;
  studentAnswer: string;
  correctAnswer: string;
  answerPoints?: string[];
  answerModel?: string;
  markerComment: string;
  awarded: number;
  maxMarks: number;
  vocabWord: string;
  reason: 'repeated_tasktype' | 'vocabulary' | 'long_answer';
  resolved: boolean;
  quizDay: string;
  /** 为什么是这个答案（中文，逐题手写） */
  explanation?: string;
  /** 原文里的证据句 */
  evidence?: string;
  correctStreak?: number;
}

const TASK_LABEL: Record<string, string> = {
  matching_information: '段落匹配',
  matching_headings: '标题配对',
  true_false_not_given: '判断题 T/F/NG',
  yes_no_not_given: '判断题 Y/N/NG',
  sentence_completion: '句子填空',
  summary_completion: '摘要填空',
  flow_chart_completion: '流程图填空',
  diagram_label_completion: '图示填空',
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

const PAGE = 15;

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
  const [shownCount, setShownCount] = useState(PAGE);
  const [showResolved, setShowResolved] = useState(false);
  /** 撤销条：最近一次「已弄懂」，6 秒内可撤回 */
  const [undo, setUndo] = useState<MistakeEntry | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    if (!name) return;
    api
      .mistakeList({ name, studentId: studentId || undefined, includeResolved: true })
      .then((r: any) => {
        setData(r);
        // 埋点在这里,不在服务端 —— 成绩页也会调同一个接口取徽标数字
        track('mistakes', name, studentId);
      })
      .catch((e: any) => setError(String(e?.message ?? e)));
  }, [name, studentId]);

  useEffect(load, [load]);

  const open = useMemo(() => (data?.entries ?? []).filter((e) => !e.resolved), [data]);
  const resolved = useMemo(() => (data?.entries ?? []).filter((e) => e.resolved), [data]);
  const filtered = useMemo(
    () => open.filter((e) => filter === 'all' || e.taskType === filter),
    [open, filter],
  );
  const shown = filtered.slice(0, shownCount);

  const setResolved = async (entry: MistakeEntry, value: boolean) => {
    setBusy(entry.id);
    try {
      await api.mistakeResolve({ studentName: name, studentId: studentId || undefined, id: entry.id, resolved: value });
      setData((d) =>
        d
          ? {
              ...d,
              total: d.total + (value ? -1 : 1),
              entries: d.entries.map((e) => (e.id === entry.id ? { ...e, resolved: value } : e)),
            }
          : d,
      );
      if (value) {
        if (undoTimer.current) clearTimeout(undoTimer.current);
        setUndo(entry);
        undoTimer.current = setTimeout(() => setUndo(null), 6000);
      } else {
        setUndo(null);
      }
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

  const qs = `name=${encodeURIComponent(name)}${studentId ? `&studentId=${encodeURIComponent(studentId)}` : ''}`;
  const backUrl = `/my-history?${qs}`;

  return (
    <div className="ui-ios min-h-screen bg-gray-50">
      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-24">
        <Link to={backUrl} className="text-sm text-blue-600 hover:underline">← 返回我的记录</Link>

        <header className="bg-white rounded-xl border shadow-sm p-5">
          <h1 className="text-2xl font-bold text-gray-900">📕 我的错题本</h1>
          {data.total > 0 ? (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{data.total}</span>
                <span className="text-sm text-gray-500">条待弄懂</span>
              </div>
              <Link
                to={`/my-mistakes/practice?${qs}`}
                className="press mt-4 flex items-center justify-center min-h-[46px] rounded-[12px] bg-gray-900 text-white text-[15px] font-semibold"
              >
                今日练一轮（10 题）
              </Link>
              <p className="mt-2 text-[12px] text-gray-500 text-center">做对、隔天再做对一次，就自动移出错题本</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-gray-600">全部弄懂了。这里会收录你反复错的题型、词义题，以及老师批改过的长答题。</p>
          )}
        </header>

        {/* 单一题型占绝对多数时这个统计没有信息量（O-Level 学生 42/43 都是
            简答题），只在确实能区分强弱项时才显示 */}
        {data.byTaskType.length >= 2 && (
          <section className="bg-white rounded-xl border shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2.5">哪类题错得最多</div>
            <div className="space-y-1.5">
              {data.byTaskType.slice(0, 5).map((t) => {
                const pct = Math.round((t.count / Math.max(data.total, 1)) * 100);
                return (
                  <button
                    key={t.taskType}
                    type="button"
                    onClick={() => { setFilter(filter === t.taskType ? 'all' : t.taskType); setShownCount(PAGE); }}
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
              <button type="button" onClick={() => { setFilter('all'); setShownCount(PAGE); }} className="mt-2.5 text-[13px] text-blue-600">
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
                {(e.correctStreak ?? 0) > 0 && (
                  <div className="text-[11px] text-emerald-700 mt-1">已练对 1 次 · 明天再练对一次就自动移出</div>
                )}

                <p className="mt-2 text-[14px] text-gray-800 leading-relaxed">{e.stem}</p>

                <div className="mt-3 space-y-2 text-[13px]">
                  <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2">
                    <div className="text-[11px] text-rose-700 font-semibold mb-0.5">我当时写的</div>
                    <div className="text-gray-800 whitespace-pre-wrap">{e.studentAnswer || '（空白）'}</div>
                  </div>

                  {/* 老师评语在参考答案之前 —— 它是针对这个学生写的中文，
                      比一串英文要点好懂（客观题的判分流水已在服务端滤掉） */}
                  {e.markerComment && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
                      <div className="text-[11px] text-blue-800 font-bold mb-1">老师说</div>
                      <div className="text-[13.5px] text-gray-900 whitespace-pre-wrap leading-relaxed">
                        {e.markerComment}
                      </div>
                    </div>
                  )}

                  {(e.answerPoints?.length || e.answerModel || e.correctAnswer) && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                      <div className="text-[11px] text-emerald-700 font-semibold mb-1">
                        {e.answerPoints && e.answerPoints.length > 1 ? '参考要点' : '参考答案'}
                      </div>
                      {e.answerPoints && e.answerPoints.length > 1 ? (
                        <ul className="space-y-1">
                          {e.answerPoints.map((pt, i) => (
                            <li key={i} className="flex gap-1.5 text-gray-800">
                              <span className="text-emerald-600 shrink-0">{i + 1}.</span>
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-gray-800 whitespace-pre-wrap font-medium">
                          {e.answerPoints?.[0] || e.correctAnswer || '—'}
                        </div>
                      )}
                      {e.answerModel && (
                        <div className="mt-2 pt-2 border-t border-emerald-200">
                          <div className="text-[11px] text-emerald-700 font-semibold mb-0.5">范文</div>
                          <div className="text-gray-800 leading-relaxed">{e.answerModel}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 为什么是这个答案 —— 客观题卡片的核心教学内容。
                      没有它，「你写B、正确F」学不到任何东西。 */}
                  {e.explanation && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                      <div className="text-[11px] text-amber-800 font-bold mb-1">为什么</div>
                      <div className="text-[13.5px] text-gray-900 leading-relaxed">{e.explanation}</div>
                      {e.evidence && (
                        <div className="mt-2 pt-2 border-t border-amber-200 text-[12.5px] text-gray-700 italic leading-relaxed">
                          原文依据：“{e.evidence}”
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    disabled={busy === e.id}
                    onClick={() => setResolved(e, true)}
                    className="press min-h-[40px] px-4 rounded-[12px] bg-gray-900 text-white text-[14px] font-semibold disabled:opacity-50"
                  >
                    {busy === e.id ? '…' : '已弄懂'}
                  </button>
                  {e.submissionId && (
                    <Link
                      to={`/my-history/submission/${e.submissionId}?name=${encodeURIComponent(name)}${e.paperQuestionId ? `#q-${e.paperQuestionId}` : ''}`}
                      className="text-[13px] font-semibold text-blue-700"
                    >
                      看原文 →
                    </Link>
                  )}
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

          {filtered.length > shownCount && (
            <button
              type="button"
              onClick={() => setShownCount((n) => n + PAGE)}
              className="press w-full min-h-[44px] rounded-[12px] bg-white border text-[14px] font-semibold text-gray-700"
            >
              加载更多（已显示 {shown.length} / {filtered.length}）
            </button>
          )}
          {open.length > 0 && filtered.length === 0 && (
            <div className="text-center text-sm text-gray-500 py-8">该题型下暂无错题。</div>
          )}
        </section>

        {/* 已弄懂的题 —— 可恢复，误触「已弄懂」不再是单行道 */}
        {resolved.length > 0 && (
          <section className="bg-white rounded-xl border shadow-sm p-4">
            <button
              type="button"
              onClick={() => setShowResolved((v) => !v)}
              className="w-full flex items-center justify-between text-sm font-semibold text-gray-700"
            >
              <span>已弄懂 · {resolved.length}</span>
              <span className="text-gray-400">{showResolved ? '收起' : '展开'}</span>
            </button>
            {showResolved && (
              <ul className="mt-3 space-y-2">
                {resolved.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-[13px] text-gray-600">
                    <span className="flex-1 truncate">{e.stem}</span>
                    <button
                      type="button"
                      disabled={busy === e.id}
                      onClick={() => setResolved(e, false)}
                      className="shrink-0 text-blue-600 font-semibold disabled:opacity-50"
                    >
                      恢复
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      {/* 撤销条 */}
      {undo && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white rounded-full pl-4 pr-2 py-2 shadow-lg text-[13px]">
          <span>已移入「已弄懂」</span>
          <button
            type="button"
            onClick={() => setResolved(undo, false)}
            className="press px-3 py-1 rounded-full bg-white/15 font-semibold"
          >
            撤销
          </button>
        </div>
      )}
    </div>
  );
}
