import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';

type Level = 'ielts_authentic' | 'ielts_simplified' | 'olevel';
const LEVEL_LABEL: Record<Level, { zh: string; en: string; tint: string }> = {
  ielts_authentic: {
    zh: '雅思真题',
    en: 'IELTS Authentic',
    tint: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
  },
  ielts_simplified: {
    zh: '轻难度雅思',
    en: 'Simplified IELTS',
    tint: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
  },
  olevel: {
    zh: 'O-Level 英语',
    en: 'OLevel English',
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
      // Full reload sidesteps the SPA route-table swap race; take page
      // boots cleanly with the new auth_token already in place.
      window.location.replace(r.quizUrl);
    } catch (e: any) {
      const raw = e?.message ?? String(e);
      const code = extractCode(raw) ?? 'unknown';
      setError({ code, message: friendlyMessage(code, raw) });
      setSubmitting(false);
    }
  }

  if (error && !meta) {
    return (
      <Centered>
        <div className="text-7xl mb-6">⛔</div>
        <div className="text-2xl font-semibold mb-2 text-rose-600">{error.message}</div>
        <div className="text-xs text-gray-400 mt-2 font-mono">code: {error.code}</div>
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
