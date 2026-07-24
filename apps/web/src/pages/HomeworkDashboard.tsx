import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { hwApi, hwPageContentPath } from '../lib/api-homework';
import { AuthImage } from '../components/AuthImage';
import { PdfPreview } from '../components/PdfPreview';

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  missing: { text: '未交', cls: 'bg-gray-100 text-gray-600' },
  in_progress: { text: '作答中', cls: 'bg-amber-100 text-amber-700' },
  submitted: { text: '已交', cls: 'bg-blue-100 text-blue-700' },
  returned: { text: '已返回', cls: 'bg-green-100 text-green-700' },
};

/**
 * 收卷看板（UX r1 改版）：
 * - 每行显示判分进度徽章（已判 x/N、🤖AI 待复核、可发布●）
 * - 一键批量发布所有「每题都已老师确认」的提交
 * - 「批改」打开全屏 Gradescope 式判分台（左答卷右评分 + 上/下一份导航）
 */
export default function HomeworkDashboardPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState('');
  const [grading, setGrading] = useState<string | null>(null); // submissionId
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
  // 可批改列表（有提交且有页）用于台内导航
  const gradable = roster.filter((r: any) => r.submissionId && r.pageCount > 0);
  const readyCount = roster.filter((r: any) => r.readyToPublish).length;
  const aiPendingTotal = roster.reduce((s: number, r: any) => s + (r.aiPending ?? 0), 0);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-1 text-sm">
        <Link to="/homework" className="text-blue-600 hover:underline">← 作业中心</Link>
      </div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{homework.title}</h1>
          <div className="text-sm text-gray-600 mb-4">
            {homework.course?.name} · {klass.name}
            {data.dueAt && <> · 截止 {new Date(data.dueAt).toLocaleString()}</>}
            {data.status === 'closed' && <span className="text-red-600"> · 已关闭</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {hasRubric && readyCount > 0 && (
            <button className="btn btn-primary" disabled={bulkBusy}
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
              {bulkBusy ? '发布中…' : `📢 批量发布（${readyCount}）`}
            </button>
          )}
          {data.status === 'open' ? (
            <button className="btn btn-ghost text-sm"
              onClick={async () => {
                if (!confirm('提前关闭收卷？关闭后学生不能再提交。')) return;
                await hwApi.updateAssignment(data.id, { status: 'closed' });
                load();
              }}>🔒 关闭收卷</button>
          ) : (
            <button className="btn btn-ghost text-sm"
              onClick={async () => { await hwApi.updateAssignment(data.id, { status: 'open' }); load(); }}>
              🔓 重新开放
            </button>
          )}
        </div>
      </div>

      {/* 汇总条 */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <Stat label="已交" value={counts.submitted} cls="text-blue-700" />
        <Stat label="作答中" value={counts.inProgress} cls="text-amber-700" />
        <Stat label="未交" value={counts.missing} cls="text-gray-700" />
        <Stat label="迟交" value={counts.late} cls="text-red-700" />
        <Stat label="🤖 待复核" value={aiPendingTotal} cls="text-purple-700" />
      </div>

      {/* 名单 */}
      <div className="bg-white rounded-lg border shadow-sm divide-y overflow-hidden">
        {roster.map((r: any) => {
          const s = STATUS_LABEL[r.status] ?? STATUS_LABEL.missing;
          const initial = (r.student.name || '?').slice(0, 1);
          return (
            <div key={r.student.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/70">
              {/* 头像 + 姓名/时间 两行 */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-semibold shrink-0">
                {initial}
              </div>
              <div className="min-w-0 w-44 shrink-0">
                <div className="font-medium truncate">{r.student.name}</div>
                <div className="text-xs text-gray-400">
                  {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}
                </div>
              </div>
              {/* 状态徽章组 */}
              <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.text}</span>
                {r.isLate && <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">迟交</span>}
                {hasRubric && r.submissionId && r.status !== 'missing' && r.status !== 'in_progress' && (
                  <>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      r.teacherGraded === r.questionCount ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      已判 {r.teacherGraded}/{r.questionCount}
                    </span>
                    {r.aiPending > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
                        🤖 {r.aiPending} 待复核
                      </span>
                    )}
                    {r.readyToPublish && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-green-600 text-white">可发布</span>
                    )}
                  </>
                )}
              </div>
              {/* 分数 + 操作 */}
              <div className="flex items-center gap-3 shrink-0">
                {r.teacherScore != null && (
                  <span className="text-lg font-bold text-gray-800">
                    {r.teacherScore}<span className="text-xs text-gray-400 font-normal">{homework.totalMarks ? ` / ${homework.totalMarks}` : ''}</span>
                  </span>
                )}
                {r.submissionId && r.pageCount > 0 && (
                  <button className="btn btn-primary text-sm px-4"
                    onClick={() => setGrading(r.submissionId)}>
                    {r.status === 'returned' ? '查看' : '批改'} →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {grading && (
        <GradingConsole
          submissionId={grading}
          gradableIds={gradable.map((r: any) => r.submissionId)}
          onNavigate={(id) => setGrading(id)}
          onClose={() => { setGrading(null); load(); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-3 text-center">
      <div className={`text-2xl font-bold ${value === 0 ? 'text-gray-300' : cls}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

/**
 * 全屏判分台（Gradescope 式）：左侧答卷图（点击放大），右侧固定评分面板，
 * 顶栏学生间 ← → 导航。有 rubric 走逐题评分；无 rubric 走单分返回。
 */
function GradingConsole({ submissionId, gradableIds, onNavigate, onClose }: {
  submissionId: string;
  gradableIds: string[];
  onNavigate: (id: string) => void;
  onClose: () => void;
}) {
  const [sub, setSub] = useState<any | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const idx = gradableIds.indexOf(submissionId);

  useEffect(() => {
    setSub(null);
    hwApi.getSubmission(submissionId).then(setSub).catch((e) => alert(e.message));
  }, [submissionId]);

  // keyboard: ← → navigate, Esc close
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && idx > 0) onNavigate(gradableIds[idx - 1]);
      if (e.key === 'ArrowRight' && idx < gradableIds.length - 1) onNavigate(gradableIds[idx + 1]);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [idx, gradableIds, onClose, onNavigate]);

  return (
    <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">
      {/* 顶栏 */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button className="btn btn-ghost text-sm" disabled={idx <= 0}
            onClick={() => onNavigate(gradableIds[idx - 1])}>← 上一份</button>
          <div className="min-w-0">
            <div className="font-semibold truncate">
              {sub ? `${sub.student.name} — ${sub.assignment.homework.title}` : '加载中…'}
            </div>
            <div className="text-xs text-gray-500">
              第 {idx + 1} / {gradableIds.length} 份
              {sub?.isLate && <span className="text-red-600"> · 迟交</span>}
              {sub?.status === 'returned' && <span className="text-green-600"> · 已返回学生</span>}
            </div>
          </div>
          <button className="btn btn-ghost text-sm" disabled={idx >= gradableIds.length - 1}
            onClick={() => onNavigate(gradableIds[idx + 1])}>下一份 →</button>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost text-sm" onClick={() => setZoomed(!zoomed)}>
            {zoomed ? '🔍 适应宽度' : '🔍 放大细看'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>关闭 (Esc)</button>
        </div>
      </div>

      {/* 主体：左答卷 右评分 */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 overflow-auto p-4">
          {!sub ? (
            <div className="text-gray-500 mt-8 text-center">加载中…</div>
          ) : (
            <div className={zoomed ? 'space-y-4' : 'space-y-4 max-w-3xl mx-auto'}>
              {sub.pages.map((p: any, i: number) => (
                <div key={p.id}>
                  <div className="text-xs text-gray-500 mb-1">
                    第 {i + 1} 页
                    <span className="ml-1">{p.source === 'ink' ? '✍️ 手写' : '📷 上传'}</span>
                  </div>
                  {p.mimeType === 'application/pdf' ? (
                    <div className="bg-white rounded border">
                      <PdfPreview contentPath={hwPageContentPath(p.id)} />
                    </div>
                  ) : (
                    <div className={zoomed ? 'overflow-auto' : ''}>
                      <AuthImage src={hwPageContentPath(p.id)} alt={`第 ${i + 1} 页`}
                        className={zoomed
                          ? 'border rounded shadow-sm max-w-none w-[160%] cursor-zoom-out'
                          : 'border rounded shadow-sm w-full cursor-zoom-in'} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右评分面板 */}
        <div className="w-[26rem] shrink-0 bg-white border-l overflow-y-auto p-4">
          {sub && (sub.assignment.homework.questions?.length > 0 ? (
            <GradingPanel key={sub.id} sub={sub}
              onReturned={() => {
                // 发布后自动跳下一份，像 Gradescope 的连续批改流
                if (idx < gradableIds.length - 1) onNavigate(gradableIds[idx + 1]);
                else onClose();
              }}
              reload={() => hwApi.getSubmission(submissionId).then(setSub)} />
          ) : (
            <SimpleReturnPanel key={sub.id} sub={sub} onReturned={onClose} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** 无 rubric 的 M1 单分返回。 */
function SimpleReturnPanel({ sub, onReturned }: { sub: any; onReturned: () => void }) {
  const totalMarks = sub.assignment.homework.totalMarks;
  const [score, setScore] = useState(sub.teacherScore != null ? String(sub.teacherScore) : '');
  const [comment, setComment] = useState(sub.teacherComment ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <h4 className="font-semibold mb-3">打分返回</h4>
      <div className="text-xs text-gray-500 mb-3">
        这份作业没有评分标准（rubric），按单个总分返回。要逐题评分请先在作业中心设置「评分标准」。
      </div>
      <label className="block text-sm mb-1">分数{totalMarks ? `（满分 ${totalMarks}）` : ''}</label>
      <input className="input w-28 mb-3" type="number" min={0} value={score}
        onChange={(e) => setScore(e.target.value)} />
      <label className="block text-sm mb-1">评语（可选）</label>
      <textarea className="input w-full mb-3" rows={3} value={comment}
        onChange={(e) => setComment(e.target.value)} placeholder="写给学生的评语" />
      <button className="btn btn-primary w-full" disabled={busy}
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
        {busy ? '返回中…' : sub.status === 'returned' ? '更新并返回' : '打分并返回学生'}
      </button>
    </div>
  );
}

/** 逐题评分面板（AI 建议预填 + 置信度 + 确认发布）。 */
function GradingPanel({ sub, onReturned, reload }: { sub: any; onReturned: () => void; reload: () => void }) {
  const questions: any[] = sub.assignment.homework.questions;
  const gradeByQ = new Map<string, any>((sub.grades ?? []).map((g: any) => [g.questionId, g]));
  const [rows, setRows] = useState(
    questions.map((q) => {
      const g = gradeByQ.get(q.id);
      return {
        questionId: q.id,
        label: q.label,
        maxMarks: q.maxMarks,
        criteria: q.criteria,
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

  const hasAiSuggestions = rows.some((r) => r.source === 'ai_suggested');
  const total = rows.reduce((s, r) => s + (Number(r.awarded) || 0), 0);
  const maxTotal = questions.reduce((s, q) => s + q.maxMarks, 0);

  function gradesPayload() {
    return rows.map((r) => ({
      questionId: r.questionId,
      awardedMarks: r.awarded === '' ? null : Number(r.awarded),
      comment: r.comment || undefined,
    }));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">逐题评分</h4>
        <span className="text-sm">
          合计 <b className="text-lg">{total}</b> / {maxTotal}
        </span>
      </div>
      {hasAiSuggestions && (
        <div className="text-xs bg-purple-100 text-purple-700 rounded px-2 py-1 mb-2">
          🤖 含 AI 建议分 — 请复核每题后发布
        </div>
      )}
      <div className="space-y-2.5">
        {rows.map((r, i) => (
          <div key={r.questionId}
            className={`rounded-lg border p-3 ${r.source === 'ai_suggested' ? 'bg-purple-50/60 border-purple-200' : 'bg-gray-50/50'}`}>
            {/* 行1：题号 | 分数组（不换行）| 满/零 | 状态徽章 */}
            <div className="flex items-center gap-2 flex-nowrap">
              <span className="inline-flex items-center justify-center min-w-9 h-7 px-1.5 rounded-md bg-gray-800 text-white text-sm font-semibold shrink-0">
                {r.label}
              </span>
              <span className="inline-flex items-baseline gap-1 whitespace-nowrap shrink-0">
                <input
                  className="w-14 h-9 text-center text-lg font-semibold border rounded-md focus:ring-2 focus:ring-blue-400 outline-none"
                  type="number" inputMode="numeric" min={0} max={r.maxMarks} value={r.awarded}
                  onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, awarded: e.target.value } : x))} />
                <span className="text-sm text-gray-400 font-medium">/ {r.maxMarks}</span>
              </span>
              <span className="flex gap-1 shrink-0">
                <button className="h-7 px-2 text-xs rounded-md bg-green-100 text-green-700 hover:bg-green-200" title="满分"
                  onClick={() => setRows(rows.map((x, j) => j === i ? { ...x, awarded: String(r.maxMarks) } : x))}>满</button>
                <button className="h-7 px-2 text-xs rounded-md bg-red-100 text-red-700 hover:bg-red-200" title="零分"
                  onClick={() => setRows(rows.map((x, j) => j === i ? { ...x, awarded: '0' } : x))}>零</button>
              </span>
              <span className="ml-auto shrink-0">
                {r.source === 'ai_suggested' && (
                  <span className="inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-100 rounded-full px-2 py-0.5 whitespace-nowrap">
                    🤖 AI{r.confidence != null ? ` ${Math.round(r.confidence * 100)}%` : ''}
                  </span>
                )}
                {r.source === 'teacher' && (
                  <span className="inline-flex items-center text-xs text-green-700 bg-green-100 rounded-full px-2 py-0.5">✓ 已确认</span>
                )}
              </span>
            </div>
            <input className="input w-full mt-2 text-sm" placeholder="本题评语（可选）" value={r.comment}
              onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, comment: e.target.value } : x))} />
            {r.criteria && (
              <div className="text-xs text-gray-500 mt-1.5 bg-white/70 rounded px-2 py-1">📌 {r.criteria}</div>
            )}
            {r.rationale && (
              <div className="text-xs text-purple-600 mt-1 bg-purple-50 rounded px-2 py-1">🤖 {r.rationale}</div>
            )}
          </div>
        ))}
      </div>
      <label className="block text-sm mt-3 mb-1">总评语（可选）</label>
      <textarea className="input w-full" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      {err && <div className="text-sm text-red-600 mt-2">{err}</div>}
      <div className="flex flex-col gap-2 mt-3">
        <button className="btn btn-ghost" disabled={busy}
          onClick={async () => {
            setBusy(true); setErr('');
            try {
              await hwApi.saveGrades(sub.id, gradesPayload());
              await reload();
              setRows((rs) => rs.map((r) => ({ ...r, source: 'teacher' })));
            } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
          }}>
          {busy ? '保存中…' : hasAiSuggestions ? '✓ 确认为老师评分（暂存）' : '暂存'}
        </button>
        <button className="btn btn-primary" disabled={busy}
          onClick={async () => {
            setBusy(true); setErr('');
            try {
              await hwApi.saveGrades(sub.id, gradesPayload());
              await hwApi.publishGrades(sub.id, comment || undefined);
              onReturned();
            } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
          }}>
          {busy ? '发布中…' : '📢 发布给学生 → 下一份'}
        </button>
      </div>
    </div>
  );
}
