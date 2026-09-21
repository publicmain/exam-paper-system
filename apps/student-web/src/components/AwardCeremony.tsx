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
  const [spun, setSpun] = useState(false);
  // 开场白（2026-09-21）：模型第一次要下载一两兆，学生看到的是「空屏 + 正在加载」。
  // 先铺两句话把这段时间变成仪式的一部分：最少念 3 秒（已缓存时也不会一闪而过），
  // 模型一就绪就接上，绝不为了演而多等。队列里的第二枚起不再重复开场白。
  const [beat, setBeat] = useState(0);
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
    if (reduced) { setBeat(3); return; }
    // 2026-09-21 叶老师：开场白延长到 3 秒。第一句立刻出、第二句 1.2 秒出，念满 3 秒才落幕。
    const timers = [
      window.setTimeout(() => setBeat(current => Math.max(current, 1)), 60),
      window.setTimeout(() => setBeat(current => Math.max(current, 2)), 1200),
      window.setTimeout(() => setBeat(current => Math.max(current, 3)), 3000),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [reduced]);
  // 开场白念完 **且** 模型就绪，才让徽章露面并开转。
  const curtain = !(beat >= 3 && (started || failed));
  // 落幕之后文字还要留 0.35 秒淡出，别一下子消失、徽章一下子冒出来（2026-09-21）。
  const [introGone, setIntroGone] = useState(false);
  useEffect(() => {
    if (curtain) { setIntroGone(false); return; }
    const timer = window.setTimeout(() => setIntroGone(true), 400);
    return () => window.clearTimeout(timer);
  }, [curtain]);
  // 文字等真正转完再出现（2026-09-18）：原来按固定时刻推进，手机一卡，
  // 旋转还没走完标题就先冒出来了。兜底：转完的消息 6 秒没到（模型慢或降级）也照常往下走。
  // 兜底计时从「落幕」开始算，不从「模型就绪」算：开场白现在要念 3 秒，模型要是
  // 0.1 秒就绪，从就绪算 6 秒，留给「淡入 + 转一圈」的时间就不够了。
  useEffect(() => {
    if (!started || curtain || reduced || spun) return;
    const timer = window.setTimeout(() => setSpun(true), 6000);
    return () => window.clearTimeout(timer);
  }, [started, curtain, reduced, spun]);
  useEffect(() => {
    if (!started) return;
    // Timed from the finished spin, not from network fetch. All actions stay escapable.
    if (reduced) setPhase(3);
    const timers = reduced || !spun ? [] : [
      window.setTimeout(() => setPhase(current => Math.max(current, 1)), 0),
      window.setTimeout(() => setPhase(current => Math.max(current, 2)), 300),
      window.setTimeout(() => setPhase(current => Math.max(current, 3)), 800),
    ];
    // Let students read the text before automatically advancing a multi-award queue.
    // The last medal's owner callback never closes it without a student action.
    if (reduced || spun) {
      timers.push(window.setTimeout(() => {
        if (!completed.current) { completed.current = true; onComplete.current(); }
      }, reduced ? 3200 : 2900));
    }
    return () => timers.forEach(window.clearTimeout);
  }, [started, reduced, spun]);
  const reason = medalAwardReason(badge.assetId);
  return <Dialog open onClose={onSkipAll} title={badge.title}
    description={preview ? '颁奖体验 · 仅展示动画，不解锁徽章，也不改变学习记录。' : reason}
    placement="fullscreen" appearance="ceremony" showClose={false} initialFocus="panel"
    testId={preview ? 'achievement-preview' : 'achievement-award'}>
    <div className="award-scene" data-phase={phase} data-started={started} data-reduced={reduced} data-curtain={curtain} data-beat={beat}>
      <div className="award-topline">
        {preview ? <span>颁奖体验 · 不改变收藏</span> : <span aria-hidden="true" />}
        <button type="button" className="award-skip" onClick={onSkipAll}>跳过全部动画</button>
      </div>
      <div className="award-composition">
        <div className="award-medal-wrap">
          {/* 开场白：盖住模型下载的那一两秒，让它成为仪式的一部分而不是等待。 */}
          {!introGone && <p className="award-intro" data-testid="award-intro" role="status">
            <span className="award-intro-1">做得好</span>
            <span className="award-intro-2">收下你的新徽章</span>
          </p>}
          <div className="award-halo" aria-hidden="true" />
          <div className="award-motes" aria-hidden="true">{MOTES.map(([x,y,delay], index) => <i key={index} style={{ '--x': `${x}%`, '--y': `${y}%`, '--delay': `${delay}ms` } as CSSProperties} />)}</div>
          <MedalViewer assetId={badge.assetId} title={badge.title} reveal ceremony hold={curtain}
            onReady={() => setStarted(true)}
            onRevealComplete={() => setSpun(true)}
            onError={() => { setFailed(true); setStarted(true); setSpun(true); }} />
        </div>
        <div className="award-copy">
          <h2 className="award-title" aria-hidden={phase < 1}>{badge.title}</h2>
          <p className="award-reason" aria-hidden={phase < 2}>{reason}</p>
        </div>
        <div className="award-actions">
          <button type="button" className="award-continue" hidden={phase < 3} onClick={onContinue}>{remainingCount ? '下一枚' : '继续'}</button>
          {remainingCount > 0 && phase >= 3 && <p className="award-queue" role="status">还有 {remainingCount} 枚，即将依次呈现</p>}
          {spun && !failed && remainingCount === 0 && phase >= 3 && <p className="award-hint">用手指拖动徽章，可以转着看</p>}
          {failed && <p className="award-fallback" role="status">{preview ? '已改为图片预览，不改变收藏。' : '已改为图片展示，徽章已保存。'}</p>}
        </div>
      </div>
    </div>
  </Dialog>;
}
