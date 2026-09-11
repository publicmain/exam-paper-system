/**
 * 今日（审计 IOS-04 / UI05 / UI13 / UI14）—— 学生每天的落点。
 *
 * ## 三项任务是主体，各管各的
 *
 * 今日阅读、每日新词、正式单词测试三张卡，每张有自己的状态、真实进度和**只启动它
 * 自己**的动作：点「学词」不会顺手开阅读，没有阅读内容也不挡学词（UI13）。卡片顺序
 * 固定，第一张还没做完、能动手的用主按钮，其余用次按钮 —— 有推荐的先后，但不强制串行。
 *
 * ## 完成度按三项的适用性算（UI14）
 *
 * 分母 = 今天适用的项数，分子 = 其中已完成（含「已交卷待老师批」「系统已收卷」）的项数。
 *   · 学完新词但正式词测还没做 → 不是全部完成；
 *   · 全部延后、没有学完的词 → 测试「不需要」，不进分母；
 *   · 阅读还没发布 → 学生无事可做，不进分母（发布后变成待完成，重新计）；
 *   · 周末 / 没进班 / 没选档 → 不适用，不进分母。
 * 与服务端 `home.allDone` 同一口径（vocabulary-v2.service overview）。**不是**把分母写死成 3。
 *
 * ## 模块各自加载（UI05）
 *
 * `/lesson/today`（阅读）与 `/vocab-v2/overview`（新词 / 测试 / 旧待办）分开请求、分开
 * 报错、分开重试。一边失败另一边照常可用；失败的那块写「没加载出来」并给重试 ——
 * 不把「不知道」当成「没有任务」，更不显示「全部完成」。
 *
 * ## 旧待办不挤占首屏
 *
 * 放在今天的三项之后，按日期分组，写清每天欠阅读 / 新词 / 测试各几项；默认只展开最早
 * 两天，其余收在「查看全部待办」里。没有截止强锁，也不挡先做今天。
 *
 * ## 服务端说了算
 *
 * 状态与数字只照搬服务端（`home` 三项、`pendingTests` 的冻结卷题数、`/lesson/today`
 * 的阅读段）。后端的 `nextAction.href` 永远不读；跳转路径只从 `routes.contract.ts` 取。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PushNudge } from '../push/PushNudge';
import {
  api,
  type HomeReadingTask,
  type HomeTestTask,
  type HomeWordsTask,
  type LessonToday,
  type ReadSegment,
  type V2Overview,
} from '../lib/api';
import { getState, handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { levelLabel } from '../lib/levels';
import { NEXT_ACTION_ROUTE, ROUTES, type NextActionKind } from '../routes.contract';
import { isTeachingDay } from '../lib/teaching-day';
import { Badge, type BadgeTone } from '../design/Badge';
import { Button } from '../design/Button';
import { Dialog } from '../design/Dialog';
import { Icon, type IconName } from '../design/Icon';
import { Page } from '../design/Page';
import { InlineStatus, Spinner, StatusView } from '../design/Status';

// ─────────────────────────────────────────────────────────────
// 纯逻辑（导出给测试直接驱动）
// ─────────────────────────────────────────────────────────────

export type TaskKey = 'reading' | 'words' | 'test';

export type TaskAction =
  /** 今天的阅读还没开始：走 `lesson/start`（**只建阅读答卷**，不碰单词） */
  | { kind: 'start-reading'; label: string }
  | { kind: 'navigate'; label: string; path: string }
  /** 学完了、卷子还没生成：生成并打开这一天的正式测试 */
  | { kind: 'start-test'; label: string; dailySessionId: string }
  | { kind: 'none' };

export type TaskView = {
  key: TaskKey;
  title: string;
  icon: IconName;
  /** 今天这一项算不算数（不适用的不进分母） */
  applicable: boolean;
  done: boolean;
  badge: { tone: BadgeTone; text: string };
  /** 一句具体的进度 / 说明 */
  detail: string;
  /** 进度条（有真实分母时才给） */
  progress?: { value: number; max: number };
  action: TaskAction;
};

const TASK_META: Record<TaskKey, { title: string; icon: IconName }> = {
  reading: { title: '今日阅读', icon: 'reading' },
  words: { title: '每日新词', icon: 'words' },
  test: { title: '正式单词测试', icon: 'checkCircle' },
};

const STAY_KINDS = new Set<NextActionKind>(['no_content', 'window_closed', 'level_not_set', 'none']);

const READING_REASON: Record<string, string> = {
  weekend: '周六周日没有阅读，周一再来',
  no_class: '还没有加入班级 —— 找老师确认一下',
  no_level: '还没选难度 —— 去「账号」选一档',
  cancelled: '今天的阅读老师取消了，不用做',
  no_session_published: '今天的阅读还没有发布',
  window_closed: '今天的作答时间已经结束了',
};

