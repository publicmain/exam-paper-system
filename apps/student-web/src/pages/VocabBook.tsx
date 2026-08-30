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
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Button, Card, Notice, Screen } from '../ui';

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

// ─────────────────────────────────────────────────────────────
// 页面
// ─────────────────────────────────────────────────────────────

type Phase =
  | { s: 'loading' }
  | { s: 'error'; message: string }
  /** `stats` 为 null = 统计那一次取失败了（词表照常显示）。 */
  | { s: 'ready'; data: VocabWordsResult; stats: VocabStats | null };

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
        // 统计失败**不**走 handleAuthFailure：词表刚刚才成功，说明票是好的；
        // 真掉票了下一次交互自然会撞上。这里只是少显示几个数字。
        stats = null;
      }
      if (mine !== gen.current) return;
      setPhase({ s: 'ready', data, stats });
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

  /** 本地摘掉一行 —— **只在服务端确认删除之后**调用。 */
  const dropRow = useCallback((headword: string) => {
    setPhase((p) => {
      if (p.s !== 'ready') return p;
      const words = p.data.words.filter((w) => w.headword !== headword);
      const removed = p.data.words.length - words.length;
      return {
        ...p,
        data: {
          ...p.data,
          words,
          total: Math.max(0, p.data.total - removed),
          dueCount: p.data.dueCount,
        },
      };
    });
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

  const { data, stats } = phase;

  return (
    <Screen>
      <Card>
        <h1 className="text-xl font-semibold mb-1">生词本</h1>
        <p className="text-sm text-slate-600 mb-1">
          一共 <span data-testid="vocab-total" className="font-medium tabular-nums">{data.total}</span> 个词
          ·{' '}
          <span data-testid="vocab-due-count" className="tabular-nums">
            {data.dueCount}
          </span>{' '}
          个待复习
        </p>

        {/* 统计 —— 缺哪一项就不显示哪一项 */}
        {stats ? (
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

        {data.words.length === 0 ? (
          <p data-testid="vocab-empty" className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            生词本还是空的 —— 做阅读答错的词会自动收进来。
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2">
            {data.words.map((w) => (
              <WordRow key={w.headword} word={w} onRemoved={() => dropRow(w.headword)} />
            ))}
          </ul>
        )}

        <BackToToday navigate={navigate} />
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
