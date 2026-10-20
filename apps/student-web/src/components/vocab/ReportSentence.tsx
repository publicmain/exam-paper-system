/**
 * 「这句有问题？」—— 学生自己能报不合适 / 有错的例句（2026-10-20）。
 *
 * 「What is oral sex?」推了三周，是学生截图给叶老师才知道的。现在学生点一下，这句就
 * 立刻对所有学生下架（回到待审队列），老师后台收到通知。宁可错下架一句好句子 ——
 * 它会被重审放回来。
 *
 * 两步确认，避免误触；不弹系统对话框（iPad PWA 上体验差）。
 */
import { useState } from 'react';
import { api } from '../../lib/api';
import { handleAuthFailure } from '../../lib/auth-store';
import { readToken } from '../../lib/identity';
import { Button } from '../../design/Button';

type Phase = 'idle' | 'confirm' | 'sending' | 'done-hidden' | 'done' | 'error';

export function ReportSentence({ itemId }: { itemId: string }) {
  const [phase, setPhase] = useState<Phase>('idle');

  async function send() {
    const token = readToken();
    if (!token) return;
    setPhase('sending');
    try {
      const out = await api.vocabV2Report(token, { itemId });
      setPhase(out.hidden ? 'done-hidden' : 'done');
    } catch (error) {
      if (handleAuthFailure(error)) return;
      setPhase('error');
    }
  }

  if (phase === 'done-hidden' || phase === 'done') {
    return (
      <p role="status" data-testid="report-sentence-done" className="mt-3 text-footnote text-ink-3">
        {phase === 'done-hidden' ? '收到了，这句已经先下架，老师会看。谢谢你。' : '收到了，老师会看。谢谢你。'}
      </p>
    );
  }

  if (phase === 'confirm' || phase === 'sending' || phase === 'error') {
    return (
      <div className="mt-3 rounded-control bg-surface p-3" data-testid="report-sentence-confirm">
        <p className="text-footnote text-ink-2">
          {phase === 'error' ? '没发出去，再试一次。' : '这句例句不合适，或者有错？告诉老师后，这句会先下架。'}
        </p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="secondary" busy={phase === 'sending'} onClick={send}>
            告诉老师
          </Button>
          <Button size="sm" variant="plain" disabled={phase === 'sending'} onClick={() => setPhase('idle')}>
            算了
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid="report-sentence"
      onClick={() => setPhase('confirm')}
      className="mt-2 min-h-[44px] text-footnote text-ink-3 underline decoration-dotted underline-offset-4 hover:text-ink-2"
    >
      这句有问题？
    </button>
  );
}
