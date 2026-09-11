/**
 * 学词 → 背一背（审计 IOS-07 / VOC08 / VOC12 / UI02）。
 *
 * ## 一屏教清一个词
 *
 * 英文、发音、词性 + 核心中文、英文释义、短例句与中文；搭配 / 词族 / 易混词 / 记忆提示
 * 有可靠内容才显示，收在「更多」里，没有就不出现（不摆空的四宫格）。
 *
 * ## 三个动作，说清发生了什么
 *
 *   · 「学完这个词」—— 主动作。算学完，进今天的正式测试。
 *   · 「已会，换一个」—— 这个词记为会，换一个新词，总数不变。请求带**屏幕上这张卡**的
 *     senseId（UI02 / VOC02）：重试、双击都不会把刚换上来的新词再换掉。
 *   · 「稍后再学」—— 延后，不算学完、不进今天的测试，之后的新词里会再出现。
 * 每次动作后一句反馈，写明数量怎么变了。进度区把学完 / 延后 / 还剩分开写（VOC08）。
 *
 * ## 背一背：学完之后、开考之前（2026-09-10 叶老师）
 *
 * 学完最后一张卡不直接开考 —— 首发三天实测翻完到答第一题中位 30 秒，那是抄写。
 * 中文默认盖住；自己标过「有点难」的排前面；什么时候开考学生自己定，不设时间闸门。
 *
 * ## 回看（VOC12）
 *
 * 已经学完的那一天，再进来（刷新、次日、从待测任务点进来）都能看到**原来冻结的那批词**
 * （`GET /vocab-v2/daily/review`，只读）。不增加新学习量，也不重建测试：卷子已经生成就
 * 打开它，交过了就去看回顾。原来是一律送回首页。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, type V2Card, type V2DailyReview, type V2LearningSession } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { cleanDefinition, cleanTranslation, formatPhonetic, posPrefixFor } from '../lib/word-display';
import { playWord } from '../lib/speak';
import { Badge } from '../design/Badge';
import { Button } from '../design/Button';
import { Icon } from '../design/Icon';
import { FocusHeader, FocusLayout } from '../design/Page';
import { InlineStatus, StatusView } from '../design/Status';
import { dayText } from './Today';

const SOURCE_LABEL: Record<string, string> = {
  teacher_list: '老师布置',
  level_gap: '每日新词',
  daily_pushed: '每日新词',
};

type Loaded =
  | { s: 'loading' }
  | { s: 'error'; weekend: boolean }
  | { s: 'learning'; session: V2LearningSession }
  /** 学完了：背一背。`fresh` = 刚学完这一刻（来自学习会话）；否则来自只读回看 */
  | { s: 'recite'; review: ReciteData; fresh: boolean };

/** 背一背需要的：这一天冻结的学完词、延后词、测试指针。刚学完和回看两个来源拼成同一个形状。 */
export type ReciteData = {
  date: string;
  sessionId: string;
  learned: number;
  deferred: number;
  words: Array<{ id: string; action: string | null; position: number; card: V2Card }>;
  deferredWords: string[];
  test: { testSessionId: string | null; status: string; total: number | null; newWords: number | null; reviewWords: number | null; expectedNewWords?: number; reviewWordsMax?: number } | null;
};

export function reciteFromSession(s: V2LearningSession & { generatedTestId?: string | null; generatedTest?: { total: number; newWords: number; reviewWords: number } | null }): ReciteData {
  const learnedItems = s.items.filter((it) => it.status === 'completed');
  return {
    date: s.date,
    sessionId: s.id,
    learned: s.learned,
    deferred: s.deferred ?? s.items.filter((it) => it.status === 'skipped').length,
    words: learnedItems.map((it) => ({ id: it.id, action: it.action, position: it.position, card: it.card })),
    deferredWords: s.items.filter((it) => it.status === 'skipped').map((it) => it.card.headword),
    test: s.generatedTestId
      ? { testSessionId: s.generatedTestId, status: 'not_started', total: s.generatedTest?.total ?? null, newWords: s.generatedTest?.newWords ?? null, reviewWords: s.generatedTest?.reviewWords ?? null }
      : null,
  };
}

export function reciteFromReview(r: V2DailyReview): ReciteData {
  return {
    date: r.date,
    sessionId: r.sessionId,
    learned: r.learned,
    deferred: r.deferred,
    words: r.recite.map((it) => ({ id: it.id, action: it.action, position: it.position, card: it.card })),
    deferredWords: r.deferredWords,
    test: r.test
      ? { testSessionId: r.test.testSessionId, status: r.test.status, total: r.test.total, newWords: r.test.newWords, reviewWords: r.test.reviewWords, expectedNewWords: r.test.expectedNewWords, reviewWordsMax: r.test.reviewWordsMax }
      : null,
  };
}

