import { useEffect, useState, useSyncExternalStore } from 'react';
import { getState, subscribe, type AuthState } from '../lib/auth-store';
import { prefetchMedalModel, V5_MEDALS, type V5Medal } from '../lib/medal-catalog';
import { Button } from '../design/Button';
import { AwardCeremony } from './AwardCeremony';

// Presentation-only allowlist: identity is the existing server-verified /me ID,
// never a mutable name, query string, decoded JWT or localStorage override.
// This grants no capability to save awards or modify learning facts.
const TEACHER_EXPERIENCE_ID = 'cmtqgmjl200u6stuq31xrad59';
export function canPreviewCeremony(auth: AuthState): boolean {
  return auth.status === 'authenticated' && auth.profile.id === TEACHER_EXPERIENCE_ID;
}
type Preview = { ownerId: string; medals: readonly V5Medal[]; index: number; run: number };

/** Pure display: deliberately no achievement API, notice-store or storage writes. */
export default function BadgeCeremonyPreview() {
  const auth = useSyncExternalStore(subscribe, getState, getState);
  const allowed = canPreviewCeremony(auth);
  const [selected, setSelected] = useState('reading-1');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [run, setRun] = useState(0);
  useEffect(() => { if (!allowed) setPreview(null); }, [allowed]);
  // 选中哪一枚就先把模型拉下来：按下「体验颁奖」时才开始下载的话，要空等约两秒。
  useEffect(() => { if (allowed) prefetchMedalModel(selected); }, [allowed, selected]);
  if (!allowed || auth.status !== 'authenticated') return null;
  const medal = V5_MEDALS.find(item => item.assetId === selected) ?? V5_MEDALS[0];
  const tiered = medal.tier !== null;
  const active = preview?.ownerId === auth.profile.id ? preview : null;
  const current = active?.medals[active.index];
  const remaining = active ? active.medals.length - active.index - 1 : 0;
  const start = (medals: readonly V5Medal[]) => {
    // Recheck the live authenticated identity at the click boundary.
    const latest = getState();
    if (!canPreviewCeremony(latest) || latest.status !== 'authenticated') return;
    const nextRun = run + 1; setRun(nextRun);
    setPreview({ ownerId: latest.profile.id, medals, index: 0, run: nextRun });
  };
  const next = () => setPreview(previous => !previous || previous.index + 1 >= previous.medals.length ? null : { ...previous, index: previous.index + 1 });
  const close = () => setPreview(null);
  return <section className="mb-5 rounded-group border border-line bg-surface p-4" aria-label="老师测试专用颁奖体验" data-testid="badge-preview-controls">
    <h2 className="text-headline text-ink">老师测试专用</h2>
    <p className="mt-1 text-footnote text-ink-2">体验正式全屏颁奖效果。仅预览，不发放徽章，不改变学习记录和收藏。</p>
    <label className="mt-3 block text-footnote text-ink-2" htmlFor="badge-preview-select">选择体验徽章</label>
    <select id="badge-preview-select" value={selected} onChange={event => setSelected(event.target.value)} className="mt-1 min-h-[44px] w-full rounded-control border border-line bg-surface px-3 text-callout text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
      {V5_MEDALS.map(item => <option key={item.assetId} value={item.assetId}>{item.title}</option>)}
    </select>
    <div className="mt-3 flex flex-wrap gap-3">
      <Button onClick={() => start([medal])}>体验颁奖</Button>
      {tiered && <Button variant="secondary" onClick={() => start(V5_MEDALS.filter(item => item.series === medal.series))}>连续体验四级</Button>}
    </div>
    <AwardCeremony key={current ? `preview:${active!.run}:${current.assetId}` : 'preview-closed'} open={Boolean(current)} badge={current ? { key: `preview_${current.assetId}`, assetId: current.assetId, title: current.title } : null} remainingCount={remaining} onContinue={next} onSkipAll={close} onRevealComplete={() => { if (remaining > 0) next(); }} preview debug />
  </section>;
}
