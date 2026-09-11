import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import AppealReviewModal from '../components/AppealReviewModal';
import { Spinner, ErrorState } from '../components/AsyncState';
import { prettifyPaperName } from '../lib/paperName';
import { STAGE_BADGE_CLASS, STAGE_HINT, STAGE_LABEL, errorMessage } from '../lib/markerStages';

/**
 * 判分队列（2026-09-11 审计 M01 / M04 / IOS-10 重做）。
 *
 *   · 三个分栏：待批（可认领）/ 批改中 / 已评分待发布。「已评分待发布」
 *     是 M01 缺的那个入口 —— 保存完最后一题、还没发布的答卷在这里找回。
 *   · 翻页（M04）：按服务端 page / pageCount / total 显示页码，上一页 / 下一页；
 *     分栏和页码写在网址里，刷新、重登、从判分页返回都回到同一处。
 *     前 20 份都被别人认领时，「待批」栏只列没人认领的，第一页就能认领。
 *   · 桌面优先的密集表格，窄屏逐层收起次要列（班级、交卷时间）。
 *   · 只给当前身份真的能做的操作：别人认领的卷不给「认领」，只显示认领人 + 查看。
 *   · 认领失败等错误写在页面里（role=alert），不弹 alert；切换分栏 / 翻页时
 *     丢弃过期响应，旧请求晚回来也不会盖掉新选择。
 */

type QueueStageTab = 'awaiting' | 'in_progress' | 'ready';
const TABS: QueueStageTab[] = ['awaiting', 'in_progress', 'ready'];
const PAGE_SIZE = 20;

const EMPTY_TEXT: Record<QueueStageTab, string> = {
  awaiting: '没有待批的答卷。',
  in_progress: '没有正在批改的答卷。',
  ready: '没有待发布的答卷。',
};

function parseStage(raw: string | null): QueueStageTab {
  return (TABS as string[]).includes(raw ?? '') ? (raw as QueueStageTab) : 'awaiting';
}
function parsePage(raw: string | null): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function friendlyClaimError(e: unknown): string {
  const msg = errorMessage(e);
  if (/already claimed/i.test(msg) || (e as any)?.status === 409) return '这份答卷刚被其他老师认领了，列表已刷新。';
  if (/status=/i.test(msg)) return '这份答卷的状态已经变了（可能已发布），列表已刷新。';
  if (/not_your_class/i.test(msg) || (e as any)?.status === 403) return '你不在这个班的任课名单里，不能认领。';
  return msg;
}

