import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/**
 * 集体注册台（2026-08-25）—— 教师在课堂上开一次窗，全班当场认领 PIN。
 *
 * ## 这个页面为什么长这样
 *
 * 它不是一个设置页，是**一节课里用的操作台**。教师投影出来，学生一个个
 * 注册，名字一个个变绿。这个「当众变绿」本身就是防抢注的一环：谁的名字
 * 被别人领了，当场就会有人喊出来，而不是几周后才发现。
 *
 * 所以设计上：
 *   · 一个大按钮（开窗/关窗），倒计时明显
 *   · 名单大字号、两列，绿=已领 灰=未领，远处看得清
 *   · 每 5 秒自动刷新 —— 教师不用去点刷新
 *   · 完成人数放在最显眼处，教师据此判断「还差谁」
 */

function fmtRemaining(sec: number): string {
  if (sec <= 0) return '已结束';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type Row = {
  id: string;
  name: string;
  claimed: boolean;
  claimedAt: string | null;
  locked: boolean;
  personalWindowOpen: boolean;
};

export default function ClassRegistration() {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState('');
  const [data, setData] = useState<Awaited<ReturnType<typeof api.claimStatus>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = await api.listClasses();
        const arr = (Array.isArray(list) ? list : list?.items ?? []) as any[];
        setClasses(arr.map((c) => ({ id: c.id, name: c.name })));
        if (arr.length && !classId) setClassId(arr[0].id);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    if (!classId) return;
    try {
      setData(await api.claimStatus(classId));
      setErr(null);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }, [classId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 每 5 秒拉一次 + 每秒走一次倒计时。注册进行中教师不该需要手动刷新。
  useEffect(() => {
    const poll = window.setInterval(() => void refresh(), 5000);
    timer.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [refresh]);

  const remainingSec = data?.windowOpenUntil
    ? Math.max(0, Math.round((new Date(data.windowOpenUntil).getTime() - now) / 1000))
    : 0;
  const open = !!data?.windowOpen && remainingSec > 0;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e: any) {
      window.alert(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  /** 以该学生的视角打开新标签页（只读，15 分钟）。 */
  const viewAs = async (s: Row) => {
    try {
      const r = await api.studentViewToken(s.id);
      const url = new URL(`${window.location.origin}/me`);
      url.searchParams.set('viewToken', r.token);
      url.searchParams.set('viewName', r.student.name);
      // 新标签页 —— 教师这一页的登录状态不受影响（令牌进的是新页的
      // sessionStorage，见 lib/teacher-view.ts）
      window.open(url.toString(), '_blank', 'noopener');
    } catch (e: any) {
      window.alert('打不开学生视角：' + (e?.message ?? e));
    }
  };

  const rows = (data?.students ?? []) as Row[];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">注册看板</h1>
      <p className="text-sm text-gray-500 mt-1 leading-relaxed">
        学生打开 App 时会<strong>自动引导注册</strong>（设密码、选头像），
        不需要教师做任何操作。这里看谁注册了；有人被冒名或忘密码，
        去「班级」页给他<strong>重置密码</strong>即可（重置瞬间对方所有登录失效）。
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          className="border rounded-lg px-3 py-2"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* 2026-08-26 网站式注册：开窗机制废弃，这里只剩看板 */}
      </div>

      {err && <div className="mt-3 text-sm text-rose-600">{err}</div>}

      {data && (
        <>
          <div className="mt-5 flex items-baseline gap-4">
            <div className="text-3xl font-bold text-gray-900">
              {data.claimed}
              <span className="text-gray-400 text-xl"> / {data.total}</span>
            </div>
            <div className="text-sm text-gray-500">
              已注册 · 还差 <strong className="text-gray-800">{data.unclaimed}</strong> 人
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {rows.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                  s.claimed ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={s.claimed ? 'text-emerald-600' : 'text-gray-300'}>
                    {s.claimed ? '●' : '○'}
                  </span>
                  <span className="text-lg font-medium text-gray-900 truncate">{s.name}</span>
                  {s.locked && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
                      锁定中
                    </span>
                  )}
                  {!s.claimed && s.personalWindowOpen && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">
                      单独开窗中
                    </span>
                  )}
                </span>
                <span className="flex gap-1 shrink-0">

                  <button
                    onClick={() => void viewAs(s)}
                    className="text-xs px-2 py-1 rounded border text-gray-700 hover:bg-gray-50"
                    title="以该学生的视角查看（只读，15 分钟）"
                  >
                    学生视角
                  </button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
