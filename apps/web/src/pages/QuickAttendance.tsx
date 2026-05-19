import { useEffect, useMemo, useState } from 'react';

type Status = 'present' | 'absent' | 'signup';
type Mode = Status | 'clear';
type Student = { name: string; id: string };
type Session = { name: string; savedAt: string; marks: Record<string, Status> };

const STUDENTS: Student[] = [
  { name: '杨钧皓', id: 'S260053' }, { name: '于琳晶', id: 'S260052' },
  { name: '胡鑫瑜', id: 'S260051' }, { name: '罗翾瑶', id: 'S260050' },
  { name: '孙爱迪', id: 'S260049' }, { name: '王晨旭', id: 'S260048' },
  { name: '王晨宇', id: 'S260047' }, { name: '于小婷', id: 'S260046' },
  { name: '刘思璇', id: 'S260045' }, { name: '牛星林', id: 'S260044' },
  { name: '林寅嘉', id: 'S260043' }, { name: '于小娉', id: 'S260039' },
  { name: 'HEIN HTET NAING', id: 'S260038' }, { name: '牟歌', id: 'S260037' },
  { name: '叶书瑞', id: 'S260036' }, { name: '毛思琳', id: 'S260035' },
  { name: '田昌', id: 'S260034' }, { name: '田硕', id: 'S260033' },
  { name: '李淳', id: 'S260032' }, { name: '王耀星', id: 'S260031' },
  { name: '郑靖稀', id: 'S260030' }, { name: '郑稀瑜', id: 'S260029' },
  { name: '雷泽锐', id: 'S260028' }, { name: '祝振豪', id: 'S260027' },
  { name: '严锦诺', id: 'S260026' }, { name: '李明阳', id: 'S260020' },
  { name: '喻耀程', id: 'S260024' }, { name: '闫雯涵', id: 'S260023' },
  { name: '李永轩', id: 'S260022' }, { name: '范恩慧', id: 'S260021' },
  { name: '孔凡今', id: 'S260019' }, { name: '刘钇村', id: 'S260009' },
  { name: '刘亦佳', id: 'S260008' },
];

const TAGS: Record<Status, string> = { present: '到', absent: '未到', signup: '报名' };
const KEY_CURRENT = 'qa.current.v1';
const KEY_SESSIONS = 'qa.sessions.v1';

function defaultName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 记录`;
}

function loadCurrent(): { name: string; marks: Record<string, Status> } {
  try {
    const raw = localStorage.getItem(KEY_CURRENT);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { name: defaultName(), marks: {} };
}

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(s: { name: string; marks: Record<string, Status> }) {
  const rows: string[][] = [['姓名', '学工号', '状态', '记录名', '导出时间']];
  const ts = new Date().toISOString();
  STUDENTS.forEach((st) => {
    const status = s.marks[st.id];
    rows.push([st.name, st.id, status ? TAGS[status] : '', s.name || '', ts]);
  });
  const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = (s.name || '考勤').replace(/[\\/:*?"<>|]/g, '_');
  a.href = url;
  a.download = `${safe}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
}

/**
 * Quick Attendance — phone-first roster tracker.
 *
 * Public route (no login). State lives entirely in localStorage, zero
 * backend round-trip — the page is safe to expose because it touches no
 * user data, just a hardcoded name list. The teacher home-screens it on
 * their phone, taps each name to mark present/absent/signed-up for an
 * event, then exports CSV when done. History tab lets them re-open a
 * past session for re-export.
 *
 * Roster is hardcoded — this is a personal tool for one cohort, not a
 * generic class manager (we already have /classes for that). When the
 * roster changes, edit STUDENTS at the top of this file.
 */
