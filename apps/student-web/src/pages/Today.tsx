/**
 * 今天的课 —— 学生每天的落点。
 *
 * ## 一条原则：服务端说了算
 *
 * 页面**不重算任何业务状态**。完成度、阶段、下一步全部照搬
 * `/lesson/today` 的回答；这里只负责把它读出来，以及把**唯一的**
 * 下一步动作摆出来。
 *
 * ## S12L —— 三段现在**可以点**
 *
 * 原来它们是纯状态摘要，理由是「每段配一个按钮会造出第二套推进逻辑」。
 * 真人走查证明代价更大：学生看到「阅读 · 已完成 6/8 分」去点它，什么
 * 都不发生，于是以为页面坏了。
 *
 * 折中是这样：**主行动仍然只有一个**（`nextAction`，服务端说了算），
 * 卡片只做**导航**，不推进任何状态 —— 它们把人送到那一段本来就该在的
 * 地方（读完了去结果页、没读完去阅读页），不写库、不改阶段。
 * 「还没开始今天的课」时点任何一张卡，走的都是同一个 `start` 命令，
 * 不另起一条推进路径。
 *
 * 不能点的卡片必须**说明为什么**（`aria-disabled` + 一句话），
 * 绝不做「点了没反应」。
 *
 * ## 为什么忽略后端的 href
 *
 * 服务端的 `nextAction.href` 指向旧端的路由（`/morning-quiz/:id` 之类）。
 * 新端只消费 `kind`，路径**只从 `routes.contract.ts` 取**。这样后端换
 * href、或者 href 被人塞了脏值，都影响不到新端往哪跳。
 *
 * ## 「没有内容」不是「全部完成」
 *
 * RC1.1-F 的教训：`no_content` 时后端也会给 `allDone: true`（三段目标
 * 都是 0，自然「都完成了」）。照着 `allDone` 显示庆祝，学生会看到
 * 「🎉 今天的课完成了」而其实今天根本没排课。**停留态一律按停留渲染。**
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  api,
  type LessonSegment,
  type LessonToday,
  type SegmentStatus,
  type V2Overview,
} from '../lib/api';
import { getState, handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { NEXT_ACTION_ROUTE, ROUTES, type NextActionKind } from '../routes.contract';
import { WEEKEND_VOCAB_NOTE, isTeachingDay } from '../lib/teaching-day';
import { Button, Card, Notice, Screen } from '../ui';

const SEGMENT_LABEL: Record<LessonSegment['key'], string> = {
  read: '阅读',
  vocab: '单词',
  drill: '错题',
};

const STATUS_TEXT: Record<SegmentStatus, string> = {
  done: '完成',
  partial: '做了一部分',
  todo: '还没开始',
  none: '今天没有',
  auto_closed: '被系统收尾了',
};

/**
 * 点这张卡去哪。
 *
 * 纯函数，导出给测试直接驱动 —— 「点了去哪」是这一屏最容易悄悄坏掉的
 * 一条规则，不该只能靠渲染整页来验。
 *
 * 返回 `null` = 这张卡现在不能点，调用方必须给出**为什么**。
 */
export type CardTarget =
  | { kind: 'navigate'; path: string }
  /** 今天的课还没开始 —— 走与主按钮同一个 start 命令 */
  | { kind: 'start' }
  | { kind: 'blocked'; reason: string };

export function segmentTarget(
  seg: LessonSegment,
  ctx: { nextActionKind: NextActionKind; stage: string },
): CardTarget {
  if (seg.available === false) {
    return { kind: 'blocked', reason: seg.unavailableReason || '这部分暂时不开放' };
  }
  // 停留态：今天根本没课 / 窗口关了 / 没分级 —— 说清楚，不装作能进
  if (STAY_KINDS.has(ctx.nextActionKind)) {
    return { kind: 'blocked', reason: STAY_REASON[ctx.nextActionKind] ?? '今天进不去这一段' };
  }
  if (ctx.nextActionKind === 'ready_to_start') return { kind: 'start' };

  if (seg.key === 'read') {
    // 读完了（或已交卷等判分）→ 看结果；否则回阅读页接着做
    const finished = seg.status === 'done' || seg.status === 'auto_closed' || seg.scoresPending;
    return { kind: 'navigate', path: finished ? ROUTES.readingResult : ROUTES.reading };
  }
  if (seg.key === 'vocab') {
    // 单词卡与待办都由“我的单词”统一管理；学习未完成时直接续学。
    return { kind: 'navigate', path: seg.status === 'done' ? ROUTES.vocab : ROUTES.coachLearn };
  }
  return { kind: 'navigate', path: ROUTES.mistakes };
}

