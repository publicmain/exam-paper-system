/**
 * `/lesson/summary` —— 今日总结（审计 UI10）。
 *
 * ## 与首页读同一份事实
 *
 * 原来首页按 V2（新词 / 正式词测）显示完成，总结却按旧 `nextAction` / 旧词测
 * 判「做完没有」，不同意就 replace 回首页 —— 于是「首页 → 总结 → 首页」来回弹。
 * 现在总结用首页同一套纯函数（`readingTaskView` / `wordsTaskView` / `testTaskView`
 * / `progressOf`），读同样三份数据：
 *
 *   · `GET /lesson/today` —— 本次有效阅读（分数、待批、客观题小计、答卷）；
 *   · `GET /vocab-v2/overview` —— 每日新词与正式词测的状态（`home`）；
 *   · `GET /vocab-v2/tests` —— 已交卷正式卷的成绩（答对几题，来自冻结卷本身）。
 *
 * ## 规矩
 *
 * **① 只读。** 只有上面三个 GET，不发任何写 —— 尤其不碰 `/lesson/start`。刷新、
 * 重试、从别处再进来，都仍然只读。
 *
 * **② 不回跳，也不误报。** 三项都做完 → 「今天的三项都做完了」；没做完 → 「还有 N 项
 * 没做完」，照样列出已做的部分和回今日的出口。不再按旧字段把人弹回首页。
 *
 * **③ 服务端说了算。** 还在判分就说还在判分，**绝不补一个 0**；词测只写「答对 c / t」，
 * 不拿两个数重算百分比。后端的 `nextAction.href` 一次都不读。
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type LessonToday, type ReadSegment, type V2FormalTestRow, type V2Overview } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { Badge } from '../design/Badge';
import { Button, buttonClass } from '../design/Button';
import { Icon, type IconName } from '../design/Icon';
import { FocusHeader, FocusLayout } from '../design/Page';
import { InlineStatus, StatusView } from '../design/Status';
import { dayText, progressOf, readingTaskView, testTaskView, wordsTaskView, type TaskView } from './Today';

// ─────────────────────────────────────────────────────────────
// 纯逻辑（导出给测试直接驱动）
// ─────────────────────────────────────────────────────────────

/** 交过卷的两种状态 —— 学生自己交的，或者被系统收走的。 */
const SUBMITTED = new Set(['done', 'auto_closed']);

/**
 * 阅读那一段该说什么。**五种情况，一种都不许含混过去。**
 *
 * 顺序有讲究：先问「今天有没有阅读」，再问「做完了没有」，最后才谈分数 ——
 * 反过来的话，没排课的日子会被说成「0 分」。
 */
export function readingLine(read: ReadSegment): string {
  if (read.status === 'none') return '今天没有阅读';
  if (!SUBMITTED.has(read.status)) return '还没做完';
  if (read.scoresPending) {
    const r = read.releasedScore;
    return r && r.count > 0 ? `已交卷 · 客观题 ${r.earned} / ${r.max} · 其余等老师批` : '已交卷 · 还在判分';
  }
  if (read.score == null || read.maxScore == null) return '已交卷 · 还没有分数';
  return `${read.score} / ${read.maxScore} 分`;
}

/** 正式词测那一行：交了卷就写冻结卷的成绩；没交写状态。不重算百分比。 */
export function testLine(view: TaskView, row: V2FormalTestRow | null, rowsFailed: boolean): string {
  if (view.done) {
    if (row) return `答对 ${row.correct} / ${row.total}`;
    return rowsFailed ? '已交卷 · 成绩暂时没取到' : '已交卷';
  }
  return view.detail;
}

/** 新词那一行：学完几个、延后几个；全延后不叫学完（VOC08）。 */
export function wordsLine(ov: V2Overview, view: TaskView): string {
  const w = ov.home?.words;
  if (!view.applicable || !w || w.learned == null) return view.detail;
  const parts = [`学完 ${w.learned} 个`, w.deferred ? `延后 ${w.deferred} 个` : '', w.pending ? `还剩 ${w.pending} 个` : ''].filter(Boolean);
  return parts.join(' · ');
}

// ─────────────────────────────────────────────────────────────
// 页面
// ─────────────────────────────────────────────────────────────

type Part<T> = { s: 'loading' } | { s: 'error' } | { s: 'ready'; data: T };
type VocabFacts = { ov: V2Overview; tests: V2FormalTestRow[] | null };

