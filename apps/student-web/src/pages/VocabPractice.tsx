/**
 * `/vocab/practice` —— 生词本自由练习（阶段 12A）。
 *
 * ## 只吃一个端点
 *
 * `GET /vocab/due`，此外**不取任何卡**。拿不到就说拿不到 —— **绝不**退回
 * 课程队列（`/vocab/lesson-cards`）、自测（`/vocab/quiz`）或正式测试。
 * 那正是旧端的病：课程队列取不到时悄悄换成自由练习，学生以为在上今天的课，
 * 其实在刷另一个词表，课程完成度永远不动（G-9A 的由来）。这一屏是它的
 * 镜像面，同一条规矩反过来也要成立。
 *
 * ## 不碰课程进度
 *
 * 一次 `/lesson/*` 都没有 —— 尤其没有 `/lesson/vocab-cursor`。自由练习
 * 推进课程断点，等于学生自己刷本子把「今天的课」刷掉一格；那是最难解释、
 * 也最难撤回的一种数据污染。
 *
 * ## 评分的三条硬规矩
 *
 * **① `requestId` 在第一次尝试之前就定好，重发一直用同一个。**
 * 服务端对 `WordReviewLog.requestId` 有唯一约束，「POST 到了但响应丢了」
 * 的重发会拿到 `duplicate: true` —— 绝不会被算成两次复习。
 *
 * **② 没成功就不翻页。** 卡片翻过去了但 FSRS 什么都没记，是学生最没法
 * 察觉、也最挫败的失败：第二天同一个词又出现，他的结论是「系统坏了」。
 *
 * **③ 回执照搬。** 服务端说 `tooFast`（停留太短，没写调度）就照说，
 * 说 `duplicate` 也照说。把这两种情况显示成「记住了」，是在骗学生。
 *
 * ## 跳过不写
 *
 * 跳过就是「这张先不算」，一个请求都不发。它必须存在：没有跳过，学生遇到
 * 一张不想面对的卡就只能乱评一个分，那比跳过糟得多。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api,
  type PracticeRating,
  type VocabDueCard,
  type VocabReviewResult,
} from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { concealTarget } from '../lib/vocab-card';
import {
  elapsedSince,
  newRequestId,
  type PendingWrite,
} from '../components/vocab/practice-write';
import { Button, Card, Notice, Screen } from '../ui';

// ─────────────────────────────────────────────────────────────
// 纯逻辑（导出给测试直接驱动）
// ─────────────────────────────────────────────────────────────

/** 四档。顺序就是屏幕上的顺序 —— 从「完全不记得」到「太简单了」。 */
export const RATINGS: ReadonlyArray<{ key: PracticeRating; label: string }> = [
  { key: 'again', label: '不记得' },
  { key: 'hard', label: '有点难' },
  { key: 'good', label: '记住了' },
  { key: 'easy', label: '太简单' },
];

/**
 * 回执该怎么说。
 *
 * `tooFast` / `duplicate` **优先于**间隔 —— 那两种情况下服务端根本没写
 * 新调度，显示「下次 3 天后」就是编的。
 */
export function receiptLine(r: VocabReviewResult): string {
  if (r.tooFast) return '刚才太快了 —— 这次不算，下次还会遇到它。';
  if (r.duplicate) return '这条已经记过了（刚才那次其实成功了）。';
  return `记下了 —— 隔 ${r.intervalDays} 天再复习。`;
}

// ─────────────────────────────────────────────────────────────
// 页面
// ─────────────────────────────────────────────────────────────

type Phase =
  | { s: 'loading' }
  | { s: 'error'; message: string }
  | { s: 'ready'; cards: VocabDueCard[] };

/** 上一张评过的卡 —— 撤销要用。评分成功那一刻才写进来。 */
type LastGraded = { card: VocabDueCard; index: number };