export default function MarkerQueuePage() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const stage = parseStage(params.get('stage'));
  const page = parsePage(params.get('page'));

  const [data, setData] = useState<any | null>(null);
  // 当前 data 对应哪一栏哪一页 —— 切换分栏时不把上一栏的行挂在新分栏下面
  const [dataKey, setDataKey] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  // ROUND 14 — Feature 10: open-appeals state. `appeals` is a flat list
  // of open appeals; the count per submission is derived from there for the
  // per-row badge, and the modal target picks one appeal to review.
  const [appeals, setAppeals] = useState<any[]>([]);
  const [activeAppeal, setActiveAppeal] = useState<any | null>(null);
  const reqRef = useRef(0);

  const go = useCallback(
    (next: { stage?: QueueStageTab; page?: number }, replace = false) => {
      const sp = new URLSearchParams(params);
      const s = next.stage ?? stage;
      const p = next.page ?? page;
      if (s === 'awaiting') sp.delete('stage');
      else sp.set('stage', s);
      if (p <= 1) sp.delete('page');
      else sp.set('page', String(p));
      setParams(sp, { replace });
    },
    [params, setParams, stage, page],
  );

  const load = useCallback(async () => {
    const id = ++reqRef.current;
    setLoading(true);
    try {
      const q = await api.markerQueue({ stage, page, pageSize: PAGE_SIZE });
      if (id !== reqRef.current) return; // 过期响应：用户已经换了分栏 / 页码
      const pageCount = Number(q?.pageCount ?? 1);
      if (page > 1 && page > pageCount) {
        // 发布 / 认领后最后一页空了：回到最后一页有内容的那页
        go({ page: Math.max(1, pageCount) }, true);
        return;
      }
      setData(q);
      setDataKey(`${stage}:${page}`);
      setErr(null);
    } catch (e) {
      if (id !== reqRef.current) return;
      setErr(errorMessage(e));
    } finally {
      if (id === reqRef.current) setLoading(false);
    }
  }, [stage, page, go]);

  const loadAppeals = useCallback(async () => {
    const ap = await api.morningQuizListAppeals({ status: 'open' }).catch(() => ({ items: [] as any[] }));
    setAppeals((ap as any)?.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    void loadAppeals();
  }, [loadAppeals]);

  // Map submissionId → open appeals
  const appealsBySubmission: Record<string, any[]> = {};
  for (const a of appeals) {
    const k = a.submissionId;
    if (!k) continue;
    (appealsBySubmission[k] ||= []).push(a);
  }
  const totalOpenAppeals = appeals.length;

  async function claim(submissionId: string) {
    setBusy(submissionId);
    setActionError(null);
    try {
      await api.markerClaim(submissionId);
      nav(`/marker/submission/${submissionId}`);
    } catch (e) {
      setActionError(`认领失败：${friendlyClaimError(e)}`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  const counts: Record<QueueStageTab, number> = {
    awaiting: data?.stageCounts?.awaiting ?? 0,
    in_progress: data?.stageCounts?.in_progress ?? 0,
    ready: data?.stageCounts?.ready ?? 0,
  };
  const fresh = !!data && dataKey === `${stage}:${page}`;
  const pageCount = fresh ? Math.max(1, Number(data?.pageCount ?? 1)) : Math.max(1, page);
  const items: any[] = fresh ? data?.items ?? [] : [];

  if (err && !data) return <ErrorState message={err} onRetry={() => void load()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">判分队列</h1>
        <div className="flex items-center gap-3 text-sm text-gray-700">
          {loading ? <span role="status">刷新中…</span> : null}
          <button type="button" className="btn tap" onClick={() => void load()}>
            刷新
          </button>
        </div>
      </div>

      {totalOpenAppeals > 0 && (
        <section className="card border-amber-300 bg-amber-50" aria-labelledby="appeals-title">
          <div className="flex items-center justify-between mb-2">
            <h2 id="appeals-title" className="text-lg font-bold text-amber-900">
              待审申诉 · Open Appeals
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300 font-medium">
              {totalOpenAppeals}
            </span>
          </div>
          <ul className="divide-y divide-amber-200">
            {appeals.map((a: any) => (
              <li key={a.id} className="py-2 flex items-start justify-between gap-3">
                <div className="text-sm min-w-0 flex-1">
                  <div className="text-gray-900 truncate">
                    {a.student?.name ?? a.studentId ?? 'unknown'}
                    {a.paperQuestionSortOrder != null && <span className="text-gray-700"> · Q{a.paperQuestionSortOrder}</span>}
                  </div>
                  <div className="text-xs text-gray-700 truncate mt-0.5">{a.message?.slice(0, 100) ?? ''}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveAppeal(a)}
                  className="tap shrink-0 text-sm px-3 rounded bg-amber-200 hover:bg-amber-300 text-amber-900 border border-amber-300 font-medium"
                >
                  查看 · Review
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 阶段分栏 */}
      <div role="group" aria-label="判分阶段" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={stage === t}
            onClick={() => {
              setActionError(null);
              go({ stage: t, page: 1 });
            }}
            className={`tap inline-flex items-center gap-2 rounded-lg border px-4 text-sm font-semibold ${
              stage === t ? 'border-[#1f4e79] bg-[#1f4e79] text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
            }`}
          >
            <span>{STAGE_LABEL[t]}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                stage === t ? 'bg-white text-[#1f4e79]' : t === 'ready' && counts.ready > 0 ? 'bg-violet-100 text-violet-900' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {counts[t]}
            </span>
          </button>
        ))}
      </div>
      <p className="text-sm text-gray-700">{STAGE_HINT[stage]}</p>

      {actionError ? (
        <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {actionError}
        </p>
      ) : null}
      {err ? (
        <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          刷新失败：{err}（下面是上次成功加载的结果）
        </p>
      ) : null}

      {!fresh ? (
        <Spinner label="加载判分队列…" />
      ) : items.length === 0 ? (
        <div className="card py-10 text-center text-gray-700">{EMPTY_TEXT[stage]}</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              {STAGE_LABEL[stage]}的答卷，第 {page} 页
            </caption>
            <thead className="bg-gray-50 text-xs text-gray-700">
              <tr>
                <th scope="col" className="px-3 py-2">学生</th>
                <th scope="col" className="px-3 py-2">试卷</th>
                <th scope="col" className="hidden px-3 py-2 md:table-cell">班级</th>
                <th scope="col" className="hidden px-3 py-2 lg:table-cell">交卷时间</th>
                <th scope="col" className="px-3 py-2">进度</th>
                <th scope="col" className="px-3 py-2">认领</th>
                <th scope="col" className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it: any) => {
                const activeClaim = it.claim && it.claim.status === 'active' ? it.claim : null;
                const claimedByMe = !!(activeClaim && me && activeClaim.markerId === me.id);
                const claimedByOther = !!(activeClaim && !claimedByMe);
                const rowStage: QueueStageTab = (TABS as string[]).includes(it.stage) ? it.stage : stage;
                const rowAppeals = appealsBySubmission[it.id] ?? [];
                const href = `/marker/submission/${it.id}`;
                return (
                  <tr key={it.id} className="align-middle">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      <span>{it.student?.name ?? it.student?.email ?? 'unknown'}</span>
                      {it.finalSubmittedAt === null ? (
                        <span className="ml-2 text-xs font-normal text-amber-800">暂存提交</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2" title={it.assignment?.paper?.name ?? 'Paper'}>
                      {prettifyPaperName(it.assignment?.paper?.name ?? 'Paper')}
                    </td>
                    <td className="hidden px-3 py-2 md:table-cell">
                      {it.assignment?.class?.name}
                      {it.assignment?.class?.classCode ? ` (${it.assignment.class.classCode})` : ''}
                    </td>
                    <td className="hidden px-3 py-2 lg:table-cell tabular-nums">
                      {it.submittedAt ? new Date(it.submittedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STAGE_BADGE_CLASS[rowStage]}`}>
                        {STAGE_LABEL[rowStage]}
                      </span>
                      <span className="ml-2 text-xs text-gray-700 tabular-nums">
                        {rowStage === 'ready' ? (
                          <span>{it.markerGradedCount > 0 ? '你已评完' : '自动判分'}</span>
                        ) : (
                          <>
                            {it.ungradedCount}/{it.structuredCount} 题待打分
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {claimedByMe ? (
                        <span className="text-emerald-800">你已认领</span>
                      ) : claimedByOther ? (
                        <span className="text-amber-800">{activeClaim.marker?.name ?? '其他老师'} 已认领</span>
                      ) : (
                        <span className="text-gray-700">无人认领</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {rowAppeals.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveAppeal(rowAppeals[0])}
                            className="tap text-xs px-2 rounded bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                            title={`${rowAppeals.length} 条未处理申诉，点击查看`}
                          >
                            申诉 {rowAppeals.length}
                          </button>
                        )}
                        {claimedByMe ? (
                          <Link to={href} className="btn btn-primary tap">
                            {rowStage === 'ready' ? '去发布' : '继续判分'}
                          </Link>
                        ) : claimedByOther ? (
                          <Link to={href} className="btn tap">
                            查看
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary tap"
                            disabled={busy === it.id}
                            onClick={() => void claim(it.id)}
                          >
                            {busy === it.id ? '认领中…' : rowStage === 'ready' ? '认领并发布' : '认领'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="分页" className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-800">
        <span className="tabular-nums">
          {fresh ? <>第 {Math.min(page, pageCount)} / {pageCount} 页 · 共 {data?.total ?? 0} 份</> : <>第 {page} 页</>}
        </span>
        <span className="flex gap-2">
          <button type="button" className="btn tap" disabled={page <= 1 || !fresh} onClick={() => go({ page: page - 1 })}>
            上一页
          </button>
          <button
            type="button"
            className="btn tap"
            disabled={page >= pageCount || !fresh}
            onClick={() => go({ page: page + 1 })}
          >
            下一页
          </button>
        </span>
      </nav>

      {activeAppeal && (
        <AppealReviewModal
          appeal={activeAppeal}
          onClose={() => setActiveAppeal(null)}
          onResolved={() => {
            setActiveAppeal(null);
            void loadAppeals();
            void load();
          }}
        />
      )}
    </div>
  );
}
