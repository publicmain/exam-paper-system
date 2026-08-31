/**
 * `/lesson/summary` —— 今日总结（阶段 10）。
 *
 * 七步链的最后一屏：读完、背完、考完之后，学生在这里看今天做了什么。
 *
 * ## 三条规矩
 *
 * **① 只读。** 这一屏只打一个 `GET /lesson/today`，此外**不发任何请求**
 * —— 尤其不碰 `/lesson/start`。它是「回顾」，不是流程节点；一个总结页
 * 偷偷写一次库，就会变成「看一眼总结把今天又开了一遍」。刷新、重试、
 * 从别处再进来，都仍然只有那一个 GET。
 *
 * **② 服务端说了算。** 分数、完成度、连续天数、百分比全部照搬。
 * 这一屏**不做任何算术**：
 *
 *   · 服务端说「还在判分」或者没给分数 —— 就这么说，**绝不补一个 0**。
 *     显示 0 分和显示「还没判」，对学生是两件完全不同的事；
 *   · 百分比用服务端的 `percentage`，**不拿 `correct / total` 重算**。
 *     两边一旦对不上，权威是落库的那一份（`vocab-score.ts` 交卷时算一次
 *     就冻住），前端重算只会造出第二套成绩。
 *
 * **③ 只认 `kind`，不看 `href`。** 后端的 `nextAction.href` 指向旧端
 * （`/my-lesson/summary` 之类），这一屏一次都不读它。`kind` 不是
 * `summary` 就说明学生今天还没走到这一步 —— **replace 回 `/today`**，
 * 让枢纽决定下一步，而不是在这里显示一份半截的总结。
 *
 * ## 出口只有两个
 *
 * `/today`、**有答卷时**的 `/lesson/reading/result`、`/scores`
 * （历史成绩，阶段 11）、`/vocab`（生词本，阶段 12A）以及 `/mistakes`
 * （错题本，阶段 12B）。
 *
 * 「指向不存在的页面比没有入口更糟」这条规矩仍然有效：新加一个出口之前，
 * 那一页得先真的存在。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  api,
  type DrillSegment,
  type LessonToday,
  type ReadSegment,
  type SegmentStatus,
  type VocabSegment,
} from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { Button, Card, Notice, Screen } from '../ui';

// ─────────────────────────────────────────────────────────────
// 纯逻辑（导出给测试直接驱动）
// ─────────────────────────────────────────────────────────────

const STATUS_TEXT: Record<SegmentStatus, string> = {
  done: '完成',
  partial: '做了一部分',
  todo: '还没开始',
  none: '今天没有',
  auto_closed: '被系统收尾了',
};

/** 交过卷的两种状态 —— 学生自己交的，或者作答窗关闭时被系统收走的。 */
const SUBMITTED: ReadonlySet<SegmentStatus> = new Set<SegmentStatus>(['done', 'auto_closed']);

/**
 * 阅读那一段该说什么。**五种情况，一种都不许含混过去。**
 *
 * 顺序有讲究：先问「今天有没有阅读」，再问「做完了没有」，最后才谈分数
 * —— 反过来的话，没排课的日子会被说成「0 分」。
 */
export function readingLine(read: ReadSegment): string {
  if (read.status === 'none') return '今天没有阅读';
  if (!SUBMITTED.has(read.status)) return '还没做完';
  if (read.scoresPending) return '已交卷 · 还在判分';
  if (read.score == null || read.maxScore == null) return '已交卷 · 还没有分数';
  return `${read.score} / ${read.maxScore} 分`;
}

/**
 * 正式单词测试那一段该说什么。
 *
 * `percentage` **直接用服务端的**（见文件头第 ② 条）。
 */
export function quizLine(vocab: VocabSegment): string {
  const q = vocab.quizScore;
  if (q.status === 'legacy_no_queue') return '这次任务没有单词测试';
  if (q.status === 'not_started') return '还没开始';
  if (q.status === 'in_progress') return `进行中 · 已答 ${q.answered} / ${q.total}`;
  return `答对 ${q.correct} / ${q.total} · ${q.percentage}%`;
}

/** 「几 / 几」这种进度，目标为 0 时不显示 —— 「0 / 0」不是信息。 */
export function progressLine(seg: VocabSegment | DrillSegment): string | null {
  return seg.target > 0 ? `${seg.progress} / ${seg.target}` : null;
}

/** 从 segments 里取一段。服务端一直是三段齐发，取不到时按「今天没有」渲染。 */
function segmentOf<K extends 'read' | 'vocab' | 'drill'>(
  data: LessonToday,
  key: K,
): Extract<LessonToday['segments'][number], { key: K }> | null {
  const s = data.segments.find((x) => x.key === key);
  return (s as Extract<LessonToday['segments'][number], { key: K }> | undefined) ?? null;
}

// ─────────────────────────────────────────────────────────────
// 页面
// ─────────────────────────────────────────────────────────────

type Phase =
  | { s: 'loading' }
  | { s: 'error'; message: string }
  | { s: 'ready'; data: LessonToday };

