import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../design/Button';
import { Dialog } from '../design/Dialog';
import { claimAchievementNotices, dismissAchievementNotices, getAchievementNotices, markAchievementViewed, subscribeAchievementNotices, syncAchievementNotices } from '../lib/achievement-notices';
import { MedalImage } from './MedalViewer';
import { AwardCeremony } from './AwardCeremony';
import { ROUTES } from '../routes.contract';

const SAFE_ROUTES: readonly string[] = [ROUTES.today, ROUTES.readingResult, ROUTES.scores, ROUTES.growthBadges, ROUTES.summary];
function safeToCelebrate(pathname: string) {
  if (SAFE_ROUTES.includes(pathname) || pathname.startsWith(ROUTES.scores + '/')) return true;
  if (pathname !== ROUTES.coachLearn && pathname !== ROUTES.coachTest) return false;
  return [...document.querySelectorAll<HTMLElement>('[data-achievement-safe]')].some((element) => element.dataset.achievementSafe === pathname);
}
function anotherDialogIsOpen() {
  return [...document.querySelectorAll<HTMLElement>('[role="dialog"],[role="alertdialog"],dialog[open]')]
    .some((element) => !['achievement-award', 'achievement-backfill'].includes(element.dataset.testid ?? '') && !element.closest('[hidden]') && !element.matches('dialog:not([open])'));
}

/** Saved grants → atomic claim → safe-page presentation. No learning behavior is inferred here. */
export default function AchievementNotifier() {
  const notices = useSyncExternalStore(subscribeAchievementNotices, getAchievementNotices, getAchievementNotices);
  const location = useLocation(); const navigate = useNavigate();
  const [opened, setOpened] = useState<{ key: string; routeKey: string } | null>(null);
  const attempted = useRef(false);
  const current = opened?.routeKey === location.key ? notices.find((notice) => notice.claimed && notice.badge.key === opened.key) : null;
  const backfill = notices.filter((notice) => notice.claimed && notice.kind === 'backfill');
  const awardRemainder = notices.filter((notice) => notice.claimed && notice.kind === 'award' && notice.badge.key !== current?.badge.key);

  // Home is the normal post-login entry; account/history/result page reads must
  // not themselves write grants. Actual task completions already call sync.
  useEffect(() => {
    if (location.pathname === ROUTES.today || location.pathname === ROUTES.growthBadges) void syncAchievementNotices();
  }, [location.pathname]);
  useEffect(() => {
    attempted.current = false;
    const attempt = () => {
      const safe = safeToCelebrate(location.pathname), blocked = anotherDialogIsOpen();
      if (opened) {
        if (opened.routeKey !== location.key || !safe || blocked || document.visibilityState === 'hidden') {
          setOpened(null);
          // Claimed but unfinished medals stay New; leaving never forces another ceremony.
          dismissAchievementNotices(notices.filter((notice) => notice.claimed).map((notice) => notice.badge.key));
        } else if (!notices.some((notice) => notice.badge.key === opened.key)) {
          // Native renderer callbacks can commit the external-store removal
          // before setOpened(null). This is a normal handoff, not interruption:
          // retain every remaining claimed medal for the next reveal.
          setOpened(null);
        }
        return;
      }
      if (!safe || blocked || document.visibilityState === 'hidden' || !notices.length) return;
      const first = notices.find((notice) => notice.claimed);
      if (first) { setOpened({ key: first.badge.key, routeKey: location.key }); return; }
      if (!attempted.current) { attempted.current = true; void claimAchievementNotices(); }
    };
    const retry = () => { attempted.current = false; attempt(); };
    attempt();
    const observer = new MutationObserver(attempt);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['role', 'hidden', 'open', 'data-achievement-safe'] });
    document.addEventListener('visibilitychange', retry); window.addEventListener('online', retry);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', retry); window.removeEventListener('online', retry); };
  }, [location.key, location.pathname, notices, opened]);

  const skipAll = () => {
    dismissAchievementNotices(notices.filter((notice) => notice.claimed).map((notice) => notice.badge.key)); setOpened(null);
  };
  const advance = () => {
    if (!current) return;
    void markAchievementViewed([current.badge.key]);
    dismissAchievementNotices([current.badge.key]); setOpened(null);
  };
  const onRevealComplete = () => {
    if (!current) return;
    if (awardRemainder.length) advance(); // Each independently earned level gets its own reveal.
  };
  const closeBackfill = (visit = false) => {
    // Summary is not an inspection of every award: keep each New until explicitly viewed.
    dismissAchievementNotices(backfill.map((notice) => notice.badge.key)); setOpened(null);
    if (visit) navigate(ROUTES.growthBadges);
  };
  const isSummary = current?.kind === 'backfill';
  return <>
    <Dialog open={Boolean(isSummary)} onClose={() => closeBackfill()} title="过去的努力，也值得收藏" description="已根据你的真实学习记录补入徽章，不会逐枚播放历史获得动画。" placement="sheet" size="lg" testId="achievement-backfill" initialFocus="panel" footer={<><Button variant="neutral" onClick={() => closeBackfill()}>稍后查看</Button><Button onClick={() => closeBackfill(true)}>查看我的徽章</Button></>}>
      <p className="mb-3 text-callout text-ink">本次补入 {backfill.length} 枚，已安全保存。</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">{backfill.map(({ badge }) => <div key={badge.key} className="text-center"><MedalImage assetId={badge.assetId!} thumbnail className="aspect-square w-full object-contain" /><p className="text-caption text-ink-2">{badge.title}</p></div>)}</div>
    </Dialog>
    <AwardCeremony open={Boolean(current?.kind === 'award')}
      badge={current?.kind === 'award' ? { key: current.badge.key, assetId: current.badge.assetId!, title: current.badge.title ?? '已获得徽章' } : null}
      remainingCount={awardRemainder.length} onContinue={advance} onSkipAll={skipAll} onRevealComplete={onRevealComplete} />
  </>;
}