const STAY_KINDS = new Set<NextActionKind>([
  'no_content',
  'window_closed',
  'level_not_set',
  'none',
]);
/**
 * 停留态下**卡片上**那一句。
 *
 * 刻意与主行动区那一句不同字：同一句话在一屏里出现四遍是噪音，而且
 * 「为什么进不去」的完整说法应该只有一处权威（主行动区）。这里给的是
 * 每张卡各自的短说明，够学生知道点它没用、以及为什么。
 */
const STAY_REASON: Partial<Record<NextActionKind, string>> = {
  no_content: '今天还没有课程',
  window_closed: '作答时间已结束',
  level_not_set: '还没分配难度',
  none: '今天没有要做的',
};

/** 每段右侧的一句细节 —— 有就显示，没有就留空，不编造。 */
function segmentDetail(s: LessonSegment): string | null {
  if (s.key === 'read') {
    if (s.scoresPending) {
      // 还没交卷就谈不上「成绩」—— 盲测时没交卷的卡片写着「成绩还没出来」。
      if (s.status === 'partial' || s.status === 'todo') return '还没交卷';
      const r = s.releasedScore;
      return r && r.count > 0 ? `客观题 ${r.earned} / ${r.max} · 其余等老师批` : '成绩还没出来';
    }
    if (s.score != null && s.maxScore != null) return `${s.score} / ${s.maxScore} 分`;
    if (s.questionCount != null) return `${s.questionCount} 题`;
    return s.label;
  }
  if (s.key === 'vocab') {
    const q = s.quizScore;
    if (q.status === 'submitted') return `测试 ${q.correct} / ${q.total}`;
    if (q.status === 'in_progress') return `测试进行中 ${q.answered} / ${q.total}`;
    return s.target > 0 ? `${s.progress} / ${s.target}` : null;
  }
  return s.target > 0 ? `${s.progress} / ${s.target}` : null;
}

type Phase =
  | { s: 'loading' }
  | { s: 'ready'; data: LessonToday; vocabOverview: V2Overview | null }
  | { s: 'error'; message: string };