/**
 * 今日阅读。
 *
 * 状态优先照 `home.reading`（按实际分配算，UI01）；老服务端没有 `home` 时按
 * `/lesson/today` 的阅读段推断。动作按 `/lesson/today` 决定：今天的课还没开始才走
 * start（只建阅读答卷），已开始就直接去阅读页 / 结果页。
 */
export function readingTaskView(lesson: LessonToday, home: HomeReadingTask | undefined): TaskView {
  const seg = lesson.segments.find((s): s is ReadSegment => s.key === 'read') ?? null;
  const kind = lesson.nextAction.kind;
  const base = { key: 'reading' as const, ...TASK_META.reading };
  const state = home?.state ?? legacyReadingState(seg, kind);
  const reason = home?.reason ?? legacyReadingReason(seg, kind);

  // 服务端有状态、但 /lesson/today 说今天这一段进不去（两条口径偶尔不同步）→ 按进不去说
  const lessonSaysNothing = STAY_KINDS.has(kind) && (!seg || seg.status === 'none');
  if (state === 'not_applicable' || state === 'not_generated' || (lessonSaysNothing && (state === 'pending' || state === 'in_progress'))) {
    const why = kind === 'window_closed' ? READING_REASON.window_closed : kind === 'level_not_set' ? READING_REASON.no_level : READING_REASON[reason ?? 'no_session_published'];
    return {
      ...base,
      applicable: false,
      done: false,
      badge: { tone: 'neutral', text: state === 'not_generated' ? '还没发布' : '今天没有' },
      detail: why ?? '今天没有阅读',
      action: { kind: 'none' },
    };
  }

  const title = home?.title || seg?.label || '';
  const levelText = home?.level ? levelLabel(home.level) : null;
  const head = [title, levelText].filter(Boolean).join(' · ');
  const withHead = (tail: string) => [head, tail].filter(Boolean).join(' · ');

  if (state === 'awaiting_marking') {
    const r = seg?.releasedScore;
    return {
      ...base,
      applicable: true,
      done: true,
      badge: { tone: 'warning', text: '已交卷，待老师批' },
      detail: withHead(r && r.count > 0 ? `客观题 ${r.earned} / ${r.max}，其余等老师批` : '成绩出来后在「学习记录」里看'),
      action: { kind: 'navigate', label: '看结果', path: ROUTES.readingResult },
    };
  }
  if (state === 'completed' || state === 'auto_closed') {
    const score = seg && seg.score != null && seg.maxScore != null ? `${seg.score} / ${seg.maxScore} 分` : '';
    return {
      ...base,
      applicable: true,
      done: true,
      badge: { tone: state === 'auto_closed' ? 'neutral' : 'success', text: state === 'auto_closed' ? '系统已收卷' : '已完成' },
      detail: withHead(score),
      action: { kind: 'navigate', label: '看结果', path: ROUTES.readingResult },
    };
  }
  if (state === 'in_progress') {
    return {
      ...base,
      applicable: true,
      done: false,
      badge: { tone: 'accent', text: '做了一部分' },
      detail: withHead('答案已自动保存'),
      action: { kind: 'navigate', label: '继续阅读', path: ROUTES.reading },
    };
  }
  const size = [seg?.questionCount ? `${seg.questionCount} 题` : '', seg?.typicalMinutes ? `约 ${seg.typicalMinutes} 分钟` : ''].filter(Boolean).join('，');
  return {
    ...base,
    applicable: true,
    done: false,
    badge: { tone: 'neutral', text: '还没开始' },
    detail: withHead(size),
    action: kind === 'ready_to_start' ? { kind: 'start-reading', label: '开始阅读' } : { kind: 'navigate', label: '开始阅读', path: ROUTES.reading },
  };
}

function legacyReadingState(seg: ReadSegment | null, kind: NextActionKind): HomeReadingTask['state'] {
  if (!seg || seg.status === 'none') return isTeachingDay() && kind !== 'level_not_set' ? 'not_generated' : 'not_applicable';
  if (seg.scoresPending && (seg.status === 'done' || seg.status === 'auto_closed')) return 'awaiting_marking';
  if (seg.status === 'done') return 'completed';
  if (seg.status === 'auto_closed') return 'auto_closed';
  if (seg.status === 'partial') return 'in_progress';
  return 'pending';
}

function legacyReadingReason(seg: ReadSegment | null, kind: NextActionKind): string | undefined {
  if (seg && seg.status !== 'none') return undefined;
  if (kind === 'level_not_set') return 'no_level';
  return isTeachingDay() ? 'no_session_published' : 'weekend';
}

