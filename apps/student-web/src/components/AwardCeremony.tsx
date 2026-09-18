import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Dialog } from '../design/Dialog';
import { medalAwardReason } from '../lib/medal-catalog';
import { MedalViewer } from './MedalViewer';
import './award-ceremony.css';

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

/** Presentation only. A grant is already saved before its ceremony opens. */
export function AwardCeremony(props: AwardCeremonyProps) {
  if (!props.open || !props.badge) return null;
  return <ActiveAwardCeremony key={props.badge.key} {...props} badge={props.badge} />;
}

const MOTES = [[21,26,0],[69,18,180],[83,40,60],[16,57,320],[76,70,160],[30,83,240],[57,90,80],[89,59,280],[10,43,130],[64,8,360]];

function ActiveAwardCeremony({ badge, remainingCount, onContinue, onSkipAll, onRevealComplete, preview = false }: AwardCeremonyProps & { badge: AwardCeremonyBadge }) {
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState(0);
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const onComplete = useRef(onRevealComplete); onComplete.current = onRevealComplete;
  const completed = useRef(false);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media?.matches ?? false);
    media?.addEventListener?.('change', change);
    return () => media?.removeEventListener?.('change', change);
  }, []);
  useEffect(() => {
    if (!started) return;
    // Timed from model readiness, not network fetch. All actions stay escapable.
    if (reduced) setPhase(3);
    const timers = reduced ? [] : [
      window.setTimeout(() => setPhase(current => Math.max(current, 1)), 1900),
      window.setTimeout(() => setPhase(current => Math.max(current, 2)), 2200),
      window.setTimeout(() => setPhase(current => Math.max(current, 3)), 2700),
    ];
    // Let students read the text before automatically advancing a multi-award queue.
    // The last medal's owner callback never closes it without a student action.
    timers.push(window.setTimeout(() => {
      if (!completed.current) { completed.current = true; onComplete.current(); }
    }, reduced ? 3200 : 4800));
    return () => timers.forEach(window.clearTimeout);
  }, [started, reduced]);
  const reason = medalAwardReason(badge.assetId);
  return <Dialog open onClose={onSkipAll} title={badge.title}
    description={preview ? '颁奖体验 · 仅展示动画，不解锁徽章，也不改变学习记录。' : reason}
    placement="fullscreen" appearance="ceremony" showClose={false} initialFocus="panel"
    testId={preview ? 'achievement-preview' : 'achievement-award'}>
    <div className="award-scene" data-phase={phase} data-started={started} data-reduced={reduced}>
      <div className="award-topline">
        {preview ? <span>颁奖体验 · 不改变收藏</span> : <span aria-hidden="true" />}
        <button type="button" className="award-skip" onClick={onSkipAll}>跳过全部动画</button>
      </div>
      <div className="award-composition">
        <div className="award-medal-wrap">
          <div className="award-halo" aria-hidden="true" />
          <div className="award-motes" aria-hidden="true">{MOTES.map(([x,y,delay], index) => <i key={index} style={{ '--x': `${x}%`, '--y': `${y}%`, '--delay': `${delay}ms` } as CSSProperties} />)}</div>
          <MedalViewer assetId={badge.assetId} title={badge.title} reveal ceremony
            onReady={() => setStarted(true)}
            onError={() => { setFailed(true); setStarted(true); }} />
        </div>
        <div className="award-copy">
          <h2 className="award-title" aria-hidden={phase < 1}>{badge.title}</h2>
          <p className="award-reason" aria-hidden={phase < 2}>{reason}</p>
        </div>
        <div className="award-actions">
          <button type="button" className="award-continue" hidden={phase < 3} onClick={onContinue}>{remainingCount ? '下一枚' : '继续'}</button>
          {remainingCount > 0 && phase >= 3 && <p className="award-queue" role="status">还有 {remainingCount} 枚，即将依次呈现</p>}
          {failed && <p className="award-fallback" role="status">{preview ? '已改为图片预览，不改变收藏。' : '已改为图片展示，徽章已保存。'}</p>}
        </div>
      </div>
    </div>
  </Dialog>;
}
