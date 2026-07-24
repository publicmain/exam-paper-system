import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { hwApi, hwFileContentPath } from '../lib/api-homework';

/**
 * 作业中心（老师端）— 课程文件夹 → 作业 → 布置。
 * 左列课程列表，右侧选中课程的作业列表；上传 / 布置走弹窗。
 */
export default function HomeworkCoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // modals
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [showNewHw, setShowNewHw] = useState(false);
  const [assignHw, setAssignHw] = useState<any | null>(null);

  async function loadCourses() {
    try {
      const cs = await hwApi.listCourses();
      setCourses(cs);
      if (selectedCourse) {
        const still = cs.find((c: any) => c.id === selectedCourse.id);
        if (!still) setSelectedCourse(null);
      }
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function loadHomeworks(courseId: string) {
    try {
      setHomeworks(await hwApi.listHomework(courseId));
    } catch (e: any) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    loadCourses();
    api.subjects().then(setSubjects).catch(() => {});
    api.listClasses().then((cs: any) => setClasses(Array.isArray(cs) ? cs : cs?.classes ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedCourse) loadHomeworks(selectedCourse.id);
  }, [selectedCourse?.id]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">📚 作业中心</h1>
        <button className="btn btn-primary" onClick={() => setShowNewCourse(true)}>+ 新建课程</button>
      </div>
      {err && <div className="mb-3 p-3 bg-red-50 text-red-700 rounded text-sm">{err}</div>}

      <div className="flex gap-6">
        {/* 课程列表 */}
        <div className="w-72 shrink-0 space-y-2">
          {courses.length === 0 && (
            <div className="text-sm text-gray-500 p-4 bg-white rounded border">
              还没有课程。先建一个课程文件夹（如「Form 5 Add Maths」），作业都挂在课程下。
            </div>
          )}
          {courses.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCourse(c)}
              className={`w-full text-left p-3 rounded border bg-white hover:border-blue-400 ${
                selectedCourse?.id === c.id ? 'border-blue-500 ring-1 ring-blue-300' : ''
              }`}
            >
              <div className="font-medium">📁 {c.name}</div>
              <div className="text-xs text-gray-500 mt-1">
                {c.subject ? `${c.subject.code} ${c.subject.name} · ` : ''}
                {c._count.homeworks} 份作业
              </div>
            </button>
          ))}
        </div>

        {/* 作业列表 */}
        <div className="flex-1 min-w-0">
          {!selectedCourse ? (
            <div className="text-gray-500 text-sm p-8 text-center bg-white rounded border">
              ← 选择一个课程查看作业
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">{selectedCourse.name}</h2>
                <button className="btn btn-primary" onClick={() => setShowNewHw(true)}>+ 新建作业</button>
              </div>
              <div className="space-y-3">
                {homeworks.length === 0 && (
                  <div className="text-sm text-gray-500 p-6 bg-white rounded border text-center">
                    这个课程还没有作业
                  </div>
                )}
                {homeworks.map((hw) => (
                  <HomeworkCard
                    key={hw.id}
                    hw={hw}
                    onAssign={() => setAssignHw(hw)}
                    onChanged={() => loadHomeworks(selectedCourse.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showNewCourse && (
        <NewCourseModal
          subjects={subjects}
          busy={busy}
          onClose={() => setShowNewCourse(false)}
          onCreate={async (data) => {
            setBusy(true);
            try {
              await hwApi.createCourse(data);
              setShowNewCourse(false);
              await loadCourses();
            } catch (e: any) {
              setErr(e.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {showNewHw && selectedCourse && (
        <NewHomeworkModal
          busy={busy}
          onClose={() => setShowNewHw(false)}
          onCreate={async (data, files) => {
            setBusy(true);
            try {
              const hw = await hwApi.createHomework({ courseId: selectedCourse.id, ...data });
              if (files.length) await hwApi.uploadHomeworkFiles(hw.id, files);
              setShowNewHw(false);
              await loadHomeworks(selectedCourse.id);
            } catch (e: any) {
              setErr(e.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {assignHw && (
        <AssignModal
          hw={assignHw}
          classes={classes}
          busy={busy}
          onClose={() => setAssignHw(null)}
          onAssign={async (data) => {
            setBusy(true);
            try {
              await hwApi.assign(assignHw.id, data);
              setAssignHw(null);
              await loadHomeworks(selectedCourse!.id);
            } catch (e: any) {
              setErr(e.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

function HomeworkCard({ hw, onAssign, onChanged }: { hw: any; onAssign: () => void; onChanged: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showRubric, setShowRubric] = useState(false);

  return (
    <div className="bg-white rounded border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{hw.title}</div>
          {hw.instructions && <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{hw.instructions}</div>}
          <div className="text-xs text-gray-500 mt-1">
            {hw.totalMarks ? `满分 ${hw.totalMarks} · ` : ''}
            {new Date(hw.createdAt).toLocaleDateString()} · {hw.createdBy?.name}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="btn btn-ghost text-sm" onClick={() => setShowRubric(true)}>
            📋 评分标准{hw.questions?.length ? ` (${hw.questions.length})` : ''}
          </button>
          <button className="btn btn-ghost text-sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? '上传中…' : '＋文件'}
          </button>
          <button className="btn btn-primary text-sm" onClick={onAssign}>布置</button>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (!files.length) return;
            setUploading(true);
            try {
              await hwApi.uploadHomeworkFiles(hw.id, files);
              onChanged();
            } catch (err: any) {
              alert(err.message);
            } finally {
              setUploading(false);
            }
          }}
        />
      </div>

      {hw.files?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {hw.files.map((f: any) => (
            <span key={f.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded px-2 py-1">
              <FileLink fileId={f.id} name={f.filename} />
              <button
                className="text-gray-400 hover:text-red-600"
                title="删除文件"
                onClick={async () => {
                  if (!confirm(`删除文件 ${f.filename}？`)) return;
                  try {
                    await hwApi.deleteHomeworkFile(f.id);
                    onChanged();
                  } catch (err: any) {
                    alert(err.message);
                  }
                }}
              >✕</button>
            </span>
          ))}
        </div>
      )}

      {hw.assignments?.length > 0 && (
        <div className="mt-3 border-t pt-2 space-y-1">
          {hw.assignments.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between text-sm">
              <span>
                🏫 {a.class.name}
                {a.dueAt && <span className="text-gray-500"> · 截止 {new Date(a.dueAt).toLocaleString()}</span>}
                {a.status === 'closed' && <span className="text-red-600"> · 已关闭</span>}
              </span>
              <span className="flex items-center gap-3">
                <span className="text-gray-500">{a._count?.submissions ?? 0} 已交</span>
                <Link className="text-blue-600 hover:underline" to={`/homework/assignments/${a.id}`}>收卷看板 →</Link>
              </span>
            </div>
          ))}
        </div>
      )}

      {showRubric && (
        <RubricModal hw={hw} onClose={() => setShowRubric(false)} onSaved={() => { setShowRubric(false); onChanged(); }} />
      )}
    </div>
  );
}

/** Define per-question marks + criteria. Locked once any submission is graded. */
function RubricModal({ hw, onClose, onSaved }: { hw: any; onClose: () => void; onSaved: () => void }) {
  const [rows, setRows] = useState<{ label: string; maxMarks: string; criteria: string }[]>(
    hw.questions?.length
      ? hw.questions.map((q: any) => ({ label: q.label, maxMarks: String(q.maxMarks), criteria: q.criteria ?? '' }))
      : [{ label: 'Q1', maxMarks: '', criteria: '' }],
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const total = rows.reduce((s, r) => s + (Number(r.maxMarks) || 0), 0);

  return (
    <Modal title={`评分标准 — ${hw.title}`} onClose={onClose}>
      <div className="text-xs text-gray-500 mb-2">
        为每道题设分值 + 评分要点。AI 建议分和老师复核都按这个标准逐题判分。
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2 items-start">
            <input className="input w-16" placeholder="题号" value={r.label}
              onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
            <input className="input w-16" type="number" min={1} placeholder="分"
              value={r.maxMarks}
              onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, maxMarks: e.target.value } : x))} />
            <input className="input flex-1" placeholder="评分要点 / 参考答案（可选）" value={r.criteria}
              onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, criteria: e.target.value } : x))} />
            <button className="text-gray-400 hover:text-red-600 px-1"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>
      <button className="btn btn-ghost text-sm mt-2"
        onClick={() => setRows([...rows, { label: `Q${rows.length + 1}`, maxMarks: '', criteria: '' }])}>
        ＋ 加一题
      </button>
      <div className="text-sm text-gray-600 mt-2">合计满分：<b>{total}</b></div>
      {err && <div className="text-sm text-red-600 mt-2">{err}</div>}
      <div className="flex justify-end gap-2 mt-3">
        <button className="btn btn-ghost" onClick={onClose}>取消</button>
        <button className="btn btn-primary" disabled={busy}
          onClick={async () => {
            const qs = rows
              .filter((r) => r.label.trim() && Number(r.maxMarks) > 0)
              .map((r) => ({ label: r.label.trim(), maxMarks: Number(r.maxMarks), criteria: r.criteria.trim() || undefined }));
            if (qs.length === 0) { setErr('至少一道有效的题（题号 + 分值）'); return; }
            setBusy(true);
            try {
              await hwApi.setRubric(hw.id, qs);
              onSaved();
            } catch (e: any) {
              setErr(e.message);
            } finally {
              setBusy(false);
            }
          }}>
          {busy ? '保存中…' : '保存评分标准'}
        </button>
      </div>
    </Modal>
  );
}

/** JWT-protected view link: fetch bytes → open blob URL in a new tab. */
function FileLink({ fileId, name }: { fileId: string; name: string }) {
  return (
    <button
      className="text-blue-600 hover:underline"
      onClick={async () => {
        const token = localStorage.getItem('auth_token');
        const base = (import.meta as any).env?.VITE_API_URL || '';
        const res = await fetch(`${base}${hwFileContentPath(fileId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return alert(`打开失败: ${res.status}`);
        const url = URL.createObjectURL(await res.blob());
        window.open(url, '_blank');
      }}
    >📄 {name}</button>
  );
}

function NewCourseModal({ subjects, busy, onClose, onCreate }: any) {
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState('');
  return (
    <Modal title="新建课程" onClose={onClose}>
      <label className="block text-sm mb-1">课程名称</label>
      <input className="input w-full mb-3" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="如 Form 5 Add Maths" autoFocus />
      <label className="block text-sm mb-1">关联科目（可选，便于以后统计）</label>
      <select className="input w-full mb-4" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
        <option value="">— 不关联 —</option>
        {subjects.map((s: any) => (
          <option key={s.id} value={s.id}>{s.code} {s.name} ({s.level})</option>
        ))}
      </select>
      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>取消</button>
        <button className="btn btn-primary" disabled={!name.trim() || busy}
          onClick={() => onCreate({ name: name.trim(), subjectId: subjectId || undefined })}>
          创建
        </button>
      </div>
    </Modal>
  );
}

function NewHomeworkModal({ busy, onClose, onCreate }: any) {
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [totalMarks, setTotalMarks] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  return (
    <Modal title="新建作业" onClose={onClose}>
      <label className="block text-sm mb-1">标题</label>
      <input className="input w-full mb-3" value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="如 Chapter 4 指数与对数 练习" autoFocus />
      <label className="block text-sm mb-1">说明（可选）</label>
      <textarea className="input w-full mb-3" rows={3} value={instructions}
        onChange={(e) => setInstructions(e.target.value)} placeholder="完成第 1-8 题，写在 A4 纸上" />
      <label className="block text-sm mb-1">满分（可选）</label>
      <input className="input w-32 mb-3" type="number" min={1} value={totalMarks}
        onChange={(e) => setTotalMarks(e.target.value)} />
      <label className="block text-sm mb-1">作业文件（PDF/图片，可多选）</label>
      <input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp"
        className="mb-1" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      {files.length > 0 && <div className="text-xs text-gray-500 mb-3">{files.length} 个文件待上传</div>}
      <div className="flex justify-end gap-2 mt-3">
        <button className="btn btn-ghost" onClick={onClose}>取消</button>
        <button className="btn btn-primary" disabled={!title.trim() || busy}
          onClick={() =>
            onCreate(
              {
                title: title.trim(),
                instructions: instructions.trim() || undefined,
                totalMarks: totalMarks ? Number(totalMarks) : undefined,
              },
              files,
            )
          }>
          {busy ? '创建中…' : '创建'}
        </button>
      </div>
    </Modal>
  );
}

/** 把 Date 转 datetime-local 需要的本地格式 yyyy-MM-ddTHH:mm。 */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function AssignModal({ hw, classes, busy, onClose, onAssign }: any) {
  const [classId, setClassId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [allowLate, setAllowLate] = useState(true);

  function quickDue(kind: 'tonight' | 'tomorrow' | 'sunday') {
    const d = new Date();
    if (kind === 'tomorrow') d.setDate(d.getDate() + 1);
    if (kind === 'sunday') d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
    d.setHours(23, 59, 0, 0);
    setDueAt(toLocalInput(d));
  }

  return (
    <Modal title={`布置「${hw.title}」`} onClose={onClose}>
      <label className="block text-sm mb-1">班级</label>
      <select className="input w-full mb-3" value={classId} onChange={(e) => setClassId(e.target.value)} autoFocus>
        <option value="">— 选择班级 —</option>
        {classes.map((c: any) => (
          <option key={c.id} value={c.id}>{c.name} ({c.classCode})</option>
        ))}
      </select>
      <label className="block text-sm mb-1">截止时间（可选）</label>
      <div className="flex gap-1 mb-1">
        <button type="button" className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200" onClick={() => quickDue('tonight')}>今晚 23:59</button>
        <button type="button" className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200" onClick={() => quickDue('tomorrow')}>明晚 23:59</button>
        <button type="button" className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200" onClick={() => quickDue('sunday')}>周日 23:59</button>
        {dueAt && <button type="button" className="text-xs px-2 py-1 rounded text-gray-500 hover:bg-gray-100" onClick={() => setDueAt('')}>清除</button>}
      </div>
      <input className="input w-full mb-3" type="datetime-local" value={dueAt}
        onChange={(e) => setDueAt(e.target.value)} />
      <label className="flex items-center gap-2 text-sm mb-4">
        <input type="checkbox" checked={allowLate} onChange={(e) => setAllowLate(e.target.checked)} />
        允许迟交（迟交会标记）
      </label>
      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>取消</button>
        <button className="btn btn-primary" disabled={!classId || busy}
          onClick={() =>
            onAssign({
              classId,
              dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
              allowLate,
            })
          }>
          {busy ? '布置中…' : '布置'}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
