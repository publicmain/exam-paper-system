import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { hwApi, hwFileContentPath, hwPageContentPath } from '../lib/api-homework';
import { AuthImage } from '../components/AuthImage';

/**
 * 学生作业详情 + 拍照提交页（iPad/手机优先）。
 * M1: 查看作业文件 → 拍照/选图上传答卷页 → 排序/删除 → 提交锁定。
 * M2 会在这里加「直接手写作答」入口。
 */
export default function StudentHomeworkSubmitPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      setData(await hwApi.myHomeworkDetail(assignmentId!));
    } catch (e: any) {
      setErr(e.message);
    }
  }
  useEffect(() => { load(); }, [assignmentId]);

  if (err) return <div className="p-4 text-red-600">{err}</div>;
  if (!data) return <div className="p-4 text-gray-500">Loading…</div>;

  const sub = data.submission;
  const editable = data.canSubmit && (!sub || sub.status === 'in_progress');
  const pages: any[] = sub?.pages ?? [];

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

  return (
    <div className="pb-24">
      <div className="mb-1 text-sm">
        <Link to="/student/homework" className="text-blue-600 hover:underline">← Homework</Link>
      </div>
      <h1 className="text-xl font-bold">{data.homework.title}</h1>
      <div className="text-sm text-gray-600 mb-3">
        {data.homework.course?.name}
        {data.dueAt && <> · Due {new Date(data.dueAt).toLocaleString()}</>}
      </div>

      {data.homework.instructions && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm mb-4 whitespace-pre-wrap">
          {data.homework.instructions}
        </div>
      )}

      {/* 作业文件 */}
      {data.homework.files?.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">Questions</h2>
          <div className="flex flex-wrap gap-2">
            {data.homework.files.map((f: any) => (
              <button key={f.id}
                className="text-sm bg-white border rounded px-3 py-2 text-blue-600 hover:border-blue-400"
                onClick={async () => {
                  const token = localStorage.getItem('auth_token');
                  const base = (import.meta as any).env?.VITE_API_URL || '';
                  const res = await fetch(`${base}${hwFileContentPath(f.id)}`,
                    { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                  if (!res.ok) return alert(`open failed: ${res.status}`);
                  window.open(URL.createObjectURL(await res.blob()), '_blank');
                }}>
                📄 {f.filename}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 已批改结果 */}
      {sub?.status === 'returned' && (
        <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
          <div className="text-lg font-bold text-green-800">
            Score: {sub.teacherScore ?? '—'}{data.homework.totalMarks ? ` / ${data.homework.totalMarks}` : ''}
          </div>
          {sub.teacherComment && <div className="text-sm mt-1 whitespace-pre-wrap">{sub.teacherComment}</div>}
        </div>
      )}

      {/* 我的答卷页 */}
      <h2 className="text-sm font-semibold text-gray-500 mb-2">
        My answer pages {pages.length > 0 && `(${pages.length})`}
      </h2>
      {pages.length === 0 && (
        <div className="text-sm text-gray-500 bg-white border rounded p-6 text-center mb-3">
          {editable ? 'Take photos of your written answers and upload them here.' : 'No pages.'}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {pages.map((p: any, i: number) => (
          <div key={p.id} className="relative bg-white border rounded overflow-hidden">
            <div className="absolute top-1 left-1 z-10 bg-black/60 text-white text-xs rounded px-1.5 py-0.5">
              {i + 1}
            </div>
            {editable && (
              <div className="absolute top-1 right-1 z-10 flex gap-1">
                {i > 0 && (
                  <button className="bg-white/90 border rounded px-1.5 text-xs" title="move up"
                    onClick={async () => {
                      const ids = pages.map((x) => x.id);
                      [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                      await hwApi.reorderPages(assignmentId!, ids);
                      load();
                    }}>↑</button>
                )}
                <button className="bg-white/90 border rounded px-1.5 text-xs text-red-600" title="delete"
                  onClick={async () => {
                    if (!confirm('Delete this page?')) return;
                    await hwApi.deletePage(p.id);
                    load();
                  }}>✕</button>
              </div>
            )}
            {p.mimeType === 'application/pdf' ? (
              <div className="p-6 text-center text-sm text-gray-500">📄 PDF</div>
            ) : (
              <AuthImage src={hwPageContentPath(p.id)} alt={`page ${i + 1}`} className="w-full" />
            )}
          </div>
        ))}
      </div>

      {/* 底部操作条 */}
      {editable && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t p-3 z-40">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            {/* capture="environment" → iPad/手机直接开后置相机 */}
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" multiple
              className="hidden" onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
            <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple
              className="hidden" onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
            <button className="btn btn-ghost flex-1" disabled={busy} onClick={() => cameraInput.current?.click()}>
              📷 拍照
            </button>
            <button className="btn btn-ghost flex-1" disabled={busy} onClick={() => fileInput.current?.click()}>
              🖼 选择文件
            </button>
            <button className="btn btn-primary flex-1" disabled={busy || pages.length === 0}
              onClick={async () => {
                if (!confirm(`提交 ${pages.length} 页？提交后不能再修改。`)) return;
                setBusy(true);
                try {
                  await hwApi.submitHomework(assignmentId!);
                  await load();
                } catch (e: any) {
                  alert(e.message);
                } finally {
                  setBusy(false);
                }
              }}>
              {busy ? '…' : `✅ 提交 (${pages.length})`}
            </button>
          </div>
        </div>
      )}

      {sub?.status === 'submitted' && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
          Submitted {sub.submittedAt && new Date(sub.submittedAt).toLocaleString()} — waiting for your teacher.
        </div>
      )}
      {!data.canSubmit && (!sub || sub.status === 'in_progress') && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          This assignment is closed.
        </div>
      )}
    </div>
  );
}