export default function LessonSummaryPage() {
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Part<LessonToday>>({ s: 'loading' });
  const [vocab, setVocab] = useState<Part<VocabFacts>>({ s: 'loading' });
  /** 请求代次：重试或卸载之后，旧响应一律丢掉。 */
  const gen = useRef({ lesson: 0, vocab: 0 });

  const loadLesson = useCallback(async () => {
    const token = readToken();
    if (!token) return; // 没票不该在这一页，App 的路由守卫会送走
    const mine = ++gen.current.lesson;
    setLesson({ s: 'loading' });
    try {
      const data = await api.lessonToday(token);
      if (mine === gen.current.lesson) setLesson({ s: 'ready', data });
    } catch (e) {
      if (mine !== gen.current.lesson) return;
      if (handleAuthFailure(e)) return;
      setLesson({ s: 'error' });
    }
  }, []);

  const loadVocab = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    const mine = ++gen.current.vocab;
    setVocab({ s: 'loading' });
    try {
      const [ov, tests] = await Promise.all([
        api.vocabV2Overview(token),
        // 成绩单取不到不挡整页：词测那一行说「成绩暂时没取到」
        api.vocabV2Tests(token).then((r) => r.tests).catch((e: unknown) => {
          if (handleAuthFailure(e)) throw e;
          return null;
        }),
      ]);
      if (mine === gen.current.vocab) setVocab({ s: 'ready', data: { ov, tests } });
    } catch (e) {
      if (mine !== gen.current.vocab) return;
      if (handleAuthFailure(e)) return;
      setVocab({ s: 'error' });
    }
  }, []);

  useEffect(() => {
    void loadLesson();
    void loadVocab();
    const g = gen.current;
    return () => {
      g.lesson++;
      g.vocab++;
    };
  }, [loadLesson, loadVocab]);

  const lessonData = lesson.s === 'ready' ? lesson.data : null;
  const facts = vocab.s === 'ready' ? vocab.data : null;
  const dateKey = facts?.ov.home?.date ?? lessonData?.date ?? null;
  const header = (
    <FocusHeader
      backLabel="今日"
      onBack={() => navigate(ROUTES.today)}
      title="今日总结"
      meta={dateKey ? <span data-testid="summary-date">{dayText(dateKey)}</span> : undefined}
    />
  );

  if (lesson.s === 'loading' || vocab.s === 'loading') {
    return (
      <FocusLayout header={header} testId="summary-page">
        <StatusView kind="loading" title="正在整理今天做过的" />
      </FocusLayout>
    );
  }

  if (lesson.s === 'error' && vocab.s === 'error') {
    return (
      <FocusLayout header={header} testId="summary-page">
        <StatusView
          kind="error"
          title="今天的总结没打开"
          message="网络不太好。你做过的都记着，重试一下就好。"
          secondary={
            <>
              <Button block data-testid="retry" icon="refresh" onClick={() => { void loadLesson(); void loadVocab(); }}>
                重试
              </Button>
              <BackToToday />
            </>
          }
        />
      </FocusLayout>
    );
  }

  const readSeg = lessonData?.segments.find((s): s is ReadSegment => s.key === 'read') ?? null;
  const readView = lessonData ? readingTaskView(lessonData, facts?.ov.home?.reading) : null;
  const wordsView = facts ? wordsTaskView(facts.ov) : null;
  const testView = facts ? testTaskView(facts.ov) : null;
  const views = [readView, wordsView, testView].filter((v): v is TaskView => v !== null);
  const allKnown = views.length === 3;
  const progress = progressOf(views);
  const allDone = allKnown && progress.total > 0 && progress.done === progress.total;
  const left = progress.total - progress.done;
  const todayTest = facts && dateKey ? facts.tests?.find((t) => t.date === dateKey && t.sessionId === facts.ov.home?.test.testSessionId) ?? facts.tests?.find((t) => t.date === dateKey) ?? null : null;

  const headline = !allKnown
    ? '有一项没加载出来，先看已经有的'
    : progress.total === 0
      ? '今天没有要完成的任务'
      : allDone
        ? '今天的三项都做完了'
        : `还有 ${left} 项没做完`;

  return (
    <FocusLayout header={header} testId="summary-page">
      <section aria-labelledby="summary-headline" className="mb-5">
        <h1 id="summary-headline" data-testid="summary-completion" className="text-title1 text-ink">
          {headline}
        </h1>
        <p className="mt-1 text-callout text-ink-2">
          {allKnown && progress.total > 0 ? (
            <span aria-label={`今天完成 ${progress.done} / ${progress.total}`}>
              今天完成 <strong className="tabular-nums text-ink">{progress.done}</strong> / <span className="tabular-nums">{progress.total}</span>
            </span>
          ) : null}
          {lessonData && lessonData.streakDays > 0 ? (
            <span data-testid="summary-streak">
              {allKnown && progress.total > 0 ? ' · ' : ''}已连续学习 <span className="tabular-nums">{lessonData.streakDays}</span> 天
            </span>
          ) : null}
        </p>
      </section>

      <ul className="list-inset mb-5 overflow-hidden rounded-group bg-surface" aria-label="今天三项的结果">
        <Row
          icon="reading"
          title="今日阅读"
          view={readView}
          testId="read-state"
          line={readView ? (readSeg && readView.applicable ? `${readSeg.label ? `${readSeg.label} · ` : ''}${readingLine(readSeg)}` : readView.detail) : null}
          failed={lesson.s === 'error'}
          onRetry={() => void loadLesson()}
          extra={
            readSeg?.submissionId ? (
              <Link data-testid="reading-analysis" to={ROUTES.readingResult} className="inline-flex min-h-[44px] items-center gap-1 text-callout text-accent">
                看阅读结果
                <Icon name="forward" size={16} />
              </Link>
            ) : null
          }
        />
        <Row
          icon="words"
          title="每日新词"
          view={wordsView}
          testId="words-state"
          line={facts && wordsView ? wordsLine(facts.ov, wordsView) : null}
          failed={vocab.s === 'error'}
          onRetry={() => void loadVocab()}
        />
        <Row
          icon="checkCircle"
          title="正式单词测试"
          view={testView}
          testId="quiz-state"
          line={testView ? testLine(testView, todayTest, facts?.tests === null) : null}
          failed={vocab.s === 'error'}
          onRetry={() => void loadVocab()}
        />
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row">
        <BackToToday primary={!allDone} />
        <Link
          data-testid="go-scores"
          to={ROUTES.scores}
          className={`${buttonClass('neutral', 'lg', true)} sm:flex-1`}
        >
          <Icon name="records" size={20} />
          学习记录
        </Link>
        <Link
          data-testid="go-vocab"
          to={ROUTES.vocab}
          className={`${buttonClass('neutral', 'lg', true)} sm:flex-1`}
        >
          <Icon name="words" size={20} />
          我的单词
        </Link>
      </div>
    </FocusLayout>
  );
}