/** 进度一句话：学完 / 延后 / 还剩分开写，不把跳过当学会（VOC08）。 */
export function progressText(s: { learned: number; deferred?: number; pending?: number; target: number; completed: number }): string {
  const deferred = s.deferred ?? Math.max(0, s.completed - s.learned);
  const pending = s.pending ?? Math.max(0, s.target - s.completed);
  return [`学完 ${s.learned}`, deferred ? `延后 ${deferred}` : '', `还剩 ${pending}`].filter(Boolean).join(' · ');
}

export default function VocabularyCoachLearnPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const taskDate = params.get('date') ?? undefined;
  const [phase, setPhase] = useState<Loaded>({ s: 'loading' });
  const [busy, setBusy] = useState<null | 'normal' | 'skip' | 'replace'>(null);
  const [note, setNote] = useState<{ tone: 'neutral' | 'error' | 'success'; text: string } | null>(null);
  const startedAt = useRef(Date.now());
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    setPhase({ s: 'loading' });
    setNote(null);
    try {
      const current = await api.vocabV2Daily(token, taskDate);
      // Nest 把「没有会话」序列化成空 200，客户端解析成 `{}` —— 只按 null 判会把它当成会话
      const session = current && Array.isArray(current.items) ? current : await api.vocabV2StartDaily(token, taskDate);
      if (session.status === 'completed' || session.items.every((it) => it.status !== 'pending')) {
        // VOC12：学完的那天进来 → 只读回看原来那批词，不送回首页
        // 回看接口取不到（老服务端 / 网络）就用手上的会话拼，照样能背
        const review = await api.vocabV2DailyReview(token, session.date).catch((e: unknown) => {
          if (e instanceof ApiError && e.isAuthFailure) throw e;
          return null;
        });
        setPhase({ s: 'recite', review: review && Array.isArray(review.recite) ? reciteFromReview(review) : reciteFromSession(session), fresh: false });
        return;
      }
      setPhase({ s: 'learning', session });
      startedAt.current = Date.now();
    } catch (error) {
      if (handleAuthFailure(error)) return;
      // 周末没有新词任务是规则，不是故障 —— 别用「无法生成」吓学生。
      const weekend = error instanceof ApiError && error.body?.code === 'v2_no_task_on_weekend';
      setPhase({ s: 'error', weekend });
    }
  }, [taskDate]);
  useEffect(() => {
    void load();
  }, [load]);

  const back = () => navigate(ROUTES.today);
  const titleFor = (date: string | undefined) => (taskDate && date ? `${dayText(date)} 新词` : '今天的新词');

  if (phase.s === 'loading') {
    return (
      <FocusLayout header={<FocusHeader backLabel="今日" onBack={back} title={titleFor(taskDate)} />}>
        <StatusView kind="loading" title="正在按你的进度准备词汇" />
      </FocusLayout>
    );
  }
  if (phase.s === 'error') {
    // 盲测（2026-09-05）：周末这一页原来只有一句红字和「重试」，没有回去的路。
    return (
      <FocusLayout header={<FocusHeader backLabel="今日" onBack={back} title={titleFor(taskDate)} />}>
        {phase.weekend ? (
          <StatusView
            kind="info"
            title="周六周日没有新词任务"
            message="周一再来。有欠着的任务可以在「今日」里补做。"
            secondary={<Button block onClick={() => navigate(ROUTES.today, { replace: true })}>回到今日</Button>}
          />
        ) : (
          <StatusView
            kind="error"
            title="今天的新词暂时没准备好"
            message="系统不会用低质量的词凑数。稍后重试一下。"
            onRetry={() => void load()}
            secondary={<Button block variant="neutral" onClick={() => navigate(ROUTES.today, { replace: true })}>回到今日</Button>}
          />
        )}
      </FocusLayout>
    );
  }

  if (phase.s === 'recite') {
    return <Recite data={phase.review} fresh={phase.fresh} note={note} backToToday={back} title={taskDate || !phase.fresh ? `${dayText(phase.review.date)} · 背一背` : '背一背'} />;
  }

  const session = phase.session;
  const item = session.items.find((candidate) => candidate.status === 'pending');
  if (!item) return null; // load() 已经把「全处理完」送去背一背

  const act = async (action: 'normal' | 'skip') => {
    const token = readToken();
    if (!token || busyRef.current) return;
    busyRef.current = true;
    setBusy(action);
    setNote(null);
    try {
      const next = await api.vocabV2LearnAction(token, { sessionId: session.id, itemId: item.id, action, responseMs: Date.now() - startedAt.current });
      const word = item.card.headword;
      const counts = progressText(next);
      const text = action === 'normal' ? `学完了 ${word}。${counts}` : `${word} 延后了，不算学完，之后的新词里还会出现。${counts}`;
      if (next.items.every((it) => it.status !== 'pending')) {
        // 学完最后一张：留在本页进「背一背」，不直接开考（2026-09-10）
        setNote({ tone: 'success', text });
        setPhase({ s: 'recite', review: reciteFromSession(next as Parameters<typeof reciteFromSession>[0]), fresh: true });
      } else {
        setPhase({ s: 'learning', session: next });
        setNote({ tone: action === 'normal' ? 'success' : 'neutral', text });
      }
      startedAt.current = Date.now();
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setNote({ tone: 'error', text: '进度没有保存，这个词还在。再试一次。' });
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const replace = async () => {
    const token = readToken();
    if (!token || busyRef.current) return;
    busyRef.current = true;
    setBusy('replace');
    setNote(null);
    try {
      const next = await api.vocabV2Replace(token, { sessionId: session.id, itemId: item.id, expectedSenseId: item.senseId });
      setPhase({ s: 'learning', session: next });
      startedAt.current = Date.now();
      setNote({ tone: 'neutral', text: `${next.replacement.oldHeadword} 记为已会，换成 ${next.replacement.newHeadword}。今天的总数不变。` });
    } catch (error) {
      if (handleAuthFailure(error)) return;
      const code = error instanceof ApiError ? error.body?.code : undefined;
      if (code === 'v2_item_changed') {
        // 这张卡已经不是屏幕上那张了（另一台设备换过 / 重试）—— 重新取，不猜
        setNote({ tone: 'neutral', text: '这张卡刚刚已经换过了，已更新到最新。' });
        void load();
        return;
      }
      setNote({
        tone: 'error',
        text: code === 'v2_replacement_exhausted'
          ? `没有符合你难度的新词可换了。${item.card.headword} 还在：可以学它，或者稍后再学。`
          : `没换成，${item.card.headword} 还在。再试一次。`,
      });
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const nth = session.items.filter((it) => it.status !== 'pending').length + 1;
  return (
    <FocusLayout
      testId="learn-page"
      header={
        <FocusHeader
          backLabel="今日"
          onBack={back}
          title={titleFor(session.date)}
          meta={<span data-testid="learn-progress">{progressText(session)}</span>}
          trailing={<span className="text-footnote tabular-nums text-ink-3" aria-label={`第 ${nth} 个，共 ${session.target} 个`}>{nth} / {session.target}</span>}
        />
      }
      footer={
        <div className="flex flex-col gap-2">
          <Button block busy={busy === 'normal'} disabled={busy !== null} onClick={() => void act('normal')}>
            学完这个词
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button block size="md" variant="neutral" busy={busy === 'replace'} disabled={busy !== null} onClick={() => void replace()}>
              已会，换一个
            </Button>
            <Button block size="md" variant="neutral" busy={busy === 'skip'} disabled={busy !== null} onClick={() => void act('skip')}>
              稍后再学
            </Button>
          </div>
        </div>
      }
    >
      <div
        role="progressbar"
        aria-label="今天的新词进度"
        aria-valuemin={0}
        aria-valuemax={session.target}
        aria-valuenow={session.target - (session.pending ?? session.items.filter((it) => it.status === 'pending').length)}
        className="mb-4 h-1.5 overflow-hidden rounded-full bg-fill"
      >
        <div className="h-full rounded-full bg-accent-fill transition-[width]" style={{ width: `${((nth - 1) / Math.max(1, session.target)) * 100}%` }} />
      </div>
      {note ? (
        <div className="mb-3" data-testid="learn-note">
          <InlineStatus tone={note.tone === 'error' ? 'error' : note.tone === 'success' ? 'success' : 'info'} role="status">
            {note.text}
          </InlineStatus>
        </div>
      ) : null}
      <WordCard card={item.card} source={SOURCE_LABEL[item.source] ?? null} accent={String(session.settings.audioAccent ?? 'en-GB')} />
    </FocusLayout>
  );
}

/** 一张学词卡：英文、发音、词性 + 中文、释义、例句；扩展内容有才显示，收在「更多」。 */
export function WordCard({ card, source, accent }: { card: V2Card; source: string | null; accent: string }) {
  const [more, setMore] = useState(false);
  const connections = [
    { label: '常见搭配', value: card.collocations.join(' · ') },
    { label: '词族', value: card.wordFamily.join(' · ') },
    { label: '易混词', value: card.confusionWords.join(' · ') },
    { label: '记忆提示', value: card.memoryHint ?? '' },
  ].filter((c) => c.value.trim().length > 0);
  const definition = cleanDefinition(card.definition);
  return (
    <article className="rounded-group bg-surface p-5 sm:p-6" aria-labelledby="word-headword">
      {source ? <Badge tone="accent">{source}</Badge> : null}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 id="word-headword" className="text-[2.5rem] font-semibold leading-tight tracking-tight sm:text-5xl" lang="en">
          {card.headword}
        </h1>
        <SpeakButton text={card.audioText || card.headword} accent={accent} label={`播放 ${card.headword} 的发音`} />
        {formatPhonetic(card.phonetic) ? <span className="text-callout text-ink-3">{formatPhonetic(card.phonetic)}</span> : null}
      </div>
      <p className="mt-4 whitespace-pre-wrap text-title3 text-ink">
        {posPrefixFor(card.pos, card.translation)}
        {cleanTranslation(card.translation)}
      </p>
      {definition ? (
        <p className="mt-2 text-callout leading-7 text-ink-2" lang="en">
          {definition}
        </p>
      ) : null}
      {card.sentence ? (
        <div className="mt-5 rounded-control bg-surface-2 p-4">
          <p className="reading-prose text-body leading-8" lang="en">
            {card.sentence}
          </p>
          {card.sentenceTranslation ? <p className="mt-2 text-callout text-ink-3">{card.sentenceTranslation}</p> : null}
        </div>
      ) : null}
      {card.imageUrl ? <img src={card.imageUrl} alt={`${card.headword} 的辅助图片`} className="mt-5 max-h-56 w-full rounded-control object-cover" /> : null}
      {connections.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore((m) => !m)}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-control px-1 text-callout text-accent hover:bg-accent-soft"
          >
            {more ? '收起' : `更多：${connections.map((c) => c.label).join('、')}`}
            <Icon name={more ? 'up' : 'down'} size={16} />
          </button>
          {more ? (
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              {connections.map((c) => (
                <div key={c.label} className="rounded-control bg-surface-2 p-3">
                  <dt className="text-caption font-semibold text-ink-3">{c.label}</dt>
                  <dd className="mt-1 text-callout text-ink-2">{c.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** 发音按钮：放得出来 / 用了系统语音 / 放不出来，按钮上说清楚（IOS-06 同一套）。 */
export function SpeakButton({ text, accent, label }: { text: string; accent: string; label: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');
  return (
    <button
      type="button"
      aria-label={state === 'failed' ? `${label}（这台设备放不出来）` : label}
      onClick={async () => {
        setState('loading');
        const r = await playWord(text, { lang: accent });
        setState(r === 'failed' ? 'failed' : 'idle');
      }}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full bg-accent-soft px-3 text-accent hover:brightness-[0.97]"
    >
      <Icon name="speaker" size={20} />
      {state === 'failed' ? <span className="text-caption">放不出来</span> : null}
    </button>
  );
}

/**
 * 「背一背」—— 学完之后、开考之前；也是回看入口（VOC12）。
 *
 * 中文默认盖住 —— 就是纸上用手盖住答案自己默的那个动作；自己标过「有点难」的排前面。
 * 只背真正学完的词（稍后再学的不考，也不背）。
 */
function Recite({ data, fresh, note, backToToday, title }: { data: ReciteData; fresh: boolean; note: { tone: string; text: string } | null; backToToday: () => void; title: string }) {
  const navigate = useNavigate();
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ordered = [...data.words].sort((a, b) => (a.action === 'hard' ? 0 : 1) - (b.action === 'hard' ? 0 : 1) || a.position - b.position);
  const allShown = ordered.length > 0 && ordered.every((row) => shown.has(row.id));
  const toggle = (id: string) =>
    setShown((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const test = data.test;
  const submitted = test?.status === 'submitted';
  const openTest = async () => {
    const token = readToken();
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      // 卷子已经在就打开它 —— 不重建（VOC06）；还没生成才请服务端生成
      const id = test?.testSessionId ?? (await api.vocabV2StartTest(token, data.sessionId)).id;
      navigate(`${ROUTES.coachTest}?sessionId=${encodeURIComponent(id)}`);
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setError('测试暂时打不开，回「今日」从待办进也可以。');
      setBusy(false);
    }
  };

  const header = (
    <FocusHeader
      backLabel="今日"
      onBack={backToToday}
      title={title}
      meta={`学完 ${data.learned} 个${data.deferred ? ` · 延后 ${data.deferred} 个` : ''}`}
    />
  );

  if (!ordered.length) {
    // 全部延后：没有学完的词，不需要测试（VOC08）；说清楚这些词去哪了
    return (
      <FocusLayout header={header} testId="recite-page">
        <StatusView
          kind="info"
          title="这批词都延后了"
          message={`${data.deferredWords.length ? `${data.deferredWords.join('、')} ` : ''}没有算学完，也不用考；之后的新词里还会再出现。`}
          secondary={<Button block onClick={() => navigate(ROUTES.today, { replace: true })}>回到今日</Button>}
        />
      </FocusLayout>
    );
  }

  const testSize = test?.total != null
    ? `${test.total} 题（新词 ${test.newWords ?? data.learned}${test.reviewWords ? ` + 旧词抽查 ${test.reviewWords}` : ''}）`
    : `今天学完的 ${data.learned} 个新词，另有最多 3 个以前学过的词抽查`;

  return (
    <FocusLayout
      header={header}
      testId="recite-page"
      footer={
        <div className="flex flex-col gap-2">
          {error ? <InlineStatus tone="error">{error}</InlineStatus> : null}
          {submitted ? (
            <Button block variant="secondary" onClick={() => navigate(`${ROUTES.coachTest}?sessionId=${encodeURIComponent(test!.testSessionId!)}`)}>
              看测试回顾
            </Button>
          ) : (
            <Button block busy={busy} onClick={() => void openTest()}>
              {test?.status === 'in_progress' ? '我背好了，继续测试' : '我背好了，开始测试'}
            </Button>
          )}
          <Button block variant="plain" size="md" onClick={() => navigate(ROUTES.today, { replace: true })}>
            {submitted ? '回到今日' : '先回今日，等下再测'}
          </Button>
        </div>
      }
    >
      {note && fresh ? (
        <div className="mb-3">
          <InlineStatus tone="success" role="status">
            {note.text}
          </InlineStatus>
        </div>
      ) : null}
      <section className="mb-4">
        <h1 className="text-title2 text-ink">{submitted ? '回看这一天学的词' : '先自己默一遍，再去测试'}</h1>
        <p className="mt-1 text-callout text-ink-2">
          {submitted ? '这一天的测试已经交了。这里只是回看，不算新的学习量。' : '中文先盖住了。看着英文想一下意思，想好了再点开对答案。'}
        </p>
        {!submitted ? (
          <p data-testid="recite-test-size" className="mt-1 text-callout text-ink-2">
            测试：{testSize}。
          </p>
        ) : null}
        <Button
          variant="plain"
          size="md"
          className="-ml-3 mt-1"
          onClick={() => setShown(allShown ? new Set() : new Set(ordered.map((row) => row.id)))}
        >
          {allShown ? '重新盖住全部' : '全部翻开'}
        </Button>
      </section>

      <ul className="list-inset overflow-hidden rounded-group bg-surface">
        {ordered.map((row) => {
          const card = row.card;
          const open = shown.has(row.id);
          return (
            <li key={row.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-title3 text-ink" lang="en">
                  {card.headword}
                </span>
                <SpeakButton text={card.audioText || card.headword} accent="en-GB" label={`播放 ${card.headword} 的发音`} />
                {formatPhonetic(card.phonetic) ? <span className="text-footnote text-ink-3">{formatPhonetic(card.phonetic)}</span> : null}
                {row.action === 'hard' ? <Badge tone="warning">刚才标了有点难</Badge> : null}
              </div>
              {open ? (
                <div className="mt-2">
                  <p className="text-body text-ink">
                    {posPrefixFor(card.pos, card.translation)}
                    {cleanTranslation(card.translation)}
                  </p>
                  {card.sentence ? (
                    <p className="reading-prose mt-1 text-callout leading-7 text-ink-2" lang="en">
                      {card.sentence}
                    </p>
                  ) : null}
                  <Button variant="plain" size="sm" className="-ml-3" onClick={() => toggle(row.id)}>
                    再盖上
                  </Button>
                </div>
              ) : (
                <Button block variant="neutral" size="md" className="mt-2" data-testid={`reveal-${card.headword}`} onClick={() => toggle(row.id)}>
                  点一下看中文
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {data.deferredWords.length ? (
        <p className="mt-3 px-1 text-footnote text-ink-3">
          延后的 {data.deferredWords.length} 个（{data.deferredWords.join('、')}）不算学完，也不进这次测试。
        </p>
      ) : null}
    </FocusLayout>
  );
}
