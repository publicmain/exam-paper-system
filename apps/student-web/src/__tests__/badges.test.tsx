import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { Dialog } from '../design/Dialog';
import BadgesPage from '../pages/Badges';
import AchievementNotifier from '../components/AchievementNotifier';
import type { AchievementBadge, AchievementNoticeKeys, AchievementsList } from '../lib/api';
import { writeToken } from '../lib/identity';
import { __resetForTest, adoptSession } from '../lib/auth-store';
import { __resetAchievementNoticesForTest, claimAchievementNotices, dismissAchievementNotices, getAchievementNotices, resetAchievementNotices, syncAchievementNotices } from '../lib/achievement-notices';

// UI state-machine tests; real renderer/GLB bridge has its own integration tests.
vi.mock('../components/MedalViewer', () => ({
  MedalImage: ({ assetId, locked, className }: { assetId: string; locked?: boolean; className?: string }) => <img data-asset={assetId} data-locked={String(Boolean(locked))} className={className} alt="徽章静图" />,
  MedalViewer: ({ assetId, locked, reveal, onReady, onRevealComplete, onError }: { assetId: string; locked?: boolean; reveal?: boolean; onReady?: () => void; onRevealComplete?: () => void; onError?: () => void }) => <div data-testid="test-viewer" data-asset={assetId} data-locked={String(Boolean(locked))} data-reveal={String(Boolean(reveal))}><button onClick={onReady}>模拟模型就绪</button><button onClick={onRevealComplete}>模拟动画完成</button><button onClick={onError}>模拟三维错误</button></div>,
}));
const key = (id: string) => `v5_${id.replace(/-/g, '_')}`;
const series = ['reading', 'vocabulary', 'mastery'] as const;
const labels = { reading: '阅读探索者', vocabulary: '词汇积累者', mastery: '词汇挑战者' };
const makeList = (): AchievementsList => ({ rulesVersion: 5, unsaved: [], badges: [
  ...series.flatMap((name) => [1, 2, 3, 4].map((tier) => ({ key: key(`${name}-${tier}`), assetId: `${name}-${tier}`, series: name, tier: tier as 1 | 2 | 3 | 4, title: `${labels[name]} · ${tier}级`, description: `累计完成 ${[15, 50, 150, 300][tier - 1]} 份正式任务`, threshold: [15, 50, 150, 300][tier - 1], unit: '份', current: 0, earned: false, earnedOn: null, saved: false, revoked: null, evidence: { submissionIds: [], dates: [] }, isNew: false }))),
  ...['triad', 'worlds', 'starlight'].map((id): AchievementBadge => ({ key: key(`hidden-${id}`), assetId: null, series: 'hidden', hidden: true, tier: null, title: null, description: null, threshold: null, unit: '', current: null, earned: false, earnedOn: null, saved: false, revoked: null, evidence: null, clue: `线索 ${id}` })),
  { key: key('crown'), assetId: 'crown', series: 'legendary', tier: null, title: '群星之冠', description: '三系全部典藏', threshold: 3, unit: '系', current: 0, earned: false, earnedOn: null, saved: false, revoked: null, evidence: { submissionIds: [], dates: [] } },
] });
let list: AchievementsList, notices: AchievementNoticeKeys;
let requests: Array<{ method: string; url: string; body?: { keys?: string[] } }>;
let failure = 0, claimFailure = false, claimOverride: string[] | null;
beforeEach(() => {
  __resetForTest(); localStorage.clear(); writeToken('tok'); __resetAchievementNoticesForTest();
  list = makeList(); notices = { ceremonyKeys: [], backfillKeys: [], newKeys: [] }; requests = []; failure = 0; claimFailure = false; claimOverride = null;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET', requestBody = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, url: String(url), body: requestBody });
    let status = 200, body: unknown = {};
    if (String(url).endsWith('/achievements/sync')) body = { newlyEarned: notices.ceremonyKeys };
    else if (String(url).endsWith('/achievements/notices/claim')) {
      status = claimFailure ? 500 : 200;
      const keys = claimOverride ?? requestBody.keys.filter((k: string) => [...notices.ceremonyKeys, ...notices.backfillKeys].includes(k));
      body = { claimedKeys: keys };
      if (!claimFailure) { notices.ceremonyKeys = notices.ceremonyKeys.filter((k) => !keys.includes(k)); notices.backfillKeys = notices.backfillKeys.filter((k) => !keys.includes(k)); }
    } else if (String(url).endsWith('/achievements/notices/viewed')) { body = { ok: true }; for (const row of list.badges) if (requestBody.keys.includes(row.key)) row.isNew = false; }
    else if (String(url).endsWith('/achievements/notices')) body = notices;
    else if (String(url).endsWith('/achievements/classmates')) body = { classes: [{ id: 'a', name: 'A 班', students: [{ id: 'z', name: 'Zoe', badges: [] }, { id: 'a', name: 'Alice', badges: [{ key: key('reading-1'), assetId: 'reading-1', title: '阅读探索者 · 1级', series: 'reading', tier: 1 }], current: 999, score: 100 }] }] };
    else if (String(url).endsWith('/achievements')) { status = failure || 200; body = failure ? { code: failure === 503 ? 'module_off' : 'offline' } : list; }
    else { status = 404; }
    return { ok: status < 300, status, text: async () => JSON.stringify(body) } as Response;
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); __resetAchievementNoticesForTest(); });
const settle = async () => { await act(async () => { for (let i = 0; i < 55; i++) await Promise.resolve(); }); };
const advanceTime = async (ms: number) => { act(() => { vi.advanceTimersByTime(ms); }); await settle(); };
const mount = () => render(<MemoryRouter initialEntries={['/growth/badges']}><BadgesPage /></MemoryRouter>);
function unlock(id: string) {
  const badge = list.badges.find((row) => row.key === key(id))!;
  Object.assign(badge, { earned: true, saved: true, isNew: true, current: badge.threshold, assetId: id, grantedAt: '2026-09-17T09:00:00.000Z' });
  return badge;
}
function queue(ids: string[], historical = false) {
  ids.forEach(unlock); const keys = ids.map(key);
  if (historical) notices.backfillKeys = keys; else notices.ceremonyKeys = keys;
  notices.newKeys = keys;
}
function Harness({ blocker = false }: { blocker?: boolean }) {
  const navigate = useNavigate(), location = useLocation();
  const [blocked, setBlocked] = useState(blocker), [finished, setFinished] = useState(false);
  return <><main id="main"><button onClick={() => navigate('/today')}>回首页</button><button onClick={() => navigate('/lesson/reading')}>进入阅读</button><button onClick={() => setFinished(true)}>完成学习</button>{finished && <section data-achievement-safe={location.pathname}>结果回顾</section>}</main><Dialog open={blocked} onClose={() => setBlocked(false)} title="正在查词" footer={<button onClick={() => setBlocked(false)}>关闭查词</button>} /><AchievementNotifier /></>;
}
const celebrate = (path = '/today', blocker = false) => render(<MemoryRouter initialEntries={[path]}><Harness blocker={blocker} /></MemoryRouter>);