function Row({
  icon,
  title,
  view,
  line,
  testId,
  failed,
  onRetry,
  extra,
}: {
  icon: IconName;
  title: string;
  view: TaskView | null;
  line: string | null;
  testId: string;
  failed: boolean;
  onRetry: () => void;
  extra?: ReactNode;
}) {
  return (
    <li className="px-4 py-3" data-state={view ? (view.done ? 'done' : view.applicable ? 'todo' : 'not_applicable') : 'error'}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name={icon} size={20} className={view?.done ? 'text-success' : 'text-ink-3'} />
          <h2 className="text-headline text-ink">{title}</h2>
        </div>
        {view ? (
          <Badge tone={view.badge.tone} icon={view.done ? 'check' : null}>
            {view.badge.text}
          </Badge>
        ) : null}
      </div>
      {failed || !view ? (
        <div className="mt-2">
          <InlineStatus tone="error" onRetry={onRetry} testId={`${testId}-error`}>
            这一项没加载出来，不代表没做。
          </InlineStatus>
        </div>
      ) : (
        <p data-testid={testId} className="mt-1 text-callout text-ink-2">
          {line}
        </p>
      )}
      {extra && !failed ? <div className="-mb-1 mt-1">{extra}</div> : null}
    </li>
  );
}

/** 主出口。 */
function BackToToday({ primary = false }: { primary?: boolean }) {
  const navigate = useNavigate();
  return (
    <Button data-testid="back-to-today" variant={primary ? 'primary' : 'neutral'} block onClick={() => navigate(ROUTES.today)} className="sm:flex-1">
      回到今日
    </Button>
  );
}
