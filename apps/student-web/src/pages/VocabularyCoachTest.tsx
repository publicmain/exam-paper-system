/**
 * 正式单词测试 / 自助抽查（审计 IOS-07 / VOC04 / VOC10 / VOC11）。
 *
 * ## 标清楚这是哪一份
 *
 * 页头写日期、新词几题、旧词抽查几题、共几题（冻结卷的数字，VOC06）；自助抽查写
 * 「个人练习，不记正式成绩」。
 *
 * ## 作答规则明说
 *
 * 选项题点一下就算作答，答了不能改 —— 这条规则写在题目上方，不让学生猜。答完每题先给对错
 * （只看得到这一题的答案），点「下一题」再继续；没答的题一个答案都拿不到（VOC04 由服务端
 * 白名单保证，这里不自己藏）。
 *
 * ## 听写题（VOC04）
 *
 * 题面里没有目标词：发音凭 sessionId + itemId 找服务端要，放不出来就说放不出来，**不退回
 * 系统语音**（那等于把答案念出来）。拼写题本来就不给发音。
 *
 * ## 造句题（VOC11）
 *
 * 只检查有没有像样地用上目标词，不评估语法和意思 —— 作答前、反馈、回顾都这么说，永远不说
 * 「句子正确」。
 *
 * ## 自助抽查的生命周期（VOC10）
 *
 * 退出前确认，确认后请服务端删掉这份临时卷；交卷后结果保留 2 小时，刷新还能看；过期了明说
 * 过期，给回「我的单词」的路。不写正式成绩、不进学习总数。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, type V2PublicQuestion, type V2TestSession } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { cleanTranslation, posPrefixFor } from '../lib/word-display';
import { playBlob } from '../lib/speak';
import { Button } from '../design/Button';
import { Dialog } from '../design/Dialog';
import { Icon } from '../design/Icon';
import { FocusHeader, FocusLayout } from '../design/Page';
import { InlineStatus, StatusView } from '../design/Status';
import { dayText } from './Today';

type Phase = { s: 'loading' } | { s: 'error'; expired: boolean; notFound: boolean } | { s: 'ready'; session: V2TestSession };
type TestItem = V2TestSession['items'][number];

/** 把一道题的标准答案翻成人话（选项题给选项文字，拼写题给单词）。 */
export function answerText(q: V2PublicQuestion): string {
  const a = q.answer;
  if (a == null) return '';
  if (typeof a === 'number') return q.options[a] ?? String(a);
  if (Array.isArray(a)) return a.join(' / ');
  return String(a);
}

export function responseText(item: TestItem): string {
  const v = item.response?.value;
  if (v == null) return '（没答）';
  if (typeof v === 'number') return item.question.options[v] ?? String(v);
  return String(v).trim() || '（没答）';
}

/** 页头的元信息：日期 · 新词几题 + 旧词抽查几题 · 共几题。 */
export function testMeta(s: V2TestSession): string {
  const practice = s.type === 'custom_test';
  const mix = !practice && s.newWords != null ? `新词 ${s.newWords}${s.reviewWords ? ` + 旧词抽查 ${s.reviewWords}` : ''} · ` : '';
  return `${practice ? '个人练习，不记正式成绩 · ' : ''}${mix}共 ${s.total} 题`;
}

