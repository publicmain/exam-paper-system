import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { hwApi, hwFileContentPath, hwPageContentPath } from '../lib/api-homework';
import { listInkDrafts, finishInkDrafts } from '../lib/ink-flatten';
import { AuthImage } from '../components/AuthImage';
import { HandwritingWorkspace } from '../components/HandwritingWorkspace';

/**
 * 学生作业详情 + 作答提交页（iPad/手机优先，中文为主）。
 * 支持混合作答：✍️手写（矢量草稿→展平）与 📷拍照/🖼文件可以混用，
 * 每页带来源标记。提交时若存在未「完成手写」的草稿，自动展平合入，
 * 绝不静默丢失手写内容。
 */
export default function StudentHomeworkSubmitPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [handwriting, setHandwriting] = useState(false);
  const [inkDraftCount, setInkDraftCount] = useState(0);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const d = await hwApi.myHomeworkDetail(assignmentId!);
      setData(d);
      // Surface unfinished handwriting so the student (and the submit flow)
      // always know it's there.
      if (!d.submission || d.submission.status === 'in_progress') {
        const drafts = await listInkDrafts(assignmentId!).catch(() => []);
        setInkDraftCount(drafts.filter((x) => x.strokes.length > 0).length);
      } else {
        setInkDraftCount(0);
      }
    } catch (e: any) {
      setErr(e.message);
    }
  }
  useEffect(() => { load(); }, [assignmentId]);

  if (err) return <div className="p-4 text-red-600">{err}</div>;
  if (!data) return <div className="p-4 text-gray-500">加载中…</div>;

  const sub = data.submission;
  const editable = data.canSubmit && (!sub || sub.status === 'in_progress');
  const pages: any[] = sub?.pages ?? [];
  const questions: any[] = data.homework.questions ?? [];

  async function addFiles(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    try {
      await hwApi.uploadPages(assignmentId!, files);
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doSubmit() {
    setBusy(true);
    try {
      // P0 rescue: unfinished handwriting gets flattened in, never lost.
      let extra = 0;
      const drafts = await listInkDrafts(assignmentId!).catch(() => []);
      const withInk = drafts.filter((d) => d.strokes.length > 0);
      if (withInk.length > 0) {
        if (!confirm(`你有 ${withInk.length} 页手写还没点「完成手写」，将自动一并提交。继续？`)) {
          setBusy(false);
          return;
        }
        extra = await finishInkDrafts(assignmentId!, drafts);
      }
      const totalPages = pages.length + extra;
      if (totalPages === 0) {
        alert('还没有任何答卷内容');
        setBusy(false);
        return;
      }
      if (withInk.length === 0 && !confirm(`确认提交 ${totalPages} 页？提交后需老师同意才能修改。`)) {
        setBusy(false);
        return;
      }
      await hwApi.submitHomework(assignmentId!);
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-28">
      <div className="mb-1 text-sm">
        <Link to="/student/homework" className="text-blue-600 hover:underline">← 作业列表</Link>
      </div>
      <h1 className="text-xl font-bold">{data.homework.title}</h1>
      <div className="text-sm text-gray-600 mb-3 flex items-center gap-2 flex-wrap">
        <span>{data.homework.course?.name}</span>
        {data.dueAt && (
          <DueChip dueAt={data.dueAt} />
        )}
        {questions.length > 0 && (
          <span className="text-gray-400">满分 {questions.reduce((s, q) => s + q.maxMarks, 0)} 分</span>
        )}
      </div>

      {data.homework.instructions && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm mb-4 whitespace-pre-wrap">
          {data.homework.instructions}
        </div>
      )}

      {/* 题目：图片内嵌预览（iPad 不跳出上下文），PDF 点开 */}
      {data.homework.files?.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">题目 Questions</h2>
          <div className="space-y-2">
            {data.homework.files.map((f: any) => (
              <QuestionFile key={f.id} file={f} />
            ))}
          </div>
        </div>
      )}

      {/* 状态横幅 */}
      {sub?.status === 'submitted' && (
        <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold text-blue-800">⏳ 已提交，等待批改</div>
            <div className="text-sm text-blue-700 mt-0.5">
              {sub.submittedAt && new Date(sub.submittedAt).toLocaleString()} 提交
              {sub.isLate && <span className="text-red-600"> · 迟交</span>}
            </div>
          </div>
          {data.canSubmit && (
            <button className="btn btn-ghost text-sm" disabled={busy}
              onClick={async () => {
                if (!confirm('撤回后可以继续修改，改完需重新提交。撤回？')) return;
                setBusy(true);
                try { await hwApi.withdrawHomework(assignmentId!); await load(); }
                catch (e: any) { alert(e.message); }
                finally { setBusy(false); }
              }}>
              ↩︎ 撤回修改
            </button>
          )}
        </div>
      )}

      {/* 已批改：总分 + 逐题红绿 */}
      {sub?.status === 'returned' && (() => {
        const gradeByQ = new Map<string, any>((sub.grades ?? []).map((g: any) => [g.questionId, g]));
        const maxTotal = questions.reduce((s, q) => s + q.maxMarks, 0);
        return (
          <div className="bg-white border-2 border-green-300 rounded-lg p-4 mb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-green-700">{sub.teacherScore ?? '—'}</span>
              <span className="text-gray-500">/ {questions.length > 0 ? maxTotal : data.homework.totalMarks ?? '—'} 分</span>
              <span className="ml-auto text-xs text-gray-400">
                {sub.returnedAt && new Date(sub.returnedAt).toLocaleString()} 批改返回
              </span>
            </div>
            {sub.teacherComment && (
              <div className="text-sm mt-2 bg-gray-50 rounded p-2 whitespace-pre-wrap">💬 {sub.teacherComment}</div>
            )}
            {questions.length > 0 && (
              <div className="mt-3 divide-y">
                {questions.map((q) => {
                  const g = gradeByQ.get(q.id);
                  const full = g?.awardedMarks === q.maxMarks;
                  const zero = (g?.awardedMarks ?? 0) === 0;
                  return (
                    <div key={q.id} className="py-1.5 flex items-start gap-3 text-sm">
                      <span className="font-medium w-10">{q.label}</span>
                      <span className={`w-14 font-semibold ${full ? 'text-green-600' : zero ? 'text-red-600' : 'text-amber-600'}`}>
                        {g?.awardedMarks ?? '—'} / {q.maxMarks}
                      </span>
                      {g?.comment && <span className="text-gray-600 flex-1">{g.comment}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* 未完成手写提醒 */}
      {editable && inkDraftCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded p-3 text-sm mb-3 flex items-center justify-between gap-2">
          <span>✍️ 你有 <b>{inkDraftCount}</b> 页手写草稿还没完成（提交时会自动合入，不会丢）</span>
          <button className="btn btn-ghost text-sm shrink-0" onClick={() => setHandwriting(true)}>继续手写 →</button>
        </div>
      )}

      {/* 我的答卷 */}
      <h2 className="text-sm font-semibold text-gray-500 mb-2">
        我的答卷 {pages.length > 0 && `（${pages.length} 页）`}
      </h2>
      {pages.length === 0 && inkDraftCount === 0 && (
        <div className="text-sm text-gray-500 bg-white border rounded p-6 text-center mb-3">
          {editable ? '用下方按钮作答：✍️ 直接手写，或把纸上的答案 📷 拍照上传' : '（无答卷）'}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {pages.map((p: any, i: number) => (
          <div key={p.id} className="relative bg-white border rounded overflow-hidden">
            <div className="absolute top-1 left-1 z-10 flex gap-1">
              <span className="bg-black/60 text-white text-xs rounded px-1.5 py-0.5">{i + 1}</span>
              <span className="bg-white/90 border text-xs rounded px-1.5 py-0.5">
                {p.source === 'ink' ? '✍️ 手写' : '📷 上传'}
              </span>
            </div>
            {editable && (
              <div className="absolute top-1 right-1 z-10 flex gap-1">
                {i > 0 && (
                  <button className="bg-white/90 border rounded px-1.5 text-xs" title="上移"
                    onClick={async () => {
                      const ids = pages.map((x) => x.id);
                      [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                      await hwApi.reorderPages(assignmentId!, ids);
                      load();
                    }}>↑</button>
                )}
                <button className="bg-white/90 border rounded px-1.5 text-xs text-red-600" title="删除"
                  onClick={async () => {
                    if (!confirm('删除这一页？')) return;
                    await hwApi.deletePage(p.id);
                    load();
                  }}>✕</button>
              </div>
            )}
            {p.mimeType === 'application/pdf' ? (
              <div className="p-6 text-center text-sm text-gray-500">📄 PDF</div>
            ) : (
              <AuthImage src={hwPageContentPath(p.id)} alt={`第 ${i + 1} 页`} className="w-full" />
            )}
          </div>
        ))}
      </div>

      {/* 底部操作条 */}
      {editable && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t p-3 z-40">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" multiple
              className="hidden" onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
            <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple
              className="hidden" onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
            <button className="btn btn-ghost flex-1" disabled={busy} onClick={() => setHandwriting(true)}>
              ✍️ {inkDraftCount > 0 ? '继续手写' : '手写'}
            </button>
            <button className="btn btn-ghost flex-1" disabled={busy} onClick={() => cameraInput.current?.click()}>
              📷 拍照
            </button>
            <button className="btn btn-ghost flex-1" disabled={busy} onClick={() => fileInput.current?.click()}>
              🖼 文件
            </button>
            <button className="btn btn-primary flex-1" disabled={busy || (pages.length === 0 && inkDraftCount === 0)}
              onClick={doSubmit}>
              {busy ? '…' : `✅ 提交${pages.length + inkDraftCount > 0 ? `（${pages.length + inkDraftCount} 页）` : ''}`}
            </button>
          </div>
        </div>
      )}

      {!data.canSubmit && (!sub || sub.status === 'in_progress') && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          ⛔ 已截止，不能再提交。如需补交请联系老师。
        </div>
      )}

      {handwriting && (
        <HandwritingWorkspace
          assignmentId={assignmentId!}
          questionFiles={data.homework.files ?? []}
          onClose={async () => { setHandwriting(false); await load(); }}
          onFinished={async () => { setHandwriting(false); await load(); }}
        />
      )}
    </div>
  );
}

/** 截止时间徽章：临近变色。 */
function DueChip({ dueAt }: { dueAt: string }) {
  const due = new Date(dueAt);
  const hoursLeft = (due.getTime() - Date.now()) / 36e5;
  const cls =
    hoursLeft < 0 ? 'bg-gray-100 text-gray-500'
    : hoursLeft < 24 ? 'bg-red-100 text-red-700'
    : hoursLeft < 72 ? 'bg-amber-100 text-amber-700'
    : 'bg-gray-100 text-gray-600';
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>
      {hoursLeft < 0 ? '已截止 ' : '截止 '}{due.toLocaleString()}
    </span>
  );
}

/** 题目文件：图片内嵌可折叠预览；PDF 打开新窗口。 */
function QuestionFile({ file }: { file: { id: string; filename: string; mimeType: string } }) {
  const isImage = file.mimeType.startsWith('image/');
  const [open, setOpen] = useState(isImage); // 图片默认展开
  if (!isImage) {
    return (
      <button
        className="text-sm bg-white border rounded px-3 py-2 text-blue-600 hover:border-blue-400"
        onClick={async () => {
          const token = localStorage.getItem('auth_token');
          const base = (import.meta as any).env?.VITE_API_URL || '';
          const res = await fetch(`${base}${hwFileContentPath(file.id)}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (!res.ok) return alert(`打开失败: ${res.status}`);
          window.open(URL.createObjectURL(await res.blob()), '_blank');
        }}>
        📄 {file.filename}（PDF，点击打开）
      </button>
    );
  }
  return (
    <div className="bg-white border rounded overflow-hidden">
      <button className="w-full text-left px-3 py-2 text-sm flex items-center justify-between"
        onClick={() => setOpen(!open)}>
        <span>🖼 {file.filename}</span>
        <span className="text-gray-400">{open ? '收起 ▲' : '展开 ▼'}</span>
      </button>
      {open && <AuthImage src={hwFileContentPath(file.id)} alt={file.filename} className="w-full border-t" />}
    </div>
  );
}