export default function VocabPracticePage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });
  const [index, setIndex] = useState(0);
  const [revealedAt, setRevealedAt] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<VocabReviewResult | null>(null);
  const [last, setLast] = useState<LastGraded | null>(null);
  const [ratingError, setRatingError] = useState(false);
  const [undoError, setUndoError] = useState(false);

  /**
   * 待写入的那一次评分。**`requestId` 属于这次评分，不属于这次请求** ——
   * 重试时整个对象原样再发，所以 id 不变。
   */
  const pending = useRef<PendingWrite<PracticeRating> | null>(null);
  const busy = useRef(false);
  const gen = useRef(0);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    const mine = ++gen.current;
    setPhase({ s: 'loading' });
    try {
      const data = await api.vocabDue(token);
      if (mine !== gen.current) return;
      setIndex(0);
      setRevealedAt(null);
      setReceipt(null);
      setLast(null);
      setPhase({ s: 'ready', cards: data.cards ?? [] });
    } catch (e) {
      if (mine !== gen.current) return;
      if (handleAuthFailure(e)) return;
      setPhase({ s: 'error', message: '没能拿到要复习的词 —— 网络不太好，重试一下。' });
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      gen.current++;
    };
  }, [load]);

  const cards = phase.s === 'ready' ? phase.cards : [];
  const current = cards[index] ?? null;

  /** 遮掉例句里的目标词 —— 正面把答案印出来就没得练了。 */
  const masked = useMemo(
    () => (current ? concealTarget(current.contextSentence, current.headword, current.surfaceForm) : null),
    [current],
  );

  const advance = useCallback(() => {
    setIndex((i) => i + 1);
    setRevealedAt(null);
    setRatingError(false);
    pending.current = null;
  }, []);

  /** 发出（或重发）待写入的那一次评分。成功才翻页。 */
  const send = useCallback(async () => {
    const write = pending.current;
    if (!write) return;
    const token = readToken();
    if (!token) return;
    if (busy.current) return;
    busy.current = true;
    setRatingError(false);
    try {
      const r = await api.vocabPracticeReview(token, write);
      busy.current = false;
      setReceipt(r);
      setUndoError(false);
      setLast(current ? { card: current, index } : null);
      advance();
    } catch (e) {
      busy.current = false;
      if (handleAuthFailure(e)) return;
      // **留在原地**，`pending` 不清 —— 重试用同一个 requestId
      setRatingError(true);
    }
  }, [advance, current, index]);

  const rate = useCallback(
    (rating: PracticeRating) => {
      if (!current || busy.current) return;
      pending.current = {
        headword: current.headword,
        rating,
        elapsedMs: elapsedSince(revealedAt ?? Date.now(), Date.now()),
        requestId: newRequestId(),
      };
      void send();
    },
    [current, revealedAt, send],
  );

  const undo = useCallback(async () => {
    if (!last || busy.current) return;
    const token = readToken();
    if (!token) return;
    busy.current = true;
    setUndoError(false);
    try {
      await api.vocabReviewUndo(token, { headword: last.card.headword });
      busy.current = false;
      // **服务端确认之后**才把卡放回来
      setIndex(last.index);
      setRevealedAt(null);
      setReceipt(null);
      setLast(null);
    } catch (e) {
      busy.current = false;
      if (handleAuthFailure(e)) return;
      setUndoError(true);
    }
  }, [last]);

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
          <BackToVocab navigate={navigate} />
        </Card>
      </Screen>
    );
  }

  if (cards.length === 0) {
    return (
      <Screen>
        <Card>
          <h1 className="text-xl font-semibold mb-2">自由练习</h1>
          <p data-testid="practice-empty" className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            现在没有到期的词 —— 过一阵再来，或者去考考自己。
          </p>
          <BackToVocab navigate={navigate} />
        </Card>
      </Screen>
    );
  }

  if (!current) {
    return (
      <Screen>
        <Card>
          <h1 className="text-xl font-semibold mb-2">练完了 🎉</h1>
          <p data-testid="practice-done" className="text-sm text-slate-600">
            这一轮 {cards.length} 个词都过了一遍。
          </p>
          {receipt ? (
            <p data-testid="rating-receipt" className="mt-2 text-sm text-slate-500">
              {receiptLine(receipt)}
            </p>
          ) : null}
          {last ? (
            <>
              <button
                type="button"
                data-testid="undo"
                onClick={() => void undo()}
                className="mt-3 min-h-[44px] px-3 rounded-lg border border-slate-300 text-sm"
              >
                撤销上一个（{last.card.headword}）
              </button>
              {undoError ? (
                <p role="alert" data-testid="undo-error" className="mt-1 text-sm text-rose-700">
                  没能撤销 —— 再试一次。
                </p>
              ) : null}
            </>
          ) : null}
          <BackToVocab navigate={navigate} />
        </Card>
      </Screen>
    );
  }

  const revealed = revealedAt != null;

  return (
    <Screen>
      <Card>
        <p data-testid="practice-progress" className="text-sm text-slate-500 mb-2 tabular-nums">
          {index + 1} / {cards.length}
        </p>

        <h1 data-testid="card-headword" className="text-2xl font-semibold">
          {current.headword}
        </h1>
        {current.phonetic ? <p className="text-sm text-slate-500">{current.phonetic}</p> : null}

        {masked?.text ? (
          <p data-testid="card-context" className="mt-3 text-base text-slate-700 leading-relaxed">
            {masked.text}
          </p>
        ) : null}

        {revealed ? (
          <div data-testid="card-answer" className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-base text-slate-900">{current.translation || '（词典里没有释义）'}</p>
            {current.pos ? <p className="mt-1 text-sm text-slate-500">{current.pos}</p> : null}
            {current.definition ? (
              <p className="mt-1 text-sm text-slate-600">{current.definition}</p>
            ) : null}
          </div>
        ) : null}

        {!revealed ? (
          <div className="mt-5 flex flex-col gap-2">
            <Button onClick={() => setRevealedAt(Date.now())}>
              <span data-testid="reveal">看答案</span>
            </Button>
            <button
              type="button"
              data-testid="skip"
              onClick={advance}
              className="min-h-[44px] w-full rounded-xl border border-slate-300 py-3 text-sm text-slate-600"
            >
              跳过这个（不算）
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {RATINGS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  data-testid={`rate-${r.key}`}
                  onClick={() => rate(r.key)}
                  className="min-h-[44px] rounded-xl border border-slate-300 py-3 text-base"
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              data-testid="skip"
              onClick={advance}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-300 py-3 text-sm text-slate-600"
            >
              跳过这个（不算）
            </button>
          </>
        )}

        {ratingError ? (
          <>
            <p role="alert" data-testid="rating-error" className="mt-3 text-sm text-rose-700">
              没记上 —— 网络不太好。**这一张还没算**，再试一次。
            </p>
            <button
              type="button"
              data-testid="retry-rating"
              onClick={() => void send()}
              className="mt-2 min-h-[44px] px-4 rounded-xl bg-blue-600 text-white text-sm"
            >
              重试
            </button>
          </>
        ) : null}

        {receipt ? (
          <p data-testid="rating-receipt" className="mt-3 text-sm text-slate-500">
            {receiptLine(receipt)}
          </p>
        ) : null}

        {last ? (
          <>
            <button
              type="button"
              data-testid="undo"
              onClick={() => void undo()}
              className="mt-2 min-h-[44px] px-3 rounded-lg border border-slate-300 text-sm"
            >
              撤销上一个（{last.card.headword}）
            </button>
            {undoError ? (
              <p role="alert" data-testid="undo-error" className="mt-1 text-sm text-rose-700">
                没能撤销 —— 再试一次。
              </p>
            ) : null}
          </>
        ) : null}

        <BackToVocab navigate={navigate} />
      </Card>
    </Screen>
  );
}

function BackToVocab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <button
      type="button"
      data-testid="back-to-vocab"
      onClick={() => navigate(ROUTES.vocab)}
      className="mt-6 w-full rounded-xl border border-slate-300 py-3 text-base min-h-[44px]"
    >
      回到生词本
    </button>
  );
}
