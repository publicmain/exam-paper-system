import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type MistakeEntry, type MistakeListResult } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { Button } from '../design/Button';
import { BackButton, Page } from '../design/Page';
import { StatusView } from '../design/Status';
import { Feedback } from '../components/ReadingRedo';

export default function MistakesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<MistakeListResult | null>(null);
  const [error, setError] = useState(false);
  const [limit, setLimit] = useState(24);
  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    setError(false);
    try { setData(await api.mistakeList(token)); }
    catch (e) { if (!handleAuthFailure(e)) setError(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (error) return <StatusView kind="error" title="错题本没打开" message="暂时没能打开，请重试。" onRetry={() => void load()} />;
  if (!data) return <StatusView kind="loading" title="正在打开错题本" />;
  const unresolved = data.entries.filter((r) => !r.resolved);
  const resolved = data.entries.filter((r) => r.resolved);
  return <Page title="错题本" subtitle="做错的留着，之后再试一次。" leading={<BackButton label="今日" onClick={() => navigate(ROUTES.today)} />}>
    <div className="space-y-8 text-base leading-relaxed">
      <section className="space-y-4" aria-label="阅读错题">
        <h2 className="text-xl font-semibold text-ink">阅读错题（{unresolved.length} 道）</h2>
        <p className="max-w-prose text-sm text-ink-2">今天要重做的题，接在阅读结果后面，每天最多 3 道。</p>
        <Button variant="secondary" onClick={() => navigate(ROUTES.readingResult)}>去今天的阅读</Button>
        {unresolved.length ? <ReadingEntries rows={unresolved.slice(0, limit)} /> : <p className="text-ink-2">暂时没有待处理的阅读错题。</p>}
        {unresolved.length > limit ? <Button variant="plain" onClick={() => setLimit((n) => n + 24)}>再看一些</Button> : null}
      </section>
      <section className="space-y-4" aria-label="错词">
        <h2 className="text-xl font-semibold text-ink">错词（{data.vocabulary.length} 个）</h2>
        <p className="max-w-prose text-sm text-ink-2">正式测试里做错的词，会安排到之后的单词测试里。</p>
        {data.vocabulary.length ? <ul className="divide-y divide-line">{data.vocabulary.map((word) => <li key={word.senseId} className="flex flex-wrap items-baseline justify-between gap-3 py-3">
          <span className="min-w-0 break-words text-ink"><strong className="font-semibold">{word.headword}</strong> {word.meaning}</span><time className="text-sm text-ink-2">{word.date}</time>
        </li>)}</ul> : <p className="text-ink-2">暂时没有待处理的错词。</p>}
      </section>
      <details className="space-y-4"><summary className="min-h-12 cursor-pointer text-xl font-semibold text-ink">已经做对的阅读错题（{resolved.length} 道）</summary>
        <ReadingEntries rows={resolved} />
      </details>
    </div>
  </Page>;
}

function ReadingEntries({ rows }: { rows: MistakeEntry[] }) {
  return <div className="space-y-6">{rows.map((entry, i) => <div key={entry.id}>
    {i === 0 || rows[i - 1].quizDay !== entry.quizDay ? <h3 className="mb-3 text-sm font-semibold text-ink-2">{entry.quizDay}</h3> : null}
    <details className="rounded-control bg-surface p-4">
      <summary className="min-h-12 cursor-pointer break-words text-ink"><span className="block text-sm text-ink-2">{entry.passageTitle}</span><span className="font-semibold">{entry.stem}</span></summary>
      <div className="mt-4 space-y-4">
        {entry.legacy ? <p className="text-sm text-ink-2">这道旧题只供回看，不安排重做。</p> : null}
        {entry.passage ? <p className="max-w-prose whitespace-pre-wrap break-words text-ink">{entry.passage}</p> : null}
        {entry.options?.length ? <ul className="space-y-2 text-ink">{entry.options.map((o) => <li key={o.key}>{o.key} {o.text}</li>)}</ul> : null}
        <p className="max-w-prose whitespace-pre-wrap break-words text-ink-2">我当时的答案：{entry.studentAnswer}</p>
        <Feedback value={entry} />
      </div>
    </details>
  </div>)}</div>;
}
