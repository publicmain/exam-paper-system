/**
 * 今天的课 —— 学生每天的落点。
 *
 * ## 一条原则：服务端说了算
 *
 * 页面**不重算任何业务状态**。完成度、阶段、下一步全部照搬
 * `/lesson/today` 的回答；这里只负责把它读出来，以及把**唯一的**
 * 下一步动作摆出来。
 *
 * 三个段落是**状态摘要**，不是三个入口 —— 每段配一个按钮会立刻造出
 * 第二套推进逻辑，而课程推进的唯一权威是 `nextAction`。
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
} from '../lib/api';
import { getState, handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { NEXT_ACTION_ROUTE, ROUTES } from '../routes.contract';
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

/** 每段右侧的一句细节 —— 有就显示，没有就留空，不编造。 */
function segmentDetail(s: LessonSegment): string | null {
  if (s.key === 'read') {
    if (s.scoresPending) return '成绩还没出来';
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
  | { s: 'ready'; data: LessonToday }
  | { s: 'error'; message: string };

export default function TodayPage() {
  const navigate = useNavigate();
  const auth = getState();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

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
      if (mine !== gen.current) return;
      setPhase({ s: 'ready', data });
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
      setPhase({ s: 'ready', data });
      setStarting(false);
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setStartError('没能开始今天的课 —— 再试一次。');
      setStarting(false);
    }
  }, [navigate, starting]);

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
  const who = auth.status === 'authenticated' ? auth.profile.nickname || auth.profile.name : '';
  const target = NEXT_ACTION_ROUTE[d.nextAction.kind];

  return (
    <Screen>
      <Card>
        <h1 className="text-xl font-semibold mb-1">你好，{who}</h1>
        {d.streakDays > 0 ? (
          <p className="text-sm text-slate-500 mb-4">已经连续学习 {d.streakDays} 天</p>
        ) : (
          <div className="mb-4" />
        )}

        <p className="text-sm text-slate-600 mb-4">
          今天完成 <span className="font-medium">{d.completed}</span> / {d.total}
        </p>

        <ul className="mb-6 flex flex-col gap-2">
          {d.segments.map((s) => {
            const detail = segmentDetail(s);
            return (
              <li
                key={s.key}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"
              >
                <span className="font-medium">{SEGMENT_LABEL[s.key]}</span>
                <span className="text-slate-500">
                  {STATUS_TEXT[s.status]}
                  {detail ? ` · ${detail}` : ''}
                </span>
              </li>
            );
          })}
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
          <Button onClick={() => navigate(target.path)}>{d.nextAction.label}</Button>
        ) : (
          <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
            {d.nextAction.label}
          </p>
        )}

        {/* 历史成绩（阶段 11）—— 随时能进，与今天走到哪一步无关 */}
        <Link
          data-testid="go-scores"
          to={ROUTES.scores}
          className="block mt-6 text-blue-600 underline text-sm"
        >
          历史成绩 →
        </Link>
        {/* 生词本（阶段 12A）—— 同样随时能进 */}
        <Link
          data-testid="go-vocab"
          to={ROUTES.vocab}
          className="block mt-3 text-blue-600 underline text-sm"
        >
          生词本 →
        </Link>
        <Link to={ROUTES.account} className="block mt-3 text-blue-600 underline text-sm">
          账号设置 →
        </Link>
      </Card>
    </Screen>
  );
}