describe('V5 independent collection and privacy', () => {
  it('shows 16 separate badges, only 13 ordinary thumbnails, no model until selected, and no legacy awards', async () => {
    list.legacyBadges = [{ ...list.badges[0], key: 'v3_legacy', title: '旧奖章' }];
    mount(); await settle();
    expect(screen.getByTestId('medal-collection').querySelectorAll('button')).toHaveLength(16);
    expect(screen.getByTestId('medal-collection').querySelectorAll('img')).toHaveLength(13);
    expect(screen.queryByTestId('test-viewer')).toBeNull();
    expect(screen.getByTestId('medal-overview').textContent).toContain('0 / 16');
    expect(screen.queryByText('旧奖章')).toBeNull();
    expect(requests.map((r) => r.url)).toEqual(['/api/achievements']);
  });
  it('locked ordinary 3D stays gray, shows own progress, and cannot replay', async () => {
    list.badges[0].current = 7; mount(); await settle(); fireEvent.click(screen.getByTestId(`medal-card-${key('reading-1')}`));
    expect(screen.getByTestId('test-viewer').getAttribute('data-locked')).toBe('true');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('7');
    expect(screen.queryByRole('button', { name: '重播获得动画' })).toBeNull();
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(0);
  });
  it('locked hidden exposes only clue, no true title/threshold/model even if server accidentally supplies them', async () => {
    Object.assign(list.badges[12], { title: '绝不能显示的名称', description: '绝不能显示的条件', assetId: 'hidden-triad', current: 11, threshold: 15 });
    mount(); await settle(); fireEvent.click(screen.getByTestId(`medal-card-${key('hidden-triad')}`));
    expect(screen.queryByTestId('test-viewer')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText('绝不能显示的名称')).toBeNull(); expect(screen.queryByText('绝不能显示的条件')).toBeNull();
    expect(screen.getByTestId('hidden-clue').textContent).toBe('线索 triad');
    expect(document.querySelector('[data-asset="hidden-triad"]')).toBeNull();
  });
  it('each earned level is independent, New clears on explicit inspection, replay never grants', async () => {
    unlock('reading-1'); unlock('reading-2'); mount(); await settle();
    expect(screen.getByTestId('medal-overview').textContent).toContain('2 / 16');
    fireEvent.click(screen.getByTestId(`medal-card-${key('reading-1')}`)); await settle();
    expect(screen.getByTestId(`medal-card-${key('reading-1')}`).textContent).not.toContain('NEW');
    expect(screen.getByTestId(`medal-card-${key('reading-2')}`).textContent).toContain('NEW');
    fireEvent.click(screen.getByRole('button', { name: '重播获得动画' }));
    expect(screen.getByTestId('test-viewer').getAttribute('data-reveal')).toBe('true');
    expect(requests.filter((r) => r.method === 'POST').map((r) => r.url)).toEqual(['/api/achievements/notices/viewed']);
  });
  it('class collection alphabetical and earned-only; peer details never show personal progress or replay', async () => {
    mount(); await settle(); fireEvent.click(screen.getByRole('tab', { name: '班级收藏' })); await settle();
    expect(screen.getAllByTestId(/^classmate-/).map((row) => row.dataset.testid)).toEqual(['classmate-a', 'classmate-z']);
    fireEvent.click(screen.getByRole('button', { name: '查看Alice的阅读探索者 · 1级' }));
    expect(screen.getByTestId('test-viewer').getAttribute('data-locked')).toBe('false');
    expect(screen.queryByTestId('private-progress')).toBeNull(); expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('button', { name: '重播获得动画' })).toBeNull();
    expect(screen.getByTestId('medal-detail').textContent).not.toContain('999');
    expect(requests.filter((r) => r.method === 'POST')).toHaveLength(0);
  });
  it('offline loading has a retry and does not invent an empty collection', async () => {
    failure = 500; mount(); await settle(); expect(screen.getByTestId('badges-error')).toBeTruthy();
    failure = 0; fireEvent.click(screen.getByRole('button', { name: '重试' })); await settle(); expect(screen.getByTestId('medal-collection')).toBeTruthy();
  });
  it('module-off never loads the 3D viewer', async () => { failure = 503; mount(); await settle(); expect(screen.getByTestId('badges-off')).toBeTruthy(); expect(screen.queryByTestId('test-viewer')).toBeNull(); });
  it('initial sync refreshes saved medals on this same page rather than leaving stale gray cards', async () => {
    const original = fetch;
    list.unsaved = [key('reading-1')];
    vi.stubGlobal('fetch', vi.fn(async (...args: Parameters<typeof fetch>) => {
      if (String(args[0]).endsWith('/achievements/sync')) { unlock('reading-1'); list.unsaved = []; notices.backfillKeys = [key('reading-1')]; }
      return original(...args);
    }));
    mount(); await settle(); expect(screen.getByTestId('medal-overview').textContent).toContain('1 / 16');
  });
  it('keyboard arrows and Home switch tabs and preserve a single tab stop', async () => {
    mount(); await settle(); const mine = screen.getByRole('tab', { name: '我的徽章' }); mine.focus(); fireEvent.keyDown(mine, { key: 'ArrowRight' }); await settle();
    const group = screen.getByRole('tab', { name: '班级收藏' }); expect(document.activeElement).toBe(group); expect(group.tabIndex).toBe(0); expect(mine.tabIndex).toBe(-1);
    fireEvent.keyDown(group, { key: 'Home' }); expect(document.activeElement).toBe(mine);
  });
});

