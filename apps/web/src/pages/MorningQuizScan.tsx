import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import WhatsNewSheet, { hasSeenWhatsNew, markWhatsNewSeen } from '../components/exam/WhatsNewSheet';

type Level = 'ielts_authentic' | 'ielts_simplified' | 'olevel';
const LEVEL_LABEL: Record<Level, { zh: string; en: string; desc: string; tint: string }> = {
  ielts_authentic: {
    zh: '雅思真题',
    en: 'IELTS Authentic',
    desc: '真·剑桥雅思学术阅读,难度最高 · hardest',
    tint: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
  },
  ielts_simplified: {
    zh: '轻难度雅思',
    en: 'Simplified IELTS',
    desc: '简化版雅思阅读 · easier',
    tint: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
  },
  olevel: {
    zh: 'O-Level 英语',
    en: 'OLevel English',
    desc: 'O-Level 记叙文理解,大多数同学选这个 · most students',
    tint: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
  },
};

interface RosterMeta {
  sessionId: string;
  sessionStatus: string;
  className: string;
  level: Level | null;
  // R10 multi-level: when a class is running multiple bands on the same
  // day, the projector shows ONE QR and we present a level-picker here
  // so the student selects their own difficulty before typing their name.
  // The list always includes the QR's own session, so single-band
  // classes get exactly one entry and the picker is auto-skipped.
  siblingSessions: Array<{ sessionId: string; level: Level }>;
  studentCount: number;
}
interface ScanResult {
  attendance: { id: string; status: 'on_time' | 'late' | 'absent'; scanTime: string | null };
  student: { id: string; name: string };
  scanToken: string;
  quizUrl: string;
  remainingMinutes: number;
}

/**
 * Landing page after a student scans the big-screen QR. URL pattern is
 * `/scan/:token`. The flow is LOGIN-FREE — student types their full real
 * name, server matches it against the session's class roster, and on a hit
 * mints a short-lived "scan token" the frontend stores as auth_token. The
 * token expires at session.quizEnd, so it's useless after 9:00.
 *
 * Design choice: typing > picking from a dropdown. Picking is faster but
 * makes 代签 (one phone clicking 30 names in 30s) trivial; typing forces a
 * minimum knowledge bar and slows attempts to a crawl. Combined with the
 * deviceUuid block (one device → one student per session) and in-room
 * invigilation, this is the strongest no-password defence we can deploy.
 */
function getDeviceUuid(): string {
  const KEY = 'morningQuizDeviceUuid';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'fallback-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEY, id);
  }
  return id;
}