export default function LessonSummaryPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });

  /**
   * 请求代次 —— 与 `Today.tsx` 同一套。重试会并发出第二个请求，组件也
   * 可能在响应回来之前就卸载了；回来时不是最新那一代就整个丢掉，否则
   * 慢的那个会把快的覆盖掉，屏幕上是过期结果。
   */
  const gen = useRef(0);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return; // 没票不该在这一页，App 的路由守卫会送走
    const mine = ++gen.current;
    setPhase({ s: 'loading' });
    try {
      const data = await api.lessonToday(token);
      if (mine !== gen.current) return;
      // **三个服务端字段要同时同意**，少一个就回枢纽，不显示半截总结。
      //
      // S12I —— 只认 `kind` 是不够的。用户验收实测：主页写着 `2 / 3`、
      // 补段 `0 / 5`，而服务端（当时）还是给了 `summary` —— 于是这一屏
      // 把一份没做完的一天当成总结渲染了出来。现在还要 `allDone` 与
      // `completed === total` 一起点头；任何不一致都当作「还没完」。
      //
      // **不闪一下**：`setPhase({ s: 'ready' })` 在这一判断之后，
      // 不合格时根本进不到 ready，总结的 DOM 一帧都不会出现。
      const done =
        data.nextAction.kind === 'summary' &&
        data.allDone === true &&
        data.completed === data.total;
      if (!done) {
        navigate(ROUTES.today, { replace: true });
        return;
      }
      setPhase({ s: 'ready', data });
    } catch (e) {
      if (mine !== gen.current) return;
      if (handleAuthFailure(e)) return;
      // 网络 / 服务端故障 —— **留着票**，停在这一页给一个重试
      setPhase({ s: 'error', message: '没能打开今天的总结 —— 网络不太好，重试一下。' });
    }
  }, [navigate]);

  useEffect(() => {
    void load();
    // 卸载后让在途响应作废
    return () => {
      gen.current++;
    };
  }, [load]);

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
          <Button onClick={() => void load()}>
            <span data-testid="retry">重试</span>
          </Button>
          <BackToToday />
        </Card>
      </Screen>
    );
  }

  const d = phase.data;
  const read = segmentOf(d, 'read');
  const vocab = segmentOf(d, 'vocab');
  const drill = segmentOf(d, 'drill');

  return (
    <Screen>
      <Card>
        <h1 className="text-xl font-semibold mb-1">今日总结</h1>
        <p className="text-base text-slate-700 mb-1">今天的课完成了 🎉</p>
        <p data-testid="summary-date" className="text-sm text-slate-500">
          {d.date}
        </p>
        <p data-testid="summary-completion" className="mt-1 text-sm text-slate-600">
          今天完成 <span className="font-medium tabular-nums">{d.completed}</span> / {d.total}
        </p>
        {d.streakDays > 0 ? (
          <p data-testid="summary-streak" className="mt-1 text-sm text-slate-500">
            已经连续学习 <span className="tabular-nums">{d.streakDays}</span> 天
          </p>
        ) : null}

        <ul className="mt-5 flex flex-col gap-3">
          {/* ① 阅读 */}
          <li className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">阅读</span>
              <span className="text-slate-500">{read ? STATUS_TEXT[read.status] : STATUS_TEXT.none}</span>
            </div>
            <p data-testid="read-state" className="mt-1 text-sm text-slate-600">
              {read?.label ? `${read.label} · ` : ''}
              {read ? readingLine(read) : '今天没有阅读'}
            </p>
            {read?.submissionId ? (
              <Link
                data-testid="reading-analysis"
                to={ROUTES.readingResult}
                className="mt-2 inline-block text-sm text-blue-600 underline"
              >
                看阅读解析 →
              </Link>
            ) : null}
          </li>

          {/* ② 正式单词测试 + 课程学词进度 */}
          <li className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">单词</span>
              <span className="text-slate-500">{vocab ? STATUS_TEXT[vocab.status] : STATUS_TEXT.none}</span>
            </div>
            <p data-testid="quiz-state" className="mt-1 text-sm text-slate-600">
              正式测试：{vocab ? quizLine(vocab) : '今天没有单词测试'}
            </p>
            <p data-testid="vocab-progress" className="mt-1 text-sm text-slate-500">
              课程学词：{(vocab && progressLine(vocab)) ?? '今天没有'}
            </p>
          </li>

          {/* ③ 错题重练 */}
          <li className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">错题</span>
              <span className="text-slate-500">{drill ? STATUS_TEXT[drill.status] : STATUS_TEXT.none}</span>
            </div>
            <p data-testid="drill-state" className="mt-1 text-sm text-slate-600">
              {(drill && progressLine(drill)) ?? '今天没有要重练的错题'}
            </p>
          </li>
        </ul>

        {/* 历史成绩（阶段 11）—— 今天看完了，也能回头看以前的 */}
        <Link
          data-testid="go-scores"
          to={ROUTES.scores}
          className="block mt-5 text-blue-600 underline text-sm"
        >
          历史成绩 →
        </Link>
        {/* 生词本（阶段 12A） */}
        <Link
          data-testid="go-vocab"
          to={ROUTES.vocab}
          className="block mt-2 text-blue-600 underline text-sm"
        >
          生词本 →
        </Link>
        {/* 错题本（阶段 12B） */}
        <Link
          data-testid="go-mistakes"
          to={ROUTES.mistakes}
          className="block mt-2 text-blue-600 underline text-sm"
        >
          错题本 →
        </Link>

        <BackToToday />
      </Card>
    </Screen>
  );
}

/** 主出口。 */
function BackToToday() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      data-testid="back-to-today"
      onClick={() => navigate(ROUTES.today)}
      className="mt-6 w-full rounded-xl border border-slate-300 py-3 text-base min-h-[44px]"
    >
      回到今天的课
    </button>
  );
}
