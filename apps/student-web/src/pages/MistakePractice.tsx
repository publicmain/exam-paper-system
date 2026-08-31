/**
 * `/mistakes/practice` —— 错题重练（阶段 12B）。
 *
 * ## 只吃一个端点
 *
 * `GET /vocab/mistakes/practice-queue`。**不碰**课程线、生词本、成绩线、
 * 正式测试 —— 它和「今天的课」里的错题段（`drill`）不是一回事：那一段算
 * 当天完成度，这一条是学生自己回来重做，不推进任何课程状态。
 *
 * ## 作答之前不许漏答案
 *
 * 响应里**本来就带着**正确答案、要点、范文、解析、证据句 —— 这是自由重练，
 * 不是考试，服务端不做遮挡（考试那条链才有 `stripUnreleasedScores`）。
 * 所以**遮挡是这一屏的责任**：作答（翻卡题是翻开）之前，这几样一个字都
 * 不进 DOM。做不到的话，「重练」就变成了「看一遍答案」。
 *
 * ## 这条写入没有幂等键
 *
 * `POST /vocab/mistakes/practice-result` 没有 `requestId`，服务端每收到
 * 一次就 `practiceCount + 1` 并重算连胜 —— **重发一次就等于多做对一次**，
 * 而「隔天连对两次自动销账」正是靠这个数。所以：
 *
 *   · 在途期间**不接受**下一题 / 跳过 / 再答；
 *   · 网络失败**绝不盲目重发** —— 先把队列读回来看这道题还在不在：
 *       还在 → 那次没记上，给一个**学生自己点**的重试；
 *       不在 → 那次记上了，给一个**不编数字**的回执（连胜与销账
 *              只能来自服务端，猜一个出来比不说更糟）；
 *       读也失败 → 停在这一题，只给「再查一次」，**不自动再写**。
 *
 * ## 连胜与销账照搬
 *
 * `correctStreak` / `resolved` 一律用回执里的，前端不自己推。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type MistakePracticeItem } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import {
  optionIsCorrect,
  optionLabel,
  reasonLabel,
  taskTypeLabel,
} from '../components/mistakes/answer-check';
import { Button, Card, Notice, Screen } from '../ui';

// ─────────────────────────────────────────────────────────────
// 页面
// ─────────────────────────────────────────────────────────────

type Phase =
  | { s: 'loading' }
  | { s: 'error'; message: string }
  | { s: 'ready'; items: MistakePracticeItem[]; remaining: number };

/**
 * 这一题的写入走到哪一步。
 *
 *   idle      还没作答
 *   sending   在途 —— 什么都不接受
 *   done      服务端确认了（有连胜回执）
 *   recorded  对账发现「其实记上了」—— **不编连胜**
 *   failed    确定没记上（`ok:false`，或对账时这题还在队列里）→ 可重试
 *   stuck     对账也失败 —— 只给「再查一次」，绝不自动重发
 */
type Write = 'idle' | 'sending' | 'done' | 'recorded' | 'failed' | 'stuck';

/** 本地判定 + 服务端回执。 */
type Answered = {
  correct: boolean;
  streak: { correctStreak: number; resolved: boolean } | null;
};