/** 每日新词。老服务端没有 `home` 时按 `today` 会话推断。 */
export function wordsTaskView(ov: V2Overview): TaskView {
  const base = { key: 'words' as const, ...TASK_META.words };
  const w: HomeWordsTask = ov.home?.words ?? legacyWords(ov);
  const target = w.target ?? ov.dailyTarget;
  if (w.state === 'not_applicable') {
    return { ...base, applicable: false, done: false, badge: { tone: 'neutral', text: '今天没有' }, detail: w.reason === 'weekend' ? '周六周日不推新词，周一再来' : '今天没有新词任务', action: { kind: 'none' } };
  }
  if (w.state === 'not_generated') {
    return { ...base, applicable: true, done: false, badge: { tone: 'neutral', text: '还没开始' }, detail: `今天 ${target} 个新词，点开就开始`, action: { kind: 'navigate', label: '开始学习', path: ROUTES.coachLearn } };
  }
  const learned = w.learned ?? 0;
  const deferred = w.deferred ?? 0;
  const pending = w.pending ?? Math.max(0, target - learned - deferred);
  const counts = [`学完 ${learned}`, deferred ? `延后 ${deferred}` : '', pending ? `还剩 ${pending}` : ''].filter(Boolean).join(' · ');
  const progress = { value: Math.min(target, learned + deferred), max: Math.max(1, target) };
  if (w.state === 'completed') {
    // 全部延后 ≠ 学完（VOC08）
    const allDeferred = learned === 0;
    return {
      ...base,
      applicable: true,
      done: true,
      badge: allDeferred ? { tone: 'neutral', text: '都延后了' } : { tone: 'success', text: '学完了' },
      detail: allDeferred ? `这 ${deferred} 个词都延后了，之后再学` : `${counts}。可以再背一背，不算新的学习量`,
      progress,
      action: allDeferred ? { kind: 'none' } : { kind: 'navigate', label: '背一背', path: learnPathFor(ov.home?.date ?? ov.today?.date ?? null) },
    };
  }
  return {
    ...base,
    applicable: true,
    done: false,
    badge: w.state === 'in_progress' ? { tone: 'accent', text: '学到一半' } : { tone: 'neutral', text: '还没开始' },
    detail: w.state === 'in_progress' ? counts : `今天 ${target} 个新词`,
    progress,
    action: { kind: 'navigate', label: w.state === 'in_progress' ? '继续学习' : '开始学习', path: ROUTES.coachLearn },
  };
}

function learnPathFor(date: string | null): string {
  return date ? `${ROUTES.coachLearn}?date=${encodeURIComponent(date)}` : ROUTES.coachLearn;
}

function legacyWords(ov: V2Overview): HomeWordsTask {
  const t = ov.today;
  if (!t) return isTeachingDay() ? { state: 'not_generated' } : { state: 'not_applicable', reason: 'weekend' };
  const deferred = t.deferred ?? Math.max(0, t.completed - t.learned);
  const pending = t.pending ?? Math.max(0, t.target - t.completed);
  return {
    state: t.status === 'completed' ? 'completed' : t.completed > 0 ? 'in_progress' : 'pending',
    target: t.target,
    learned: t.learned,
    deferred,
    pending,
  };
}

/** 一份测试有多少题：卷子生成了照冻结卷；还没生成写「预计」，不编一个数（VOC06）。 */
export function testSizeText(t: { total?: number | null; newWords?: number | null; reviewWords?: number | null; expectedNewWords?: number; reviewWordsMax?: number }): string {
  if (t.total != null) {
    const mix = t.newWords != null ? `（新词 ${t.newWords}${t.reviewWords ? ` + 旧词抽查 ${t.reviewWords}` : ''}）` : '';
    return `${t.total} 题${mix}`;
  }
  if (t.expectedNewWords != null) {
    return `预计 ${t.expectedNewWords} 个新词${t.reviewWordsMax ? `，另有最多 ${t.reviewWordsMax} 个旧词抽查` : ''}`;
  }
  return '';
}

