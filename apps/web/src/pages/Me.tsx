import { useCallback, useEffect, useState } from 'react';
import { teacherViewToken } from '../lib/teacher-view';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { decodeJwt } from '../lib/auth';
import { Spinner } from '../components/AsyncState';
import RegistrationSheet from '../components/RegistrationSheet';
import { checkRegistration, type RegStatus } from '../lib/registration';

/**
 * 个人主页 /me（2026-08-25，docs/PRD/student-auth-and-home.md §6）。
 *
 * 学生登录态的家：未登录给「姓名 + PIN」登录卡；登录后聚合
 * 「今天的课（三段）· 我的数据 · 我的账号」。
 *
 * 三段的数据**全部复用既有接口**（history-by-name / vocab-stats /
 * mistakes-practice-queue），不新建 lesson API —— 那留给 4.0 正式版。
 * 完成判定沿 4.0 PRD §2.3：可达成、只看「做了」。
 */

interface Segment {
  key: 'read' | 'vocab' | 'drill';
  icon: string;
  title: string;
  status: 'done' | 'partial' | 'todo' | 'none';
  detail: string;
  href: string | null;
  cta: string;
}

function tokenStudent(): { id: string; name: string } | null {
  try {
    // 教师「以学生视角查看」的令牌在 sessionStorage 里（每标签页独立，
    // 不挤掉教师自己的登录态）。这里必须一并认，否则教师点进学生视角
    // 只会看到一张登录卡 —— 而这个功能的全部意义就是看到学生看到的东西。
    const t = teacherViewToken() ?? localStorage.getItem('auth_token');
    if (!t) return null;
    const p = decodeJwt(t) as any;
    if (p?.role !== 'student' || !p.id || p.scope === 'mq_handoff') return null;
    if (typeof p.exp === 'number' && p.exp * 1000 < Date.now()) return null;
    return { id: p.id, name: p.name ?? '' };
  } catch {
    return null;
  }
}

