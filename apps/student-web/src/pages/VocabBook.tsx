/**
 * `/vocab` —— 生词本（阶段 12A）。
 *
 * 同一外壳里的**独立页面**：随时能进，进了也不改变今天的课走到哪一步。
 * 所以它**不读 `/lesson/today`** —— 一读就把「看本子」和「今天走到哪」
 * 绑在了一起，而它们本来毫无关系。
 *
 * ## 两个 GET，各管各的
 *
 *   · `GET /vocab/words` —— 词表（顺序、总数、待复习数）
 *   · `GET /vocab/stats` —— 统计（掌握进度、连胜、今天复习了几次）
 *
 * 分开取，是为了让**统计挂了不连累词表**：词已经拿到了就照常显示，
 * 统计那一块单独说「暂时取不到」。反过来（一个失败整页报错）是最气人的
 * 一种失败 —— 学生要看的是自己的词，不是那几个数字。
 *
 * **但「统计挂了」和「票没了」是两回事**（返工 1/2 B-3）：401 说明令牌在
 * 这两次请求之间失效了（老师重置了 PIN、学生在另一台设备登出）。把它也
 * 吞掉，学生就停在一个**看着正常、其实已经登出**的页面上，直到下一次交互
 * 才莫名其妙被踢走。掉票一律走统一登出，其余才算「少几个数字」。
 *
 * ## 缺失不等于 0
 *
 * 统计里任何一项没给，就**不显示那一项**。「今天复习了 0 次」和「不知道
 * 今天复习了几次」对学生是两件事；把后者渲染成前者，是在替服务端说话。
 *
 * ## 移出要有一次明确确认
 *
 * 生词本是**会消失的东西**：删掉的词不会再回到复习队列，学生也不会知道
 * 自己曾经有过它。所以「移出」是两步：点一下变成「确认移出 / 取消」，
 * 再点一下才发请求。而且**服务端成功之后才**把那一行拿掉 —— 失败时行
 * 原样留着、可以再试，绝不做「乐观删除」：那会让一次断网看起来像一次成功。
 *
 * ## 删完要重新对账
 *
 * 删掉一个词，`total` 变了，`dueCount` 和统计**也变了** —— 但那两个数字
 * 是服务端按整本词表算出来的，本地减一减只能算对其中一个（返工 1/2 B-4）。
 * 「还有 9 个待复习」而实际只剩 8 个，是学生**没法察觉**的错：他不会去数，
 * 只会照着那个数字安排自己。
 *
 * 所以删除成功之后**重新取一次权威数字**（词表 + 统计）。如果这次对账也
 * 失败了 —— 那一行确实已经从库里没了，界面照删，但**所有聚合数字一律
 * 藏起来**并说明「对不上账了，刷新一下」。宁可少显示，不显示错的。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  api,
  type VocabStats,
  type VocabWordRow,
  type VocabWordsResult,
} from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { Button, Card, Notice, Screen, TopBar } from '../ui';

// ─────────────────────────────────────────────────────────────
// 纯逻辑（导出给测试直接驱动）
// ─────────────────────────────────────────────────────────────

/** FSRS 的内部状态机学生看不懂，也不该看懂 —— 翻译成人话。 */
const STATE_TEXT: Readonly<Record<string, string>> = {
  new: '还没开始',
  learning: '学习中',
  review: '复习中',
  relearning: '重新学',
  known: '已掌握',
};

export function stateLabel(state: string): string {
  return STATE_TEXT[state] ?? state;
}

/** 这词怎么进本子的。认不出来的来源**原样显示**，不猜。 */
const SOURCE_TEXT: Readonly<Record<string, string>> = {
  auto_wrong_answer: '答错自动收录',
  manual: '自己加的',
  lookup: '查词加入',
  teacher: '老师加的',
};

export function sourceLabel(sourceType: string): string {
  return SOURCE_TEXT[sourceType] ?? sourceType;
}

/** 到期日。ISO 串取前十位就是那一天，不做时区换算。 */
export function dayOf(iso: string | null | undefined): string | null {
  return iso ? iso.slice(0, 10) : null;
}