/** 正式单词测试：生成前写清生成条件与预计题数；生成后照冻结卷的题数。 */
export function testTaskView(ov: V2Overview): TaskView {
  const base = { key: 'test' as const, ...TASK_META.test };
  const t: HomeTestTask = ov.home?.test ?? legacyTest(ov);
  if (t.state === 'not_applicable') {
    const why = t.reason === 'nothing_learned' ? '今天没有学完的新词，不需要测试' : t.reason === 'weekend' ? '周末没有测试' : '今天不需要测试';
    return { ...base, applicable: false, done: false, badge: { tone: 'neutral', text: '不需要' }, detail: why, action: { kind: 'none' } };
  }
  if (t.state === 'not_generated') {
    if (t.reason === 'ready_to_generate' && t.dailySessionId) {
      return {
        ...base,
        applicable: true,
        done: false,
        badge: { tone: 'accent', text: '可以开始' },
        detail: testSizeText(t) || '今天学完的新词',
        action: { kind: 'start-test', label: '开始测试', dailySessionId: t.dailySessionId },
      };
    }
    return { ...base, applicable: true, done: false, badge: { tone: 'neutral', text: '还没生成' }, detail: '学完今天的新词后自动生成，什么时候做都可以', action: { kind: 'none' } };
  }
  const path = t.testSessionId ? `${ROUTES.coachTest}?sessionId=${encodeURIComponent(t.testSessionId)}` : null;
  if (t.state === 'completed') {
    return {
      ...base,
      applicable: true,
      done: true,
      badge: { tone: 'success', text: '已完成' },
      detail: testSizeText(t),
      action: path ? { kind: 'navigate', label: '看回顾', path } : { kind: 'none' },
    };
  }
  const total = t.total ?? 0;
  const answered = t.answered ?? 0;
  return {
    ...base,
    applicable: true,
    done: false,
    badge: t.state === 'in_progress' ? { tone: 'accent', text: `做到 ${answered} / ${total}` } : { tone: 'warning', text: '待完成' },
    detail: testSizeText(t),
    progress: total ? { value: answered, max: total } : undefined,
    action: path
      ? { kind: 'navigate', label: t.state === 'in_progress' ? '继续测试' : '开始测试', path }
      : t.dailySessionId
        ? { kind: 'start-test', label: '开始测试', dailySessionId: t.dailySessionId }
        : { kind: 'navigate', label: '去看看', path: ROUTES.vocab },
  };
}

function legacyTest(ov: V2Overview): HomeTestTask {
  const date = ov.today?.date;
  const mine = date ? ov.pendingTests.find((p) => p.date === date) : undefined;
  if (mine) {
    return {
      state: mine.testSessionId || mine.generated ? (mine.status === 'in_progress' ? 'in_progress' : 'pending') : 'not_generated',
      reason: mine.testSessionId || mine.generated ? undefined : 'ready_to_generate',
      dailySessionId: mine.dailySessionId,
      testSessionId: mine.testSessionId,
      total: mine.total ?? undefined,
      answered: mine.answered,
      expectedNewWords: mine.expectedNewWords,
      reviewWordsMax: mine.reviewWordsMax,
    };
  }
  if (!ov.today) return isTeachingDay() ? { state: 'not_generated', reason: 'no_word_task_yet' } : { state: 'not_applicable', reason: 'weekend' };
  if (ov.today.status !== 'completed') return { state: 'not_generated', reason: 'learning_unfinished' };
  return ov.today.learned === 0 ? { state: 'not_applicable', reason: 'nothing_learned' } : { state: 'completed' };
}

/** 今天完成几项 / 适用几项。 */
export function progressOf(views: TaskView[]): { done: number; total: number } {
  const applicable = views.filter((v) => v.applicable);
  return { done: applicable.filter((v) => v.done).length, total: applicable.length };
}

export type BacklogDay = {
  date: string;
  reading: NonNullable<V2Overview['readingBacklog']>;
  words: NonNullable<V2Overview['learningBacklog']>;
  tests: V2Overview['pendingTests'];
};

