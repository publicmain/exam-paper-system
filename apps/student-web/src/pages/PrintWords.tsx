/**
 * 单词打印版（2026-09-22）：单词表（英文 / 音标 / 中文 / 例句）或默写纸（只印中文，留空写英文，
 * 答案另起一页，可以不印）。只读。
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type PrintWordsPayload } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { Button } from '../design/Button';
import { Segmented } from '../design/Segmented';
import { StatusView } from '../design/Status';
import { WordsSheet, type WordSheetMode } from '../print/PrintSheets';
import { dayText } from './Today';

type State = { s: 'loading' } | { s: 'error' } | { s: 'ready'; data: PrintWordsPayload };

export default function PrintWordsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? '';
  const mode: WordSheetMode = params.get('mode') === 'dictation' ? 'dictation' : 'list';
  const [withAnswers, setWithAnswers] = useState(true);
  const [state, setState] = useState<State>({ s: 'loading' });

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    setState({ s: 'loading' });
    try {
      setState({ s: 'ready', data: await api.printWords(token, date) });
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setState({ s: 'error' });
    }
  }, [date]);
  useEffect(() => {
    void load();
  }, [load]);

  const setMode = (next: WordSheetMode) => {
    const p = new URLSearchParams(params);
    p.set('mode', next);
    setParams(p, { replace: true });
  };
  const when = /^\d{4}-\d{2}-\d{2}$/.test(date) ? dayText(date) : date;

  return (
    <div className="ps-screen" data-testid="print-words-page">
      <div className="ps-toolbar ps-no-print">
        <Button size="md" variant="neutral" icon="back" onClick={() => navigate(ROUTES.printCenter)}>
          返回
        </Button>
        <Segmented<WordSheetMode>
          label="打印哪一种"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'list', label: '单词表', testId: 'mode-list' },
            { value: 'dictation', label: '默写纸', testId: 'mode-dictation' },
          ]}
        />
        {mode === 'dictation' ? (
          <label className="inline-flex min-h-[44px] items-center gap-2 text-callout text-ink-2">
            <input type="checkbox" checked={withAnswers} onChange={(e) => setWithAnswers(e.target.checked)} data-testid="with-answers" />
            最后一页附答案
          </label>
        ) : null}
        {state.s === 'ready' ? (
          <Button size="md" data-testid="print-now" onClick={() => window.print()}>
            打印 / 存 PDF
          </Button>
        ) : null}
      </div>
      {state.s === 'loading' ? <StatusView kind="loading" title="正在排版" /> : null}
      {state.s === 'error' ? <StatusView kind="error" title="没排出来" message="网络不太好，重试一下就好。" onRetry={() => void load()} /> : null}
      {state.s === 'ready' ? (
        <WordsSheet
          words={state.data.words}
          mode={mode}
          title={`${mode === 'dictation' ? '默写纸' : '单词表'} · ${when}`}
          meta={`每日新词 · 共 ${state.data.words.length} 个`}
          showAnswers={withAnswers}
        />
      ) : null}
    </div>
  );
}