/**
 * S12L —— 生词本 MVP 的**四档筛选**。
 *
 * 50 个词一条列表铺到底、没有搜索也没有筛选，学生找一个词只能滚。
 * 试点先给最小的一套：按词头搜 + 四档过滤，全部在**已经取回来的那份
 * 列表上**做（不新增端点、不做服务端分页 —— 那是试点之后的事）。
 *
 * 「到期」按服务端给的 `due` 与当下时间比，不重算 FSRS。
 */
export type VocabFilter = 'all' | 'learning' | 'due' | 'mastered';

export const VOCAB_FILTER_LABEL: Readonly<Record<VocabFilter, string>> = {
  all: '全部',
  learning: '学习中',
  due: '待复习',
  mastered: '已掌握',
};

export function matchesFilter(
  w: { state: string; due?: string | null },
  f: VocabFilter,
  now: number,
): boolean {
  if (f === 'all') return true;
  if (f === 'mastered') return w.state === 'known';
  if (f === 'learning') return w.state === 'learning' || w.state === 'review' || w.state === 'relearning';
  // due：服务端给的到期时刻已经过了
  return w.due != null && Date.parse(w.due) <= now;
}

/** 按词头搜。空串 = 不过滤；大小写与首尾空白都不计较。 */
export function matchesQuery(w: { headword: string }, q: string): boolean {
  const k = q.trim().toLowerCase();
  return k === '' || w.headword.toLowerCase().includes(k);
}

// ─────────────────────────────────────────────────────────────
// 页面
// ─────────────────────────────────────────────────────────────

type Phase =
  | { s: 'loading' }
  | { s: 'error'; message: string }
  /**
   * `stats` 为 null = 统计那一次取失败了（词表照常显示）。
   * `aggregatesStale` = 删除成功但对账失败 —— 数字**一个都不显示**。
   */
  | { s: 'ready'; data: VocabWordsResult; stats: VocabStats | null; aggregatesStale: boolean };

export default function VocabBookPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });

  /** 请求代次 —— 与其它几屏同一套。 */
  const gen = useRef(0);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return; // 没票不该在这一页，App 的路由守卫会送走
    const mine = ++gen.current;
    setPhase({ s: 'loading' });
    try {
      // 词表是主角：它失败才算整页失败。
      const data = await api.vocabWords(token);
      if (mine !== gen.current) return;
      let stats: VocabStats | null = null;
      try {
        stats = await api.vocabStats(token);
      } catch (e) {
        // **掉票要立刻登出**（B-3）；其余（500 / 断网）才是「少几个数字」。
        if (handleAuthFailure(e)) return;
        stats = null;
      }
      if (mine !== gen.current) return;
      setPhase({ s: 'ready', data, stats, aggregatesStale: false });
    } catch (e) {
      if (mine !== gen.current) return;
      if (handleAuthFailure(e)) return;
      setPhase({ s: 'error', message: '没能打开生词本 —— 网络不太好，重试一下。' });
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      gen.current++;
    };
  }, [load]);

  /**
   * 删除成功之后的**对账**（B-4）。
   *
   * 重新取权威的词表与统计。对账本身失败时：那一行确实已经从库里没了，
   * 界面照删，但把**所有聚合数字藏起来** —— 宁可少显示，不显示错的。
   */
  const reconcile = useCallback(async (headword: string) => {
    const token = readToken();
    if (!token) return;
    const mine = ++gen.current;
    try {
      const data = await api.vocabWords(token);
      if (mine !== gen.current) return;
      let stats: VocabStats | null = null;
      try {
        stats = await api.vocabStats(token);
      } catch (e) {
        if (handleAuthFailure(e)) return;
        stats = null;
      }
      if (mine !== gen.current) return;
      setPhase({ s: 'ready', data, stats, aggregatesStale: false });
    } catch (e) {
      if (mine !== gen.current) return;
      if (handleAuthFailure(e)) return;
      setPhase((p) =>
        p.s !== 'ready'
          ? p
          : {
              ...p,
              data: { ...p.data, words: p.data.words.filter((w) => w.headword !== headword) },
              stats: null,
              aggregatesStale: true,
            },
      );
    }
  }, []);

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
          <BackToToday navigate={navigate} />
        </Card>
      </Screen>
    );
  }

  return <VocabBookReady phase={phase} navigate={navigate} reconcile={reconcile} />;
}

