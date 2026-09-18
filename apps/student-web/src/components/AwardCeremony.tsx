import { useState } from 'react';
import { Button } from '../design/Button';
import { Dialog } from '../design/Dialog';
import { MedalViewer } from './MedalViewer';

export type AwardCeremonyBadge = { key: string; assetId: string; title: string };

export type AwardCeremonyProps = {
  open: boolean;
  badge: AwardCeremonyBadge | null;
  remainingCount: number;
  onContinue: () => void;
  onSkipAll: () => void;
  onRevealComplete: () => void;
  preview?: boolean;
};

/** Presentation only: owning callers control queues and persistence. */
export function AwardCeremony(props: AwardCeremonyProps) {
  if (!props.open || !props.badge) return null;
  // Each opening and badge starts a fresh renderer, including repeated previews.
  return <ActiveAwardCeremony key={props.badge.key} {...props} badge={props.badge} />;
}

function ActiveAwardCeremony({ badge, remainingCount, onContinue, onSkipAll, onRevealComplete, preview = false }: AwardCeremonyProps & { badge: AwardCeremonyBadge }) {
  const [finished, setFinished] = useState(false);
  const [failed, setFailed] = useState(false);
  return <Dialog open onClose={onSkipAll} title={badge.title}
    description={preview ? '颁奖体验 · 仅展示动画，不解锁徽章，也不改变学习记录。' : '你的努力，已成为一枚新的收藏。'}
    placement="fullscreen" appearance="ceremony" showClose={false} initialFocus="panel"
    testId={preview ? 'achievement-preview' : 'achievement-award'}
    footer={<div className="mx-auto flex w-full max-w-2xl flex-wrap gap-3"><Button variant="neutral" onClick={onSkipAll}>跳过全部动画</Button><Button className="flex-1" onClick={onContinue}>{remainingCount ? '下一枚' : '继续'}</Button></div>}>
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center text-center">
      <p className="mb-2 text-footnote text-award-muted" role="status">{remainingCount ? `此后还有 ${remainingCount} 枚，依次为你呈现` : '本次最后一枚'}</p>
      <MedalViewer assetId={badge.assetId} title={badge.title} reveal
        onRevealComplete={() => { setFinished(true); onRevealComplete(); }}
        onError={() => { setFailed(true); setFinished(true); }} />
      {failed && <p className="mt-3 text-footnote text-award-muted">{preview ? '三维暂时不可用，已改为静态体验。不会解锁徽章或改变学习记录。' : '三维暂时不可用，徽章已保存。可以继续，之后在收藏里再看。'}</p>}
      {!remainingCount && finished && <p className="mt-3 text-footnote text-award-muted">可以转动、翻面欣赏。准备好后点「继续」。</p>}
    </div>
  </Dialog>;
}
