/**
 * 打印 / 下载（2026-09-22，叶老师要的）。
 *
 * 列出能打印的材料：今天的阅读和单词、之前没做完的那几天、任选一天的单词。点进去是
 * 排好 A4 版的打印版纸面，在那里点「打印 / 存 PDF」。这一页只读 overview，不写任何东西；
 * 打开阅读打印版也不会开始答题。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type V2Overview } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { sgtDateKey } from '../lib/teaching-day';
import { ROUTES } from '../routes.contract';
import { Button } from '../design/Button';
import { Page } from '../design/Page';
import { StatusView } from '../design/Status';
import { dayText } from './Today';

type Day = { date: string; reading: { sessionId: string; title: string } | null; words: boolean };

export function readingPath(sessionId: string): string {
  return `${ROUTES.printReading}?sessionId=${encodeURIComponent(sessionId)}`;
}
export function wordsPath(date: string, mode: 'list' | 'dictation'): string {
  return `${ROUTES.printWords}?date=${encodeURIComponent(date)}&mode=${mode}`;
}

/** 今天 + 之前没做完的日子（早的在前），各自能打印什么。 */
export function printableDays(ov: V2Overview, todayKey: string): { today: Day; earlier: Day[] } {
  const r = ov.home?.reading;
  const todayReading = r?.sessionId && r.state !== 'not_applicable' && r.state !== 'not_generated' ? { sessionId: r.sessionId, title: r.title || '今日阅读' } : null;
  const w = ov.home?.words;
  const todayWords = Boolean(ov.today) || (w != null && w.state !== 'not_applicable' && w.state !== 'not_generated');
  const map = new Map<string, Day>();
  const day = (date: string) => {
    let d = map.get(date);
    if (!d) {
      d = { date, reading: null, words: false };
      map.set(date, d);
    }
    return d;
  };
  for (const row of ov.readingBacklog ?? []) if (row.date < todayKey) day(row.date).reading = { sessionId: row.sessionId, title: row.title || '阅读' };
  for (const row of ov.learningBacklog ?? []) if (row.date < todayKey) day(row.date).words = true;
  for (const row of ov.pendingTests ?? []) if (row.date < todayKey) day(row.date).words = true;
  return {
    today: { date: todayKey, reading: todayReading, words: todayWords },
    earlier: [...map.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

type State = { s: 'loading' } | { s: 'error' } | { s: 'ready'; ov: V2Overview };

export default function PrintCenterPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ s: 'loading' });
  const [otherDate, setOtherDate] = useState(() => sgtDateKey());

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    setState({ s: 'loading' });
    try {
      setState({ s: 'ready', ov: await api.vocabV2Overview(token) });
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setState({ s: 'error' });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const days = useMemo(() => (state.s === 'ready' ? printableDays(state.ov, state.ov.home?.date ?? sgtDateKey()) : null), [state]);

  return (
    <Page title="打印 / 下载" subtitle="阅读文章和题目、单词表、默写纸。打开后点「打印」，也可以存成 PDF。" testId="print-center">
      {state.s === 'loading' ? <StatusView kind="loading" title="正在读取" /> : null}
      {state.s === 'error' ? <StatusView kind="error" title="没读取到" message="网络不太好，重试一下就好。" onRetry={() => void load()} /> : null}
      {days ? (
        <div className="flex flex-col gap-5">
          <DayBlock title={`今天 · ${dayText(days.today.date)}`} day={days.today} onGo={navigate} emptyText="今天没有阅读和单词任务。" />

          {days.earlier.length ? (
            <section aria-labelledby="print-earlier" className="flex flex-col gap-3">
              <h2 id="print-earlier" className="px-1 text-footnote font-semibold text-ink-3">
                之前没做完的
              </h2>
              {days.earlier.map((d) => (
                <DayBlock key={d.date} title={dayText(d.date)} day={d} onGo={navigate} />
              ))}
            </section>
          ) : null}

          <section aria-labelledby="print-other" className="rounded-group bg-surface p-4" data-testid="print-other-date">
            <h2 id="print-other" className="mb-1 text-headline text-ink">
              其他日期的单词
            </h2>
            <p className="mb-3 text-callout text-ink-2">选一天，打印那天学的单词。</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={otherDate}
                max={sgtDateKey()}
                onChange={(e) => setOtherDate(e.target.value)}
                aria-label="选择日期"
                className="min-h-[44px] rounded-control bg-fill px-3 text-body text-ink"
              />
              <Button size="md" variant="secondary" disabled={!otherDate} onClick={() => navigate(wordsPath(otherDate, 'list'))}>
                单词表
              </Button>
              <Button size="md" variant="secondary" disabled={!otherDate} onClick={() => navigate(wordsPath(otherDate, 'dictation'))}>
                默写纸
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </Page>
  );
}

function DayBlock({ title, day, onGo, emptyText }: { title: string; day: Day; onGo: (path: string) => void; emptyText?: string }) {
  const nothing = !day.reading && !day.words;
  return (
    <section className="rounded-group bg-surface p-4" data-testid={`print-day-${day.date}`}>
      <h2 className="mb-3 text-headline text-ink">{title}</h2>
      {nothing ? <p className="text-callout text-ink-3">{emptyText ?? '没有可打印的内容。'}</p> : null}
      <div className="flex flex-col gap-3">
        {day.reading ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 text-callout text-ink-2">阅读 · {day.reading.title}</span>
            <Button size="md" variant="secondary" icon="reading" onClick={() => onGo(readingPath(day.reading!.sessionId))}>
              打印阅读
            </Button>
          </div>
        ) : null}
        {day.words ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-callout text-ink-2">当天的单词</span>
            <div className="flex gap-2">
              <Button size="md" variant="secondary" icon="words" onClick={() => onGo(wordsPath(day.date, 'list'))}>
                单词表
              </Button>
              <Button size="md" variant="secondary" onClick={() => onGo(wordsPath(day.date, 'dictation'))}>
                默写纸
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