/**
 * 载入完之后的那一屏。
 *
 * 单独抽出来只有一个原因：搜索与筛选是 hook 状态，而上面那个组件里
 * `phase` 还可能是 loading / error —— hook 不能写在提前 return 后面。
 */
function VocabBookReady({
  phase,
  navigate,
  reconcile,
}: {
  phase: { s: 'ready'; data: VocabWordsResult; stats: VocabStats | null; aggregatesStale: boolean };
  navigate: ReturnType<typeof useNavigate>;
  reconcile: (headword: string) => void;
}) {
  const { data, stats, aggregatesStale } = phase;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VocabFilter>('all');

  const shown = useMemo(() => {
    const now = Date.now();
    return data.words.filter((w) => matchesQuery(w, query) && matchesFilter(w, filter, now));
  }, [data.words, filter, query]);

  return (
    <Screen>
      <Card>
        <TopBar title="生词本" onBack={() => navigate(ROUTES.today)} backLabel="今天的课" />
        {/*
          聚合数字。对不上账时**一个都不显示** —— 见文件头「删完要重新对账」。
        */}
        {aggregatesStale ? (
          <p data-testid="aggregates-stale" className="text-sm text-amber-800">
            那个词已经移出去了，但这些数字暂时对不上账 —— 刷新一下再看。
          </p>
        ) : (
          <p className="text-sm text-slate-600 mb-1">
            一共 <span data-testid="vocab-total" className="font-medium tabular-nums">{data.total}</span> 个词
            ·{' '}
            <span data-testid="vocab-due-count" className="tabular-nums">
              {data.dueCount}
            </span>{' '}
            个待复习
          </p>
        )}

        {/* 统计 —— 缺哪一项就不显示哪一项 */}
        {aggregatesStale ? null : stats ? (
          <div data-testid="vocab-stats" className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
            {stats.progress ? (
              <span data-testid="vocab-progress">
                已掌握 {stats.progress.mastered} · 学习中 {stats.progress.learning} · 待开始{' '}
                {stats.progress.untouched}
              </span>
            ) : null}
            {typeof stats.streakDays === 'number' ? (
              <span data-testid="vocab-streak">连续学习 {stats.streakDays} 天</span>
            ) : null}
            {typeof stats.reviewedToday === 'number' ? (
              <span data-testid="vocab-reviewed-today">今天复习 {stats.reviewedToday} 次</span>
            ) : null}
          </div>
        ) : (
          <p data-testid="stats-error" className="mt-2 text-sm text-amber-800">
            统计暂时取不到 —— 下面的词是全的。
          </p>
        )}

        {/* 两条自由练习，各自独立 */}
        <div className="mt-4 flex flex-col gap-2">
          <Link
            data-testid="go-practice"
            to={ROUTES.vocabPractice}
            className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-blue-600 underline"
          >
            开始复习到期的词 →
          </Link>
          <Link
            data-testid="go-selftest"
            to={ROUTES.vocabSelfTest}
            className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-blue-600 underline"
          >
            考考自己 →
          </Link>
        </div>

        {/* S12L —— 最小的一套「找得到」：按词头搜 + 四档筛选 */}
        {data.words.length > 0 ? (
          <div className="mt-5">
            <input
              data-testid="vocab-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜一个词"
              aria-label="按单词搜索"
              className="w-full min-h-[44px] rounded-xl border border-slate-300 px-4 py-2.5 text-base outline-none focus:border-blue-500"
            />
            <div role="group" aria-label="按状态筛选" className="mt-2 flex flex-wrap gap-2">
              {(['all', 'learning', 'due', 'mastered'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  data-testid={`vocab-filter-${f}`}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={`min-h-[44px] rounded-lg px-3 text-sm ${
                    filter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {VOCAB_FILTER_LABEL[f]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {data.words.length === 0 ? (
          <p data-testid="vocab-empty" className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            生词本还是空的 —— 做阅读答错的词会自动收进来。
          </p>
        ) : shown.length === 0 ? (
          <p data-testid="vocab-filter-empty" className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            这个条件下一个词都没有 —— 换个词试试，或者点「全部」。
          </p>
        ) : (
          <>
            <p className="mt-4 text-xs text-slate-500">
              显示 <span data-testid="vocab-shown-count">{shown.length}</span> / {data.words.length}
            </p>
            <ul className="mt-2 grid gap-2 lg:grid-cols-2">
              {shown.map((w) => (
                <WordRow key={w.headword} word={w} onRemoved={() => void reconcile(w.headword)} />
              ))}
            </ul>
          </>
        )}
      </Card>
    </Screen>
  );
}

type RemoveState =
  | { s: 'idle' }
  | { s: 'confirming' }
  | { s: 'sending' }
  | { s: 'failed' };

function WordRow({ word, onRemoved }: { word: VocabWordRow; onRemoved: () => void }) {
  const [rm, setRm] = useState<RemoveState>({ s: 'idle' });
  /** 连点守卫。同一个 tick 里连点两下，两次回调看到的都是上一帧的状态。 */
  const sendingRef = useRef(false);

  const confirm = useCallback(async () => {
    if (sendingRef.current) return;
    const token = readToken();
    if (!token) return;
    sendingRef.current = true;
    setRm({ s: 'sending' });
    try {
      await api.vocabWordRemove(token, { headword: word.headword });
      // **服务端确认之后**才动界面
      onRemoved();
    } catch (e) {
      sendingRef.current = false;
      if (handleAuthFailure(e)) return;
      setRm({ s: 'failed' });
    }
  }, [onRemoved, word.headword]);

  const due = dayOf(word.due);

  return (
    <li data-testid={`word-row-${word.headword}`} data-word-id={word.headword} className="rounded-xl bg-slate-50 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base font-medium">{word.headword}</span>
        {word.phonetic ? <span className="text-sm text-slate-500">{word.phonetic}</span> : null}
      </div>
      {word.translation ? <p className="mt-1 text-sm text-slate-700">{word.translation}</p> : null}
      <p className="mt-1 text-sm text-slate-500">
        <span data-testid={`word-state-${word.headword}`}>{stateLabel(word.state)}</span>
        {' · '}
        <span data-testid={`word-source-${word.headword}`}>{sourceLabel(word.sourceType)}</span>
        {due ? (
          <>
            {' · '}
            <span data-testid={`word-due-${word.headword}`} className="tabular-nums">
              {due} 复习
            </span>
          </>
        ) : null}
      </p>
      {word.contextSentence ? (
        <p data-testid={`word-context-${word.headword}`} className="mt-1 text-sm text-slate-600">
          {word.contextSentence}
        </p>
      ) : null}

      {rm.s === 'idle' ? (
        <button
          type="button"
          data-testid={`remove-${word.headword}`}
          onClick={() => setRm({ s: 'confirming' })}
          className="mt-2 min-h-[44px] px-3 rounded-lg border border-slate-300 text-sm text-slate-600"
        >
          移出生词本
        </button>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600">移出之后不会再复习到它。</span>
          <button
            type="button"
            data-testid={`confirm-remove-${word.headword}`}
            disabled={rm.s === 'sending'}
            onClick={() => void confirm()}
            className="min-h-[44px] px-3 rounded-lg bg-rose-600 text-white text-sm disabled:bg-slate-300"
          >
            {rm.s === 'sending' ? '移出中…' : '确认移出'}
          </button>
          <button
            type="button"
            data-testid={`cancel-remove-${word.headword}`}
            onClick={() => setRm({ s: 'idle' })}
            className="min-h-[44px] px-3 rounded-lg border border-slate-300 text-sm"
          >
            取消
          </button>
        </div>
      )}
      {rm.s === 'failed' ? (
        <p role="alert" data-testid={`remove-error-${word.headword}`} className="mt-1 text-sm text-rose-700">
          没能移出 —— 再试一次。
        </p>
      ) : null}
    </li>
  );
}

function BackToToday({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
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
