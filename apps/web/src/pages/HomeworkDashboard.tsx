import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { hwApi, hwPageContentPath } from '../lib/api-homework';
import { AuthImage } from '../components/AuthImage';
import { PdfPreview } from '../components/PdfPreview';

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

  async function load() {
    try {
      setData(await hwApi.dashboard(assignmentId!));
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
        <div className="flex gap-2">
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
          onNavigate={(id) => setGrading(id)}
          onClose={() => { setGrading(null); load(); }}
        />
      )}
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
function SpeedGrader({ submissionId, gradable, totalMarks, onNavigate, onClose }: {
  submissionId: string;
  gradable: any[];
  totalMarks: number | null;
  onNavigate: (id: string) => void;
  onClose: () => void;
}) {
  const [sub, setSub] = useState<any | null>(null);
  const [zoomed, setZoomed] = useState(false);
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
                  <div className="text-xs text-[#6B7780] mb-1.5">
                    第 {i + 1} 页 · {p.source === 'ink' ? '✍️ 手写' : '📷 上传'}
                  </div>
                  {p.mimeType === 'application/pdf' ? (
                    <div className="bg-white rounded border border-[#C7CDD1]">
                      <PdfPreview contentPath={hwPageContentPath(p.id)} />
                    </div>
                  ) : (
                    <div className={zoomed ? 'overflow-auto' : ''}>
                      <AuthImage src={hwPageContentPath(p.id)} alt={`第 ${i + 1} 页`}
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
        awarded: g?.awardedMarks != null ? String(g.awardedMarks) : '',
        comment: g?.comment ?? '',
        source: g?.source ?? null,
        confidence: g?.confidence ?? null,
        rationale: g?.rationale ?? null,
      };
    }),
  );
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
