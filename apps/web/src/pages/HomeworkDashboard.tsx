import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { hwApi, hwPageContentPath } from '../lib/api-homework';
import { AuthImage } from '../components/AuthImage';

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  missing: { text: '未交', cls: 'bg-gray-100 text-gray-600' },
  in_progress: { text: '作答中', cls: 'bg-amber-100 text-amber-700' },
  submitted: { text: '已交', cls: 'bg-blue-100 text-blue-700' },
  returned: { text: '已返回', cls: 'bg-green-100 text-green-700' },
};

/** 收卷看板：全班交卷状态 + 逐份查看/打分返回。 */
export default function HomeworkDashboardPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState('');
  const [viewing, setViewing] = useState<string | null>(null); // submissionId

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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-1 text-sm">
        <Link to="/homework" className="text-blue-600 hover:underline">← 作业中心</Link>
      </div>
      <h1 className="text-2xl font-bold">{homework.title}</h1>
      <div className="text-sm text-gray-600 mb-4">
        {homework.course?.name} · {klass.name}
        {data.dueAt && <> · 截止 {new Date(data.dueAt).toLocaleString()}</>}
        {data.status === 'closed' && <span className="text-red-600"> · 已关闭</span>}
      </div>

      {/* 汇总条 */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <Stat label="已交" value={counts.submitted} cls="text-blue-700" />
        <Stat label="作答中" value={counts.inProgress} cls="text-amber-700" />
        <Stat label="未交" value={counts.missing} cls="text-gray-700" />
        <Stat label="迟交" value={counts.late} cls="text-red-700" />
      </div>

      <div className="flex items-center gap-2 mb-3">
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

      {/* 名单 */}
      <div className="bg-white rounded border divide-y">
        {roster.map((r: any) => {
          const s = STATUS_LABEL[r.status] ?? STATUS_LABEL.missing;
          return (
            <div key={r.student.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-medium truncate">{r.student.name}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${s.cls}`}>{s.text}</span>
                {r.isLate && <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">迟交</span>}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {r.submittedAt && <span className="text-gray-500">{new Date(r.submittedAt).toLocaleString()}</span>}
                {r.teacherScore != null && (
                  <span className="font-semibold">{r.teacherScore}{homework.totalMarks ? ` / ${homework.totalMarks}` : ''}</span>
                )}
                {r.submissionId && r.pageCount > 0 && (
                  <button className="text-blue-600 hover:underline"
                    onClick={() => setViewing(r.submissionId)}>
                    查看 {r.pageCount} 页 →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {viewing && (
        <SubmissionViewer
          submissionId={viewing}
          totalMarks={homework.totalMarks}
          onClose={() => setViewing(null)}
          onReturned={() => { setViewing(null); load(); }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="bg-white rounded border p-3 text-center">
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function SubmissionViewer({ submissionId, totalMarks, onClose, onReturned }: {
  submissionId: string;
  totalMarks: number | null;
  onClose: () => void;
  onReturned: () => void;
}) {
  const [sub, setSub] = useState<any | null>(null);
  const [score, setScore] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    hwApi.getSubmission(submissionId).then((s) => {
      setSub(s);
      if (s.teacherScore != null) setScore(String(s.teacherScore));
      if (s.teacherComment) setComment(s.teacherComment);
    }).catch((e) => alert(e.message));
  }, [submissionId]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex" onClick={onClose}>
      <div className="bg-white w-full max-w-4xl mx-auto my-6 rounded-lg overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}>
        {!sub ? (
          <div className="text-gray-500">加载中…</div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                {sub.student.name} — {sub.assignment.homework.title}
                {sub.isLate && <span className="ml-2 text-sm text-red-600">迟交</span>}
              </h3>
              <button className="btn btn-ghost" onClick={onClose}>关闭</button>
            </div>

            <div className="space-y-3 mb-5">
              {sub.pages.map((p: any, i: number) => (
                <div key={p.id}>
                  <div className="text-xs text-gray-500 mb-1">
                    第 {i + 1} 页{p.source === 'ink' && <span className="ml-1 text-blue-600">✍️ 手写</span>}
                  </div>
                  {p.mimeType === 'application/pdf' ? (
                    <div className="text-sm">
                      📄 PDF 页 — <a className="text-blue-600 hover:underline" href="#"
                        onClick={async (e) => {
                          e.preventDefault();
                          const token = localStorage.getItem('auth_token');
                          const base = (import.meta as any).env?.VITE_API_URL || '';
                          const res = await fetch(`${base}${hwPageContentPath(p.id)}`,
                            { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                          window.open(URL.createObjectURL(await res.blob()), '_blank');
                        }}>打开</a>
                    </div>
                  ) : (
                    <AuthImage src={hwPageContentPath(p.id)} alt={`page ${i + 1}`}
                      className="border rounded w-full" />
                  )}
                </div>
              ))}
            </div>

            {/* M3: rubric → per-question grading console; else M1 single score. */}
            {sub.assignment.homework.questions?.length > 0 ? (
              <GradingPanel sub={sub} onReturned={onReturned} reload={() => hwApi.getSubmission(submissionId).then(setSub)} />
            ) : (
              <div className="border-t pt-4">
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="block text-sm mb-1">分数{totalMarks ? `（满分 ${totalMarks}）` : ''}</label>
                    <input className="input w-28" type="number" min={0} value={score}
                      onChange={(e) => setScore(e.target.value)} />
                  </div>
                  <div className="flex-1 min-w-52">
                    <label className="block text-sm mb-1">评语（可选）</label>
                    <input className="input w-full" value={comment} onChange={(e) => setComment(e.target.value)}
                      placeholder="写给学生的评语" />
                  </div>
                  <button className="btn btn-primary" disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await hwApi.returnSubmission(submissionId, {
                          teacherScore: score === '' ? undefined : Number(score),
                          teacherComment: comment || undefined,
                        });
                        onReturned();
                      } catch (e: any) {
                        alert(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}>
                    {busy ? '返回中…' : sub.status === 'returned' ? '更新并返回' : '打分并返回学生'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** M3 per-question grading console: rubric items with mark inputs, AI-suggestion
 *  pre-fill + confidence, save (confirm) and publish. */
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

  async function saveTeacher() {
    setBusy(true); setErr('');
    try {
      const grades = rows.map((r) => ({
        questionId: r.questionId,
        awardedMarks: r.awarded === '' ? null : Number(r.awarded),
        comment: r.comment || undefined,
      }));
      await hwApi.saveGrades(sub.id, grades);
      await reload();
      setRows((rs) => rs.map((r) => ({ ...r, source: 'teacher' })));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function publish() {
    setBusy(true); setErr('');
    try {
      await hwApi.saveGrades(sub.id, rows.map((r) => ({
        questionId: r.questionId,
        awardedMarks: r.awarded === '' ? null : Number(r.awarded),
        comment: r.comment || undefined,
      })));
      await hwApi.publishGrades(sub.id, comment || undefined);
      onReturned();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">逐题评分</h4>
        {hasAiSuggestions && (
          <span className="text-xs bg-purple-100 text-purple-700 rounded px-2 py-0.5">
            含 AI 建议分 — 请复核后发布
          </span>
        )}
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.questionId} className={`rounded border p-2 ${r.source === 'ai_suggested' ? 'bg-purple-50 border-purple-200' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="font-medium w-12">{r.label}</span>
              <input className="input w-20" type="number" min={0} max={r.maxMarks} value={r.awarded}
                onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, awarded: e.target.value } : x))} />
              <span className="text-sm text-gray-500">/ {r.maxMarks}</span>
              <input className="input flex-1" placeholder="评语（可选）" value={r.comment}
                onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, comment: e.target.value } : x))} />
              {r.source === 'ai_suggested' && (
                <span className="text-xs text-purple-700 whitespace-nowrap">
                  🤖 AI{r.confidence != null ? ` ${Math.round(r.confidence * 100)}%` : ''}
                </span>
              )}
              {r.source === 'teacher' && <span className="text-xs text-green-700">✓</span>}
            </div>
            {r.criteria && <div className="text-xs text-gray-500 mt-1 ml-14">要点：{r.criteria}</div>}
            {r.rationale && <div className="text-xs text-purple-600 mt-0.5 ml-14">AI 理由：{r.rationale}</div>}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <span className="text-sm">合计 <b>{total}</b> / {maxTotal}</span>
        <input className="input flex-1" placeholder="总评语（可选）" value={comment}
          onChange={(e) => setComment(e.target.value)} />
      </div>
      {err && <div className="text-sm text-red-600 mt-2">{err}</div>}
      <div className="flex justify-end gap-2 mt-3">
        <button className="btn btn-ghost" disabled={busy} onClick={saveTeacher}>
          {busy ? '保存中…' : hasAiSuggestions ? '确认为老师评分（暂存）' : '暂存'}
        </button>
        <button className="btn btn-primary" disabled={busy} onClick={publish}>
          {busy ? '发布中…' : '发布给学生'}
        </button>
      </div>
    </div>
  );
}