export default function VocabularyCoachTestPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get('sessionId') ?? '';
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** 刚答完的那一题：先给对错，学生点「下一题」再往下走（2026-09-05 盲测 P1-8）。 */
  const [feedback, setFeedback] = useState<TestItem | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [exiting, setExiting] = useState(false);
  const startedAt = useRef(Date.now());
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    if (!sessionId) {
      setPhase({ s: 'error', expired: false, notFound: true });
      return;
    }
    setPhase({ s: 'loading' });
    try {
      setPhase({ s: 'ready', session: await api.vocabV2Test(token, sessionId) });
      startedAt.current = Date.now();
    } catch (error) {
      if (handleAuthFailure(error)) return;
      const code = error instanceof ApiError ? error.body?.code : undefined;
      setPhase({ s: 'error', expired: code === 'v2_practice_expired', notFound: code === 'v2_test_not_found' });
    }
  }, [sessionId]);
  useEffect(() => {
    void load();
  }, [load]);

  const session = phase.s === 'ready' ? phase.session : null;
  const practice = session?.type === 'custom_test';
  const item = useMemo(() => session?.items.find((candidate) => candidate.status !== 'answered') ?? null, [session]);
  const home = practice ? { label: '我的单词', to: ROUTES.vocab } : { label: '今日', to: ROUTES.today };

  const onError = (error: unknown, fallback: string) => {
    if (handleAuthFailure(error)) return;
    if (error instanceof ApiError && error.body?.code === 'v2_practice_expired') {
      setPhase({ s: 'error', expired: true, notFound: false });
      return;
    }
    setMessage(fallback);
  };

  const answer = async (response: string | number) => {
    const token = readToken();
    if (!token || !session || !item || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const next = await api.vocabV2Answer(token, { sessionId: session.id, itemId: item.id, response, responseMs: Date.now() - startedAt.current });
      setPhase({ s: 'ready', session: next });
      setValue('');
      startedAt.current = Date.now();
      setFeedback(next.items.find((candidate) => candidate.id === item.id) ?? null);
    } catch (error) {
      onError(error, '这题没有保存，你的答案还在，再提交一次。');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const submit = async () => {
    const token = readToken();
    if (!token || !session || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      setPhase({ s: 'ready', session: await api.vocabV2Submit(token, session.id) });
    } catch (error) {
      onError(error, '交卷没成功，答案都保存着，再点一次。');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  /** 自助抽查：退出 = 删掉这份临时卷（VOC10）。正式测试：直接回去，已答的都保存着。 */
  const leave = async () => {
    if (!practice || session?.status === 'submitted') {
      navigate(home.to);
      return;
    }
    const token = readToken();
    setExiting(true);
    try {
      if (token && session) await api.vocabV2CancelCustomTest(token, session.id);
    } catch (error) {
      if (handleAuthFailure(error)) return;
      // 删不掉也放人走：临时卷服务端 6 小时后自己清理
    }
    navigate(ROUTES.vocab);
  };

  const header = (title: string, meta?: string, trailing?: React.ReactNode) => (
    <FocusHeader
      backLabel={home.label}
      onBack={() => (practice && session?.status !== 'submitted' && session && session.answered > 0 ? setConfirmExit(true) : void leave())}
      title={title}
      meta={meta}
      trailing={trailing}
    />
  );

  if (phase.s === 'loading') {
    return (
      <FocusLayout header={<FocusHeader backLabel="今日" onBack={() => navigate(ROUTES.today)} title="单词测试" />}>
        <StatusView kind="loading" title="正在打开这份测试" />
      </FocusLayout>
    );
  }
  if (phase.s === 'error') {
    return (
      <FocusLayout header={<FocusHeader backLabel="我的单词" onBack={() => navigate(ROUTES.vocab)} title="单词测试" />}>
        {phase.expired ? (
          <StatusView
            kind="expired"
            title="这次抽查已经过期了"
            message="自助抽查是个人练习，结果只保留 2 小时，不记正式成绩。可以再抽一次。"
            secondary={<Button block onClick={() => navigate(ROUTES.vocab)}>回到我的单词</Button>}
          />
        ) : phase.notFound ? (
          <StatusView
            kind="notFound"
            title="没有找到这份测试"
            message="链接可能不完整。每天的测试都在「今日」和「我的单词」的待办里。"
            secondary={<Button block onClick={() => navigate(ROUTES.vocab)}>回到我的单词</Button>}
          />
        ) : (
          <StatusView kind="error" title="测试没打开" message="网络不太好。已经答过的题都保存着。" onRetry={() => void load()} />
        )}
      </FocusLayout>
    );
  }

  const s = phase.session;
  const title = practice ? '自助抽查' : `${dayText(s.date)} 单词测试`;

  // ── 交卷后：成绩 + 逐题回顾（答错的在前）──
  if (s.status === 'submitted') {
    const ordered = [...s.items].sort((a, b) => Number(a.isCorrect === true) - Number(b.isCorrect === true) || a.position - b.position);
    return (
      <FocusLayout
        header={header(title, testMeta(s))}
        testId="test-result"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button block variant={practice ? 'primary' : 'neutral'} onClick={() => navigate(ROUTES.vocab)}>回到我的单词</Button>
            <Button block variant={practice ? 'neutral' : 'primary'} onClick={() => navigate(ROUTES.today)}>回到今日</Button>
          </div>
        }
      >
        <section className="mb-5 text-center" aria-labelledby="test-score">
          <p className="text-callout text-ink-3">{practice ? '抽查结束' : '测试已交卷'}</p>
          <h1 id="test-score" className="mt-1 text-[2.75rem] font-bold tabular-nums text-ink" aria-label={`答对 ${s.correct} 题，共 ${s.total} 题`}>
            {s.correct} / {s.total}
          </h1>
          <p className="mt-1 text-callout text-ink-2">
            {practice ? '个人练习，不进正式成绩，也不改复习安排。结果保留 2 小时。' : '已经保存，记入这一天的单词测试。'}
          </p>
        </section>
        <ul data-testid="test-review" className="list-inset overflow-hidden rounded-group bg-surface" aria-label="逐题回顾">
          {ordered.map((it) => (
            <li key={it.id} className="px-4 py-3">
              <div className="flex items-start gap-2">
                <Icon name={it.isCorrect ? 'checkCircle' : 'close'} size={20} className={`mt-0.5 shrink-0 ${it.isCorrect ? 'text-success' : 'text-danger'}`} label={it.isCorrect ? '答对' : '答错'} />
                <div className="min-w-0">
                  <p>
                    <span className="text-headline text-ink" lang="en">{it.card?.headword ?? `第 ${it.position} 题`}</span>{' '}
                    {it.card ? (
                      <span className="text-callout text-ink-3">
                        {posPrefixFor(it.card.pos, it.card.translation)}
                        {cleanTranslation(it.card.translation).split('\n')[0]}
                      </span>
                    ) : null}
                  </p>
                  {it.check ? <p className="mt-0.5 text-footnote text-ink-3">{it.check.label}</p> : null}
                  {!it.isCorrect ? (
                    <p className="mt-0.5 text-callout text-ink-2">
                      你写的：{responseText(it)} · 正确答案：<span className="font-semibold text-ink">{answerText(it.question)}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </FocusLayout>
    );
  }

  const exitDialog = (
    <Dialog
      open={confirmExit}
      onClose={() => setConfirmExit(false)}
      title="退出这次抽查？"
      description="已经答的几题不会保存，这份抽查会删掉。它本来就不记正式成绩。"
      size="sm"
      busy={exiting}
      testId="exit-practice"
      footer={
        <>
          <Button variant="neutral" onClick={() => setConfirmExit(false)} disabled={exiting}>继续答</Button>
          <Button variant="destructive" busy={exiting} onClick={() => void leave()}>退出并删除</Button>
        </>
      }
    />
  );

  // ── 刚答完一题：对错反馈 ──
  if (feedback) {
    const more = s.items.some((it) => it.status !== 'answered');
    return (
      <FocusLayout
        header={header(title, testMeta(s), <Progress answered={s.answered} total={s.total} />)}
        testId="test-page"
        footer={
          <Button block onClick={() => setFeedback(null)} data-autofocus>
            {more ? '下一题' : practice ? '看回顾' : '去交卷'}
          </Button>
        }
      >
        <section aria-live="polite" className="rounded-group bg-surface p-5">
          <p data-testid="test-feedback" className={`flex items-center gap-2 text-title2 ${feedback.isCorrect ? 'text-success' : 'text-danger'}`}>
            <Icon name={feedback.isCorrect ? 'checkCircle' : 'close'} size={26} />
            {feedback.isCorrect ? '答对了' : '不对'}
          </p>
          {feedback.check ? <p data-testid="active-use-check" className="mt-2 text-callout text-ink-2">{feedback.check.label}</p> : null}
          {feedback.card ? (
            <p className="mt-3 text-title3 text-ink">
              <span lang="en">{feedback.card.headword}</span>{' '}
              <span className="text-body font-normal text-ink-3">
                {posPrefixFor(feedback.card.pos, feedback.card.translation)}
                {cleanTranslation(feedback.card.translation).split('\n')[0]}
              </span>
            </p>
          ) : null}
          {!feedback.isCorrect ? (
            <p className="mt-2 text-body text-ink-2">
              你写的：{responseText(feedback)}
              <br />
              正确答案：<span className="font-semibold text-ink">{answerText(feedback.question)}</span>
            </p>
          ) : null}
          {feedback.card?.sentence ? <p className="reading-prose mt-3 text-callout text-ink-2" lang="en">{feedback.card.sentence}</p> : null}
        </section>
        {exitDialog}
      </FocusLayout>
    );
  }

  // ── 都答完了：交卷（正式）/ 看回顾（抽查）──
  if (!item) {
    return (
      <FocusLayout header={header(title, testMeta(s))} testId="test-page">
        <StatusView
          kind="info"
          title="所有题都答完了"
          message={practice ? '点一下看逐题回顾。这是个人练习，不记正式成绩。' : `${s.total} 题都已保存，还没交卷。交卷后能看逐题回顾，成绩记入这一天的单词测试。`}
          secondary={
            <>
              {message ? <InlineStatus tone="error">{message}</InlineStatus> : null}
              <Button block busy={busy} onClick={() => void submit()}>{practice ? '看本次回顾' : '交卷'}</Button>
              <Button block variant="plain" onClick={() => (practice ? setConfirmExit(true) : navigate(ROUTES.vocab))}>
                {practice ? '不看了，退出抽查' : '先不交，回我的单词'}
              </Button>
            </>
          }
        />
        {exitDialog}
      </FocusLayout>
    );
  }

  const q = item.question;
  const typed = q.options.length === 0;
  return (
    <FocusLayout
      header={header(title, testMeta(s), <Progress answered={s.answered} total={s.total} />)}
      testId="test-page"
      footer={
        typed ? (
          <Button block type="submit" form="answer-form" busy={busy} disabled={!value.trim()}>
            提交这题
          </Button>
        ) : undefined
      }
    >
      <div
        role="progressbar"
        aria-label="答题进度"
        aria-valuemin={0}
        aria-valuemax={s.total}
        aria-valuenow={s.answered}
        className="mb-4 h-1.5 overflow-hidden rounded-full bg-fill"
      >
        <div className="h-full rounded-full bg-accent-fill" style={{ width: `${(s.answered / Math.max(1, s.total)) * 100}%` }} />
      </div>
      <section className="rounded-group bg-surface p-5" aria-labelledby="q-prompt">
        <p id="q-prompt" className="text-callout text-ink-2">
          {q.type === 'meaning_choice' ? '选出这个词的中文意思。' : q.prompt}
        </p>
        <QuestionCue question={q} sessionId={s.id} itemId={item.id} />
        {!typed ? (
          <>
            <p className="mt-4 text-footnote text-ink-3">点选即作答，答了不能改。</p>
            <div className="mt-2 grid gap-2" role="group" aria-labelledby="q-prompt">
              {q.options.map((option, index) => (
                <Button key={`${index}-${option}`} variant="neutral" size="lg" block disabled={busy} className="!justify-start text-left" onClick={() => void answer(index)}>
                  {option}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <form
            id="answer-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (value.trim() && !busy) void answer(value);
            }}
          >
            {q.type === 'active_use' ? (
              <>
                <label htmlFor="answer-input" className="sr-only">写一个包含目标词的完整英文句子</label>
                <textarea
                  id="answer-input"
                  autoFocus
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && value.trim()) {
                      event.preventDefault();
                      void answer(value);
                    }
                  }}
                  placeholder="写一个包含目标词的完整英文句子"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck
                  rows={3}
                  lang="en"
                  className="mt-4 min-h-[88px] w-full resize-none rounded-control border border-control bg-surface px-4 py-3 text-body text-ink"
                />
                <p data-testid="active-use-rule" className="mt-2 text-footnote text-ink-3">
                  只检查有没有用上这个词（或它的变形），不评判语法和意思。
                </p>
              </>
            ) : (
              <>
                <label htmlFor="answer-input" className="sr-only">输入答案</label>
                <input
                  id="answer-input"
                  autoFocus
                  type="text"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder="输入答案"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  lang="en"
                  className="mt-4 min-h-[52px] w-full rounded-control border border-control bg-surface px-4 py-3 text-title3 text-ink"
                />
              </>
            )}
          </form>
        )}
        {message ? (
          <div className="mt-3">
            <InlineStatus tone="error">{message}</InlineStatus>
          </div>
        ) : null}
      </section>
      {exitDialog}
    </FocusLayout>
  );
}

function Progress({ answered, total }: { answered: number; total: number }) {
  const n = Math.min(total, answered + 1);
  return (
    <span className="text-footnote tabular-nums text-ink-3" aria-label={`第 ${n} 题，共 ${total} 题`}>
      {n} / {total}
    </span>
  );
}

function QuestionCue({ question: q, sessionId, itemId }: { question: V2PublicQuestion; sessionId: string; itemId: string }) {
  if (q.type === 'meaning_choice') return <p className="mt-4 text-[2rem] font-semibold leading-tight text-ink" lang="en">{q.prompt}</p>;
  // 拼写题不给发音 —— 念一遍就等于把答案给他（2026-09-05 复测新发现 4；VOC04）
  if (q.type === 'spelling' || q.type === 'word_choice') {
    return (
      <div className="mt-4 rounded-control bg-surface-2 p-4">
        <p className="whitespace-pre-wrap text-title2 text-ink">{posPrefixFor(q.cue.pos, q.cue.translation)}{cleanTranslation(q.cue.translation)}</p>
      </div>
    );
  }
  if (q.type === 'cloze') {
    return (
      <div className="mt-4 rounded-control bg-surface-2 p-4">
        <p className="reading-prose text-title3 leading-8" lang="en">{q.cue.sentence}</p>
        {q.cue.translation ? <p className="mt-2 text-callout text-ink-3">{q.cue.translation}</p> : null}
      </div>
    );
  }
  if (q.type === 'listening_spelling') return <ItemAudio sessionId={sessionId} itemId={itemId} pos={q.cue.pos} />;
  if (q.type === 'active_use') {
    return (
      <div className="mt-4 rounded-control bg-surface-2 p-4">
        <p className="text-title1 text-ink" lang="en">{q.cue.headword}</p>
        <p className="mt-1 text-callout text-ink-3">{q.cue.translation}</p>
      </div>
    );
  }
  if (q.type === 'collocation') return <p className="mt-4 text-title1 text-ink" lang="en">{q.cue.headword}</p>;
  return (
    <div className="mt-4 rounded-control bg-surface-2 p-4">
      <p className="text-title1 text-ink" lang="en">{q.cue.headword}</p>
      <p className="mt-1 text-callout text-ink-3">写出另一个词族成员{posPrefixFor(q.cue.pos, '') ? `（${posPrefixFor(q.cue.pos, '').trim()}）` : ''}</p>
    </div>
  );
}

/** 听写题的音频：凭 sessionId + itemId 取（VOC04）。放不出来就说放不出来。 */
function ItemAudio({ sessionId, itemId, pos }: { sessionId: string; itemId: string; pos: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const cache = useRef<Blob | null>(null);
  useEffect(() => {
    cache.current = null;
    setState('idle');
  }, [itemId]);
  const play = async () => {
    const token = readToken();
    if (!token) return;
    setState('loading');
    try {
      cache.current = cache.current ?? (await api.vocabV2TestAudio(token, sessionId, itemId));
      setState((await playBlob(cache.current)) === 'audio' ? 'idle' : 'failed');
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setState('failed');
    }
  };
  return (
    <div className="mt-4">
      <Button block variant="secondary" icon="speaker" busy={state === 'loading'} data-testid="listening-play" onClick={() => void play()}>
        {state === 'loading' ? '正在加载发音…' : '播放发音'}
      </Button>
      {pos ? <p className="mt-2 text-footnote text-ink-3">词性：{posPrefixFor(pos, '').trim() || pos}</p> : null}
      {state === 'failed' ? (
        <div className="mt-2">
          <InlineStatus tone="warning" testId="listening-failed">这台设备现在放不出这道题的发音。可以再点一次；实在不行就按拼写作答。</InlineStatus>
        </div>
      ) : null}
    </div>
  );
}
