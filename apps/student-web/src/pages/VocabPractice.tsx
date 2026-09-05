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
 * **② 没成功就不翻页 —— 而且是整屏闭锁。** 卡片翻过去了但 FSRS 什么都没记，
 * 是学生最没法察觉、也最挫败的失败：第二天同一个词又出现，他的结论是
 * 「系统坏了」。
 *
 * 光让「评分按钮」等一等是不够的（返工 1/2 B-1）：写入在路上时，**跳过**
 * 同样能把卡翻过去 —— 于是那次写入和界面脱了钩，迟到的成功又翻一次
 * （一次评分吃掉两张卡），迟到的失败则挂在一张已经不在屏幕上的卡上，
 * 「重试」什么都不会发。所以规矩是：**评过分之后，只有服务端成功能往下走**；
 * 在途与失败两种状态下，跳过和评分一律不接受。评分之前的跳过一切照旧。
 *
 * **「撤销上一个」也算翻页**（返工 2/2）：它把屏幕换成上一张，而 `pending`
 * 绑的是这一张 —— 这一张失败时允许撤销，错误提示、可见的词、重试要发的词
 * 会指向三个不同的东西。所以这三个动作（跳过 / 评分 / 撤销）**共用同一个
 * 同步判据 `settled()`**，一个都不能只靠按钮变灰。
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
import { Button, Card, Notice, Screen, TopBar } from '../ui';
import { formatPhonetic, posPrefixFor } from '../lib/word-display';

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
  const [undoError, setUndoError] = useState(false);

  /**
   * 这张卡的写入走到哪一步了。
   *
   * `idle` 之外的任何状态都**闭锁这张卡**：不接受跳过、不接受再评一次。
   * 用状态（而不是只用 ref）是因为按钮要真的变灰 —— 一个点了没反应的
   * 按钮，学生只会再点几下。
   */
  const [writeState, setWriteState] = useState<'idle' | 'sending' | 'failed'>('idle');

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

  // ── S12I —— **没教过的词先教，再考** ──
  //
  // 服务端已经告诉我们 `needsFirstTeaching`（判据见 api 的
  // `first-teaching.ts`），以前这一屏根本没用它 —— 于是第一次见面的词
  // 直接进了「想不想得起来」那一套。
  //
  // **稳定分区**：教学卡在前、复习卡在后，**组内保持服务端顺序**。
  // 不过滤、不去重、不重排组内顺序 —— 发卡总数与每张卡都不变。
  const cards = useMemo(() => {
    const all = phase.s === 'ready' ? phase.cards : [];
    const teach = all.filter((c) => c.needsFirstTeaching);
    const review = all.filter((c) => !c.needsFirstTeaching);
    return [...teach, ...review];
  }, [phase]);
  const current = cards[index] ?? null;

  /**
   * 这一场里已经点过「我看过了」的词。
   *
   * **纯本地 UI 状态，不发任何请求**。真正写库的只有后面那一次
   * 正常评分（`/vocab/review`）。用 headword 做键：撤销跳回上一张时
   * 不会又被教一遍。
   */
  const [acked, setAcked] = useState<readonly string[]>([]);
  const teaching = current != null && current.needsFirstTeaching && !acked.includes(current.headword);

  /** 遮掉例句里的目标词 —— 正面把答案印出来就没得练了。 */
  const masked = useMemo(
    () => (current ? concealTarget(current.contextSentence, current.headword, current.surfaceForm) : null),
    [current],
  );

  /**
   * 这张卡还能不能动。
   *
   * 判据用的是 **`pending` 这个 ref**，不是 `writeState` 那个状态：
   * 同一个 tick 里连点两下时，第二次回调看到的状态还是上一帧的，
   * 只有 ref 是同步生效的。状态那份是给按钮变灰用的。
   */
  const settled = () => pending.current == null && !busy.current;

  /**
   * 界面上的闭锁（按钮变灰）。同步判据见上面的 `settled()`。
   *
   * 声明在这里而不是渲染分支旁边：完成页那一支是**提前 return** 的，
   * 它里面也有一个撤销按钮 —— 声明放在它后面会踩进暂时性死区，
   * 整个组件直接抛错（返工 2/2 的第一版就是这么错的）。
   */
  const locked = writeState !== 'idle';

  const advance = useCallback(() => {
    setIndex((i) => i + 1);
    setRevealedAt(null);
    setWriteState('idle');
    pending.current = null;
  }, []);

  /** 跳过 —— **只在还没评分的时候**可用（见文件头第 ② 条）。 */
  const skip = useCallback(() => {
    if (!settled()) return;
    advance();
  }, [advance]);

  /** 发出（或重发）待写入的那一次评分。**成功才翻页。** */
  const send = useCallback(async () => {
    const write = pending.current;
    if (!write) return;
    const token = readToken();
    if (!token) return;
    if (busy.current) return;
    busy.current = true;
    setWriteState('sending');
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
      // **留在原地**，`pending` 不清 —— 重试用同一个 requestId，
      // 而且这张卡仍然是闭锁的（`pending` 非空 → `settled()` 为假）。
      setWriteState('failed');
    }
  }, [advance, current, index]);

  const rate = useCallback(
    (rating: PracticeRating) => {
      if (!current || !settled()) return;
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

  /**
   * 撤销上一张。
   *
   * **它也是一个「翻页」动作**，所以和跳过 / 评分共用同一个同步判据
   * （返工 2/2）：`last` 指的是**上一张**，而 `pending` 绑的是**这一张**。
   * 这一张的写入还没落定就允许撤销，屏幕会跳回上一张，可重试的载荷却还是
   * 这一张的 —— 错误提示、可见的词、重试要发的词，三者指向三个不同的东西。
   *
   * 只查 `busy.current` 挡不住这一条：评分失败时 `busy` 已经复位了，
   * 闭锁的证据在 `pending` 上。
   */
  const undo = useCallback(async () => {
    if (!last || !settled()) return;
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
                disabled={locked}
                onClick={() => void undo()}
                className="mt-3 min-h-[44px] px-3 rounded-lg border border-slate-300 text-sm disabled:opacity-50"
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

  if (teaching) {
    return (
      <Screen>
        <Card>
          {/* S12L —— 返回挪到顶部；原来只有页面最底下才有一个 */}
          <TopBar onBack={() => navigate(ROUTES.vocab)} backLabel="生词本" />
          <p data-testid="practice-progress" className="text-sm text-slate-500 mb-2 tabular-nums">
            {index + 1} / {cards.length}
          </p>
          <TeachingCard card={current} onAck={() => setAcked((a) => [...a, current.headword])} />
          <BackToVocab navigate={navigate} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <p data-testid="practice-progress" className="text-sm text-slate-500 mb-2 tabular-nums">
          {index + 1} / {cards.length}
        </p>

        <div data-testid="review-card">
        <p data-testid="card-mode" className="mb-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          复习
        </p>

        <h1 data-testid="card-headword" className="text-2xl font-semibold">
          {current.headword}
        </h1>
        {formatPhonetic(current.phonetic) ? <p className="text-sm text-slate-500">{formatPhonetic(current.phonetic)}</p> : null}

        {masked?.text ? (
          <p data-testid="card-context" className="mt-3 text-base text-slate-700 leading-relaxed">
            {masked.text}
          </p>
        ) : null}

        {revealed ? (
          <div data-testid="card-answer" className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-base text-slate-900">{current.translation || '（词典里没有释义）'}</p>
            {posPrefixFor(current.pos, '') ? <p className="mt-1 text-sm text-slate-500">{posPrefixFor(current.pos, '').trim()}</p> : null}
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
              disabled={locked}
              onClick={skip}
              className="min-h-[44px] w-full rounded-xl border border-slate-300 py-3 text-sm text-slate-600 disabled:opacity-50"
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
                  disabled={locked}
                  onClick={() => rate(r.key)}
                  className="min-h-[44px] rounded-xl border border-slate-300 py-3 text-base disabled:opacity-50"
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              data-testid="skip"
              disabled={locked}
              onClick={skip}
              className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-300 py-3 text-sm text-slate-600 disabled:opacity-50"
            >
              跳过这个（不算）
            </button>
          </>
        )}

        {writeState === 'failed' ? (
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
              disabled={locked}
              onClick={() => void undo()}
              className="mt-2 min-h-[44px] px-3 rounded-lg border border-slate-300 text-sm disabled:opacity-50"
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
        </div>

        <BackToVocab navigate={navigate} />
      </Card>
    </Screen>
  );
}

/**
 * 教学卡 —— **摊开给人看**。
 *
 * 不遮词、不让猜、没有评分按钮。第一次见这个词的人被要求
 * 「评价自己记得多牢」是没有意义的。
 *
 * 「我看过了」**不发请求** —— 它只把同一个词切到回忆模式，
 * 真正写库的只有随后那一次正常评分。
 */
function TeachingCard({
  card,
  onAck,
}: {
  card: VocabDueCard;
  onAck: () => void;
}) {
  const target = (card.surfaceForm || card.headword || '').trim();
  const sentence = card.contextSentence ?? '';
  // **只在精确命中时才标** —— 匹配不上就原句照旧显示，
  // 绝不模糊猜一个位置出来。
  const at = target ? sentence.toLowerCase().indexOf(target.toLowerCase()) : -1;
  return (
    <section data-testid="teaching-card">
      <p
        data-testid="card-mode"
        className="mb-1 inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
      >
        学习
      </p>
      <h1 className="text-2xl font-semibold">{card.headword}</h1>
      {formatPhonetic(card.phonetic) ? <p className="text-sm text-slate-500">{formatPhonetic(card.phonetic)}</p> : null}
      <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3">
        <p className="text-base text-slate-900">
          {card.translation || card.definition || '（词典里没有释义）'}
        </p>
        {posPrefixFor(card.pos, '') ? <p className="mt-1 text-sm text-slate-500">{posPrefixFor(card.pos, '').trim()}</p> : null}
        {card.translation && card.definition ? (
          <p className="mt-1 text-sm text-slate-600">{card.definition}</p>
        ) : null}
      </div>
      {sentence ? (
        <p data-testid="teaching-context" className="mt-3 text-base leading-relaxed text-slate-700">
          {at >= 0 ? (
            <>
              {sentence.slice(0, at)}
              <mark data-testid="teaching-highlight" className="bg-amber-100 px-0.5 rounded">
                {sentence.slice(at, at + target.length)}
              </mark>
              {sentence.slice(at + target.length)}
            </>
          ) : (
            sentence
          )}
        </p>
      ) : null}
      {card.contextTranslation ? (
        <p data-testid="teaching-context-translation" className="mt-2 text-sm leading-relaxed text-slate-600">
          句意：{card.contextTranslation}
        </p>
      ) : null}
      {card.sourcePassageTitle ? (
        <p className="mt-2 text-xs text-slate-400">来自：{card.sourcePassageTitle}</p>
      ) : null}
      <div className="mt-5">
        <Button onClick={onAck}>
          <span data-testid="teaching-ack">我看过了，开始记忆</span>
        </Button>
      </div>
    </section>
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
