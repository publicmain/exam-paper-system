import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { hwApi, hwFileContentPath, hwPageContentPath } from '../lib/api-homework';
import { listInkDrafts, finishInkDrafts } from '../lib/ink-flatten';
import { AuthImage } from '../components/AuthImage';
import { PdfPreview } from '../components/PdfPreview';
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
  // 提交前预览确认（替代裸 confirm）：让学生看清楚到底交什么
  const [preview, setPreview] = useState<{ open: boolean; draftsWithInk: number; emptyDrafts: number }>({ open: false, draftsWithInk: 0, emptyDrafts: 0 });
  // 答卷大图查看
  const [lightbox, setLightbox] = useState<string | null>(null);
  // v2: 申诉（每题一次）
  const [myRegrades, setMyRegrades] = useState<any[]>([]);
  const [disputeQ, setDisputeQ] = useState<{ id: string; label: string } | null>(null);
  // v2 拍照增强：图片先进预览（旋转/增亮）。⚠️ 必须在所有条件 return 之前
  // 声明 —— 放在早退 return 之后会让 hooks 数量随渲染变化（React #310）。
  const [enhanceFiles, setEnhanceFiles] = useState<File[] | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const d = await hwApi.myHomeworkDetail(assignmentId!);
      setData(d);
      if (d.submission?.status === 'returned') {
        hwApi.myRegrades(assignmentId!).then(setMyRegrades).catch(() => {});
      }
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
    const images = files.filter((f) => f.type.startsWith('image/'));
    const rest = files.filter((f) => !f.type.startsWith('image/'));
    if (rest.length > 0) await uploadRaw(rest);
    if (images.length > 0) setEnhanceFiles(images);
  }

  async function uploadRaw(files: File[]) {
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

  /** 第一步：打开提交预览（学生检查答卷 + 看到未完成手写将被合入）。 */
  async function openSubmitPreview() {
    setBusy(true);
    try {
      const drafts = await listInkDrafts(assignmentId!).catch(() => []);
      const withInk = drafts.filter((d) => d.strokes.length > 0).length;
      if (pages.length + withInk === 0) {
        alert('还没有任何答卷内容');
        return;
      }
      setPreview({ open: true, draftsWithInk: withInk, emptyDrafts: drafts.length - withInk });
    } finally {
      setBusy(false);
    }
  }

  /** 第二步：确认提交（未完成手写自动展平合入，绝不丢）。 */
  async function confirmSubmit() {
    setBusy(true);
    try {
      const drafts = await listInkDrafts(assignmentId!).catch(() => []);
      if (drafts.some((d) => d.strokes.length > 0)) {
        await finishInkDrafts(assignmentId!, drafts);
      }
      await hwApi.submitHomework(assignmentId!);
      setPreview({ open: false, draftsWithInk: 0, emptyDrafts: 0 });
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  const maxTotal = questions.length > 0
    ? questions.reduce((s, q) => s + q.maxMarks, 0)
    : data.homework.totalMarks;

  return (
    <div className="pb-28 max-w-5xl mx-auto">
      {/* Canvas 式面包屑 + 版头 */}
      <nav className="text-sm mb-1">
        <Link to="/student/homework" className="text-[#0374B5] hover:underline">作业</Link>
        <span className="text-gray-400 mx-1.5">›</span>
        <span className="text-gray-500">{data.homework.course?.name}</span>
      </nav>
      <div className="border-b border-[#C7CDD1] pb-3 mb-4">
        <h1 className="text-2xl font-bold text-[#2D3B45]">{data.homework.title}</h1>
        <div className="text-sm text-[#6B7780] mt-1.5 flex items-center gap-3 flex-wrap">
          {data.dueAt ? <DueChip dueAt={data.dueAt} /> : <span>无截止时间</span>}
          {maxTotal ? <span><b className="text-[#2D3B45]">{maxTotal}</b> 分</span> : null}
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
      <div className="lg:col-span-2">

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
                  const dispute = myRegrades.find((r) => r.questionId === q.id);
                  return (
                    <div key={q.id} className="py-1.5 text-sm">
                      <div className="flex items-start gap-3">
                        <span className="font-medium w-10">{q.label}</span>
                        <span className={`w-14 font-semibold ${full ? 'text-green-600' : zero ? 'text-red-600' : 'text-amber-600'}`}>
                          {g?.awardedMarks ?? '—'} / {q.maxMarks}
                        </span>
                        {g?.comment && <span className="text-gray-600 flex-1">{g.comment}</span>}
                        {!dispute && !full && (
                          <button className="text-xs text-[#0374B5] hover:underline shrink-0"
                            onClick={() => setDisputeQ({ id: q.id, label: q.label })}>
                            申诉
                          </button>
                        )}
                      </div>
                      {dispute && (
                        <div className={`ml-10 mt-1 text-xs rounded px-2 py-1.5 ${dispute.status === 'replied' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
                          💬 已申诉：{dispute.message}
                          {dispute.reply
                            ? <span className="block mt-0.5">老师回复：{dispute.reply}</span>
                            : <span className="block mt-0.5 text-amber-600">等待老师回复…</span>}
                        </div>
                      )}
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
          <div key={p.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
            {/* 卡片头部条：序号 + 来源 + 操作，不遮挡图片 */}
            <div className="flex items-center justify-between px-2 py-1.5 border-b bg-gray-50">
              <span className="text-xs font-medium text-gray-600">
                {i + 1} · {p.source === 'ink' ? '✍️ 手写' : '📷 上传'}
              </span>
              {editable && (
                <span className="flex gap-1">
                  {i > 0 && (
                    <button className="w-6 h-6 rounded border bg-white text-xs hover:bg-gray-100" title="上移"
                      onClick={async () => {
                        const ids = pages.map((x) => x.id);
                        [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                        await hwApi.reorderPages(assignmentId!, ids);
                        load();
                      }}>↑</button>
                  )}
                  <button className="w-6 h-6 rounded border bg-white text-xs text-red-500 hover:bg-red-50" title="删除"
                    onClick={async () => {
                      if (!confirm('删除这一页？')) return;
                      await hwApi.deletePage(p.id);
                      load();
                    }}>✕</button>
                </span>
              )}
            </div>
            {p.mimeType === 'application/pdf' ? (
              <div className="p-6 text-center text-sm text-gray-500">📄 PDF</div>
            ) : (
              <button className="block w-full cursor-zoom-in" onClick={() => setLightbox(p.id)} title="点击看大图">
                <AuthImage src={hwPageContentPath(p.id)} alt={`第 ${i + 1} 页`} className="w-full" />
              </button>
            )}
          </div>
        ))}
      </div>

      </div>{/* /左列 */}

      {/* Canvas 式右侧 Submission 状态卡（桌面） */}
      <aside className="hidden lg:block">
        <div className="sticky top-4 bg-white rounded-lg border border-[#C7CDD1] p-4">
          <div className="text-xs font-semibold text-[#6B7780] uppercase tracking-wide mb-2">Submission 提交状态</div>
          {!sub || sub.status === 'in_progress' ? (
            <>
              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 mb-2">
                {pages.length > 0 || inkDraftCount > 0 ? '作答中' : '未开始'}
              </span>
              <div className="text-sm text-[#6B7780]">
                已有 {pages.length + inkDraftCount} 页答卷{inkDraftCount > 0 ? `（含 ${inkDraftCount} 页手写草稿）` : ''}。
                用页面底部按钮作答并提交。
              </div>
              {!data.canSubmit && (
                <div className="text-sm text-[#E0061F] mt-2">已截止，不能再提交。</div>
              )}
            </>
          ) : sub.status === 'submitted' ? (
            <>
              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-[#E8F4FB] text-[#0374B5] mb-2">已提交 · 等待批改</span>
              <div className="text-sm text-[#6B7780]">
                {sub.submittedAt && new Date(sub.submittedAt).toLocaleString()}
                {sub.isLate && <span className="text-[#E0061F]"> · 迟交</span>}
              </div>
            </>
          ) : (
            <>
              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 mb-2">已批改</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-3xl font-bold text-[#2D3B45]">{sub.teacherScore ?? '—'}</span>
                <span className="text-[#6B7780]">/ {maxTotal ?? '—'}</span>
              </div>
              {sub.returnedAt && (
                <div className="text-xs text-[#6B7780] mt-1">{new Date(sub.returnedAt).toLocaleString()} 返回</div>
              )}
            </>
          )}
        </div>
      </aside>
      </div>{/* /grid */}

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
              onClick={openSubmitPreview}>
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

      {/* 答卷大图 lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/85 z-[60] flex flex-col" onClick={() => setLightbox(null)}>
          <div className="flex items-center justify-between px-4 py-2 text-white text-sm shrink-0">
            <span>第 {pages.findIndex((p: any) => p.id === lightbox) + 1} 页 / 共 {pages.length} 页</span>
            <button className="px-3 py-1 rounded bg-white/20 hover:bg-white/30">关闭 ✕</button>
          </div>
          <div className="flex-1 overflow-auto p-4 flex justify-center items-start">
            <InkOverlayImage
              pageId={lightbox}
              strokes={pages.find((p: any) => p.id === lightbox)?.teacherInk}
              className="max-w-full rounded shadow-2xl bg-white" />
          </div>
        </div>
      )}

      {/* v2: 拍照增强预览 */}
      {enhanceFiles && (
        <EnhanceModal files={enhanceFiles}
          onCancel={() => setEnhanceFiles(null)}
          onConfirm={async (processed) => { setEnhanceFiles(null); await uploadRaw(processed); }} />
      )}

      {/* v2: 申诉 modal */}
      {disputeQ && (
        <DisputeModal q={disputeQ} onClose={() => setDisputeQ(null)}
          onSubmit={async (msg) => {
            try {
              await hwApi.fileRegrade(assignmentId!, disputeQ.id, msg);
              setDisputeQ(null);
              hwApi.myRegrades(assignmentId!).then(setMyRegrades).catch(() => {});
            } catch (e: any) { alert(e.message); }
          }} />
      )}

      {/* 提交前预览确认 */}
      {preview.open && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="px-5 py-3 border-b flex items-center justify-between shrink-0">
              <h3 className="font-bold text-[#2D3B45]">确认提交答卷</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setPreview({ ...preview, open: false })}>✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="text-sm text-[#6B7780] mb-3">
                共将提交 <b className="text-[#2D3B45]">{pages.length + preview.draftsWithInk}</b> 页
                {preview.draftsWithInk > 0 && (
                  <span className="ml-1 text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                    含 {preview.draftsWithInk} 页未点「完成手写」的草稿，将自动合入
                  </span>
                )}
                {preview.emptyDrafts > 0 && (
                  <span className="block mt-1 text-xs">（{preview.emptyDrafts} 页空白手写页将被忽略）</span>
                )}
              </div>
              {pages.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {pages.map((p: any, i: number) => (
                    <div key={p.id} className="border rounded overflow-hidden">
                      <div className="text-xs text-[#6B7780] px-2 py-1 bg-gray-50 border-b">
                        {i + 1} · {p.source === 'ink' ? '✍️ 手写' : '📷 上传'}
                      </div>
                      {p.mimeType === 'application/pdf'
                        ? <div className="p-4 text-center text-sm text-gray-500">📄 PDF</div>
                        : <AuthImage src={hwPageContentPath(p.id)} alt={`第 ${i + 1} 页`} className="w-full" />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[#6B7780] bg-gray-50 rounded p-4 text-center">
                  当前答卷全部来自手写草稿，确认后自动生成答卷页。
                </div>
              )}
              <div className="text-xs text-[#6B7780] mt-4">
                提交后如需修改：批改开始前可自己「撤回修改」，批改开始后需联系老师。
              </div>
            </div>
            <div className="px-5 py-3 border-t flex gap-2 justify-end shrink-0">
              <button className="px-4 py-2 rounded-md border border-[#C7CDD1] text-sm"
                onClick={() => setPreview({ ...preview, open: false })}>再检查一下</button>
              <button className="px-5 py-2 rounded-md bg-[#0374B5] text-white text-sm font-medium hover:bg-[#02659F] disabled:opacity-50"
                disabled={busy} onClick={confirmSubmit}>
                {busy ? '提交中…' : '✅ 确认提交'}
              </button>
            </div>
          </div>
        </div>
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

/** v2 — 答卷图 + 老师批注叠加（returned 后学生看到老师圈画的内容）。 */
function InkOverlayImage({ pageId, strokes, className }: { pageId: string; strokes?: any[] | null; className?: string }) {
  const [img, setImg] = useState<{ url: string; w: number; h: number } | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    (async () => {
      const token = localStorage.getItem('auth_token');
      const base = (import.meta as any).env?.VITE_API_URL || '';
      const res = await fetch(`${base}${hwPageContentPath(pageId)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok || cancelled) return;
      const url = URL.createObjectURL(await res.blob());
      revoke = url;
      const im = new Image();
      im.onload = () => { if (!cancelled) setImg({ url, w: im.naturalWidth, h: im.naturalHeight }); };
      im.src = url;
    })();
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke); };
  }, [pageId]);
  if (!img) return <div className="text-white/70 p-10">加载中…</div>;
  const hasInk = Array.isArray(strokes) && strokes.length > 0;
  return (
    <div className={`relative ${className ?? ''}`} style={{ lineHeight: 0 }} onClick={(e) => e.stopPropagation()}>
      <img src={img.url} alt="答卷大图" className="max-w-full rounded" />
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

/**
 * v2 — 拍照增强预览（Google Classroom 扫描流的轻量版）：
 * 每张图可旋转 90°、一键提亮（补光/去灰），确认后 canvas 处理为 JPEG 上传。
 */
function EnhanceModal({ files, onCancel, onConfirm }: {
  files: File[]; onCancel: () => void; onConfirm: (files: File[]) => void;
}) {
  const [items, setItems] = useState(files.map((f) => ({ file: f, url: URL.createObjectURL(f), rotate: 0, enhance: true })));
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { items.forEach((it) => URL.revokeObjectURL(it.url)); }, []);

  async function process(): Promise<File[]> {
    const out: File[] = [];
    for (const it of items) {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image();
        im.onload = () => res(im); im.onerror = rej; im.src = it.url;
      });
      const rot = ((it.rotate % 360) + 360) % 360;
      const swap = rot === 90 || rot === 270;
      const cv = document.createElement('canvas');
      cv.width = swap ? img.naturalHeight : img.naturalWidth;
      cv.height = swap ? img.naturalWidth : img.naturalHeight;
      const ctx = cv.getContext('2d')!;
      if (it.enhance) ctx.filter = 'brightness(1.12) contrast(1.15) saturate(0.95)';
      ctx.translate(cv.width / 2, cv.height / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/jpeg', 0.92));
      if (blob) out.push(new File([blob], it.file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
    }
    return out;
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[75] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="px-4 py-2.5 border-b flex items-center justify-between shrink-0">
          <span className="font-bold text-[#2D3B45]">📷 检查照片（{items.length} 张）</span>
          <button className="text-gray-400 hover:text-gray-600" onClick={onCancel}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3">
          {items.map((it, i) => (
            <div key={i} className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border-b text-xs">
                <button className="px-2 py-0.5 rounded border bg-white hover:bg-gray-100"
                  onClick={() => setItems(items.map((x, j) => j === i ? { ...x, rotate: x.rotate + 90 } : x))}>
                  ↻ 旋转
                </button>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={it.enhance}
                    onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, enhance: e.target.checked } : x))} />
                  提亮增强
                </label>
              </div>
              <div className="p-2 flex justify-center bg-gray-100">
                <img src={it.url} alt={`照片 ${i + 1}`}
                  className="max-h-52 object-contain transition-transform"
                  style={{
                    transform: `rotate(${it.rotate}deg)`,
                    filter: it.enhance ? 'brightness(1.12) contrast(1.15) saturate(0.95)' : undefined,
                  }} />
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-2.5 border-t flex justify-end gap-2 shrink-0">
          <button className="btn btn-ghost text-sm" onClick={onCancel}>取消</button>
          <button className="btn btn-primary text-sm" disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { onConfirm(await process()); } finally { setBusy(false); }
            }}>
            {busy ? '处理中…' : `确认上传 ${items.length} 张`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** v2 — 申诉弹窗。 */
function DisputeModal({ q, onClose, onSubmit }: {
  q: { id: string; label: string }; onClose: () => void; onSubmit: (msg: string) => void;
}) {
  const [msg, setMsg] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-[#2D3B45] mb-1">对 {q.label} 的分数提出申诉</h3>
        <p className="text-xs text-[#6B7780] mb-3">说明你认为哪里判得不对（每题只能申诉一次，老师会收到通知并回复）。</p>
        <textarea className="input w-full" rows={4} value={msg} onChange={(e) => setMsg(e.target.value)}
          placeholder="例：我第二步用的是二倍角公式，结果和参考答案等价…" />
        <div className="flex justify-end gap-2 mt-3">
          <button className="btn btn-ghost text-sm" onClick={onClose}>取消</button>
          <button className="btn btn-primary text-sm" disabled={!msg.trim()} onClick={() => onSubmit(msg.trim())}>
            提交申诉
          </button>
        </div>
      </div>
    </div>
  );
}

/** 题目文件：图片和 PDF 都内嵌预览（PDF 经 pdf.js 逐页渲染），不跳出上下文。 */
function QuestionFile({ file }: { file: { id: string; filename: string; mimeType: string } }) {
  const isImage = file.mimeType.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf';
  const [open, setOpen] = useState(isImage); // 图片默认展开；PDF 点开（渲染成本高）
  return (
    <div className="bg-white border rounded overflow-hidden">
      <button className="w-full text-left px-3 py-2 text-sm flex items-center justify-between"
        onClick={() => setOpen(!open)}>
        <span>{isPdf ? '📄' : '🖼'} {file.filename}</span>
        <span className="text-gray-400">{open ? '收起 ▲' : '展开 ▼'}</span>
      </button>
      {open && (isPdf
        ? <PdfPreview contentPath={hwFileContentPath(file.id)} className="border-t" />
        : <AuthImage src={hwFileContentPath(file.id)} alt={file.filename} className="w-full border-t" />)}
    </div>
  );
}