/** 旧待办按日期分组（早的在前）；只收今天以前的。 */
export function backlogDays(ov: V2Overview, todayKey: string | null): BacklogDay[] {
  const map = new Map<string, BacklogDay>();
  const get = (date: string) => {
    let day = map.get(date);
    if (!day) {
      day = { date, reading: [], words: [], tests: [] };
      map.set(date, day);
    }
    return day;
  };
  for (const r of ov.readingBacklog ?? []) get(r.date).reading.push(r);
  for (const w of ov.learningBacklog ?? []) get(w.date).words.push(w);
  for (const t of ov.pendingTests) if (!todayKey || t.date < todayKey) get(t.date).tests.push(t);
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export function dayText(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${m}月${d}日 ${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}`;
}

// ─────────────────────────────────────────────────────────────
// 页面
// ─────────────────────────────────────────────────────────────

type Part<T> = { s: 'loading' } | { s: 'error' } | { s: 'ready'; data: T };
type PendingTest = V2Overview['pendingTests'][number];

const BACKLOG_PREVIEW_DAYS = 2;

export default function TodayPage() {
  const navigate = useNavigate();
  const auth = getState();
  const who = auth.status === 'authenticated' ? auth.profile.nickname || auth.profile.name : '';
  const [lesson, setLesson] = useState<Part<LessonToday>>({ s: 'loading' });
  const [ov, setOv] = useState<Part<V2Overview>>({ s: 'loading' });
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ key: string; text: string } | null>(null);
  const [showAllBacklog, setShowAllBacklog] = useState(false);
  /**
   * 「还有单词测试没做」的提醒（2026-09-09 叶老师提的）：进首页弹一次，一天只弹一次。
   * 记号写在 localStorage、key 带当天日期；读写一律 try/catch（无痕模式会抛）。
   */
  const [remindTest, setRemindTest] = useState<PendingTest | null>(null);
  const busyRef = useRef(false);
  /** 提醒弹窗打开时焦点落在「现在去测」（2026-09-09 验收 P2-2） */
  const remindGoRef = useRef<HTMLButtonElement>(null);
  /** 请求代次：重试或卸载之后，旧响应一律丢掉，免得慢的覆盖快的。 */
  const gen = useRef({ lesson: 0, ov: 0 });

  const loadLesson = useCallback(async () => {
    const token = readToken();
    if (!token) return; // 没票就不该在这里，App 的路由守卫会送走
    const mine = ++gen.current.lesson;
    setLesson({ s: 'loading' });
    try {
      const data = await api.lessonToday(token);
      if (mine === gen.current.lesson) setLesson({ s: 'ready', data });
    } catch (e) {
      if (mine !== gen.current.lesson) return;
      if (handleAuthFailure(e)) return;
      // 网络或服务端故障 → **留着票**，这一块给重试
      setLesson({ s: 'error' });
    }
  }, []);

  const loadOverview = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    const mine = ++gen.current.ov;
    setOv({ s: 'loading' });
    try {
      const data = await api.vocabV2Overview(token);
      if (mine !== gen.current.ov) return;
      setOv({ s: 'ready', data });
      const pending = data.pendingTests ?? [];
      if (pending.length > 0 && !remindedToday()) {
        // 最早那一份 —— 欠得最久的先提醒
        setRemindTest([...pending].sort((a, b) => a.date.localeCompare(b.date))[0]);
      }
    } catch (e) {
      if (mine !== gen.current.ov) return;
      if (handleAuthFailure(e)) return;
      setOv({ s: 'error' });
    }
  }, []);

  useEffect(() => {
    void loadLesson();
    void loadOverview();
    const g = gen.current;
    return () => {
      g.lesson++;
      g.ov++;
    };
  }, [loadLesson, loadOverview]);

  const ovData = ov.s === 'ready' ? ov.data : null;
  const home = ovData?.home;

  const cards = useMemo(() => {
    const reading: TaskView | Part<never>['s'] = lesson.s === 'ready' ? readingTaskView(lesson.data, home?.reading) : lesson.s;
    const words: TaskView | Part<never>['s'] = ovData ? wordsTaskView(ovData) : ov.s;
    const test: TaskView | Part<never>['s'] = ovData ? testTaskView(ovData) : ov.s;
    return [
      { key: 'reading' as const, view: reading },
      { key: 'words' as const, view: words },
      { key: 'test' as const, view: test },
    ];
  }, [lesson, ovData, ov.s, home]);

  const views = cards.map((c) => c.view).filter((v): v is TaskView => typeof v !== 'string');
  const anyError = lesson.s === 'error' || ov.s === 'error';
  const allKnown = views.length === 3;
  const progress = progressOf(views);
  const allDone = allKnown && progress.total > 0 && progress.done === progress.total;
  /** 推荐的下一项：第一张适用、没做完、而且能动手的卡 */
  const recommended = views.find((v) => v.applicable && !v.done && v.action.kind !== 'none')?.key ?? null;

  const guard = useCallback(async (key: string, work: (token: string) => Promise<void>, failText: string, errorKey = key) => {
    const token = readToken();
    if (!token || busyRef.current) return; // 双击只算一次
    busyRef.current = true;
    setBusy(key);
    setActionError(null);
    try {
      await work(token);
    } catch (e) {
      // 没有 catch 的话，一次失败就是一个未处理的 rejection：按钮看着像死了
      if (handleAuthFailure(e)) return;
      setActionError({ key: errorKey, text: failText });
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }, []);

  const runTask = useCallback(
    (v: TaskView) => {
      const a = v.action;
      if (a.kind === 'none') return;
      if (a.kind === 'navigate') {
        navigate(a.path);
        return;
      }
      if (a.kind === 'start-reading') {
        void guard(
          v.key,
          async (token) => {
            // **只开阅读**：lesson/start 只建今天的阅读答卷（lesson.service begin），不碰单词
            const data = await api.lessonStart(token);
            const target = NEXT_ACTION_ROUTE[data.nextAction.kind];
            if (target.kind === 'navigate' && (target.path === ROUTES.reading || target.path === ROUTES.readingResult)) {
              navigate(target.path);
              return;
            }
            // 服务端说阅读这会儿进不去 —— 把新状态渲染出来，不顺手把人送去别的任务
            gen.current.lesson++;
            setLesson({ s: 'ready', data });
          },
          '没能开始今天的阅读 —— 再试一次。',
        );
        return;
      }
      void guard(
        v.key,
        async (token) => {
          const test = await api.vocabV2StartTest(token, a.dailySessionId);
          navigate(`${ROUTES.coachTest}?sessionId=${encodeURIComponent(test.id)}`);
        },
        '这份单词测试暂时打不开，请稍后再试。',
      );
    },
    [guard, navigate],
  );

  const openTest = useCallback(
    (task: PendingTest, errorKey: string) =>
      guard(
        `t-${task.dailySessionId}`,
        async (token) => {
          const id = task.testSessionId ?? (await api.vocabV2StartTest(token, task.dailySessionId)).id;
          navigate(`${ROUTES.coachTest}?sessionId=${encodeURIComponent(id)}`);
        },
        '这份单词测试暂时打不开，请稍后再试。',
        errorKey,
      ),
    [guard, navigate],
  );

  const openBacklogReading = useCallback(
    (task: NonNullable<V2Overview['readingBacklog']>[number]) =>
      guard(
        `r-${task.sessionId}`,
        async (token) => {
          await api.openReadingSession(token, task.sessionId);
          navigate(`${ROUTES.reading}?sessionId=${encodeURIComponent(task.sessionId)}&date=${encodeURIComponent(task.date)}&backlog=1`);
        },
        '这份补做阅读暂时打不开，请再试一次。',
        'backlog',
      ),
    [guard, navigate],
  );

  const lessonData = lesson.s === 'ready' ? lesson.data : null;
  const todayKey = home?.date ?? lessonData?.date ?? null;
  const days = ovData ? backlogDays(ovData, todayKey) : [];
  const shownDays = showAllBacklog ? days : days.slice(0, BACKLOG_PREVIEW_DAYS);
  const levelText = home?.reading.level ? levelLabel(home.reading.level) : null;

  // 两边都失败：整页一个出错态（仍然留着票）
  if (lesson.s === 'error' && ov.s === 'error') {
    return (
      <Page title="今日" testId="today-page">
        <StatusView
          kind="error"
          title="今天的任务没加载出来"
          message="网络不太好。你的学习记录都在，重试一下就好。"
          onRetry={() => {
            void loadLesson();
            void loadOverview();
          }}
        />
      </Page>
    );
  }

  return (
    <Page
      title="今日"
      subtitle={
        <span className="flex flex-wrap items-center gap-x-2">
          {todayKey ? <span data-testid="today-date">{dayText(todayKey)}</span> : null}
          {lessonData && lessonData.streakDays > 0 ? <span>· 已连续学习 {lessonData.streakDays} 天</span> : null}
        </span>
      }
      trailing={
        <Link
          to={ROUTES.account}
          data-testid="identity-chip"
          className="inline-flex min-h-[44px] max-w-[16rem] items-center gap-2 rounded-full bg-surface px-3 text-callout text-ink-2 no-underline hover:bg-surface-2"
          aria-label={`${who || '账号'}${levelText ? `，今天阅读的难度 ${levelText}` : ''}，打开账号`}
        >
          <Icon name="account" size={18} />
          <span className="truncate">{who || '账号'}</span>
          {levelText ? <span className="hidden truncate text-ink-3 sm:inline">· {levelText}</span> : null}
        </Link>
      }
      width="wide"
      testId="today-page"
    >
      <p
        data-testid="lesson-progress"
        aria-label={allKnown && progress.total > 0 ? `今天完成 ${progress.done} / ${progress.total}` : undefined}
        className="mb-4 min-h-[1.5rem] text-callout text-ink-2"
      >
        {!allKnown ? (
          anyError ? '有一项没加载出来，完成度先不算' : <Spinner label="正在读取今天的任务" />
        ) : progress.total === 0 ? (
          '今天没有要完成的任务'
        ) : (
          <>
            今天完成 <strong className="tabular-nums text-ink">{progress.done}</strong> / <span className="tabular-nums">{progress.total}</span>
            {allDone ? ' · 全部做完了' : ''}
          </>
        )}
      </p>

      {/* 三项任务（主体） */}
      <ul className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="今天的三项任务">
        {cards.map(({ key, view }) =>
          typeof view === 'string' ? (
            <li key={key} data-testid={`task-${key}`} data-state={view} className="flex min-w-0 flex-col rounded-group bg-surface p-4">
              <div className="mb-3 flex items-center gap-2">
                <TaskIcon icon={TASK_META[key].icon} tone="neutral" />
                <h2 className="text-headline text-ink">{TASK_META[key].title}</h2>
              </div>
              {view === 'loading' ? (
                <Spinner label="载入中" />
              ) : (
                <InlineStatus
                  tone="error"
                  testId={`task-${key}-error`}
                  retryTestId={`task-${key}-retry`}
                  onRetry={() => void (key === 'reading' ? loadLesson() : loadOverview())}
                >
                  {key === 'reading' ? '阅读信息没加载出来' : '单词信息没加载出来'}，不代表今天没有任务。
                </InlineStatus>
              )}
            </li>
          ) : (
            <TaskCard
              key={key}
              view={view}
              primary={recommended === key}
              busy={busy === key}
              error={actionError?.key === key ? actionError.text : null}
              onAction={() => runTask(view)}
            />
          ),
        )}
      </ul>

      {/* 提醒开关的邀请放在任务之后：不占首屏主体（IOS-04） */}
      <PushNudge />

      {allDone ? (
        <div className="mb-6">
          <Button data-testid="open-summary" variant="secondary" block icon="sparkle" onClick={() => navigate(ROUTES.summary)}>
            查看今天的总结
          </Button>
        </div>
      ) : null}

      {/* 旧待办：今天以前还欠着的，按日期；默认只展开最早两天 */}
      <section aria-labelledby="backlog-title" data-testid="backlog" className="mb-6">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-x-3 px-1">
          <h2 id="backlog-title" className="text-footnote font-semibold text-ink-3">
            之前没做完的{days.length ? `（${days.length} 天）` : ''}
          </h2>
          {days.length ? <span className="text-caption text-ink-3">不会被今天覆盖，先做哪个都行</span> : null}
        </div>
        {ov.s === 'error' ? (
          <InlineStatus tone="error" testId="backlog-error" onRetry={() => void loadOverview()}>
            旧待办暂时没加载出来。
          </InlineStatus>
        ) : ov.s === 'loading' ? (
          <Spinner label="载入中" />
        ) : days.length === 0 ? (
          <p data-testid="backlog-empty" className="px-1 text-callout text-ink-3">
            之前的任务都做完了。
          </p>
        ) : (
          <>
            {actionError?.key === 'backlog' ? (
              <div className="mb-2">
                <InlineStatus tone="error">{actionError.text}</InlineStatus>
              </div>
            ) : null}
            <div className="list-inset overflow-hidden rounded-group bg-surface">
              {shownDays.map((d) => (
                <BacklogDayRow
                  key={d.date}
                  day={d}
                  busy={busy}
                  onReading={(t) => void openBacklogReading(t)}
                  onWords={(date) => navigate(learnPathFor(date))}
                  onTest={(t) => void openTest(t, 'backlog')}
                />
              ))}
            </div>
            {days.length > BACKLOG_PREVIEW_DAYS ? (
              <Button
                data-testid="backlog-more"
                variant="plain"
                size="md"
                aria-expanded={showAllBacklog}
                iconAfter={showAllBacklog ? 'up' : 'down'}
                onClick={() => setShowAllBacklog((s) => !s)}
                className="mt-1"
              >
                {showAllBacklog ? '收起' : `查看全部待办（还有 ${days.length - BACKLOG_PREVIEW_DAYS} 天）`}
              </Button>
            ) : null}
          </>
        )}
      </section>

      <Dialog
        open={Boolean(remindTest)}
        onClose={() => {
          markRemindedToday();
          setRemindTest(null);
        }}
        title="还有一份单词测试没做"
        description={remindTest ? `${dayText(remindTest.date)}学完的词还没测${testSizeText(remindTest) ? `，${testSizeText(remindTest)}` : ''}。两三分钟就够，什么时候做都可以。` : undefined}
        size="sm"
        testId="pending-test-reminder"
        initialFocusRef={remindGoRef}
        footer={
          <>
            <Button
              variant="neutral"
              data-testid="reminder-later"
              onClick={() => {
                markRemindedToday();
                setRemindTest(null);
              }}
            >
              待会儿
            </Button>
            <Button
              ref={remindGoRef}
              data-testid="reminder-go"
              onClick={() => {
                markRemindedToday();
                const task = remindTest;
                setRemindTest(null);
                if (task) void openTest(task, 'test');
              }}
            >
              现在去测
            </Button>
          </>
        }
      />
    </Page>
  );
}

function TaskIcon({ icon, tone }: { icon: IconName; tone: 'done' | 'todo' | 'neutral' }) {
  const cls = tone === 'done' ? 'bg-success-soft text-success' : tone === 'todo' ? 'bg-accent-soft text-accent' : 'bg-fill text-ink-3';
  return (
    <span aria-hidden="true" className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${cls}`}>
      <Icon name={icon} size={20} />
    </span>
  );
}