export default function QuickAttendancePage() {
  const initial = loadCurrent();
  const [name, setName] = useState<string>(initial.name);
  const [marks, setMarks] = useState<Record<string, Status>>(initial.marks);
  const [mode, setMode] = useState<Mode>('present');
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(KEY_CURRENT, JSON.stringify({ name, marks }));
  }, [name, marks]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, signup: 0 };
    Object.values(marks).forEach((v) => { c[v]++; });
    return { ...c, unmarked: STUDENTS.length - c.present - c.absent - c.signup };
  }, [marks]);

  function tap(id: string) {
    setMarks((m) => {
      const next = { ...m };
      if (mode === 'clear') delete next[id];
      else next[id] = mode;
      return next;
    });
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1200);
  }

  function save() {
    const sessions: Session[] = JSON.parse(localStorage.getItem(KEY_SESSIONS) || '[]');
    sessions.unshift({ name: name || defaultName(), savedAt: new Date().toISOString(), marks: { ...marks } });
    localStorage.setItem(KEY_SESSIONS, JSON.stringify(sessions.slice(0, 200)));
    flash('已保存 ✓');
  }

  function reset() {
    if (!confirm('清空当前所有标记？(已保存的历史不受影响)')) return;
    setMarks({});
  }

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b -mx-6 px-6 py-3 sm:mx-0 sm:px-0 sm:border-0 sm:bg-transparent sm:backdrop-blur-0 sm:static">
        <div className="flex items-center gap-2 mb-2">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="本次记录名称（如 2026-05-19 早测）"
          />
          <button className="btn" title="查看历史" onClick={() => setShowHistory(true)}>📂</button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs mb-2">
          <Pill>总 <b className="tabular-nums ml-1">{STUDENTS.length}</b></Pill>
          <Pill color="text-emerald-700 bg-emerald-50 border-emerald-200">✅ <b className="tabular-nums ml-1">{counts.present}</b></Pill>
          <Pill color="text-rose-700 bg-rose-50 border-rose-200">❌ <b className="tabular-nums ml-1">{counts.absent}</b></Pill>
          <Pill color="text-sky-700 bg-sky-50 border-sky-200">📝 <b className="tabular-nums ml-1">{counts.signup}</b></Pill>
          <Pill color="text-gray-600">⬜ <b className="tabular-nums ml-1">{counts.unmarked}</b></Pill>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <ModeBtn current={mode} value="present" onClick={setMode} className="bg-emerald-50 text-emerald-800 border-emerald-300">✅ 到</ModeBtn>
          <ModeBtn current={mode} value="absent" onClick={setMode} className="bg-rose-50 text-rose-800 border-rose-300">❌ 未到</ModeBtn>
          <ModeBtn current={mode} value="signup" onClick={setMode} className="bg-sky-50 text-sky-800 border-sky-300">📝 报名</ModeBtn>
          <ModeBtn current={mode} value="clear" onClick={setMode} className="bg-gray-50 text-gray-700 border-gray-300">⬜ 清除</ModeBtn>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
        {STUDENTS.map((s) => {
          const st = marks[s.id];
          const cls =
            st === 'present' ? 'bg-emerald-100 border-emerald-400 text-emerald-900' :
            st === 'absent'  ? 'bg-rose-100 border-rose-400 text-rose-900' :
            st === 'signup'  ? 'bg-sky-100 border-sky-400 text-sky-900' :
                               'bg-white border-gray-200 text-gray-800';
          return (
            <button
              key={s.id}
              onClick={() => tap(s.id)}
              className={`relative text-left rounded-xl border px-3 py-3 min-h-[64px] leading-tight active:scale-[0.98] transition ${cls}`}
            >
              <div className="font-bold truncate text-base">{s.name}</div>
              <div className="text-[11px] tabular-nums opacity-70 mt-0.5">{s.id}</div>
              {st && (
                <div className="absolute top-1.5 right-2 text-[11px] font-bold tracking-wide">{TAGS[st]}</div>
              )}
            </button>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t px-3 py-2 flex gap-2 z-10">
        <button className="btn btn-primary flex-1" onClick={save}>💾 保存</button>
        <button className="btn flex-1" onClick={() => downloadCsv({ name, marks })}>⬇ 导出 CSV</button>
        <button className="btn btn-danger flex-1" onClick={reset}>重置</button>
      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg z-20">
          {toast}
        </div>
      )}

      {showHistory && (
        <HistoryModal
          onClose={() => setShowHistory(false)}
          onLoad={(s) => { setName(s.name); setMarks({ ...s.marks }); setShowHistory(false); }}
        />
      )}
    </div>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2.5 py-0.5 font-semibold ${color ?? 'bg-gray-50 border-gray-200 text-gray-700'}`}>
      {children}
    </span>
  );
}

function ModeBtn({
  current, value, onClick, className, children,
}: {
  current: Mode; value: Mode; onClick: (m: Mode) => void; className: string; children: React.ReactNode;
}) {
  const on = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`rounded-lg border py-2 text-sm font-bold ${className} ${on ? 'ring-2 ring-offset-1 ring-gray-900' : 'opacity-60'}`}
    >
      {children}
    </button>
  );
}

function HistoryModal({
  onClose, onLoad,
}: {
  onClose: () => void; onLoad: (s: Session) => void;
}) {
  const [sessions, setSessions] = useState<Session[]>(() =>
    JSON.parse(localStorage.getItem(KEY_SESSIONS) || '[]'),
  );

  function del(i: number) {
    if (!confirm('删除该条记录？')) return;
    const next = sessions.slice();
    next.splice(i, 1);
    localStorage.setItem(KEY_SESSIONS, JSON.stringify(next));
    setSessions(next);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b font-bold">历史记录</div>
        <div className="overflow-auto p-3 space-y-2">
          {sessions.length === 0 && <div className="text-center text-gray-500 py-6">还没有保存的记录</div>}
          {sessions.map((s, i) => {
            const c = { present: 0, absent: 0, signup: 0 };
            Object.values(s.marks).forEach((v) => { c[v]++; });
            return (
              <div key={i} className="flex items-center gap-2 border rounded-lg p-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{s.name || '(未命名)'}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(s.savedAt).toLocaleString('zh-CN')} · ✅{c.present} ❌{c.absent} 📝{c.signup}
                  </div>
                </div>
                <button className="btn" onClick={() => onLoad(s)}>读取</button>
                <button className="btn" onClick={() => downloadCsv(s)}>CSV</button>
                <button className="btn btn-danger" onClick={() => del(i)}>删</button>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t text-right">
          <button className="btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