export default function MistakePracticePage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [write, setWrite] = useState<Write>('idle');
  /** 记进服务端的题数 —— 完成页用它算「还剩多少」，跳过的不算。 */
  const [recorded, setRecorded] = useState(0);

  const busy = useRef(false);
  const gen = useRef(0);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    const mine = ++gen.current;
    setPhase({ s: 'loading' });
    setIndex(0);
    setRevealed(false);
    setAnswered(null);
    setWrite('idle');
    setRecorded(0);
    try {
      const q = await api.mistakePracticeQueue(token);
      if (mine !== gen.current) return;
      setPhase({ s: 'ready', items: q.items ?? [], remaining: q.remaining ?? 0 });
    } catch (e) {
      if (mine !== gen.current) return;
      if (handleAuthFailure(e)) return;
      setPhase({ s: 'error', message: '没能拿到今天要重练的错题 —— 网络不太好，重试一下。' });
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      gen.current++;
    };
  }, [load]);

  const items = phase.s === 'ready' ? phase.items : [];
  const item = items[index] ?? null;

  /** 这一题落定了没有。**同步判据** —— 连点两下时状态还是上一帧的。 */
  const settled = () => !busy.current;
  /** 能不能往下走：还没答（跳过）或者已经落定（下一题）。 */
  const canLeave = write === 'idle' || write === 'done' || write === 'recorded';

  /** 把结果发给服务端。**只有这一个地方发**，而且从不自动重发。 */
  const submit = useCallback(
    async (id: string, correct: boolean) => {
      const token = readToken();
      if (!token) return;
      if (busy.current) return;
      busy.current = true;
      setWrite('sending');
      try {
        const r = await api.mistakePracticeResult(token, { id, correct });
        busy.current = false;
        if (!r || r.ok !== true) {
          // 服务端明说没记上 —— 这道题不是你的，或者已经不在了
          setWrite('failed');
          return;
        }
        setAnswered((a) => (a ? { ...a, streak: { correctStreak: r.correctStreak, resolved: r.resolved } } : a));
        setRecorded((n) => n + 1);
        setWrite('done');
      } catch (e) {
        busy.current = false;
        if (handleAuthFailure(e)) return;
        // **含糊的失败**：可能已经落库了。读回来看这道题还在不在。
        try {
          const q = await api.mistakePracticeQueue(token);
          const stillThere = (q.items ?? []).some((x) => x.id === id);
          if (stillThere) {
            setWrite('failed'); // 没记上 —— 让学生自己再点一次
          } else {
            setRecorded((n) => n + 1);
            setWrite('recorded'); // 记上了 —— 但**不编**连胜
          }
        } catch (e2) {
          if (handleAuthFailure(e2)) return;
          setWrite('stuck');
        }
      }
    },
    [],
  );

  /** 作答（选择式与翻卡自评共用）。 */
  const answer = useCallback(
    (correct: boolean) => {
      if (!item || answered || !settled()) return; // 一题只算一次
      setAnswered({ correct, streak: null });
      void submit(item.id, correct);
    },
    [answered, item, submit],
  );

  const next = useCallback(() => {
    if (!canLeave || !settled()) return;
    setIndex((i) => i + 1);
    setRevealed(false);
    setAnswered(null);
    setWrite('idle');
  }, [canLeave]);

  /** 「再查一次」—— **只读队列**，一个写都不发。 */
  const recheck = useCallback(async () => {
    if (!item || busy.current) return;
    const token = readToken();
    if (!token) return;
    busy.current = true;
    try {
      const q = await api.mistakePracticeQueue(token);
      busy.current = false;
      const stillThere = (q.items ?? []).some((x) => x.id === item.id);
      if (stillThere) {
        setWrite('failed');
      } else {
        setRecorded((n) => n + 1);
        setWrite('recorded');
      }
    } catch (e) {
      busy.current = false;
      if (handleAuthFailure(e)) return;
      setWrite('stuck');
    }
  }, [item]);

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
          <BackToMistakes navigate={navigate} />
        </Card>
      </Screen>
    );
  }

  if (items.length === 0) {
    return (
      <Screen>
        <Card>
          <h1 className="text-xl font-semibold mb-2">错题重练</h1>
          <p data-testid="practice-empty" className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            今天没有要重练的错题 —— 明天再来。
          </p>
          <BackToMistakes navigate={navigate} />
        </Card>
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen>
        <Card>
          <h1 className="text-xl font-semibold mb-2">这一轮练完了 🎉</h1>
          <p data-testid="practice-done" className="text-sm text-slate-600 tabular-nums">
            记下了 {recorded} 道
          </p>
          <p data-testid="remaining-after" className="mt-1 text-sm text-slate-500 tabular-nums">
            今天还剩 {Math.max(0, phase.remaining - recorded)} 道没练
          </p>
          <BackToMistakes navigate={navigate} />
        </Card>
      </Screen>
    );
  }

  const showAnswerMaterial = answered != null || revealed;
  const isReveal = item.practiceKind === 'reveal';

  return (
    <Screen>
      <Card>
        {/* S12I —— 把**这一轮**与**错题本总量**分开说。
            以前两个数字（`1 / 2` 与「今天还有 16 道」）挨在一起，
            看不出哪个是进度、哪个是库存。 */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-slate-500">
          <span data-testid="round-progress" className="tabular-nums">
            本轮第 {index + 1} / {items.length} 题
          </span>
          <span data-testid="book-remaining" className="tabular-nums">
            错题本仍有 {phase.remaining} 题
          </span>
        </div>
        {/* 旧 testid 保留：既有测试还认得它们。 */}
        <span data-testid="practice-progress" className="sr-only tabular-nums">
          {index + 1} / {items.length}
        </span>
        <span data-testid="remaining" className="sr-only tabular-nums">
          {phase.remaining}
        </span>

        <p className="mt-2 text-xs text-slate-500">
          {item.passageTitle} · {taskTypeLabel(item.taskType)} · {reasonLabel(String(item.reason))} · {item.quizDay}
        </p>

        <p data-testid="item-stem" className="mt-3 text-base text-slate-900 whitespace-pre-wrap leading-relaxed">
          {item.stem}
        </p>

        <PassageLocator passage={item.passage} evidence={item.evidence} />

        {/* ① 作答 —— 三种选择式共用一套按钮 */}
        {!isReveal ? (
          <ul className="mt-4 flex flex-col gap-2">
            {item.options.map((o, i) => (
              <li key={`${optionLabel(o)}-${i}`}>
                <button
                  type="button"
                  data-testid={`option-${i}`}
                  disabled={answered != null}
                  onClick={() => answer(optionIsCorrect(o, item.correctAnswer))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-4 py-3 text-left text-base disabled:opacity-60"
                >
                  {optionLabel(o)}
                </button>
              </li>
            ))}
          </ul>
        ) : !revealed ? (
          <div className="mt-4">
            <Button onClick={() => setRevealed(true)}>
              <span data-testid="reveal">想好了，看答案</span>
            </Button>
          </div>
        ) : answered == null ? (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              data-testid="self-wrong"
              onClick={() => answer(false)}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-300 py-3 text-base"
            >
              还没掌握
            </button>
            <button
              type="button"
              data-testid="self-correct"
              onClick={() => answer(true)}
              className="flex-1 min-h-[44px] rounded-xl border border-slate-300 py-3 text-base"
            >
              我答对了
            </button>
          </div>
        ) : null}

        {/* ② 判定 */}
        {answered ? (
          <p data-testid="verdict" className="mt-4 text-base font-medium">
            {answered.correct ? '答对了' : '答错了'}
          </p>
        ) : null}

        {/* ③ 答案材料 —— **作答或翻卡之后**才出现 */}
        {showAnswerMaterial ? (
          <div className="mt-2 flex flex-col gap-1 text-sm">
            {item.correctAnswer ? (
              <p>
                <span className="text-slate-500">正确答案：</span>
                <span data-testid="correct-answer" className="font-medium">
                  {item.correctAnswer}
                </span>
              </p>
            ) : null}
            {item.answerPoints.length > 0 ? (
              <p data-testid="answer-points" className="text-slate-700">
                <span className="text-slate-500">要点：</span>
                {item.answerPoints.join(' · ')}
              </p>
            ) : null}
            {item.answerModel ? (
              <p data-testid="answer-model" className="text-slate-700">
                <span className="text-slate-500">参考范文：</span>
                {item.answerModel}
              </p>
            ) : null}
            {item.explanation ? (
              <p data-testid="explanation" className="text-slate-600">
                {item.explanation}
              </p>
            ) : null}
            {item.evidence ? (
              <p data-testid="evidence" className="text-slate-600">
                <span className="text-slate-500">原文依据：</span>
                {item.evidence}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ④ 反馈里才给「你当时写的」与老师评语 */}
        {answered ? (
          <div className="mt-2 flex flex-col gap-1 text-sm">
            <p>
              <span className="text-slate-500">你当时写的：</span>
              <span data-testid="old-answer" className="font-medium">
                {item.myOldAnswer.trim() ? item.myOldAnswer : '（空着）'}
              </span>
            </p>
            {item.markerComment ? (
              <p data-testid="marker-comment" className="bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-slate-500">老师评语：</span>
                {item.markerComment}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ⑤ 写入状态 —— 服务端说了算 */}
        {write === 'done' && answered?.streak ? (
          <p data-testid="streak-receipt" className="mt-3 text-sm text-slate-600">
            记下了 —— 连对 {answered.streak.correctStreak} 次
            {answered.streak.resolved ? '，这道题算弄懂了 🎉' : ''}
          </p>
        ) : null}
        {write === 'recorded' ? (
          <p data-testid="recorded-receipt" className="mt-3 text-sm text-slate-600">
            这次已经记到服务端了。
          </p>
        ) : null}
        {write === 'failed' ? (
          <>
            <p role="alert" data-testid="result-error" className="mt-3 text-sm text-rose-700">
              这一次**没有**记上 —— 再试一次。
            </p>
            <button
              type="button"
              data-testid="retry-result"
              onClick={() => void submit(item.id, answered?.correct ?? false)}
              className="mt-1 min-h-[44px] px-4 rounded-xl bg-blue-600 text-white text-sm"
            >
              重试
            </button>
          </>
        ) : null}
        {write === 'stuck' ? (
          <>
            <p role="alert" data-testid="result-stuck" className="mt-3 text-sm text-amber-800">
              现在不确定这一次记上了没有 —— 先查一下，别重复提交。
            </p>
            <button
              type="button"
              data-testid="recheck"
              onClick={() => void recheck()}
              className="mt-1 min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm"
            >
              再查一次
            </button>
          </>
        ) : null}

        {/* ⑥ 往下走。**跳过只在还没作答时存在** */}
        {answered == null ? (
          <button
            type="button"
            data-testid="skip"
            onClick={next}
            className="mt-4 min-h-[44px] w-full rounded-xl border border-slate-300 py-3 text-sm text-slate-600"
          >
            跳过这道（不算）
          </button>
        ) : (
          <Button disabled={!canLeave} onClick={next}>
            <span data-testid="next">下一题</span>
          </Button>
        )}

        <BackToMistakes navigate={navigate} />
      </Card>
    </Screen>
  );
}

/**
 * 「查看原文并定位」—— **默认收起，而且绝不瞎标**。
 *
 * 证据句只有在它是原文的**精确子串**时才高亮那一处；没存证据句、
 * 或者存的那句在原文里对不上，就**如实说定位没有存下来**，把完整
 * 原文给他。模糊匹配猜一个位置比不标更坏 —— 学生会以为那就是出处。
 *
 * （全仓库都没有写入 `answerContent.evidence` 的地方，所以现阶段几乎
 * 总是走「如实说明」那一支 —— 这正是它该有的样子。）
 */
function PassageLocator({ passage, evidence }: { passage: string; evidence: string }) {
  const [open, setOpen] = useState(false);
  const body = (passage ?? '').trim();
  if (!body) return null;
  const quote = (evidence ?? '').trim();
  const at = quote ? body.indexOf(quote) : -1;
  return (
    <section className="mt-3">
      <button
        type="button"
        data-testid="locate-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="min-h-[44px] text-sm text-blue-600 underline"
      >
        {open ? '收起原文' : '查看原文并定位'}
      </button>
      {open ? (
        <>
          {at < 0 ? (
            <p data-testid="locate-note" className="mt-2 text-xs text-slate-500">
              这道题没有存下证据句的位置，下面是完整原文。
            </p>
          ) : null}
          <div
            data-testid="locate-body"
            className="mt-2 max-h-64 overflow-y-auto overflow-x-hidden break-words rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed"
          >
            {at >= 0 ? (
              <>
                {body.slice(0, at)}
                <mark data-testid="evidence-mark" className="bg-amber-100 px-0.5 rounded">
                  {body.slice(at, at + quote.length)}
                </mark>
                {body.slice(at + quote.length)}
              </>
            ) : (
              body
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

function BackToMistakes({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <button
      type="button"
      data-testid="back-to-mistakes"
      onClick={() => navigate(ROUTES.mistakes)}
      className="mt-6 w-full rounded-xl border border-slate-300 py-3 text-base min-h-[44px]"
    >
      回到错题本
    </button>
  );
}