function TaskCard({ view, primary, busy, error, onAction }: { view: TaskView; primary: boolean; busy: boolean; error: string | null; onAction: () => void }) {
  const a = view.action;
  return (
    <li
      data-testid={`task-${view.key}`}
      data-state={view.done ? 'done' : view.applicable ? 'todo' : 'not_applicable'}
      className="flex min-w-0 flex-col rounded-group bg-surface p-4"
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <TaskIcon icon={view.icon} tone={view.done ? 'done' : view.applicable ? 'todo' : 'neutral'} />
          <h2 className="min-w-0 text-headline text-ink">{view.title}</h2>
        </div>
        <Badge tone={view.badge.tone} testId={`task-${view.key}-badge`} icon={view.done ? 'check' : null}>
          {view.badge.text}
        </Badge>
      </div>
      <p data-testid={`task-${view.key}-detail`} className="mb-3 text-callout text-ink-2">
        {view.detail}
      </p>
      {view.progress ? (
        <div
          role="progressbar"
          aria-label={`${view.title}进度`}
          aria-valuemin={0}
          aria-valuemax={view.progress.max}
          aria-valuenow={view.progress.value}
          className="mb-3 h-1.5 overflow-hidden rounded-full bg-fill"
        >
          <div className="h-full rounded-full bg-accent-fill" style={{ width: `${Math.min(100, (view.progress.value / view.progress.max) * 100)}%` }} />
        </div>
      ) : null}
      {error ? (
        <div className="mb-3">
          <InlineStatus tone="error">{error}</InlineStatus>
        </div>
      ) : null}
      {a.kind === 'none' ? null : (
        <div className="mt-auto">
          <Button
            block
            size="md"
            variant={primary ? 'primary' : 'secondary'}
            busy={busy}
            data-testid={`task-${view.key}-action`}
            onClick={onAction}
          >
            {busy ? '正在打开…' : a.label}
          </Button>
        </div>
      )}
    </li>
  );
}

