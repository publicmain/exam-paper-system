import { useEffect, useMemo, useState } from 'react';

type Student = { name: string; id: string };
type Session = { name: string; savedAt: string; marked: string[] };

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

const KEY_CURRENT = 'qa.current.v2';
const KEY_SESSIONS = 'qa.sessions.v2';

function defaultName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 记录`;
}

function loadCurrent(): { name: string; marked: string[] } {
  try {
    const raw = localStorage.getItem(KEY_CURRENT);
    if (raw) {
      const v = JSON.parse(raw);
      if (Array.isArray(v.marked)) return v;
    }
  } catch { /* ignore */ }
  return { name: defaultName(), marked: [] };
}

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(s: { name: string; marked: string[] }) {
  const set = new Set(s.marked);
  const rows: string[][] = [['姓名', '学工号', '已选', '记录名', '导出时间']];
  const ts = new Date().toISOString();
  STUDENTS.forEach((st) => {
    rows.push([st.name, st.id, set.has(st.id) ? '是' : '', s.name || '', ts]);
  });
  const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = (s.name || '记录').replace(/[\\/:*?"<>|]/g, '_');
  a.href = url;
  a.download = `${safe}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
}

const STYLE = `
@keyframes qa-pop {
  0%   { transform: translateY(0)   scale(1); }
  35%  { transform: translateY(-3px) scale(1.06); }
  70%  { transform: translateY(0)   scale(0.985); }
  100% { transform: translateY(0)   scale(1); }
}
@keyframes qa-sheen {
  0%   { opacity: 0; transform: translateX(-60%) skewX(-18deg); }
  40%  { opacity: 0.55; }
  100% { opacity: 0; transform: translateX(160%) skewX(-18deg); }
}
.qa-stu {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid;
  padding: 14px 12px 12px;
  min-height: 76px;
  text-align: left;
  line-height: 1.2;
  font-weight: 700;
  transition: transform 90ms ease, box-shadow 120ms ease, background 140ms ease, border-color 140ms ease;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.75),
    0 1px 0 rgba(0,0,0,0.04),
    0 6px 14px -8px rgba(15,23,42,0.18);
  will-change: transform, box-shadow;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.qa-stu:active {
  transform: translateY(2px) scale(0.97);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.45),
    0 2px 6px -2px rgba(15,23,42,0.18);
}
.qa-stu[data-pulse="1"] { animation: qa-pop 320ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.qa-stu[data-pulse="1"]::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 50%, transparent 100%);
  width: 50%;
  height: 100%;
  animation: qa-sheen 420ms ease-out;
  pointer-events: none;
}
.qa-stu.off { background: linear-gradient(180deg, #ffffff 0%, #f4f6fb 100%); border-color: #e4e8f0; color: #0f172a; }
.qa-stu.on  { background: linear-gradient(180deg, #d1fae5 0%, #6ee7b7 100%); border-color: #10b981; color: #064e3b; }
.qa-stu .qa-id { font-size: 11px; font-weight: 600; opacity: 0.65; margin-top: 4px; font-variant-numeric: tabular-nums; letter-spacing: 0.3px; }
.qa-stu .qa-nm { font-size: 17px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.qa-foot { background: rgba(255,255,255,0.92); backdrop-filter: blur(10px) saturate(140%); }
.qa-foot button {
  border-radius: 14px;
  font-weight: 800;
  letter-spacing: 0.3px;
  padding: 12px 0;
  font-size: 15px;
  border: 1px solid;
  transition: transform 90ms ease, box-shadow 120ms ease;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 12px -4px rgba(15,23,42,0.18);
  -webkit-tap-highlight-color: transparent;
}
.qa-foot button:active { transform: translateY(2px) scale(0.985); box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 4px -2px rgba(15,23,42,0.18); }
.qa-foot .save  { background: linear-gradient(180deg, #34d399 0%, #059669 100%); color: #fff; border-color: #047857; }
.qa-foot .csv   { background: linear-gradient(180deg, #ffffff 0%, #e5e7eb 100%); color: #111827; border-color: #cbd5e1; }
.qa-foot .reset { background: linear-gradient(180deg, #fecaca 0%, #f87171 100%); color: #7f1d1d; border-color: #ef4444; }

@media (prefers-reduced-motion: reduce) {
  .qa-stu, .qa-foot button { transition: none !important; animation: none !important; }
  .qa-stu[data-pulse="1"]::after { display: none; }
}
`;

function buzz(ms = 12) {
  try { (navigator as any).vibrate?.(ms); } catch { /* ignore */ }
}

