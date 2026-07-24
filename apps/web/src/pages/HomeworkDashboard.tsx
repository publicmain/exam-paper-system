import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { hwApi, hwPageContentPath, downloadHomeworkCsv } from '../lib/api-homework';
import { AuthImage } from '../components/AuthImage';
import { PdfPreview } from '../components/PdfPreview';
import { HandwritingCanvas, Stroke } from '../components/HandwritingCanvas';

/**
 * 收卷看板 + 判分台，界面严格对标 Canvas：
 * - 看板名单 = Gradebook 风格表格（列头、斑马纹、状态 pill）
 * - 判分台 = SpeedGrader 三段式：licorice(#2D3B45) 顶栏（返回 · 判分统计 ·
 *   学生切换器 ←[select]→），左侧灰底提交内容画布，右侧白色评分栏
 *   （Submitted 块 → Grade 大输入 → Rubric 面板 → Comments）。
 * InstUI 色板：brand #0374B5 / licorice #2D3B45 / border #C7CDD1 /
 * success #0B874B / danger #E0061F / bg #F5F5F5。
 */

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  missing: { text: '未交', cls: 'bg-gray-100 text-gray-600' },
  in_progress: { text: '作答中', cls: 'bg-amber-100 text-amber-700' },
  submitted: { text: '已交', cls: 'bg-[#E8F4FB] text-[#0374B5]' },
  returned: { text: '已返回', cls: 'bg-green-100 text-green-700' },
};

