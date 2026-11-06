/**
 * Slots/input presentation adapted from designfuchen/word-atlas, Learn.tsx,
 * commit 19a9bd889d2f642fef1d8d0eef85a3f35e1a66ff, MIT.
 * Copyright (c) 2026 Word Atlas contributors. See THIRD_PARTY_NOTICES.md.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, type V2Card, type V2RecallResult } from '../../lib/api';
import { handleAuthFailure } from '../../lib/auth-store';
import { readToken } from '../../lib/identity';
import { cleanTranslation, posPrefixFor } from '../../lib/word-display';
import { recallDisplay } from './recall-display';

type RecallBody = Parameters<typeof api.vocabV2Recall>[1];

export function RecallSpelling({ sessionId, itemId, senseId, card, initial, audio, onComplete, onRefresh }: {
  sessionId: string; itemId: string; senseId?: string; card: V2Card;
  initial: V2RecallResult | null; audio: ReactNode; onComplete: () => Promise<void>; onRefresh: () => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [composing, setComposing] = useState(false);
  const composingRef = useRef(false);
  const inFlight = useRef(false);
  // A lost response must resend the exact original answer under the same number.
  const pending = useRef<RecallBody | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const expected = recallDisplay(card.headword);
  const shown = recallDisplay(value);
  const reveal = Boolean(result?.answerRevealed);
  const prefix = result?.nextPrefix ?? '';

  useEffect(() => {
    // Safari scrolls the focused input into the visual viewport. Keep slots,
    // input and submit together in normal flow rather than a fixed footer.
    const keepVisible = () => {
      if (document.activeElement === input.current) form.current?.scrollIntoView?.({ block: 'center' });
    };
    window.visualViewport?.addEventListener('resize', keepVisible);
    return () => window.visualViewport?.removeEventListener('resize', keepVisible);
  }, []);

  const submit = async () => {
    const token = readToken();
    if (!token || composingRef.current || inFlight.current) return;
    if (!result?.isCorrect && !value.trim() && !pending.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    try {
      if (result?.isCorrect) {
        await onComplete();
        return;
      }
      pending.current ??= { sessionId, itemId, expectedSenseId: senseId, typed: value,
        hintLevel: result?.hintLevel ?? 0, attempt: (result?.attempt ?? 0) + 1 };
      const next = await api.vocabV2Recall(token, pending.current);
      pending.current = null;
      if (!next.enabled) {
        await onComplete();
        return;
      }
      setResult(next);
      if (next.isCorrect) await onComplete();
      else {
        setValue('');
        input.current?.focus();
      }
    } catch (e) {
      if (handleAuthFailure(e)) return;
      if (e instanceof ApiError && ['v2_item_changed', 'v2_session_closed', 'v2_recall_sequence', 'v2_recall_complete'].includes(String(e.body?.code))) {
        await onRefresh();
        return;
      }
      setError(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="rounded-group bg-surface p-4 sm:p-6" aria-labelledby="recall-title" data-testid="recall-spelling">
      <div className="flex items-center justify-between gap-4">
        <h1 id="recall-title" className="text-2xl font-semibold leading-tight">凭记忆拼一下</h1>
        {audio}
      </div>
      <p className="mt-4 text-xl leading-normal text-ink">{posPrefixFor(card.pos, card.translation)}{cleanTranslation(card.translation)}</p>
      <form ref={form} className="mt-6 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {reveal ? <p className="break-words text-xl font-semibold text-ink" lang="en" data-testid="recall-answer">{result?.correctSpelling}</p> : null}
        <div className="flex flex-wrap gap-1" aria-hidden="true" data-testid="recall-slots">
          {Array.from(expected).map((ch, i) => {
            const wrong = result?.firstWrongIndex === i && i >= prefix.length;
            return <span key={i} data-wrong={wrong || undefined} className={[
              'inline-flex h-8 w-8 items-center justify-center rounded-control text-lg font-semibold',
              ch === ' ' ? 'bg-transparent' : wrong ? 'border-2 border-danger bg-danger-soft text-danger' : 'bg-fill text-ink',
            ].join(' ')}>{ch === ' ' ? '' : i < prefix.length ? prefix[i] : shown[i] ?? ''}</span>;
          })}
          {result?.firstWrongIndex === expected.length ? <span className="text-base text-danger">末尾多打了</span> : null}
        </div>
        <label className="flex flex-col gap-2 text-base text-ink-2">
          拼写
          <input ref={input} value={value} onChange={(e) => setValue(e.target.value)}
            className="min-h-12 w-full rounded-control border border-control bg-surface px-3 py-2 text-lg text-ink"
            autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="done"
            maxLength={1000} readOnly={busy || Boolean(pending.current) || Boolean(result?.isCorrect)}
            onFocus={() => form.current?.scrollIntoView?.({ block: 'center' })}
            onCompositionStart={() => { composingRef.current = true; setComposing(true); }}
            onCompositionEnd={() => { composingRef.current = false; setComposing(false); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault();
            }}
          />
        </label>
        <p role="status" className={`text-base ${error ? 'text-danger' : 'text-ink-2'}`}>
          {error ? '没能保存，请再试一次。' : result?.isCorrect ? '拼对了，继续吧。' : reveal ? '看着答案，再打一遍。'
            : result && result.wrongAttempts > 0 ? `还没拼对，${prefix ? '已帮你露出开头，再试一次。' : '再试一次。'}`
              : '想不起来，可以听一听。短语记得空格。'}
          {prefix && !reveal && !result?.isCorrect ? <span className="sr-only">开头是：<span lang="en">{prefix}</span>。</span> : null}
        </p>
        <button type="submit" disabled={busy || composing || (!value.trim() && !pending.current && !result?.isCorrect)} aria-busy={busy || undefined}
          className="min-h-12 w-full rounded-control bg-accent-fill px-4 py-3 text-base font-semibold text-accent-on disabled:bg-fill disabled:text-ink-3">
          {busy ? '正在保存…' : error ? '再试一次' : result?.isCorrect ? '继续' : '检查拼写'}
        </button>
      </form>
    </section>
  );
}