/**
 * Quick Attendance — phone-first tally recorder.
 *
 * Public route (no login). Tap a name to toggle it on/off; that's the
 * entire interaction. Counter shows N selected, footer saves / exports /
 * resets. All state in localStorage, no backend.
 *
 * Roster is hardcoded — when it changes, edit STUDENTS above.
 */
export default function QuickAttendancePage() {
  const initial = loadCurrent();
  const [name, setName] = useState<string>(initial.name);
  const [marked, setMarked] = useState<Set<string>>(() => new Set(initial.marked));
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pulse, setPulse] = useState<Record<string, number>>({});

  useEffect(() => {
    localStorage.setItem(KEY_CURRENT, JSON.stringify({ name, marked: [...marked] }));
  }, [name, marked]);

  const count = useMemo(() => marked.size, [marked]);

  function tap(id: string) {
    setMarked((m) => {
      const next = new Set(m);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    const t = Date.now();
    setPulse((p) => ({ ...p, [id]: t }));
    setTimeout(() => {
      setPulse((p) => (p[id] === t ? (() => { const n = { ...p }; delete n[id]; return n; })() : p));
    }, 340);
    buzz(12);
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1200);
  }

  function save() {
    const sessions: Session[] = JSON.parse(localStorage.getItem(KEY_SESSIONS) || '[]');
    sessions.unshift({ name: name || defaultName(), savedAt: new Date().toISOString(), marked: [...marked] });
    localStorage.setItem(KEY_SESSIONS, JSON.stringify(sessions.slice(0, 200)));
    flash('已保存 ✓');
    buzz(20);
  }

  function reset() {
    if (!confirm('清空当前所有标记？(已保存的历史不受影响)')) return;
    setMarked(new Set());
  }

  return (
    <div className="max-w-2xl mx-auto pb-28 px-3 sm:px-0">
      <style>{STYLE}</style>
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-md -mx-3 px-3 pt-3 pb-2 border-b border-slate-200/60 sm:mx-0 sm:px-0 sm:border-0 sm:bg-transparent sm:backdrop-blur-0 sm:static">
        <div className="flex items-center gap-2 mb-2">
          <input
            className="input shadow-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="本次记录名称（如 2026-05-19 早测）"
          />
          <button
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-base shadow-sm active:translate-y-[1px] active:shadow-none transition"
            title="查看历史"
            onClick={() => setShowHistory(true)}
          >📂</button>
        </div>
        <div className="text-sm text-slate-600 font-semibold tracking-wide">
          已选 <span className="text-emerald-700 text-base tabular-nums">{count}</span>
          <span className="text-slate-400"> / {STUDENTS.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
        {STUDENTS.map((s) => {
          const on = marked.has(s.id);
          return (
            <button
              key={s.id}
              onClick={() => tap(s.id)}
              data-pulse={pulse[s.id] ? '1' : '0'}
              className={`qa-stu ${on ? 'on' : 'off'}`}
            >
              <div className="qa-nm">{s.name}</div>
              <div className="qa-id">{s.id}</div>
            </button>
          );
        })}
      </div>

      <div
        className="qa-foot fixed bottom-0 left-0 right-0 border-t border-slate-200/70 px-3 py-3 grid grid-cols-3 gap-2 z-10"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <button className="save" onClick={save}>💾 保存</button>
        <button className="csv" onClick={() => { downloadCsv({ name, marked: [...marked] }); buzz(15); }}>⬇ 导出</button>
        <button className="reset" onClick={reset}>重置</button>
      </div>

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-gradient-to-b from-emerald-500 to-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-xl z-20 ring-1 ring-emerald-800/40">
          {toast}
        </div>
      )}

      {showHistory && (
        <HistoryModal
          onClose={() => setShowHistory(false)}
          onLoad={(s) => { setName(s.name); setMarked(new Set(s.marked)); setShowHistory(false); }}
        />
      )}
    </div>
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
          {sessions.map((s, i) => (
            <div key={i} className="flex items-center gap-2 border rounded-lg p-2">
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{s.name || '(未命名)'}</div>
                <div className="text-xs text-gray-500">
                  {new Date(s.savedAt).toLocaleString('zh-CN')} · 已选 {s.marked.length}
                </div>
              </div>
              <button className="btn" onClick={() => onLoad(s)}>读取</button>
              <button className="btn" onClick={() => downloadCsv(s)}>CSV</button>
              <button className="btn btn-danger" onClick={() => del(i)}>删</button>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t text-right">
          <button className="btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