function BacklogDayRow({
  day,
  busy,
  onReading,
  onWords,
  onTest,
}: {
  day: BacklogDay;
  busy: string | null;
  onReading: (t: BacklogDay['reading'][number]) => void;
  onWords: (date: string) => void;
  onTest: (t: PendingTest) => void;
}) {
  const parts = [
    day.reading.length ? `阅读 ${day.reading.length}` : '',
    day.words.length ? `新词 ${day.words.length}` : '',
    day.tests.length ? `测试 ${day.tests.length}` : '',
  ].filter(Boolean).join(' · ');
  return (
    <div data-testid={`backlog-day-${day.date}`} className="px-4 py-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-headline text-ink">{dayText(day.date)}</h3>
        <span className="text-footnote text-ink-3">欠 {parts}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {day.reading.map((t) => (
          <Button
            key={`r-${t.sessionId}`}
            size="sm"
            variant="neutral"
            icon="reading"
            busy={busy === `r-${t.sessionId}`}
            aria-label={`${dayText(t.date)}阅读补做${t.level ? `，${levelLabel(t.level) ?? ''}` : ''}，${t.status === 'in_progress' ? '继续上次进度' : '未开始'}`}
            onClick={() => onReading(t)}
          >
            阅读 · {t.status === 'in_progress' ? '继续' : '开始'}
          </Button>
        ))}
        {day.words.map((w) => {
          const left = w.pending ?? Math.max(0, w.target - w.completed);
          return (
            <Button
              key={`w-${w.sessionId}`}
              size="sm"
              variant="neutral"
              icon="words"
              aria-label={`${dayText(w.date)}新词补做，还剩 ${left} 个`}
              onClick={() => onWords(w.date)}
            >
              新词 · 还剩 {left}
            </Button>
          );
        })}
        {day.tests.map((t) => (
          <Button
            key={`t-${t.dailySessionId}`}
            size="sm"
            variant="neutral"
            icon="checkCircle"
            busy={busy === `t-${t.dailySessionId}`}
            aria-label={`${dayText(t.date)}单词测试${testSizeText(t) ? `，${testSizeText(t)}` : ''}，${t.status === 'in_progress' ? '继续' : '开始'}`}
            onClick={() => onTest(t)}
          >
            测试 · {t.total != null ? `${t.total} 题` : t.status === 'in_progress' ? '继续' : '开始'}
          </Button>
        ))}
      </div>
    </div>
  );
}

const REMINDER_KEY = 'sw:vocab-test-reminded';

/** 今天提醒过了吗。localStorage 在无痕模式下会抛，读写都兜住。 */
function remindedToday(): boolean {
  try {
    return localStorage.getItem(REMINDER_KEY) === localDayKey();
  } catch {
    return false;
  }
}

function markRemindedToday(): void {
  try {
    localStorage.setItem(REMINDER_KEY, localDayKey());
  } catch {
    /* 无痕模式：记不住就每次都提醒，总比不提醒好 */
  }
}

function localDayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
