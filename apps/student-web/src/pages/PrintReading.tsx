/**
 * 阅读打印版（2026-09-22）：文章 + 全部题目，A4 排版，不带答案。
 * 只读 —— 打开它不会开始今天的阅读，也不会建答卷。
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, type PrintReadingPayload } from '../lib/api';
import { handleAuthFailure } from '../lib/auth-store';
import { readToken } from '../lib/identity';
import { ROUTES } from '../routes.contract';
import { Button } from '../design/Button';
import { StatusView } from '../design/Status';
import { ReadingSheet } from '../print/PrintSheets';
import { dayText } from './Today';

type State = { s: 'loading' } | { s: 'error'; notFound: boolean } | { s: 'ready'; data: PrintReadingPayload };

export default function PrintReadingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get('sessionId') ?? '';
  const [state, setState] = useState<State>({ s: 'loading' });

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) return;
    if (!sessionId) {
      setState({ s: 'error', notFound: true });
      return;
    }
    setState({ s: 'loading' });
    try {
      setState({ s: 'ready', data: await api.printReading(token, sessionId) });
    } catch (e) {
      if (handleAuthFailure(e)) return;
      setState({ s: 'error', notFound: e instanceof ApiError && (e.status === 404 || e.status === 403) });
    }
  }, [sessionId]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="ps-screen" data-testid="print-reading-page">
      <div className="ps-toolbar ps-no-print">
        <Button size="md" variant="neutral" icon="back" onClick={() => navigate(ROUTES.printCenter)}>
          返回
        </Button>
        {state.s === 'ready' ? (
          <Button size="md" data-testid="print-now" onClick={() => window.print()}>
            打印 / 存 PDF
          </Button>
        ) : null}
      </div>
      {state.s === 'loading' ? <StatusView kind="loading" title="正在排版" /> : null}
      {state.s === 'error' ? (
        state.notFound ? (
          <StatusView kind="notFound" title="没有找到这篇阅读" message="回到「打印 / 下载」重新选一篇。" />
        ) : (
          <StatusView kind="error" title="没排出来" message="网络不太好，重试一下就好。" onRetry={() => void load()} />
        )
      ) : null}
      {state.s === 'ready' ? (
        <ReadingSheet
          reading={state.data.reading}
          meta={[state.data.levelLabel, dayText(state.data.date), state.data.className].filter(Boolean).join(' · ')}
        />
      ) : null}
    </div>
  );
}