export default function MePage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<{ id: string; name: string } | null>(() => tokenStudent());
  // 网站式注册（2026-08-26）：没登录且未注册 → 注册卡优先于登录卡
  const [reg, setReg] = useState<RegStatus | null>(null);
  useEffect(() => {
    if (me) return;
    let alive = true;
    void checkRegistration().then((r) => {
      if (alive && r?.show) setReg(r);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 登录卡状态 ──
  const [name, setName] = useState(() => {
    try { return localStorage.getItem('mq:history:name') ?? ''; } catch { return ''; }
  });
  const [pin, setPin] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Array<{ studentId: string; name: string; classes: string[] }> | null>(null);

  // ── 主页数据 ──
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [streak, setStreak] = useState(0);
  const [pinSet, setPinSet] = useState<boolean | null>(null);

  // ── 修改 PIN ──
  const [showChange, setShowChange] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [changeMsg, setChangeMsg] = useState<string | null>(null);

  const doLogin = useCallback(
    async (studentId?: string) => {
      const trimmed = name.trim();
      if (!trimmed || pin.length < 6) {
        setLoginErr('请输入姓名和密码（至少 6 位）');
        return;
      }
      setLoginBusy(true);
      setLoginErr(null);
      try {
        const r: any = await api.studentLogin({ name: trimmed, studentId, pin });
        if (r.needDisambiguation) {
          setCandidates(r.candidates);
          return;
        }
        localStorage.setItem('auth_token', r.token);
        try {
          localStorage.setItem('mq:history:name', r.student.name);
          localStorage.setItem('mq:history:studentId', r.student.id);
        } catch { /* ignore */ }
        setCandidates(null);
        setPin('');
        setMe(r.student);
      } catch (e: any) {
        if (e?.body?.code === 'pin_locked') {
          const min = Math.ceil((e.body.retryAfterSec ?? 900) / 60);
          setLoginErr(`连续输错次数过多，已锁定 —— ${min} 分钟后再试`);
        } else if (e?.body?.code === 'invalid_credentials' || e?.status === 401) {
          setLoginErr('姓名或密码不对。还没注册？打开 App 时会引导注册。');
        } else {
          setLoginErr(String(e?.message ?? e));
        }
      } finally {
        setLoginBusy(false);
      }
    },
    [name, pin],
  );

  // 登录后拉三段数据（全部既有接口，失败逐段降级，绝不整页白屏）
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      const qs = `name=${encodeURIComponent(me.name)}&studentId=${encodeURIComponent(me.id)}`;
      const out: Segment[] = [
        { key: 'read', icon: '📖', title: '读 · 今天的文章', status: 'none', detail: '加载中…', href: null, cta: '' },
        { key: 'vocab', icon: '🔤', title: '背 · 今日词汇', status: 'none', detail: '加载中…', href: `/my-vocab/review?${qs}`, cta: '去复习' },
        { key: 'drill', icon: '📕', title: '补 · 错题重练', status: 'none', detail: '加载中…', href: `/my-mistakes/practice?${qs}`, cta: '去重练' },
      ];
      const todayIso = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();

      // ① 读
      try {
        const h: any = await fetch(
          `${(import.meta as any).env?.VITE_API_URL || ''}/api/morning-quiz/history-by-name?name=${encodeURIComponent(me.name)}&studentId=${encodeURIComponent(me.id)}`,
        ).then((r) => r.json());
        // date = 场次的 SGT 日历日（UTC 午夜存储），比 submittedAt 的
        // UTC 时刻切片可靠 —— 后者在午夜边缘会切错天
        const todays = (h?.submissions ?? []).filter((s: any) =>
          String(s.date ?? '').slice(0, 10) === todayIso ||
          String(s.submittedAt ?? '').slice(0, 10) === todayIso,
        );
        if (todays.length > 0) {
          const s = todays[0];
          out[0] = {
            ...out[0],
            status: 'done',
            detail: s.scoresPending ? '已交 · 等老师批改' : `已交 · ${s.totalScore}/${s.maxScore} 分`,
            href: s.submissionId ? `/my-history/submission/${s.submissionId}?${qs}` : `/my-history?${qs}`,
            cta: '看答案',
          };
        } else {
          const up: any = await fetch(
            `${(import.meta as any).env?.VITE_API_URL || ''}/api/morning-quiz/upcoming-for-name?name=${encodeURIComponent(me.name)}&studentId=${encodeURIComponent(me.id)}`,
          ).then((r) => r.json());
          const open = (up?.upcoming ?? []).length > 0;
          out[0] = open
            ? { ...out[0], status: 'todo', detail: '今天的场次开着 · 扫教室二维码开始', href: null, cta: '' }
            : { ...out[0], status: 'none', detail: '今天没有进行中的场次', href: `/my-history?${qs}`, cta: '看历史' };
        }
      } catch {
        out[0] = { ...out[0], status: 'none', detail: '暂时取不到 · 稍后再试', href: `/my-history?${qs}`, cta: '看历史' };
      }

      // ② 背
      try {
        const v: any = await fetch(
          `${(import.meta as any).env?.VITE_API_URL || ''}/api/vocab/stats?name=${encodeURIComponent(me.name)}&studentId=${encodeURIComponent(me.id)}`,
        ).then((r) => r.json());
        setStreak(v?.streakDays ?? 0);
        const due = v?.totalDue ?? 0;
        const doneN = v?.reviewedToday ?? 0;
        if (due === 0 && doneN > 0) out[1] = { ...out[1], status: 'done', detail: `今天已复习 ${doneN} 次 · 到期的都清完了`, cta: '再练一轮' };
        else if (due === 0) out[1] = { ...out[1], status: 'done', detail: '今天没有到期的词', cta: '自主复习' };
        else if (doneN > 0) out[1] = { ...out[1], status: 'partial', detail: `已复习 ${doneN} 次 · 还有 ${due} 个词到期`, cta: '继续' };
        else out[1] = { ...out[1], status: 'todo', detail: `${due} 个词在等你 · 约 ${Math.max(2, Math.ceil(due / 5))} 分钟`, cta: '开始' };
      } catch {
        out[1] = { ...out[1], status: 'none', detail: '暂时取不到', cta: '打开生词本', href: `/my-vocab?${qs}` };
      }

      // ③ 补
      try {
        const m: any = await fetch(
          `${(import.meta as any).env?.VITE_API_URL || ''}/api/vocab/mistakes/practice-queue?name=${encodeURIComponent(me.name)}&studentId=${encodeURIComponent(me.id)}`,
        ).then((r) => r.json());
        const n = (m?.items ?? m?.queue ?? []).length;
        out[2] = n === 0
          ? { ...out[2], status: 'done', detail: '今天没有待练的错题', cta: '打开错题本', href: `/my-mistakes?${qs}` }
          : { ...out[2], status: 'todo', detail: `${n} 道待练 · 约 ${Math.max(2, n)} 分钟`, cta: '开始' };
      } catch {
        out[2] = { ...out[2], status: 'none', detail: '暂时取不到', cta: '打开错题本', href: `/my-mistakes?${qs}` };
      }

      if (!cancelled) setSegments([...out]);
      // PIN 状态（修改 PIN 卡片要知道设没设过）
      try {
        const info: any = await api.studentAuthMe();
        if (!cancelled) setPinSet(!!info.pinSet);
      } catch { /* token 可能刚失效，忽略 */ }
    })();
    return () => { cancelled = true; };
  }, [me]);

  const isTeacherView = teacherViewToken() != null;

  const logout = () => {
    // 教师视角下这颗按钮是隐藏的。这里再挡一层：真被点到也不能去清
    // localStorage.auth_token —— 那是**教师自己的登录票**，清了他就被
    // 自己踢下线了。视角要退出走横幅上的「退出视角」。
    if (isTeacherView) return;
    localStorage.removeItem('auth_token');
    setMe(null);
    setSegments(null);
  };

  const changePin = async () => {
    setChangeMsg(null);
    try {
      await api.studentChangePin({ oldPin, newPin });
      setChangeMsg('✓ 已修改');
      setOldPin('');
      setNewPin('');
      setTimeout(() => setShowChange(false), 800);
    } catch (e: any) {
      const code = e?.body?.code;
      setChangeMsg(
        code === 'invalid_credentials' ? '旧密码不对' :
        code === 'pin_too_weak' || code === 'password_too_weak' ? '新密码太好猜了，换一个' :
        code === 'password_too_short' ? '密码至少 6 位' :
        code === 'pin_locked' ? '输错太多次，稍后再试' :
        String(e?.message ?? e),
      );
    }
  };

  // ── 未登录：登录卡 ──
  if (!me && reg) {
    return (
      <RegistrationSheet
        name={reg.name}
        studentId={reg.studentId}
        candidates={reg.candidates}
        onDone={(stu) => { setReg(null); setMe(stu); }}
      />
    );
  }

  if (!me) {
    return (
      <div className="ui-ios min-h-screen bg-gray-50 flex items-center justify-center px-5">
        <div className="bg-white rounded-2xl border shadow-sm p-6 max-w-sm w-full">
          <h1 className="text-xl font-bold text-gray-900 text-center">我的每日英语</h1>
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => { e.preventDefault(); void doLogin(); }}
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="姓名"
              autoComplete="off"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
            />
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value.slice(0, 32))}
              placeholder="密码"
              autoComplete="off"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base tracking-[0.4em] text-center focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loginBusy || !name.trim() || pin.length < 6}
              className="press w-full py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:bg-gray-300"
            >
              {loginBusy ? '登录中…' : '登录'}
            </button>
          </form>
          {loginErr && (
            <div className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {loginErr}
            </div>
          )}
          {candidates && (
            <div className="mt-3 space-y-2">
              <div className="text-sm text-gray-600">有 {candidates.length} 位同名同学，选你的班级：</div>
              {candidates.map((c) => (
                <button
                  key={c.studentId}
                  type="button"
                  onClick={() => void doLogin(c.studentId)}
                  className="press w-full text-left px-3 py-2 rounded-lg border bg-gray-50 text-sm"
                >
                  {c.name} · {c.classes.join(' / ')}
                </button>
              ))}
            </div>
          )}
          <div className="mt-5 pt-4 border-t text-[13px] text-gray-500 leading-relaxed">
            第一次用？打开 App 会引导你<strong>注册账号</strong>（设密码、选头像）。
            <br />
            <Link to="/my-history" className="text-blue-600 underline">
              或先用姓名查看成绩 →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── 已登录：今天的课 ──
  return (
    <div className="ui-ios min-h-screen bg-gray-50">
      <main className="max-w-md mx-auto px-4 py-5 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-gray-900">你好，{me.name}</div>
            {streak > 0 && (
              <div className="text-[13px] text-orange-600 mt-0.5">🔥 连续学习 {streak} 天</div>
            )}
          </div>
          {!isTeacherView && (
            <button type="button" onClick={logout} className="text-[13px] text-gray-400 px-2 py-1">
              退出
            </button>
          )}
        </header>

        <section className="bg-white rounded-2xl border shadow-sm divide-y">
          <div className="px-4 py-3 text-[13px] font-semibold text-gray-500">
            <a
              href={`/my-lesson?name=${encodeURIComponent(me?.name ?? '')}&studentId=${encodeURIComponent(me?.id ?? '')}`}
              className="hover:underline"
              title="打开完整的课程页"
            >
              今天的课
            </a>{' '}·{' '}
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
          {(segments ?? []).map((s) => (
            <div key={s.key} className="px-4 py-3.5 flex items-center gap-3">
              <span className="text-xl">{s.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-gray-900">
                  {s.title}
                  {s.status === 'done' && <span className="ml-2 text-emerald-600 text-[13px]">✓</span>}
                  {s.status === 'partial' && <span className="ml-2 text-sky-600 text-[13px]">●</span>}
                </div>
                <div className="text-[13px] text-gray-500 mt-0.5">{s.detail}</div>
              </div>
              {s.href && s.cta && (
                <button
                  type="button"
                  onClick={() => navigate(s.href!)}
                  className="press shrink-0 text-[13px] px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 font-medium"
                >
                  {s.cta} →
                </button>
              )}
            </div>
          ))}
          {!segments && <div className="px-4 py-6"><Spinner label="加载今天的课…" /></div>}
        </section>

        <section className="grid grid-cols-3 gap-2">
          {[
            { to: `/my-history?name=${encodeURIComponent(me.name)}&studentId=${me.id}`, icon: '📊', label: '成绩记录' },
            { to: `/my-vocab?name=${encodeURIComponent(me.name)}&studentId=${me.id}`, icon: '📒', label: '生词本' },
            { to: `/my-mistakes?name=${encodeURIComponent(me.name)}&studentId=${me.id}`, icon: '📕', label: '错题本' },
          ].map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="press bg-white rounded-xl border shadow-sm py-3 text-center"
            >
              <div className="text-xl">{l.icon}</div>
              <div className="text-[12px] text-gray-600 mt-1">{l.label}</div>
            </Link>
          ))}
        </section>

        <section className="bg-white rounded-2xl border shadow-sm p-4">
          {!showChange ? (
            <button
              type="button"
              onClick={() => setShowChange(true)}
              disabled={isTeacherView}
              title={isTeacherView ? '教师视角只读 —— 重置密码请在班级花名册操作' : undefined}
              className="text-[14px] text-gray-600 disabled:text-gray-300"
            >
              🔑 修改密码 {pinSet === false && <span className="text-amber-600">（还没设置 —— 打开 App 会引导注册）</span>}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="text-[14px] font-semibold text-gray-800">修改密码</div>
              <input
                type="password" placeholder="旧密码" value={oldPin}
                onChange={(e) => setOldPin(e.target.value.slice(0, 32))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="password" placeholder="新密码（至少 6 位）" value={newPin}
                onChange={(e) => setNewPin(e.target.value.slice(0, 32))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={oldPin.length < 6 || newPin.length < 6}
                  onClick={() => void changePin()}
                  className="press px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:bg-gray-300"
                >
                  确认
                </button>
                <button type="button" onClick={() => setShowChange(false)} className="px-3 py-2 text-sm text-gray-500">
                  取消
                </button>
              </div>
              {changeMsg && <div className="text-[13px] text-gray-600">{changeMsg}</div>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
