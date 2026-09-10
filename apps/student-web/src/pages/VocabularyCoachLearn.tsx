import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, type V2LearningSession } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { Button, Card, Notice, Screen, TopBar } from '../ui';
import { cleanTranslation, formatPhonetic, posPrefixFor } from '../lib/word-display';

const SOURCE_LABEL: Record<string, string> = {
  teacher_list: '老师布置', level_gap: '每日新词',
};

type Phase = { s: 'loading' } | { s: 'error'; message: string; weekend?: boolean } | { s: 'ready'; session: V2LearningSession };

export default function VocabularyCoachLearnPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const taskDate = params.get('date') ?? undefined;
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    setPhase({ s: 'loading' });
    try {
      const current = await api.vocabV2Daily(token, taskDate);
      // Nest serializes a missing daily session as an empty 200 response.  The
      // shared client intentionally parses an empty success body as `{}`, so a
      // nullish-only check would mistake that object for a real session and the
      // render path would crash on `session.items.find(...)`.
      const session = current && Array.isArray(current.items)
        ? current
        : await api.vocabV2StartDaily(token, taskDate);
      // 「背一背」只在**刚学完那一刻**出现（见 update）。事后再回到这一页
      // ——考完了按浏览器后退、或者直接敲地址——仍旧送回首页，那里的待办卡
      // 才知道这份测试到底交没交。
      if (session.status === 'completed') {
        navigate(ROUTES.today, { replace: true });
        return;
      }
      setPhase({ s: 'ready', session });
      startedAt.current = Date.now();
    } catch (error) {
      if (handleAuthFailure(error)) return;
      // 周末没有新词任务是规则，不是故障 —— 别用「无法生成」吓学生。
      const weekend = error instanceof ApiError && error.body?.code === 'v2_no_task_on_weekend';
      setPhase({
        s: 'error',
        weekend,
        message: weekend
          ? '周六周日没有新词任务，周一再来。有欠着的任务可以在首页补做。'
          : '今天的词汇任务暂时无法生成。系统不会用低质量词凑数，请稍后重试。',
      });
    }
  }, [navigate, taskDate]);
  useEffect(() => { void load(); }, [load]);

  if (phase.s === 'loading') return <Screen><p className="text-center text-slate-500">正在按你的进度准备词汇…</p></Screen>;
  if (phase.s === 'error') {
    // 盲测（2026-09-05）：周末这一页只有一句红字和「重试」，没有回去的路。
    return (
      <Screen>
        <Card>
          <Notice kind={phase.weekend ? 'info' : 'error'}>{phase.message}</Notice>
          <div className="mt-4 grid gap-2">
            {!phase.weekend && <Button onClick={() => void load()}>重试</Button>}
            <Button onClick={() => navigate(ROUTES.today, { replace: true })}>回首页</Button>
          </div>
        </Card>
      </Screen>
    );
  }

  const session = phase.session;
  const item = session.items.find((candidate) => candidate.status === 'pending');
  const update = async (action: 'mastered' | 'normal' | 'hard' | 'skip') => {
    const token = readToken();
    if (!token || !item || busy) return;
    setBusy(true); setMessage(null);
    try {
      const next = await api.vocabV2LearnAction(token, { sessionId: session.id, itemId: item.id, action, responseMs: Date.now() - startedAt.current });
      // 学完最后一张卡**不再直接把考试推到面前**（2026-09-10 叶老师：得给
      // 孩子留背诵时间）。生产实测首发三天 48 次：翻完最后一张到答出第一题
      // 中位 30 秒，73% 的人一分钟内就开始答，整份 10 题 72 秒答完 ——
      // 那不是考试，是抄写。留在本页进「背一背」，何时开考学生自己定。
      setPhase({ s: 'ready', session: next });
      startedAt.current = Date.now();
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setMessage('进度没有保存，请再试一次。');
    } finally { setBusy(false); }
  };
  const replace = async () => {
    const token = readToken();
    if (!token || !item || busy) return;
    setBusy(true); setMessage(null);
    try {
      const next = await api.vocabV2Replace(token, { sessionId: session.id, itemId: item.id });
      setPhase({ s: 'ready', session: next });
      startedAt.current = Date.now();
      setMessage(`“${next.replacement.oldHeadword}”已标记为会，换成“${next.replacement.newHeadword}”。总数不变。`);
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setMessage('没有找到符合等级和质量要求的新词，原词没有被移除。');
    } finally { setBusy(false); }
  };
  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = String(session.settings.audioAccent ?? 'en-GB');
    speechSynthesis.speak(utterance);
  };
  if (!item) return <Recite session={session} speak={speak} message={message} />;

  const card = item.card;
  const connections = [
    { label: '常见搭配', value: card.collocations.join(' · ') },
    { label: '词族', value: card.wordFamily.join(' · ') },
    { label: '易混词', value: card.confusionWords.join(' · ') },
    { label: '记忆提示', value: card.memoryHint ?? '' },
  ].filter((connection) => connection.value.trim().length > 0);
  return (
    <Screen>
      <TopBar title={taskDate ? `${Number(taskDate.slice(5, 7))}月${Number(taskDate.slice(8, 10))}日新词补做` : '今天的新词'} onBack={() => navigate(ROUTES.today)} backLabel="首页" right={<span className="text-sm tabular-nums text-slate-500">{session.completed + 1} / {session.target}</span>} />
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${(session.completed / session.target) * 100}%` }} /></div>
        <Card>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{SOURCE_LABEL[item.source] ?? item.source}</span>
          <section className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">理解并学习</p>
            <div className="mt-3 flex flex-wrap items-baseline gap-3"><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{card.headword}</h1><button className="hit rounded-full bg-blue-50 px-3 text-blue-700" onClick={() => speak(card.audioText)} aria-label="播放发音">▶</button><span className="text-slate-500">{formatPhonetic(card.phonetic)}</span></div>
            <p className="mt-5 text-xl whitespace-pre-wrap">{posPrefixFor(card.pos, card.translation)}{cleanTranslation(card.translation)}</p><p className="mt-2 text-base leading-7 text-slate-600">{card.definition}</p>
            {card.sentence ? <div className="mt-5 rounded-2xl bg-slate-50 p-5"><p className="font-serif text-lg leading-8">{card.sentence}</p>{card.sentenceTranslation ? <p className="mt-3 text-sm leading-6 text-slate-500">{card.sentenceTranslation}</p> : null}</div> : null}
            {card.imageUrl ? <img src={card.imageUrl} alt={`${card.headword} 的辅助图片`} className="mt-5 max-h-56 w-full rounded-2xl object-cover" /> : null}
            {connections.length > 0 ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{connections.map((connection) => <Connection key={connection.label} {...connection} />)}</div> : null}
          </section>
          {message ? <p role="status" className="mt-4 text-sm text-slate-600">{message}</p> : null}
          <button className="app-primary mt-7 w-full" disabled={busy} onClick={() => void update('normal')}>学完这个词</button>
          <div className="mt-3 grid grid-cols-2 gap-2"><button className="min-h-[44px] text-sm text-slate-500" disabled={busy} onClick={() => void update('skip')}>稍后再学</button><button className="min-h-[44px] text-sm text-blue-600" disabled={busy} onClick={() => void replace()}>这个词我会了，换一个</button></div>
        </Card>
      </div>
    </Screen>
  );
}

function Connection({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-medium text-slate-400">{label}</p><p className="mt-2 text-sm leading-6 text-slate-700">{value}</p></div>;
}

/**
 * 「背一背」—— 学完最后一张卡与开考之间的那一段（2026-09-10）。
 *
 * 为什么要有：以前翻完最后一张卡，测试卷已经生成好等在首页，学生顺手就点完了。
 * 生产实测首发三天 48 次 —— 翻完到答出第一题**中位 30 秒**，73% 的人一分钟内
 * 就开始答，整份 10 题**72 秒**答完。考的是刚看过半分钟的东西，不是记住了什么。
 *
 * 这一页**不设时间闸门**（叶老师定的），什么时候开考由学生自己决定。所以它必须
 * 自己值得停留：中文默认盖住 —— 就是纸上用手盖住答案自己默的那个动作；自己刚
 * 标过「有点难」的词排在最前面。
 */
function Recite({
  session,
  speak,
  message,
}: {
  session: V2LearningSession;
  speak: (text: string) => void;
  message: string | null;
}) {
  const navigate = useNavigate();
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 只有真正学完的词进考卷（「稍后再学」的不考），所以背也只背这些。
  const learned = session.items.filter((row) => row.status === 'completed');
  const ordered = [...learned].sort((a, b) => {
    const hard = (row: (typeof learned)[number]) => (row.action === 'hard' ? 0 : 1);
    return hard(a) - hard(b) || a.position - b.position;
  });
  const allShown = ordered.length > 0 && ordered.every((row) => shown.has(row.id));

  const toggle = (id: string) =>
    setShown((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const startTest = async () => {
    const token = readToken();
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const test = await api.vocabV2StartTest(token, session.id);
      navigate(`${ROUTES.coachTest}?sessionId=${encodeURIComponent(test.id)}`);
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setError('测试暂时打不开，回首页从待办进也可以。');
    } finally {
      setBusy(false);
    }
  };

  if (!ordered.length) {
    return (
      <Screen center>
        <Card>
          <h1 className="text-center text-2xl font-semibold">今天的词处理完了</h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            今天的词都点了「稍后再学」，没有可以考的内容。明天它们还会回来。
          </p>
          <Button onClick={() => navigate(ROUTES.today, { replace: true })}>回首页</Button>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar
        title="背一背"
        onBack={() => navigate(ROUTES.today)}
        backLabel="首页"
        right={<span className="text-sm tabular-nums text-slate-500">{ordered.length} 个词</span>}
      />
      <div className="mx-auto w-full max-w-4xl">
        <Card>
          <h1 className="text-xl font-semibold">先自己默一遍，再去考试</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            中文先盖住了。看着英文想一下意思，想好了再点开对答案。
            <br />
            考试里还会<span className="font-medium text-slate-800">抽查 3 个你以前学过的词</span>，所以别急着走。
          </p>
          <button
            className="mt-4 min-h-[44px] text-sm text-blue-600"
            onClick={() => setShown(allShown ? new Set() : new Set(ordered.map((row) => row.id)))}
          >
            {allShown ? '重新盖住全部' : '全部翻开'}
          </button>

          <ul className="mt-4 flex flex-col gap-2">
            {ordered.map((row) => {
              const card = row.card;
              const open = shown.has(row.id);
              return (
                <li key={row.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="text-2xl font-semibold tracking-tight">{card.headword}</span>
                    <button
                      className="hit rounded-full bg-blue-50 px-3 text-blue-700"
                      onClick={() => speak(card.audioText)}
                      aria-label={`播放 ${card.headword} 的发音`}
                    >
                      ▶
                    </button>
                    <span className="text-sm text-slate-500">{formatPhonetic(card.phonetic)}</span>
                    {row.action === 'hard' ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        刚才标了有点难
                      </span>
                    ) : null}
                  </div>
                  {open ? (
                    <div className="mt-3">
                      <p className="text-base">
                        {posPrefixFor(card.pos, card.translation)}
                        {cleanTranslation(card.translation)}
                      </p>
                      {card.sentence ? (
                        <p className="mt-2 font-serif text-sm leading-7 text-slate-600">{card.sentence}</p>
                      ) : null}
                      <button className="mt-2 min-h-[44px] text-sm text-slate-500" onClick={() => toggle(row.id)}>
                        再盖上
                      </button>
                    </div>
                  ) : (
                    <button
                      className="mt-3 w-full rounded-xl bg-slate-100 py-3 text-sm text-slate-500"
                      onClick={() => toggle(row.id)}
                      data-testid={`reveal-${card.headword}`}
                    >
                      点一下看中文
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {message ? <p role="status" className="mt-4 text-sm text-slate-600">{message}</p> : null}
          {error ? <Notice kind="error">{error}</Notice> : null}
          <button className="app-primary mt-6 w-full" disabled={busy} onClick={() => void startTest()}>
            我背好了，开始考试
          </button>
          <button
            className="mt-3 min-h-[44px] w-full text-sm text-slate-500"
            onClick={() => navigate(ROUTES.today, { replace: true })}
          >
            先回首页，等下再考
          </button>
        </Card>
      </div>
    </Screen>
  );
}