describe('V5 saved notices, claim and automatic ceremony', () => {
  it('keeps all four levels independently in catalog order and repeated sync cannot duplicate', async () => {
    queue(['reading-4', 'reading-2', 'reading-1', 'reading-3']); await syncAchievementNotices();
    expect(getAchievementNotices().map((n) => n.badge.assetId)).toEqual(['reading-1', 'reading-2', 'reading-3', 'reading-4']);
    await syncAchievementNotices(); expect(getAchievementNotices()).toHaveLength(4);
    expect(getAchievementNotices().every((n) => !n.claimed)).toBe(true);
  });
  it('claims before first frame, auto-advances each level, and leaves last until Continue', async () => {
    vi.useFakeTimers();
    queue(['reading-1', 'reading-2']); celebrate(); await settle();
    expect(requests.find((r) => r.url.endsWith('/notices/claim'))?.body?.keys).toEqual([key('reading-1'), key('reading-2')]);
    expect(screen.getByTestId('test-viewer').getAttribute('data-asset')).toBe('reading-1');
    expect(screen.getByTestId('achievement-award').className).toContain('h-[100dvh]');
    fireEvent.click(screen.getByRole('button', { name: '模拟模型就绪' }));
    fireEvent.click(screen.getByRole('button', { name: '模拟动画完成' })); await advanceTime(4799);
    expect(screen.getByTestId('test-viewer').getAttribute('data-asset')).toBe('reading-1');
    expect(requests.some((r) => r.url.endsWith('/viewed'))).toBe(false);
    await advanceTime(1);
    expect(screen.getByTestId('test-viewer').getAttribute('data-asset')).toBe('reading-2');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '模拟模型就绪' })); await advanceTime(60000);
    expect(screen.getByTestId('achievement-award')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '继续' })); await settle();
    expect(screen.queryByRole('dialog')).toBeNull(); expect(getAchievementNotices()).toHaveLength(0);
  });
  it('an external-store handoff committed before local selection clears cannot consume the next medal', async () => {
    vi.useFakeTimers();
    queue(['reading-1', 'hidden-worlds']); celebrate(); await settle();
    expect(screen.getByTestId('test-viewer').getAttribute('data-asset')).toBe('reading-1');
    // Native iframe messages can commit useSyncExternalStore removal before the
    // following local setOpened(null). Model that intermediate frame directly.
    act(() => { dismissAchievementNotices([key('reading-1')]); });
    await settle();
    expect(getAchievementNotices().map((notice) => notice.badge.assetId)).toEqual(['hidden-worlds']);
    expect(screen.getByTestId('test-viewer').getAttribute('data-asset')).toBe('hidden-worlds');
    fireEvent.click(screen.getByRole('button', { name: '模拟模型就绪' })); await advanceTime(60000);
    expect(screen.getByRole('button', { name: '继续' })).toBeTruthy();
    expect(screen.getByTestId('achievement-award')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '继续' })); await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('failed claim never shows unclaimed animation or marks viewed', async () => {
    queue(['reading-1']); claimFailure = true; celebrate(); await settle();
    expect(screen.queryByTestId('achievement-award')).toBeNull();
    expect(getAchievementNotices()[0].claimed).toBe(false);
    expect(requests.some((r) => r.url.endsWith('/viewed'))).toBe(false);
  });
  it('failed claim retries when connectivity returns instead of trapping the notification', async () => {
    queue(['reading-1']); claimFailure = true; celebrate(); await settle(); claimFailure = false;
    fireEvent(window, new Event('online')); await settle(); expect(screen.getByTestId('achievement-award')).toBeTruthy();
  });
  it('losing an atomic claim to another tab removes only those notices without display', async () => {
    queue(['reading-1', 'reading-2']); claimOverride = []; celebrate(); await settle();
    expect(screen.queryByTestId('achievement-award')).toBeNull(); expect(getAchievementNotices()).toHaveLength(0);
  });
  it('backfill is one summary, no 3D ceremony and no fake viewed state', async () => {
    queue(['reading-1', 'reading-2'], true); celebrate(); await settle();
    expect(screen.getByTestId('achievement-backfill').textContent).toContain('本次补入 2 枚');
    expect(screen.queryByTestId('test-viewer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '稍后查看' })); await settle();
    expect(screen.queryByRole('dialog')).toBeNull(); expect(list.badges[0].isNew).toBe(true);
  });
  it.each(['/lesson/reading', '/coach/learn', '/coach/test'])('waits on %s without claiming, opens only at safe pause', async (path) => {
    queue(['vocabulary-1']); celebrate(path); await settle();
    expect(screen.queryByTestId('achievement-award')).toBeNull(); expect(requests.some((r) => r.url.endsWith('/claim'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '回首页' })); await settle();
    expect(screen.getByTestId('achievement-award')).toBeTruthy();
  });
  it('finished task safe marker allows celebration without route change', async () => {
    queue(['vocabulary-1']); await syncAchievementNotices(); celebrate('/coach/learn'); await settle(); fireEvent.click(screen.getByRole('button', { name: '完成学习' })); await settle(); expect(screen.getByTestId('achievement-award')).toBeTruthy();
  });
  it('waits for an existing modal to close and never stacks it', async () => {
    queue(['reading-1']); celebrate('/today', true); await settle();
    expect(screen.getAllByRole('dialog')).toHaveLength(1); expect(requests.some((r) => r.url.endsWith('/claim'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '关闭查词' })); await settle();
    expect(screen.getAllByRole('dialog')).toHaveLength(1); expect(screen.getByTestId('achievement-award')).toBeTruthy();
  });
  it('Escape skips the complete claimed batch but retains New and cannot force replay after reload', async () => {
    queue(['reading-1', 'reading-2']); celebrate(); await settle();
    fireEvent.keyDown(screen.getByTestId('achievement-award'), { key: 'Escape' }); await settle();
    expect(screen.queryByRole('dialog')).toBeNull(); expect(list.badges[0].isNew).toBe(true); expect(list.badges[1].isNew).toBe(true);
    await act(async () => { __resetAchievementNoticesForTest(); await syncAchievementNotices(); }); await settle();
    expect(screen.queryByRole('dialog')).toBeNull(); expect(getAchievementNotices()).toHaveLength(0);
  });
  it('route interruption clears all already-claimed medals but not New', async () => {
    queue(['reading-1', 'reading-2']); celebrate(); await settle(); fireEvent.click(screen.getByRole('button', { name: '进入阅读' })); await settle();
    expect(screen.queryByTestId('achievement-award')).toBeNull(); expect(getAchievementNotices()).toHaveLength(0); expect(list.badges[0].isNew).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '回首页' })); await settle(); expect(screen.queryByTestId('achievement-award')).toBeNull();
  });
  it('WebGL failure still offers Continue; the student cannot get trapped', async () => {
    vi.useFakeTimers();
    queue(['reading-1']); celebrate(); await settle(); fireEvent.click(screen.getByRole('button', { name: '模拟三维错误' })); await settle();
    expect(screen.getByText('已改为图片展示，徽章已保存。')).toBeTruthy();
    await advanceTime(2700);
    fireEvent.click(screen.getByRole('button', { name: '继续' })); await settle(); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('account changes synchronously unmount a previous identity ceremony', async () => {
    queue(['reading-1']); celebrate(); await settle(); act(() => { writeToken('b'); resetAchievementNotices(); }); await settle(); expect(screen.queryByTestId('achievement-award')).toBeNull(); expect(getAchievementNotices()).toHaveLength(0);
  });
  it('background tab does not claim; hiding an active ceremony preserves New without replay', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    queue(['reading-1']); celebrate(); await settle(); expect(requests.some((r) => r.url.endsWith('/claim'))).toBe(false);
    visibility.mockReturnValue('visible'); fireEvent(document, new Event('visibilitychange')); await settle(); expect(screen.getByTestId('achievement-award')).toBeTruthy();
    visibility.mockReturnValue('hidden'); fireEvent(document, new Event('visibilitychange')); await settle(); expect(screen.queryByTestId('achievement-award')).toBeNull(); expect(list.badges[0].isNew).toBe(true);
    visibility.mockReturnValue('visible'); fireEvent(document, new Event('visibilitychange')); await settle(); expect(screen.queryByTestId('achievement-award')).toBeNull();
  });
  it('late A sync cannot populate B queue', async () => {
    let resolve!: (r: Response) => void; vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { resolve = r; })));
    const work = syncAchievementNotices(); writeToken('b'); resetAchievementNotices(); resolve({ ok: true, status: 200, text: async () => JSON.stringify({ newlyEarned: [key('reading-1')] }) } as Response);
    await work; expect(getAchievementNotices()).toHaveLength(0);
  });
  it('late A atomic claim cannot populate B queue', async () => {
    queue(['reading-1']); await syncAchievementNotices(); let resolve!: (r: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { resolve = r; })));
    const work = claimAchievementNotices(); writeToken('b'); resetAchievementNotices(); resolve({ ok: true, status: 200, text: async () => JSON.stringify({ claimedKeys: [key('reading-1')] }) } as Response);
    await work; expect(getAchievementNotices()).toHaveLength(0);
  });
  it('no saved list, legacy rows, or revoked rows means no invented celebration', async () => {
    queue(['reading-1']); failure = 500; await syncAchievementNotices(); expect(getAchievementNotices()).toHaveLength(0);
    failure = 0; list.badges[0].revoked = { at: '2026-09-17', reason: 'duplicate' }; await syncAchievementNotices(); expect(getAchievementNotices()).toHaveLength(0);
  });
  it('offline sync is a harmless optional-feature failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); })); await expect(syncAchievementNotices()).resolves.toBeUndefined(); expect(getAchievementNotices()).toHaveLength(0);
  });
  it('display-only teacher preview defers real award notices without claiming, viewing or discarding them', async () => {
    adoptSession('tok', {id:'cmtqgmjl200u6stuq31xrad59',name:'老师测试号',nickname:'',avatar:null});
    render(<MemoryRouter initialEntries={['/growth/badges']}><BadgesPage /><AchievementNotifier /></MemoryRouter>);
    await settle(); const before = requests.length;
    fireEvent.click(screen.getByRole('button',{name:'体验颁奖'})); await settle();
    expect(screen.getByTestId('achievement-preview')).toBeTruthy();
    expect(requests.length).toBe(before);
    queue(['reading-1']); await act(async()=>{await syncAchievementNotices();}); await settle();
    expect(screen.queryByTestId('achievement-award')).toBeNull();
    expect(requests.some(r=>r.url.endsWith('/notices/claim')||r.url.endsWith('/notices/viewed'))).toBe(false);
    expect(getAchievementNotices()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'跳过全部动画'})); await settle();
    expect(screen.queryByTestId('achievement-preview')).toBeNull();
    expect(screen.getByTestId('achievement-award')).toBeTruthy();
    expect(list.badges[0].isNew).toBe(true);
    expect(requests.filter(r=>r.url.endsWith('/notices/claim'))).toHaveLength(1);
    expect(requests.some(r=>r.url.endsWith('/notices/viewed'))).toBe(false);
  });
});