export default function HomeworkDashboardPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState('');
  const [grading, setGrading] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  // v2: analytics panel, regrade queue, grade-by-question mode
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [regrades, setRegrades] = useState<any[]>([]);
  const [byQuestionId, setByQuestionId] = useState<string | null>(null);

  async function load() {
    try {
      const d = await hwApi.dashboard(assignmentId!);
      setData(d);
      hwApi.listRegrades(assignmentId!).then(setRegrades).catch(() => {});
    } catch (e: any) {
      setErr(e.message);
    }
  }
  useEffect(() => { load(); }, [assignmentId]);

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!data) return <div className="p-6 text-gray-500">加载中…</div>;

  const { homework, class: klass, counts, roster } = data;
  const hasRubric = (roster[0]?.questionCount ?? 0) > 0;
  const gradable = roster.filter((r: any) => r.submissionId && r.pageCount > 0);
  const readyCount = roster.filter((r: any) => r.readyToPublish).length;
  const aiPendingTotal = roster.reduce((s: number, r: any) => s + (r.aiPending ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Canvas 式面包屑 + 页头 */}
      <nav className="text-sm text-[#0374B5] mb-1">
        <Link to="/homework" className="hover:underline">作业中心</Link>
        <span className="text-gray-400 mx-1.5">›</span>
        <span className="text-gray-500">{homework.course?.name}</span>
        <span className="text-gray-400 mx-1.5">›</span>
        <span className="text-gray-500">{homework.title}</span>
      </nav>
      <div className="flex items-start justify-between gap-3 flex-wrap border-b border-[#C7CDD1] pb-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#2D3B45]">{homework.title}</h1>
          <div className="text-sm text-[#6B7780] mt-1">
            {klass.name}
            {data.dueAt && <> · 截止 {new Date(data.dueAt).toLocaleString()}</>}
            {homework.totalMarks ? <> · 满分 {homework.totalMarks}</> : null}
            {data.status === 'closed' && <span className="text-[#E0061F]"> · 已关闭收卷</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {hasRubric && (
            <select
              className="px-3 py-2 rounded-md border border-[#C7CDD1] text-sm bg-white text-[#2D3B45]"
              value={byQuestionId ?? ''}
              onChange={(e) => { if (e.target.value) setByQuestionId(e.target.value); }}>
              <option value="">按题批改…</option>
              {(data.homework.questions ?? []).map((q: any) => (
                <option key={q.id} value={q.id}>{q.label}（全班连批）</option>
              ))}
            </select>
          )}
          <button className="px-3 py-2 rounded-md border border-[#C7CDD1] text-sm text-[#2D3B45] hover:bg-gray-50"
            onClick={async () => {
              if (!showAnalytics && !analytics) {
                setAnalytics(await hwApi.analytics(assignmentId!).catch(() => null));
              }
              setShowAnalytics(!showAnalytics);
            }}>
            📊 学情
          </button>
          <button className="px-3 py-2 rounded-md border border-[#C7CDD1] text-sm text-[#2D3B45] hover:bg-gray-50"
            onClick={() => downloadHomeworkCsv(assignmentId!, `${homework.title}.csv`).catch((e) => alert(e.message))}>
            导出 CSV
          </button>
          {hasRubric && readyCount > 0 && (
            <button
              className="px-4 py-2 rounded-md bg-[#0374B5] text-white text-sm font-medium hover:bg-[#02659F] disabled:opacity-50"
              disabled={bulkBusy}
              onClick={async () => {
                if (!confirm(`把 ${readyCount} 份已复核完的作业一键发布给学生？`)) return;
                setBulkBusy(true);
                try {
                  const r = await hwApi.publishAll(assignmentId!);
                  alert(`已发布 ${r.published} 份${r.skipped.length ? `，跳过 ${r.skipped.length} 份（未复核完）` : ''}`);
                  await load();
                } catch (e: any) { alert(e.message); }
                finally { setBulkBusy(false); }
              }}>
              {bulkBusy ? '发布中…' : `发布已复核（${readyCount}）`}
            </button>
          )}
          {data.status === 'open' ? (
            <button className="px-4 py-2 rounded-md border border-[#C7CDD1] text-sm text-[#2D3B45] hover:bg-gray-50"
              onClick={async () => {
                if (!confirm('提前关闭收卷？关闭后学生不能再提交。')) return;
                await hwApi.updateAssignment(data.id, { status: 'closed' });
                load();
              }}>关闭收卷</button>
          ) : (
            <button className="px-4 py-2 rounded-md border border-[#C7CDD1] text-sm text-[#2D3B45] hover:bg-gray-50"
              onClick={async () => { await hwApi.updateAssignment(data.id, { status: 'open' }); load(); }}>
              重新开放
            </button>
          )}
        </div>
      </div>

      {/* 汇总 */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <Stat label="已交" value={counts.submitted} cls="text-[#0374B5]" />
        <Stat label="作答中" value={counts.inProgress} cls="text-amber-600" />
        <Stat label="未交" value={counts.missing} cls="text-[#2D3B45]" />
        <Stat label="迟交" value={counts.late} cls="text-[#E0061F]" />
        <Stat label="AI 待复核" value={aiPendingTotal} cls="text-purple-700" />
      </div>

      {/* v2: 学情分析 */}
      {showAnalytics && analytics && (
        <div className="bg-white rounded-lg border border-[#C7CDD1] p-5 mb-5">
          <div className="flex items-baseline gap-4 flex-wrap mb-4">
            <h3 className="font-bold text-[#2D3B45] m-0">📊 班级学情</h3>
            <span className="text-sm text-[#6B7780]">
              已返回 {analytics.returned} 份
              {analytics.mean != null && <> · 平均 <b className="text-[#2D3B45]">{analytics.mean.toFixed(1)}</b> / {analytics.maxTotal}</>}
              {analytics.max != null && <> · 最高 {analytics.max} · 最低 {analytics.min}</>}
              {analytics.lateRate > 0 && <> · 迟交率 {(analytics.lateRate * 100).toFixed(0)}%</>}
            </span>
          </div>
          {analytics.returned === 0 ? (
            <div className="text-sm text-[#6B7780]">还没有已批改返回的提交，发布成绩后这里会出现分布和每题得分率。</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {/* 分数分布 */}
              <div>
                <div className="text-xs font-semibold text-[#6B7780] uppercase tracking-wide mb-2">分数分布</div>
                {analytics.bands.map((n: number, i: number) => {
                  const maxBand = Math.max(...analytics.bands, 1);
                  return (
                    <div key={i} className="flex items-center gap-2 mb-1.5">
                      <span className="w-16 text-xs text-[#6B7780] text-right font-mono">{i * 20}–{i * 20 + 20}%</span>
                      <div className="flex-1 h-5 bg-[#F0F2F5] rounded overflow-hidden">
                        <div className={`h-full rounded ${i <= 1 ? 'bg-[#E0061F]/70' : i === 2 ? 'bg-amber-400' : 'bg-[#0B874B]/80'}`}
                          style={{ width: `${(n / maxBand) * 100}%` }} />
                      </div>
                      <span className="w-6 text-xs text-[#2D3B45] font-mono">{n}</span>
                    </div>
                  );
                })}
              </div>
              {/* 每题得分率 */}
              <div>
                <div className="text-xs font-semibold text-[#6B7780] uppercase tracking-wide mb-2">
                  每题得分率
                  {analytics.weakest.length > 0 && (
                    <span className="normal-case font-normal text-[#E0061F] ml-2">
                      最弱：{analytics.weakest.map((w: any) => w.label).join('、')}
                    </span>
                  )}
                </div>
                {analytics.perQuestion.map((q: any) => (
                  <div key={q.questionId} className="flex items-center gap-2 mb-1.5">
                    <span className="w-10 text-xs font-semibold text-[#2D3B45]">{q.label}</span>
                    <div className="flex-1 h-5 bg-[#F0F2F5] rounded overflow-hidden">
                      {q.rate != null && (
                        <div className={`h-full rounded ${q.rate < 0.5 ? 'bg-[#E0061F]/70' : q.rate < 0.75 ? 'bg-amber-400' : 'bg-[#0B874B]/80'}`}
                          style={{ width: `${q.rate * 100}%` }} />
                      )}
                    </div>
                    <span className="w-12 text-xs text-[#6B7780] font-mono text-right">
                      {q.rate != null ? `${(q.rate * 100).toFixed(0)}%` : '—'}
                    </span>
                    {q.topic && <span className="text-[10px] text-[#9AA5AF] w-20 truncate">{q.topic}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* v2: 待处理申诉 */}
      {regrades.filter((r) => r.status === 'open').length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-5">
          <div className="font-semibold text-amber-800 text-sm mb-2">
            💬 {regrades.filter((r) => r.status === 'open').length} 条申诉待处理
          </div>
          <div className="space-y-2">
            {regrades.filter((r) => r.status === 'open').map((r) => (
              <RegradeRow key={r.id} r={r} onDone={load} />
            ))}
          </div>
        </div>
      )}

      {/* Gradebook 风格表格 */}
      <div className="bg-white rounded-lg border border-[#C7CDD1] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F5F5F5] text-left text-xs text-[#6B7780] uppercase tracking-wide">
              <th className="px-4 py-2.5 font-semibold">学生</th>
              <th className="px-3 py-2.5 font-semibold">状态</th>
              {hasRubric && <th className="px-3 py-2.5 font-semibold">判分进度</th>}
              <th className="px-3 py-2.5 font-semibold text-right">分数</th>
              <th className="px-4 py-2.5 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8EAEC]">
            {roster.map((r: any) => {
              const s = STATUS_LABEL[r.status] ?? STATUS_LABEL.missing;
              return (
                <tr key={r.student.id} className="hover:bg-[#F8FAFB]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-full bg-[#0374B5] text-white flex items-center justify-center text-xs font-semibold shrink-0">
                        {(r.student.name || '?').slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-[#2D3B45] truncate">{r.student.name}</div>
                        <div className="text-xs text-[#6B7780]">
                          {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.text}</span>
                    {r.isLate && <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-[#E0061F]">迟交</span>}
                  </td>
                  {hasRubric && (
                    <td className="px-3 py-2.5">
                      {r.submissionId && r.status !== 'missing' && r.status !== 'in_progress' ? (
                        <span className="inline-flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs ${r.teacherGraded === r.questionCount ? 'text-[#0B874B] font-medium' : 'text-[#6B7780]'}`}>
                            {r.teacherGraded}/{r.questionCount} 题
                          </span>
                          {r.aiPending > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">🤖 {r.aiPending}</span>
                          )}
                          {r.readyToPublish && (
                            <span className="px-1.5 py-0.5 rounded-full text-xs bg-[#0B874B] text-white">可发布</span>
                          )}
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right">
                    {r.teacherScore != null ? (
                      <span className="font-bold text-[#2D3B45]">
                        {r.teacherScore}
                        <span className="text-xs text-[#6B7780] font-normal">{homework.totalMarks ? `/${homework.totalMarks}` : ''}</span>
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.submissionId && r.pageCount > 0 && (
                      <button
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-[#0374B5] text-white hover:bg-[#02659F]"
                        onClick={() => setGrading(r.submissionId)}>
                        {r.status === 'returned' ? '查看' : 'SpeedGrader'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {grading && (
        <SpeedGrader
          submissionId={grading}
          gradable={gradable}
          totalMarks={homework.totalMarks}
          regrades={regrades}
          onRegradeDone={load}
          onNavigate={(id) => setGrading(id)}
          onClose={() => { setGrading(null); load(); }}
        />
      )}
      {byQuestionId && (
        <QuestionGrader
          assignmentId={assignmentId!}
          questionId={byQuestionId}
          onClose={() => { setByQuestionId(null); load(); }}
        />
      )}
    </div>
  );
}

/** v2 — one open regrade row with inline reply box. */
function RegradeRow({ r, onDone }: { r: any; onDone: () => void }) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="bg-white rounded-md border border-amber-200 p-3">
      <div className="text-sm">
        <b>{r.student.name}</b> 对 <b>{r.question.label}</b> 提出申诉：
        <span className="text-[#2D3B45]">{r.message}</span>
      </div>
      <div className="flex gap-2 mt-2">
        <input className="input flex-1 text-sm" placeholder="回复学生（改分请到批改台操作）"
          value={reply} onChange={(e) => setReply(e.target.value)} />
        <button className="px-3 py-1.5 rounded-md bg-[#0374B5] text-white text-sm disabled:opacity-50"
          disabled={busy || !reply.trim()}
          onClick={async () => {
            setBusy(true);
            try { await hwApi.replyRegrade(r.id, reply.trim()); onDone(); }
            catch (e: any) { alert(e.message); }
            finally { setBusy(false); }
          }}>回复</button>
      </div>
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="bg-white rounded-lg border border-[#C7CDD1] p-3 text-center">
      <div className={`text-2xl font-bold ${value === 0 ? 'text-gray-300' : cls}`}>{value}</div>
      <div className="text-xs text-[#6B7780] mt-0.5">{label}</div>
    </div>
  );
}

/**
 * SpeedGrader 仿制：licorice 顶栏（返回 · 统计 · ←[学生下拉]→），
 * 左灰底内容画布，右白评分栏。键盘 ←/→ 切学生，Esc 退出。
 */
function SpeedGrader({ submissionId, gradable, totalMarks, regrades = [], onRegradeDone, onNavigate, onClose }: {
  submissionId: string;
  gradable: any[];
  totalMarks: number | null;
  regrades?: any[];
  onRegradeDone?: () => void;
  onNavigate: (id: string) => void;
  onClose: () => void;
}) {
  const [sub, setSub] = useState<any | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [annotating, setAnnotating] = useState<string | null>(null); // pageId being annotated
  const myRegrades = regrades.filter((r: any) => r.submissionId === submissionId);
  const ids = gradable.map((r) => r.submissionId);
  const idx = ids.indexOf(submissionId);
  const gradedCount = useMemo(
    () => gradable.filter((r) => r.status === 'returned' || r.readyToPublish).length,
    [gradable],
  );
  const avg = useMemo(() => {
    const scores = gradable.map((r) => r.teacherScore).filter((x: any) => x != null);
    return scores.length ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : null;
  }, [gradable]);

  useEffect(() => {
    setSub(null);
    hwApi.getSubmission(submissionId).then(setSub).catch((e) => alert(e.message));
  }, [submissionId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && idx > 0) onNavigate(ids[idx - 1]);
      if (e.key === 'ArrowRight' && idx < ids.length - 1) onNavigate(ids[idx + 1]);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [idx, ids, onClose, onNavigate]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F5F5F5]">
      {/* SpeedGrader 顶栏 */}
      <div className="h-14 bg-[#2D3B45] text-white flex items-center px-3 gap-4 shrink-0">
        <button className="w-9 h-9 rounded hover:bg-white/10 text-xl leading-none" title="返回看板 (Esc)"
          onClick={onClose}>←</button>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">
            {sub ? sub.assignment.homework.title : '加载中…'}
          </div>
          <div className="text-xs text-white/70">SpeedGrader™ 式判分</div>
        </div>
        <div className="hidden md:flex items-center gap-4 text-xs text-white/80 ml-4">
          <span>已判 <b className="text-white">{gradedCount}</b> / {gradable.length}</span>
          {avg != null && <span>平均 <b className="text-white">{avg}</b>{totalMarks ? ` / ${totalMarks}` : ''}</span>}
        </div>
        {/* 学生切换器 */}
        <div className="ml-auto flex items-center gap-1.5">
          <button className="w-9 h-9 rounded hover:bg-white/10 disabled:opacity-30 text-lg" disabled={idx <= 0}
            title="上一位 (←)" onClick={() => onNavigate(ids[idx - 1])}>‹</button>
          <select
            className="h-9 rounded bg-[#3C4F5E] text-white text-sm px-2 max-w-48 outline-none border border-white/20"
            value={submissionId}
            onChange={(e) => onNavigate(e.target.value)}>
            {gradable.map((r, i) => (
              <option key={r.submissionId} value={r.submissionId}>
                {i + 1}/{gradable.length} · {r.student.name}{r.status === 'returned' ? ' ✓' : ''}
              </option>
            ))}
          </select>
          <button className="w-9 h-9 rounded hover:bg-white/10 disabled:opacity-30 text-lg" disabled={idx >= ids.length - 1}
            title="下一位 (→)" onClick={() => onNavigate(ids[idx + 1])}>›</button>
        </div>
      </div>

      {/* 主体 */}
      <div className="flex-1 flex min-h-0">
        {/* 左：提交内容画布 */}
        <div className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 bg-white/95 border-b border-[#C7CDD1] px-4 py-1.5 flex items-center gap-3 text-xs text-[#6B7780]">
            <span>{sub ? `${sub.pages.length} 页提交内容` : ''}</span>
            <button className="ml-auto px-2.5 py-1 rounded border border-[#C7CDD1] hover:bg-gray-50 text-[#2D3B45]"
              onClick={() => setZoomed(!zoomed)}>
              {zoomed ? '适应宽度' : '放大 160%'}
            </button>
          </div>
          {!sub ? (
            <div className="text-gray-400 mt-16 text-center">加载中…</div>
          ) : (
            <div className={`p-6 space-y-6 ${zoomed ? '' : 'max-w-3xl mx-auto'}`}>
              {sub.pages.map((p: any, i: number) => (
                <div key={p.id}>
                  <div className="text-xs text-[#6B7780] mb-1.5 flex items-center gap-2">
                    第 {i + 1} 页 · {p.source === 'ink' ? '✍️ 手写' : '📷 上传'}
                    {p.mimeType !== 'application/pdf' && (
                      <button
                        className={`ml-auto px-2 py-0.5 rounded border text-xs ${annotating === p.id ? 'bg-[#E0061F] text-white border-[#E0061F]' : 'border-[#C7CDD1] text-[#2D3B45] hover:bg-gray-50'}`}
                        onClick={() => setAnnotating(annotating === p.id ? null : p.id)}>
                        {annotating === p.id ? '批注中…点此退出' : '✏️ 批注'}
                      </button>
                    )}
                    {Array.isArray(p.teacherInk) && p.teacherInk.length > 0 && annotating !== p.id && (
                      <span className="text-[#E0061F]">已有批注</span>
                    )}
                  </div>
                  {p.mimeType === 'application/pdf' ? (
                    <div className="bg-white rounded border border-[#C7CDD1]">
                      <PdfPreview contentPath={hwPageContentPath(p.id)} />
                    </div>
                  ) : annotating === p.id ? (
                    <AnnotatePage page={p}
                      onSaved={(strokes) => {
                        setSub({ ...sub, pages: sub.pages.map((x: any) => x.id === p.id ? { ...x, teacherInk: strokes } : x) });
                        setAnnotating(null);
                      }}
                      onCancel={() => setAnnotating(null)} />
                  ) : (
                    <div className={zoomed ? 'overflow-auto' : ''}>
                      <AnnotatedImage pageId={p.id} strokes={p.teacherInk}
                        className={`border border-[#C7CDD1] rounded shadow-sm bg-white ${zoomed ? 'max-w-none w-[160%]' : 'w-full'}`} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右：评分栏 */}
        <div className="w-[24rem] shrink-0 bg-white border-l border-[#C7CDD1] overflow-y-auto">
          {sub && (
            <>
              {/* Submitted 块 */}
              <div className="px-4 py-3 border-b border-[#E8EAEC]">
                <div className="text-sm font-semibold text-[#2D3B45]">{sub.student.name}</div>
                <div className="text-xs text-[#6B7780] mt-0.5">
                  {sub.submittedAt ? `提交于 ${new Date(sub.submittedAt).toLocaleString()}` : '未提交'}
                  {sub.isLate && <span className="text-[#E0061F] font-medium"> · 迟交</span>}
                </div>
                {sub.status === 'returned' && (
                  <div className="text-xs text-[#0B874B] mt-0.5">✓ 已返回学生{sub.returnedAt ? ` · ${new Date(sub.returnedAt).toLocaleString()}` : ''}</div>
                )}
              </div>
              {myRegrades.length > 0 && (
                <div className="px-4 pt-3">
                  {myRegrades.map((r: any) => (
                    <div key={r.id} className={`rounded-md border p-2.5 mb-2 text-sm ${r.status === 'open' ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-[#E8EAEC]'}`}>
                      <div className="text-xs font-semibold text-amber-800 mb-1">
                        💬 {r.question.label} 申诉{r.status === 'replied' ? '（已回复）' : ''}
                      </div>
                      <div className="text-[#2D3B45]">{r.message}</div>
                      {r.status === 'open' && onRegradeDone && (
                        <InlineReply requestId={r.id} onDone={onRegradeDone} />
                      )}
                      {r.reply && <div className="text-xs text-[#6B7780] mt-1">回复：{r.reply}</div>}
                    </div>
                  ))}
                </div>
              )}
              <div className="p-4">
                {sub.assignment.homework.questions?.length > 0 ? (
                  <RubricPanel key={sub.id} sub={sub}
                    onReturned={() => {
                      if (idx < ids.length - 1) onNavigate(ids[idx + 1]);
                      else onClose();
                    }}
                    reload={() => hwApi.getSubmission(submissionId).then(setSub)} />
                ) : (
                  <SimplePanel key={sub.id} sub={sub} onReturned={onClose} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** 无 rubric：Canvas 的单一 Grade 框。 */
function SimplePanel({ sub, onReturned }: { sub: any; onReturned: () => void }) {
  const totalMarks = sub.assignment.homework.totalMarks;
  const [score, setScore] = useState(sub.teacherScore != null ? String(sub.teacherScore) : '');
  const [comment, setComment] = useState(sub.teacherComment ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold text-[#6B7780] uppercase tracking-wide mb-1.5">Grade 分数</label>
      <div className="flex items-baseline gap-2 mb-4">
        <input
          className="w-24 h-12 text-2xl font-bold text-center border border-[#C7CDD1] rounded-md focus:ring-2 focus:ring-[#0374B5] outline-none"
          type="number" min={0} value={score} onChange={(e) => setScore(e.target.value)} />
        {totalMarks ? <span className="text-[#6B7780]">/ {totalMarks}</span> : null}
      </div>
      <div className="text-xs text-[#6B7780] bg-[#F5F5F5] rounded p-2 mb-4">
        这份作业没有评分标准。在作业中心设置「评分标准」可逐题评分，AI 建议分也会按题呈现。
      </div>
      <label className="block text-xs font-semibold text-[#6B7780] uppercase tracking-wide mb-1.5">Comments 评语</label>
      <textarea className="w-full border border-[#C7CDD1] rounded-md p-2 text-sm focus:ring-2 focus:ring-[#0374B5] outline-none"
        rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="写给学生的评语…" />
      <button
        className="mt-4 w-full py-2.5 rounded-md bg-[#0374B5] text-white font-medium hover:bg-[#02659F] disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await hwApi.returnSubmission(sub.id, {
              teacherScore: score === '' ? undefined : Number(score),
              teacherComment: comment || undefined,
            });
            onReturned();
          } catch (e: any) { alert(e.message); }
          finally { setBusy(false); }
        }}>
        {busy ? '提交中…' : sub.status === 'returned' ? '更新并返回' : '提交评分'}
      </button>
    </div>
  );
}

/** Rubric 面板（Canvas Enhanced Rubrics 风格）+ 总分框 + Comments。 */
function RubricPanel({ sub, onReturned, reload }: { sub: any; onReturned: () => void; reload: () => void }) {
  const questions: any[] = sub.assignment.homework.questions;
  const gradeByQ = new Map<string, any>((sub.grades ?? []).map((g: any) => [g.questionId, g]));
  const [rows, setRows] = useState(
    questions.map((q) => {
      const g = gradeByQ.get(q.id);
      return {
        questionId: q.id, label: q.label, maxMarks: q.maxMarks, criteria: q.criteria,
        items: (q.items as any[]) ?? [],
        applied: ((g?.appliedItems as string[]) ?? []) as string[],
        awarded: g?.awardedMarks != null ? String(g.awardedMarks) : '',
        comment: g?.comment ?? '',
        source: g?.source ?? null,
        confidence: g?.confidence ?? null,
        rationale: g?.rationale ?? null,
      };
    }),
  );

  /** 点击评分项：toggle 应用，分数=deltas 之和（钳到 0..max）。 */
  function toggleItem(rowIdx: number, itemId: string) {
    setRows(rows.map((r, j) => {
      if (j !== rowIdx) return r;
      const applied = r.applied.includes(itemId)
        ? r.applied.filter((x) => x !== itemId)
        : [...r.applied, itemId];
      const sum = applied.reduce((s, id) => s + (r.items.find((x: any) => x.id === id)?.delta ?? 0), 0);
      const awarded = applied.length > 0 ? String(Math.max(0, Math.min(r.maxMarks, sum))) : r.awarded;
      return { ...r, applied, awarded };
    }));
  }
  const [comment, setComment] = useState(sub.teacherComment ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const hasAi = rows.some((r) => r.source === 'ai_suggested');
  const total = rows.reduce((s, r) => s + (Number(r.awarded) || 0), 0);
  const maxTotal = questions.reduce((s, q) => s + q.maxMarks, 0);
  const payload = () => rows.map((r) => ({
    questionId: r.questionId,
    awardedMarks: r.awarded === '' ? null : Number(r.awarded),
    comment: r.comment || undefined,
    appliedItems: r.applied.length > 0 ? r.applied : undefined,
  }));

  return (
    <div>
      {/* Grade 总分框（rubric 自动汇总，Canvas 行为） */}
      <label className="block text-xs font-semibold text-[#6B7780] uppercase tracking-wide mb-1.5">Grade 总分</label>
      <div className="flex items-baseline gap-2 mb-1">
        <div className="w-24 h-12 text-2xl font-bold text-center border border-[#C7CDD1] rounded-md bg-[#F5F5F5] flex items-center justify-center text-[#2D3B45]">
          {total}
        </div>
        <span className="text-[#6B7780]">/ {maxTotal}</span>
        <span className="text-xs text-[#6B7780] ml-1">由下方评分标准自动汇总</span>
      </div>
      {hasAi && (
        <div className="text-xs bg-purple-50 border border-purple-200 text-purple-700 rounded-md px-2.5 py-1.5 mt-2 mb-1">
          🤖 含 AI 建议分（预填）— 逐题复核后发布
        </div>
      )}

      {/* Rubric 行 */}
      <div className="mt-3 mb-1 text-xs font-semibold text-[#6B7780] uppercase tracking-wide">Rubric 评分标准</div>
      <div className="border border-[#C7CDD1] rounded-md divide-y divide-[#E8EAEC] overflow-hidden">
        {rows.map((r, i) => (
          <div key={r.questionId} className={`p-3 ${r.source === 'ai_suggested' ? 'bg-purple-50/50' : 'bg-white'}`}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#2D3B45] w-8">{r.label}</span>
              <input
                className="w-14 h-9 text-center text-base font-semibold border border-[#C7CDD1] rounded-md focus:ring-2 focus:ring-[#0374B5] outline-none"
                type="number" inputMode="numeric" min={0} max={r.maxMarks} value={r.awarded}
                onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, awarded: e.target.value } : x))} />
              <span className="text-xs text-[#6B7780] whitespace-nowrap">/ {r.maxMarks}</span>
              <span className="flex gap-1 ml-1">
                <button className="h-7 px-2 text-xs rounded border border-[#C7CDD1] text-[#0B874B] hover:bg-green-50"
                  onClick={() => setRows(rows.map((x, j) => j === i ? { ...x, awarded: String(r.maxMarks) } : x))}>满</button>
                <button className="h-7 px-2 text-xs rounded border border-[#C7CDD1] text-[#E0061F] hover:bg-red-50"
                  onClick={() => setRows(rows.map((x, j) => j === i ? { ...x, awarded: '0' } : x))}>零</button>
              </span>
              <span className="ml-auto">
                {r.source === 'ai_suggested' && (
                  <span className="text-[11px] text-purple-700 bg-purple-100 rounded-full px-2 py-0.5 whitespace-nowrap">
                    🤖{r.confidence != null ? ` ${Math.round(r.confidence * 100)}%` : ''}
                  </span>
                )}
                {r.source === 'teacher' && (
                  <span className="text-[11px] text-[#0B874B] bg-green-50 rounded-full px-2 py-0.5">✓</span>
                )}
              </span>
            </div>
            {/* v2 评分项：点击应用，正负分自动累计（Gradescope rubric items） */}
            {r.items.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {r.items.map((it: any) => {
                  const on = r.applied.includes(it.id);
                  return (
                    <button key={it.id}
                      className={`px-2 py-1 rounded-md text-xs border transition ${
                        on
                          ? it.delta >= 0
                            ? 'bg-[#0B874B] text-white border-[#0B874B]'
                            : 'bg-[#E0061F] text-white border-[#E0061F]'
                          : 'bg-white border-[#C7CDD1] text-[#2D3B45] hover:border-[#0374B5]'
                      }`}
                      onClick={() => toggleItem(i, it.id)}>
                      {it.delta >= 0 ? `+${it.delta}` : it.delta} {it.label}
                    </button>
                  );
                })}
              </div>
            )}
            {r.criteria && <div className="text-xs text-[#6B7780] mt-1.5">{r.criteria}</div>}
            {r.rationale && <div className="text-xs text-purple-700 bg-purple-50 rounded px-2 py-1 mt-1.5">AI：{r.rationale}</div>}
            <input
              className="w-full mt-2 border border-[#C7CDD1] rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#0374B5] outline-none"
              placeholder="本题评语（可选）" value={r.comment}
              onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, comment: e.target.value } : x))} />
          </div>
        ))}
      </div>

      {/* Comments */}
      <div className="mt-4 mb-1.5 text-xs font-semibold text-[#6B7780] uppercase tracking-wide">Assignment Comments 总评语</div>
      <textarea className="w-full border border-[#C7CDD1] rounded-md p-2 text-sm focus:ring-2 focus:ring-[#0374B5] outline-none"
        rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="写给学生的总评…" />
      {err && <div className="text-sm text-[#E0061F] mt-2">{err}</div>}

      <div className="flex flex-col gap-2 mt-4">
        <button className="w-full py-2 rounded-md border border-[#C7CDD1] text-sm text-[#2D3B45] hover:bg-gray-50 disabled:opacity-50"
          disabled={busy}
          onClick={async () => {
            setBusy(true); setErr('');
            try {
              await hwApi.saveGrades(sub.id, payload());
              await reload();
              setRows((rs) => rs.map((r) => ({ ...r, source: 'teacher' })));
            } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
          }}>
          {busy ? '保存中…' : hasAi ? '✓ 确认为老师评分（暂存）' : '暂存'}
        </button>
        <button className="w-full py-2.5 rounded-md bg-[#0374B5] text-white font-medium hover:bg-[#02659F] disabled:opacity-50"
          disabled={busy}
          onClick={async () => {
            setBusy(true); setErr('');
            try {
              await hwApi.saveGrades(sub.id, payload());
              await hwApi.publishGrades(sub.id, comment || undefined);
              onReturned();
            } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
          }}>
          {busy ? '发布中…' : '发布给学生 → 下一位'}
        </button>
      </div>
    </div>
  );
}

/** v2 — 申诉行内回复（SpeedGrader 右栏）。 */
function InlineReply({ requestId, onDone }: { requestId: string; onDone: () => void }) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex gap-1.5 mt-1.5">
      <input className="input flex-1 text-xs" placeholder="回复…" value={reply}
        onChange={(e) => setReply(e.target.value)} />
      <button className="px-2 py-1 rounded bg-[#0374B5] text-white text-xs disabled:opacity-50"
        disabled={busy || !reply.trim()}
        onClick={async () => {
          setBusy(true);
          try { await hwApi.replyRegrade(requestId, reply.trim()); onDone(); }
          catch (e: any) { alert(e.message); } finally { setBusy(false); }
        }}>发送</button>
    </div>
  );
}

/** Authorized image fetch shared by the annotation components. */
function useAuthedImage(pageId: string) {
  const [state, setState] = useState<{ url: string; w: number; h: number } | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    (async () => {
      const token = localStorage.getItem('auth_token');
      const base = (import.meta as any).env?.VITE_API_URL || '';
      const res = await fetch(`${base}${hwPageContentPath(pageId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok || cancelled) return;
      const url = URL.createObjectURL(await res.blob());
      revoke = url;
      const img = new Image();
      img.onload = () => { if (!cancelled) setState({ url, w: img.naturalWidth, h: img.naturalHeight }); };
      img.src = url;
    })();
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke); };
  }, [pageId]);
  return state;
}

/** v2 — 答卷图 + 老师批注叠加（SVG polyline，原图不动）。 */
function AnnotatedImage({ pageId, strokes, className }: { pageId: string; strokes?: any[] | null; className?: string }) {
  const img = useAuthedImage(pageId);
  if (!img) return <div className="text-xs text-gray-400 p-6 text-center bg-white border border-[#C7CDD1] rounded">加载中…</div>;
  const hasInk = Array.isArray(strokes) && strokes.length > 0;
  return (
    <div className={`relative ${className ?? ''}`} style={{ lineHeight: 0 }}>
      <img src={img.url} alt="答卷" className="w-full rounded" />
      {hasInk && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${img.w} ${img.h}`} preserveAspectRatio="none">
          {strokes!.map((s: any, i: number) => (
            <polyline key={i}
              points={(s.pts ?? []).map((p: number[]) => `${p[0]},${p[1]}`).join(' ')}
              fill="none" stroke={s.color ?? '#E0061F'} strokeWidth={s.size ?? 3}
              strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>
      )}
    </div>
  );
}

/** v2 — 批注编辑：在答卷图上用红笔圈画（复用手写画布，保存到 teacherInk）。 */
function AnnotatePage({ page, onSaved, onCancel }: { page: any; onSaved: (strokes: any[]) => void; onCancel: () => void }) {
  const img = useAuthedImage(page.id);
  const [strokes, setStrokes] = useState<Stroke[]>(Array.isArray(page.teacherInk) ? page.teacherInk : []);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [busy, setBusy] = useState(false);
  if (!img) return <div className="text-xs text-gray-400 p-6 text-center bg-white border rounded">加载中…</div>;
  return (
    <div className="border-2 border-[#E0061F] rounded overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border-b border-red-200 text-sm">
        <span className="text-[#E0061F] font-medium">✏️ 批注模式</span>
        <button className={`px-2 py-0.5 rounded text-xs border ${tool === 'pen' ? 'bg-[#E0061F] text-white border-[#E0061F]' : 'border-[#C7CDD1]'}`}
          onClick={() => setTool('pen')}>红笔</button>
        <button className={`px-2 py-0.5 rounded text-xs border ${tool === 'eraser' ? 'bg-[#E0061F] text-white border-[#E0061F]' : 'border-[#C7CDD1]'}`}
          onClick={() => setTool('eraser')}>橡皮</button>
        <button className="px-2 py-0.5 rounded text-xs border border-[#C7CDD1]"
          onClick={() => setStrokes((s) => s.slice(0, -1))}>撤销</button>
        <span className="ml-auto flex gap-1.5">
          <button className="px-3 py-1 rounded text-xs border border-[#C7CDD1]" onClick={onCancel}>取消</button>
          <button className="px-3 py-1 rounded text-xs bg-[#0374B5] text-white disabled:opacity-50" disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await hwApi.saveAnnotations(page.id, strokes); onSaved(strokes); }
              catch (e: any) { alert(e.message); } finally { setBusy(false); }
            }}>
            {busy ? '保存中…' : '保存批注'}
          </button>
        </span>
      </div>
      <HandwritingCanvas
        width={img.w} height={img.h}
        strokes={strokes}
        backgroundUrl={img.url}
        color="#E0061F" size={Math.max(3, Math.round(img.w / 300))}
        tool={tool} penOnly={false}
        onChange={(updater) => setStrokes(updater)}
      />
    </div>
  );
}

/** v2 — 题区裁剪显示：把答卷图裁到该题的作答区域（归一化坐标 CSS crop）。 */
function RegionCrop({ pageId, region }: { pageId: string; region: { x: number; y: number; w: number; h: number } }) {
  const img = useAuthedImage(pageId);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    if (!boxRef.current) return;
    const ro = new ResizeObserver((es) => setBoxW(es[0].contentRect.width));
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [img]);
  if (!img) return <div ref={boxRef} className="text-xs text-gray-400 p-6 text-center bg-white border rounded">加载中…</div>;
  const scale = boxW > 0 ? boxW / (region.w * img.w) : 0;
  return (
    <div ref={boxRef} className="relative overflow-hidden rounded border border-[#C7CDD1] bg-white"
      style={{ height: boxW > 0 ? region.h * img.h * scale : 120 }}>
      {boxW > 0 && (
        <img src={img.url} alt="题区" className="absolute max-w-none"
          style={{
            width: img.w * scale,
            left: -region.x * img.w * scale,
            top: -region.y * img.h * scale,
          }} />
      )}
    </div>
  );
}

/**
 * v2 — 按题批改（vertical grading）：一道题、全班连批。
 * 有题区且答卷为手写卷面页时自动裁剪放大到作答区；否则显示整页。
 * 判分即存，→ 下一位。
 */
function QuestionGrader({ assignmentId, questionId, onClose }: {
  assignmentId: string; questionId: string; onClose: () => void;
}) {
  const [data, setData] = useState<any | null>(null);
  const [idx, setIdx] = useState(0);
  const [awarded, setAwarded] = useState('');
  const [applied, setApplied] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    hwApi.byQuestion(assignmentId, questionId).then(setData).catch((e) => alert(e.message));
  }, [assignmentId, questionId]);

  const entry = data?.entries?.[idx];
  useEffect(() => {
    if (!entry) return;
    setAwarded(entry.grade?.awardedMarks != null ? String(entry.grade.awardedMarks) : '');
    setApplied(((entry.grade?.appliedItems as string[]) ?? []));
    setComment(entry.grade?.comment ?? '');
  }, [entry?.submissionId]);

  if (!data) return (
    <div className="fixed inset-0 bg-black/40 z-[80] flex items-center justify-center text-white">加载中…</div>
  );
  const q = data.question;
  const items: any[] = (q.items as any[]) ?? [];
  const regions: any[] = (q.regions as any[]) ?? [];
  // 启发式：题区定义在卷面第 page 页 → 手写页 sortOrder 与卷面页对齐时命中。
  const region = regions[0] ?? null;
  const inkPages = entry ? entry.pages.filter((p: any) => p.source === 'ink') : [];
  const cropPage = region && region.page != null && inkPages[region.page - 1]
    ? inkPages[region.page - 1] : null;

  function toggle(itemId: string) {
    const next = applied.includes(itemId) ? applied.filter((x) => x !== itemId) : [...applied, itemId];
    setApplied(next);
    if (next.length > 0) {
      const sum = next.reduce((s, id) => s + (items.find((x) => x.id === id)?.delta ?? 0), 0);
      setAwarded(String(Math.max(0, Math.min(q.maxMarks, sum))));
    }
  }

  async function saveAndNext() {
    if (!entry) return;
    setBusy(true);
    try {
      await hwApi.saveGrades(entry.submissionId, [{
        questionId,
        awardedMarks: awarded === '' ? null : Number(awarded),
        comment: comment || undefined,
        appliedItems: applied.length > 0 ? applied : undefined,
      }]);
      if (idx < data.entries.length - 1) setIdx(idx + 1);
      else onClose();
    } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-[#F5F5F5] z-[80] flex flex-col">
      <div className="h-12 bg-[#2D3B45] text-white flex items-center px-4 gap-4 shrink-0">
        <button className="text-lg hover:bg-white/10 rounded w-8 h-8" onClick={onClose}>←</button>
        <span className="font-semibold">按题批改 · {q.label}</span>
        <span className="text-xs text-white/70">满分 {q.maxMarks}{q.topic ? ` · ${q.topic}` : ''}</span>
        <span className="ml-auto text-sm">
          {idx + 1} / {data.entries.length} · {entry?.student.name}
        </span>
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 overflow-auto p-5">
          {!entry ? <div className="text-gray-400 text-center mt-10">没有已提交的学生</div> : (
            <div className="max-w-2xl mx-auto space-y-3">
              {cropPage ? (
                <>
                  <div className="text-xs text-[#6B7780]">已按题区裁剪 · 第 {region.page} 页作答区</div>
                  <RegionCrop pageId={cropPage.id} region={region} />
                  <details className="text-xs text-[#6B7780]">
                    <summary className="cursor-pointer">查看整页</summary>
                    <AuthImage src={hwPageContentPath(cropPage.id)} alt="整页" className="w-full mt-2 border rounded" />
                  </details>
                </>
              ) : (
                entry.pages.filter((p: any) => p.mimeType !== 'application/pdf').map((p: any, i: number) => (
                  <AuthImage key={p.id} src={hwPageContentPath(p.id)} alt={`第${i + 1}页`}
                    className="w-full border border-[#C7CDD1] rounded bg-white" />
                ))
              )}
            </div>
          )}
        </div>
        <div className="w-80 shrink-0 bg-white border-l border-[#C7CDD1] p-4 overflow-y-auto">
          {q.criteria && <div className="text-xs text-[#6B7780] bg-[#F5F8FA] rounded p-2 mb-3">📌 {q.criteria}</div>}
          <div className="flex items-baseline gap-2 mb-3">
            <input className="w-16 h-11 text-xl font-bold text-center border border-[#C7CDD1] rounded-md" type="number"
              min={0} max={q.maxMarks} value={awarded} onChange={(e) => { setAwarded(e.target.value); setApplied([]); }} />
            <span className="text-[#6B7780]">/ {q.maxMarks}</span>
          </div>
          {items.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {items.map((it) => {
                const on = applied.includes(it.id);
                return (
                  <button key={it.id}
                    className={`px-2 py-1 rounded-md text-xs border ${on ? (it.delta >= 0 ? 'bg-[#0B874B] text-white border-[#0B874B]' : 'bg-[#E0061F] text-white border-[#E0061F]') : 'bg-white border-[#C7CDD1]'}`}
                    onClick={() => toggle(it.id)}>
                    {it.delta >= 0 ? `+${it.delta}` : it.delta} {it.label}
                  </button>
                );
              })}
            </div>
          )}
          <input className="input w-full text-sm mb-3" placeholder="本题评语（可选）" value={comment}
            onChange={(e) => setComment(e.target.value)} />
          <button className="w-full py-2.5 rounded-md bg-[#0374B5] text-white font-medium disabled:opacity-50"
            disabled={busy || !entry} onClick={saveAndNext}>
            {busy ? '保存中…' : idx < (data.entries.length - 1) ? '保存 → 下一位' : '保存并完成'}
          </button>
          <div className="flex justify-between mt-2 text-sm">
            <button className="text-[#0374B5] disabled:opacity-30" disabled={idx <= 0} onClick={() => setIdx(idx - 1)}>‹ 上一位</button>
            <button className="text-[#0374B5] disabled:opacity-30" disabled={idx >= data.entries.length - 1} onClick={() => setIdx(idx + 1)}>下一位 ›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