export default function MorningQuizScan() {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<RosterMeta | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // R10 multi-level: which (class+day+level) sibling session the student
  // wants. null means "not yet picked" — the picker UI is shown when
  // meta.siblingSessions.length > 1; auto-set to the only entry when
  // there's just one (single-band class).
  const [chosenSessionId, setChosenSessionId] = useState<string | null>(null);
  /** 签到成功后要去的试卷地址。非 null = 正在显示新功能引导。 */
  const [pendingQuizUrl, setPendingQuizUrl] = useState<string | null>(null);

  // Fetch the class meta on mount. We hit /scan-roster (gated by a live
  // QR token) but only display the class name + count, never the names
  // themselves — avoids leaking the roster.
  useEffect(() => {
    if (!token) {
      setError({ code: 'no_token', message: '扫码链接缺少 token,请重新扫一次大屏二维码。' });
      return;
    }
    let cancelled = false;
    api
      .attendanceScanRoster(token)
      .then((r: any) => {
        if (cancelled) return;
        const siblings: Array<{ sessionId: string; level: Level }> =
          Array.isArray(r.siblingSessions) ? r.siblingSessions : [];
        setMeta({
          sessionId: r.sessionId,
          sessionStatus: r.sessionStatus,
          className: r.className,
          level: r.level ?? null,
          siblingSessions: siblings,
          studentCount: r.students?.length ?? 0,
        });
        // Auto-pick when there's only one band (or when scan-roster
        // didn't return siblings — pre-multi-level fallback).
        if (siblings.length <= 1) {
          setChosenSessionId(siblings[0]?.sessionId ?? r.sessionId);
        }
      })
      .catch((e: any) => {
        if (cancelled) return;
        const raw = e?.message ?? String(e);
        const code = extractCode(raw) ?? 'unknown';
        setError({ code, message: friendlyMessage(code, raw) });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !token) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError({ code: 'empty_name', message: '请输入你的姓名' });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r: ScanResult = await api.attendanceScan(
        token,
        trimmed,
        getDeviceUuid(),
        // Pass the chosen sessionId only when it's different from the
        // QR's encoded one (server tolerates both, but keeping the
        // payload small avoids confusing future readers).
        chosenSessionId && chosenSessionId !== meta?.sessionId
          ? chosenSessionId
          : undefined,
      );
      localStorage.setItem('auth_token', r.scanToken);
      // 记住姓名 —— /my-history 的输入框会用它预填。学生以后随时扫墙上
      // 的码查成绩时,不用再回忆"当时登记的是哪个写法"。
      try {
        localStorage.setItem('mq:history:name', trimmed);
      } catch { /* 隐私模式，无所谓 */ }
      // 2.0 新功能引导：签到已经写进服务端了,这里只是在跳转前插一屏。
      //
      // 为什么放在这个位置 —— 前后各有一个不能碰的东西:
      //   · 往前放（输姓名之前）会挡住签到本身,迟到的学生最需要的是
      //     先把考勤打上,不是看功能介绍;
      //   · 往后放（进了试卷再弹）会盖住考卷,而倒计时挂的是固定的
      //     9:00,那时候每一秒都是答题时间。
      // 夹在中间这一下,考勤已经落库、试卷还没开始渲染,是唯一一个
      // "出了任何岔子都不影响成绩"的位置。引导组件自身也不做任何
      // 网络请求,卡住也只是白屏一秒,点跳过就走。
      if (hasSeenWhatsNew()) {
        window.location.replace(r.quizUrl);
        return;
      }
      setPendingQuizUrl(r.quizUrl);
    } catch (e: any) {
      const raw = e?.message ?? String(e);
      const code = extractCode(raw) ?? 'unknown';
      setError({ code, message: friendlyMessage(code, raw) });
      setSubmitting(false);
    }
  }

  // 引导优先于其余所有分支：此刻考勤已经落库,唯一还没做的就是跳转,
  // 不能被下面任何一个 meta/error 分支抢先渲染掉。
  if (pendingQuizUrl) {
    return (
      <WhatsNewSheet
        onDone={() => {
          markWhatsNewSeen();
          window.location.replace(pendingQuizUrl);
        }}
      />
    );
  }

  if (error && !meta) {
    return (
      <Centered>
        <div className="text-7xl mb-6">{isQuizOver(error.code, error.message) ? '🕐' : '⛔'}</div>
        {/* 「不是考试时间」不是错误 —— 下午扫码查成绩的学生占多数,满屏
            红字"联系班主任"会吓到他们。灰字陈述事实,红色留给真报错。 */}
        <div
          className={`text-2xl font-semibold mb-2 ${
            isQuizOver(error.code, error.message) ? 'text-gray-600' : 'text-rose-600'
          }`}
        >
          {error.message}
        </div>
        <div className="text-xs text-gray-400 mt-2 font-mono">code: {error.code}</div>
        <AfterQuizPortal code={error.code} raw={error.message} />
      </Centered>
    );
  }

  if (!meta) {
    return (
      <Centered>
        <div className="text-2xl text-gray-500">正在准备签到…</div>
      </Centered>
    );
  }

  // R10 multi-level — when more than one band is active for this
  // (class, day) and the student hasn't picked yet, gate the name input
  // behind a level-picker. Single-band classes auto-skip to the form.
  if (meta.siblingSessions.length > 1 && !chosenSessionId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col px-4 py-8">
        <div className="max-w-md mx-auto w-full">
          <header className="mb-8 text-center">
            <h1 className="text-3xl font-bold">{meta.className}</h1>
            <p className="text-sm text-gray-500 mt-1">请先选择难度</p>
          </header>
          <div className="space-y-3">
            {meta.siblingSessions.map((s) => {
              const lab = LEVEL_LABEL[s.level];
              return (
                <button
                  key={s.sessionId}
                  type="button"
                  onClick={() => setChosenSessionId(s.sessionId)}
                  className={`w-full px-4 py-5 text-left border-2 rounded-lg transition-colors ${lab.tint}`}
                  data-testid={`level-pick-${s.level}`}
                >
                  <div className="text-lg font-semibold text-gray-900">{lab.zh}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{lab.en}</div>
                  <div className="text-xs text-gray-600 mt-1">{lab.desc}</div>
                </button>
              );
            })}
          </div>
          <p className="mt-6 text-center text-xs text-gray-500">
            难度按你目前的英语水平选择;不确定问老师。选错可以联系老师重置。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 py-8">
      <div className="max-w-md mx-auto w-full">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold">{meta.className}</h1>
          <p className="text-sm text-gray-500 mt-1">
            早测签到 · 共 {meta.studentCount} 人
            {chosenSessionId && (() => {
              const sib = meta.siblingSessions.find((s) => s.sessionId === chosenSessionId);
              return sib ? (
                <>
                  {' · '}
                  <span className="text-blue-700 font-medium">
                    {LEVEL_LABEL[sib.level].zh}
                  </span>
                  {meta.siblingSessions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setChosenSessionId(null)}
                      className="ml-2 text-xs text-blue-600 underline"
                    >
                      换难度
                    </button>
                  )}
                </>
              ) : null;
            })()}
          </p>
        </header>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-base text-gray-700 mb-2 font-medium">
              请输入你的姓名(完整真名)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder=""
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={submitting}
              className="w-full px-4 py-4 text-2xl text-center border-2 border-gray-200 focus:border-blue-500 rounded-lg outline-none disabled:bg-gray-100"
            />
          </div>
          {error && (
            <div className="px-4 py-3 bg-rose-50 border border-rose-200 text-rose-700 rounded text-sm text-center">
              {error.message}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="w-full px-4 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-lg font-semibold rounded-lg transition-colors"
          >
            {submitting ? '签到中…' : '签到 · Sign In'}
          </button>
        </form>
        <footer className="mt-8 text-center text-xs text-gray-400">
          Morning Quiz · ESIC · 名字打错或不在名单?请联系老师
        </footer>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center text-center px-6">
      {children}
    </div>
  );
}

/**
 * 「现在不是考试时间」类的状态 —— 学生此刻扫码,多半不是来补签的,
 * 是来**查成绩 / 背单词**的。涵盖:考完(locked/closed)、周末或假期
 * (session_not_found)、考前(scheduled/not_open)。
 * 不涵盖考试进行中的具体报错(查无此名、设备冲突、二维码轮换过期),
 * 那些场景学生正急着签到,塞成绩链接只会添乱。
 */
function isQuizOver(code: string, raw: string): boolean {
  return (
    code === 'attendance_window_closed' ||
    code === 'attendance_window_not_open' ||
    code === 'session_not_found' ||
    code === 'qr_session_not_found' ||
    code === 'session_not_active'
  );
}

/**
 * 死胡同 → 门厅。
 *
 * 老师反馈学生不知道去哪看成绩,「单单一个链接」记不住。观察到的事实:
 * 学生唯一形成肌肉记忆的动作就是**扫墙上那个码**(每天早上都在做)。
 * 以前考试结束后再扫,得到的是"窗口已关闭,请联系班主任" —— 一个
 * 死胡同。把这个死胡同改成门厅,查成绩就不需要学生学任何新东西:
 * 还是那个码,考试时间扫=签到,考完扫=查成绩/练生词。
 *
 * 姓名从签到时存的 localStorage 里带上,一次点击直达本人页面。
 * 换了设备没有姓名也不要紧 —— /my-history 自己会让他输一次并记住。
 */
function AfterQuizPortal({ code, raw }: { code: string; raw: string }) {
  if (!isQuizOver(code, raw)) return null;
  let savedName = '';
  try {
    savedName = localStorage.getItem('mq:history:name') ?? '';
  } catch { /* ignore */ }
  const q = savedName ? `?name=${encodeURIComponent(savedName)}` : '';
  return (
    <div className="mt-8 w-full max-w-sm">
      <div className="text-base text-gray-600 mb-3">要查成绩或背单词？就是这里：</div>
      <a
        href={`/my-history${q}`}
        className="block w-full py-4 rounded-2xl bg-blue-600 active:bg-blue-700 text-white text-xl font-semibold text-center touch-manipulation"
      >
        📊 我的成绩{savedName ? ` · ${savedName}` : ''}
      </a>
      <a
        href={`/my-vocab${q}`}
        className="mt-3 block w-full py-4 rounded-2xl bg-white border-2 border-gray-300 text-gray-800 text-xl font-semibold text-center touch-manipulation"
      >
        📒 我的生词本 · 自测
      </a>
      <div className="mt-3 text-sm text-gray-400 text-center">
        以后任何时候扫这个码，都能从这里进。
      </div>
    </div>
  );
}

function extractCode(raw: string): string | null {
  const m = raw.match(/code["']?\s*[:=]\s*["']([a-z_]+)["']/i);
  if (m) return m[1];
  try {
    const j = JSON.parse(raw);
    if (j?.code) return j.code as string;
  } catch {
    /* not json */
  }
  return null;
}

function friendlyMessage(code: string, raw: string): string {
  switch (code) {
    case 'qr_expired':
    case 'qr_from_future':
      return '二维码已过期。请重新扫一次大屏上的最新二维码。';
    case 'qr_invalid':
    case 'qr_malformed':
      return '二维码无效或格式错误。请直接用手机相机扫描大屏。';
    case 'qr_session_not_found':
    case 'session_not_found':
      return '今天没有早测安排,请联系老师。';
    case 'session_not_active': {
      // Backend includes the actual session.status in the error body
      // (see attendance.service.ts:66 / :164). Surfacing it lets us
      // tell scheduled / locked / cancelled apart on the spot — the
      // old generic "已开启或已结束" wording made operator triage
      // impossible (you didn't know if it was a cron miss, a teacher
      // mis-cancel, or just past 9:00).
      const m = raw.match(/status["']?\s*[:=]\s*["']([a-z_]+)["']/);
      const status = m?.[1];
      if (status === 'scheduled') return '考勤窗口尚未开启,请稍等大屏倒计时归零再扫。';
      if (status === 'locked') return '今早早测已结束(9:00 之后)。请联系班主任手工补登。';
      if (status === 'cancelled') return '本场早测已取消,请联系老师确认。';
      return `早测会话状态异常(${status ?? 'unknown'})。请联系老师并截图本提示。`;
    }
    case 'student_not_found':
      return '名单里没有这个名字,请检查拼写后重试(全名,不加空格)。';
    case 'multiple_students_with_same_name':
      return '本班有多名同学同名,请联系老师手工补登。';
    case 'not_enrolled':
      return '你不在该班级名单中。请确认你扫的是自己班的二维码。';
    case 'device_already_used': {
      const m = raw.match(/conflictStudent["']?\s*[:=]\s*["']([^"']+)["']/);
      const other = m ? m[1] : '另一位同学';
      return `本设备已被 ${other} 用于签到。如果是你借的手机给同学,请联系老师手工补登。`;
    }
    case 'attendance_window_not_open':
      return '考勤窗口未开放,请等待大屏倒计时。';
    case 'attendance_window_closed':
      return '考勤窗口已关闭(9:00 之后)。请联系班主任手工补登。';
    case 'override_session_not_found':
    case 'override_class_or_date_mismatch':
      return '难度选择无效,请刷新页面重新选择。';
    case 'empty_name':
      return '请输入你的姓名';
    default:
      return raw.length < 200 ? raw : '签到失败,请联系老师。';
  }
}