export default function TodayPage() {
  const navigate = useNavigate();
  const auth = getState();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  /**
   * 请求代次。
   *
   * 「重试」会并发出第二个请求；组件也可能在响应回来之前就卸载了。
   * 每次发起自增，回来时不是最新那一代就整个丢掉 —— 否则慢的那个会把
   * 快的覆盖掉，页面显示的是过期结果。
   */
  const gen = useRef(0);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return; // 没票就不该在这个页面上，App 的路由守卫会送走
    const mine = ++gen.current;
    setPhase({ s: 'loading' });
    try {
      const data = await api.lessonToday(token);
      const vocabOverview = typeof api.vocabV2Overview === 'function'
        ? await api.vocabV2Overview(token).catch(() => null)
        : null;
      if (mine !== gen.current) return;
      setPhase({ s: 'ready', data, vocabOverview });
    } catch (e) {
      if (mine !== gen.current) return;
      // 认证失败 → 走统一的登出，回登录页
      if (handleAuthFailure(e)) return;
      // 网络或服务端故障 → **留着票**，停在这一页给一个重试
      setPhase({ s: 'error', message: '没能拿到今天的课 —— 网络不太好，重试一下。' });
    }
  }, []);

  useEffect(() => {
    void load();
    // 卸载后让在途响应作废
    return () => {
      gen.current++;
    };
  }, [load]);

  const onStart = useCallback(async () => {
    if (starting) return; // 双击只算一次
    const token = readToken();
    if (!token) return;
    setStarting(true);
    setStartError(null);
    try {
      const data = await api.lessonStart(token);
      // 不做乐观跳转：拿到服务端的新 kind 再决定去哪
      const target = NEXT_ACTION_ROUTE[data.nextAction.kind];
      if (target.kind === 'navigate') {
        navigate(target.path);
        return;
      }
      // 仍是停留态 —— 就把新状态渲染出来
      gen.current++;
      setPhase({ s: 'ready', data, vocabOverview: phase.s === 'ready' ? phase.vocabOverview : null });
      setStarting(false);
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setStartError('没能开始今天的课 —— 再试一次。');
      setStarting(false);
    }
  }, [navigate, phase, starting]);

  if (phase.s === 'loading') {
    return (
      <Screen>
        <p className="text-center text-slate-400">载入中…</p>
      </Screen>
    );
  }

  if (phase.s === 'error') {
    return (
      <Screen>
        <Card>
          <Notice kind="error">{phase.message}</Notice>
          <Button onClick={() => void load()}>重试</Button>
        </Card>
      </Screen>
    );
  }

  const d = phase.data;
  const vocabOverview = phase.vocabOverview;
  const readingBacklog = vocabOverview?.readingBacklog ?? [];
  const learningBacklog = vocabOverview?.learningBacklog ?? [];
  const hasBacklog = readingBacklog.length > 0 || learningBacklog.length > 0;
  const openReadingBacklog = async (task: (typeof readingBacklog)[number]) => {
    if (starting) return;
    const token = readToken();
    if (!token) return;
    setStarting(true);
    setStartError(null);
    try {
      await api.openReadingSession(token, task.sessionId);
      navigate(`${ROUTES.reading}?sessionId=${encodeURIComponent(task.sessionId)}&date=${encodeURIComponent(task.date)}&backlog=1`);
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setStartError('这份补做阅读暂时打不开，请再试一次。');
      setStarting(false);
    }
  };
  // 周末：没有当天的新词会话时，单词卡不再显示「0 / 10 · 还没开始」，
  // 主按钮也不再把学生送进只有一句「周一再来」的页面（2026-09-05 盲测）。
  const teachingDay = isTeachingDay();
  const weekendNoVocab = !teachingDay && !vocabOverview?.today;
  const displayedSegments = d.segments.map((segment): LessonSegment => {
    if (segment.key !== 'vocab' || !vocabOverview) return segment;
    if (weekendNoVocab) {
      return { ...segment, status: 'none', progress: 0, target: 0, available: false, unavailableReason: `${WEEKEND_VOCAB_NOTE} · 不计入今日完成` };
    }
    const daily = vocabOverview.today;
    const progress = daily?.completed ?? 0;
    const target = daily?.target ?? vocabOverview.dailyTarget;
    const status: SegmentStatus = daily?.status === 'completed'
      ? 'done'
      : progress > 0
        ? 'partial'
        : 'todo';
    return {
      ...segment,
      status,
      progress,
      target,
      typicalMinutes: Math.max(2, Math.ceil(target / 5)),
      quizScore: { status: 'not_started' },
    };
  });
  const countable = displayedSegments.filter((segment) => segment.available !== false);
  const displayedCompleted = countable.filter((segment) => segment.status === 'done' || segment.status === 'auto_closed').length;
  const displayedTotal = countable.length;
  const who = auth.status === 'authenticated' ? auth.profile.nickname || auth.profile.name : '';
  const serverTarget = NEXT_ACTION_ROUTE[d.nextAction.kind];
  const learningAction = d.nextAction.kind === 'learn_vocab';
  const testingAction = d.nextAction.kind === 'vocab_test' || d.nextAction.kind === 'vocab_waiting';
  const dailyFinished = vocabOverview?.today?.status === 'completed';
  const target = testingAction
    ? { kind: 'navigate' as const, path: ROUTES.vocab }
    : learningAction && vocabOverview
      ? dailyFinished
        ? { kind: 'navigate' as const, path: ROUTES.summary }
        : weekendNoVocab
          ? { kind: 'stay' as const }
          : { kind: 'navigate' as const, path: ROUTES.coachLearn }
    : serverTarget;
  const targetLabel = testingAction
    ? '去做单词小测'
    : learningAction && vocabOverview
      ? dailyFinished
        ? '查看今天的总结'
        : vocabOverview.today ? '继续学习今天的新词' : '学习今天的新词'
    : d.nextAction.label;
  const stayLabel = learningAction && weekendNoVocab ? `今天的阅读做完了。${WEEKEND_VOCAB_NOTE}。` : d.nextAction.label;

  return (
    <Screen>
      <Card>
        <h1 className="text-xl font-semibold mb-1">你好，{who}</h1>
        {d.streakDays > 0 ? (
          <p className="text-sm text-slate-500 mb-4">已经连续学习 {d.streakDays} 天</p>
        ) : (
          <div className="mb-4" />
        )}

        {/*
          分母**照搬服务端的 `total`**。错题本暂停期间它是 2 —— 前端不自己
          数段数，否则两边一旦不一致，学生看到的就是一个永远差一段的进度。
        */}
        <p data-testid="lesson-progress" className="text-sm text-slate-600 mb-4">
          今天完成 <span className="font-medium">{displayedCompleted}</span> / {displayedTotal}
        </p>

        {hasBacklog ? (
          <section className="mb-6 rounded-2xl border border-orange-200 bg-orange-50/80 p-4" aria-label="待补做任务">
            <h2 className="font-semibold text-orange-950">待补做任务</h2>
            <p className="mt-1 text-sm text-orange-800">旧任务不会被今天的任务覆盖。可以先补旧任务，也可以先做今天的。</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {readingBacklog.map((task) => (
                <button key={`reading-${task.assignmentId}`} disabled={starting} onClick={() => void openReadingBacklog(task)} className="app-secondary flex min-h-[58px] items-center justify-between bg-white px-4 text-left">
                  <span><strong>{formatTaskDate(task.date)}阅读</strong><small className="mt-1 block text-slate-500">{task.status === 'in_progress' ? '继续上次进度' : '未开始'}</small></span>
                  <span className="text-[#007aff]">{task.status === 'in_progress' ? '继续' : '开始'} →</span>
                </button>
              ))}
              {learningBacklog.map((task) => (
                <button key={`words-${task.sessionId}`} disabled={starting} onClick={() => navigate(`${ROUTES.coachLearn}?date=${encodeURIComponent(task.date)}`)} className="app-secondary flex min-h-[58px] items-center justify-between bg-white px-4 text-left">
                  <span><strong>{formatTaskDate(task.date)}新词</strong><small className="mt-1 block text-slate-500">{task.completed} / {task.target}</small></span>
                  <span className="text-[#007aff]">{task.status === 'in_progress' ? '继续' : '开始'} →</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <ul className="mb-6 grid gap-3 md:grid-cols-3">
          {displayedSegments.map((s) => (
            <SegmentCard
              key={s.key}
              seg={s}
              target={segmentTarget(s, { nextActionKind: d.nextAction.kind, stage: d.stage })}
              busy={starting}
              onStart={() => void onStart()}
              onGo={(path) => navigate(path)}
            />
          ))}
        </ul>

        {/* 唯一的主行动区 */}
        {target.kind === 'start' ? (
          <>
            {startError ? <Notice kind="error">{startError}</Notice> : null}
            <Button disabled={starting} onClick={() => void onStart()}>
              {starting ? '正在开始…' : d.nextAction.label}
            </Button>
          </>
        ) : target.kind === 'navigate' ? (
          <Button onClick={() => navigate(target.path)}>{targetLabel}</Button>
        ) : (
          <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
            {stayLabel}
          </p>
        )}

        {vocabOverview?.pendingTests.length ? (
          <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/80 p-4" aria-label="还没做的单词小测">
            <h2 className="font-semibold text-amber-950">还没做的单词小测</h2>
            <p className="mt-1 text-sm text-amber-800">没有截止时间；没做的会按日期一直留着。</p>
            {testError ? <Notice kind="error">{testError}</Notice> : null}
            <div className="mt-3 grid gap-2">
              {vocabOverview.pendingTests.map((task) => (
                <button
                  key={task.dailySessionId}
                  className="app-secondary flex min-h-[52px] items-center justify-between bg-white px-4 text-left"
                  onClick={async () => {
                    const token = readToken();
                    if (!token) return;
                    setTestError(null);
                    try {
                      const test = task.testSessionId
                        ? { id: task.testSessionId }
                        : await api.vocabV2StartTest(token, task.dailySessionId);
                      navigate(`${ROUTES.coachTest}?sessionId=${encodeURIComponent(test.id)}`);
                    } catch (error) {
                      // 没有 catch 的话，一次失败就是一个未处理的 rejection：按钮看着像死了，
                      // 学生不知道发生了什么。
                      if (handleAuthFailure(error)) return;
                      setTestError('这份单词测试暂时打不开，请稍后再试。');
                    }
                  }}
                >
                  <span>{formatTaskDate(task.date)} · {task.total} 个词</span>
                  <span className="text-[#007aff]">{task.status === 'in_progress' ? '继续' : '开始'} →</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* 历史成绩（阶段 11）—— 随时能进，与今天走到哪一步无关 */}
        <nav aria-label="常用功能" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickLink testId="go-scores" to={ROUTES.scores} icon="▤" label="历史成绩" />
          <QuickLink testId="go-vocab" to={ROUTES.vocab} icon="Aa" label="我的单词" />
          <QuickLink testId="go-mistakes" to={ROUTES.mistakes} icon="!" label="错题本" />
          <QuickLink to={ROUTES.account} icon="⚙" label="账号设置" />
        </nav>
      </Card>
    </Screen>
  );
}

function formatTaskDate(date: string) {
  const [, month, day] = date.split('-').map(Number);
  return `${month}月${day}日`;
}

/**
 * 一段课程的卡片。
 *
 * 三种形态，**没有第四种「点了没反应」**：
 *   · 可导航 —— `<button>`，点了就走；
 *   · 该开始 —— 走与主按钮同一个 start 命令；
 *   · 进不去 —— 不是按钮，`aria-disabled`，并且把原因写在卡上。
 */
function SegmentCard({
  seg,
  target,
  busy,
  onStart,
  onGo,
}: {
  seg: LessonSegment;
  target: CardTarget;
  busy: boolean;
  onStart: () => void;
  onGo: (path: string) => void;
}) {
  const detail = segmentDetail(seg);
  const label = SEGMENT_LABEL[seg.key];
  // 读屏用的完整名字（2026-09-05 盲测 P2-19）
  const statusText = seg.available === false ? '暂未开放' : STATUS_TEXT[seg.status];
  const accessibleName = `${label}：${statusText}${seg.available !== false && detail ? `，${detail}` : ''}`;
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{label}</span>
        <span className="text-slate-500 text-sm">
          {seg.available === false ? '暂未开放' : STATUS_TEXT[seg.status]}
          {seg.available === false ? '' : detail ? ` · ${detail}` : ''}
        </span>
      </span>
      {target.kind === 'blocked' ? (
        <span className="mt-1 block text-xs text-slate-500">{target.reason}</span>
      ) : null}
    </>
  );

  if (target.kind === 'blocked') {
    return (
      <li
        data-testid={`segment-card-${seg.key}`}
        aria-disabled="true"
        className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600"
      >
        {body}
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        data-testid={`segment-card-${seg.key}`}
        aria-label={accessibleName}
        disabled={busy}
        onClick={() => (target.kind === 'start' ? onStart() : onGo(target.path))}
        className="app-secondary w-full min-h-[76px] text-left px-4 py-3 text-sm hover:bg-white disabled:opacity-60"
      >
        {body}
      </button>
    </li>
  );
}

function QuickLink({ to, icon, label, testId }: { to: string; icon: string; label: string; testId?: string }) {
  return (
    <Link
      data-testid={testId}
      to={to}
      className="min-h-[68px] rounded-2xl border border-slate-200/80 bg-white/70 px-3 py-3 text-center text-sm font-medium text-slate-700 no-underline transition hover:bg-white hover:shadow-sm"
    >
      <span aria-hidden="true" className="mx-auto mb-1 grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-[13px] font-semibold text-[#007aff]">
        {icon}
      </span>
      {label}
    </Link>
  );
}
