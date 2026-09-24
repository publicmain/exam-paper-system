import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AwardCeremony, type AwardCeremonyProps } from '../components/AwardCeremony';
import { medalAwardReason, V5_MEDALS } from '../lib/medal-catalog';

vi.mock('../components/MedalViewer', () => ({
  MedalViewer: ({ assetId, reveal, ceremony, hold, fallbackRequested, onReady, onRevealComplete, onError }: { assetId: string; reveal?: boolean; ceremony?: boolean; hold?: boolean; fallbackRequested?: boolean; onReady?: () => void; onRevealComplete?: () => void; onError?: () => void }) => <div data-testid="mock-medal" data-asset={assetId} data-reveal={String(reveal)} data-ceremony={String(ceremony)} data-hold={String(Boolean(hold))} data-fallback={String(Boolean(fallbackRequested))}><button onClick={onReady}>模型就绪</button><button onClick={onRevealComplete}>模型旋转结束</button><button onClick={onError}>模拟错误</button></div>,
}));

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const props = (): AwardCeremonyProps => ({
  open: true,
  badge: { key: 'v5_reading_1', assetId: 'reading-1', title: '阅读探索者 · 启程' },
  remainingCount: 0,
  onContinue: vi.fn(), onSkipAll: vi.fn(), onRevealComplete: vi.fn(),
});
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const ready = () => fireEvent.click(screen.getByRole('button', { name: '模型就绪' }));
const spun = () => fireEvent.click(screen.getByRole('button', { name: '模型旋转结束' }));
const scene = () => document.querySelector<HTMLElement>('.award-scene')!;

// 2026-09-18：文字和「继续」等徽章真正转完再出现。原来按固定时刻推进，手机一卡，
// 旋转被跳过、文字却照常冒出来，看上去就是「卡一下直接变成最终画面」。
it('holds every word until the medal has actually finished turning', () => {
  const input = props(); render(<AwardCeremony {...input} />);
  expect(screen.getByTestId('achievement-award').className).toContain('award-dialog');
  expect(screen.getByTestId('achievement-award-scrim').className).toContain('award-scrim');
  expect(screen.getByTestId('mock-medal').dataset.ceremony).toBe('true');
  expect(scene().dataset.phase).toBe('0');
  expect(document.querySelector('.award-title')).toHaveAttribute('aria-hidden', 'true');
  expect(document.querySelector('.award-reason')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.queryByRole('button', { name: '继续' })).toBeNull();
  expect(document.querySelector('.award-continue')).toHaveAttribute('hidden');
  tick(20000);
  expect(scene().dataset.phase).toBe('0');
  expect(input.onRevealComplete).not.toHaveBeenCalled();
  ready(); tick(3000);
  expect(scene().dataset.phase).toBe('0'); // 还在转，一个字都不出现
  spun(); tick(0);
  expect(scene().dataset.phase).toBe('1');
  expect(document.querySelector('.award-title')).toHaveAttribute('aria-hidden', 'false');
  expect(document.querySelector('.award-reason')).toHaveAttribute('aria-hidden', 'true');
  tick(300);
  expect(scene().dataset.phase).toBe('2');
  expect(document.querySelector('.award-reason')).toHaveAttribute('aria-hidden', 'false');
  expect(screen.queryByRole('button', { name: '继续' })).toBeNull();
  tick(500);
  expect(scene().dataset.phase).toBe('3');
  expect(screen.getByRole('button', { name: '继续' })).toBeTruthy();
  expect(input.onRevealComplete).not.toHaveBeenCalled();
});

// 开场白（2026-09-21）：模型第一次要下载一两兆，用两句话把这段时间变成仪式的一部分。
// 最少念 3 秒（2026-09-21 叶老师要求延长），模型就绪就接上（不为了演而多等）。
it('covers the model download with an opening line, then hands over to the medal', () => {
  render(<AwardCeremony {...props()} />);
  expect(screen.getByTestId('award-intro').textContent).toContain('做得好');
  expect(screen.getByTestId('award-intro').textContent).toContain('收下你的新徽章');
  expect(scene().dataset.curtain).toBe('true');
  expect(screen.getByTestId('mock-medal').dataset.hold).toBe('true'); // 幕没落，不许开转
  ready(); // 模型很快就绪也要把话说完
  tick(1199);
  expect(scene().dataset.beat).toBe('1'); // 1.2 秒前只有第一句
  tick(1); expect(scene().dataset.beat).toBe('2');
  tick(1799);
  expect(scene().dataset.curtain).toBe('true');
  expect(screen.getByTestId('mock-medal').dataset.hold).toBe('true');
  tick(1);
  expect(scene().dataset.curtain).toBe('false');
  expect(screen.getByTestId('mock-medal').dataset.hold).toBe('false');
  // 文字先淡出 0.35 秒再撤走，徽章同时淡入 —— 不是一下子换画面（2026-09-21）
  expect(screen.getByTestId('award-intro')).toBeTruthy();
  tick(400);
  expect(screen.queryByTestId('award-intro')).toBeNull();
});

it('keeps the opening line up while a slow model is still loading', () => {
  render(<AwardCeremony {...props()} />);
  tick(5000); // 话早念完了，模型还没好
  expect(scene().dataset.curtain).toBe('true');
  expect(screen.getByTestId('award-intro')).toBeTruthy();
  ready();
  expect(scene().dataset.curtain).toBe('false'); // 一就绪立刻落幕，不再多等
  expect(screen.getByTestId('mock-medal').dataset.hold).toBe('false');
});

// 模型慢 / 一直等不到「转完」时不能卡死：落幕后 6 秒兜底照常往下走。
// （从落幕算，不从就绪算 —— 开场白要念 3 秒，从就绪算会把「淡入 + 转一圈」的时间挤掉。）
it('requests an explicit image fallback after six seconds instead of pretending the spin completed', () => {
  const input = props(); render(<AwardCeremony {...input} />);
  ready(); tick(3000);
  expect(scene().dataset.curtain).toBe('false');
  tick(5999);
  expect(scene().dataset.phase).toBe('0');
  tick(1); tick(0);
  expect(screen.getByTestId('mock-medal').dataset.fallback).toBe('true');
  expect(scene().dataset.phase).toBe('0');
  expect(input.onRevealComplete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '模拟错误' }));
  spun(); tick(0);
  expect(scene().dataset.phase).toBe('1');
  tick(800);
  expect(screen.getByRole('button', { name: '继续' })).toBeTruthy();
  expect(input.onRevealComplete).not.toHaveBeenCalled();
});

it('preview is clearly display-only, waits for Continue and never makes requests', () => {
  const input = props(), fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  render(<AwardCeremony {...input} preview />);
  expect(screen.getByTestId('achievement-preview').className).toContain('h-[100dvh]');
  expect(screen.queryByTestId('achievement-award')).toBeNull();
  expect(screen.getByText('颁奖体验 · 不改变收藏')).toBeTruthy();
  expect(screen.getByTestId('mock-medal').dataset.reveal).toBe('true');
  ready(); tick(3000); spun(); tick(60000);
  expect(input.onRevealComplete).toHaveBeenCalledOnce();
  expect(input.onContinue).not.toHaveBeenCalled();
  expect(screen.getByTestId('achievement-preview')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '继续' }));
  expect(input.onContinue).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
});

it('keeps text readable before notifying the queue', () => {
  const input = props(); render(<AwardCeremony {...input} remainingCount={2} />);
  ready(); tick(3000); spun(); tick(800);
  expect(screen.getByRole('button', { name: '下一枚' })).toBeTruthy();
  expect(screen.getByText('还有 2 枚，即将依次呈现')).toBeTruthy();
  tick(2099); expect(input.onRevealComplete).not.toHaveBeenCalled();
  tick(1); expect(input.onRevealComplete).toHaveBeenCalledOnce();
  ready(); spun(); tick(20000);
  expect(input.onRevealComplete).toHaveBeenCalledOnce();
});

it('permits skip and Escape before loading or title reveal', () => {
  const input = props(); render(<AwardCeremony {...input} preview />);
  fireEvent.click(screen.getByRole('button', { name: '跳过全部动画' }));
  expect(input.onSkipAll).toHaveBeenCalledOnce();
  expect(input.onContinue).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByTestId('achievement-preview'), { key: 'Escape' });
  expect(input.onSkipAll).toHaveBeenCalledTimes(2);
});

it('cancels pending title and queue timers on close and unmount', () => {
  const input = props(); const { rerender, unmount } = render(<AwardCeremony {...input} />);
  ready(); tick(2200);
  rerender(<AwardCeremony {...input} open={false} />);
  tick(60000); expect(input.onRevealComplete).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
  rerender(<AwardCeremony {...input} />); ready(); tick(1000); unmount();
  tick(60000); expect(input.onRevealComplete).not.toHaveBeenCalled();
});

it('new badges and repeated openings reset timing, readiness and fallback text', () => {
  const input = props(); const { rerender } = render(<AwardCeremony {...input} preview />);
  fireEvent.click(screen.getByRole('button', { name: '模拟错误' })); tick(2700);
  expect(screen.getByText('已改为图片预览，不改变收藏。')).toBeTruthy();
  rerender(<AwardCeremony {...input} preview badge={{ key: 'v5_reading_2', assetId: 'reading-2', title: '阅读探索者 · 进阶' }} />);
  expect(screen.queryByText(/已改为图片/)).toBeNull();
  expect(scene().dataset.started).toBe('false');
  expect(scene().dataset.phase).toBe('0');
  expect(screen.getByTestId('mock-medal').dataset.asset).toBe('reading-2');
  tick(6000); expect(input.onRevealComplete).not.toHaveBeenCalled();
  ready(); spun(); tick(800);
  expect(screen.getByRole('button', { name: '继续' })).toBeTruthy();
  rerender(<AwardCeremony {...input} preview open={false} />);
  rerender(<AwardCeremony {...input} preview />);
  expect(scene().dataset.started).toBe('false');
  expect(scene().dataset.phase).toBe('0');
  expect(screen.queryByRole('button', { name: '继续' })).toBeNull();
});

it('fallback starts a usable reveal without implying a preview was awarded', () => {
  const input = props(); const { rerender } = render(<AwardCeremony {...input} preview />);
  fireEvent.click(screen.getByRole('button', { name: '模拟错误' }));
  expect(scene().dataset.started).toBe('true');
  expect(screen.getByText('已改为图片预览，不改变收藏。')).toBeTruthy();
  expect(screen.queryByText(/徽章已保存/)).toBeNull();
  tick(3000);
  expect(screen.queryByRole('button', { name: '继续' })).toBeNull();
  expect(input.onRevealComplete).not.toHaveBeenCalled();
  spun(); tick(800);
  expect(screen.getByRole('button', { name: '继续' })).toBeTruthy();
  rerender(<AwardCeremony {...input} />);
  expect(screen.getByText('已改为图片展示，徽章已保存。')).toBeTruthy();
});

it('never advances an immediate-error medal behind the opening curtain', () => {
  const input = props(); render(<AwardCeremony {...input} remainingCount={3} />);
  fireEvent.click(screen.getByRole('button', { name: '模拟错误' }));
  tick(2999);
  expect(scene().dataset.curtain).toBe('true');
  expect(scene().dataset.phase).toBe('0');
  expect(input.onRevealComplete).not.toHaveBeenCalled();
  tick(1);
  expect(scene().dataset.curtain).toBe('false');
  tick(2600);
  expect(scene().dataset.phase).toBe('0'); // image still controls completion
  spun(); tick(2899);
  expect(input.onRevealComplete).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '下一枚' })).toBeTruthy();
  tick(1); expect(input.onRevealComplete).toHaveBeenCalledOnce();
});

it('ignores an early completion for reading and queue timing until the curtain opens', () => {
  const input = props(); render(<AwardCeremony {...input} remainingCount={1} />);
  ready(); spun(); tick(2999);
  expect(scene().dataset.phase).toBe('0');
  expect(input.onRevealComplete).not.toHaveBeenCalled();
  tick(1); tick(2899);
  expect(input.onRevealComplete).not.toHaveBeenCalled();
  tick(1); expect(input.onRevealComplete).toHaveBeenCalledOnce();
});

it('reduced motion shows copy and actions immediately after ready with a reading dwell', () => {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('prefers-reduced-motion'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const input = props(); render(<AwardCeremony {...input} />);
  expect(scene().dataset.reduced).toBe('true');
  ready(); expect(scene().dataset.phase).toBe('3');
  spun();
  expect(screen.getByRole('button', { name: '继续' })).toBeTruthy();
  tick(3199); expect(input.onRevealComplete).not.toHaveBeenCalled();
  tick(1); expect(input.onRevealComplete).toHaveBeenCalledOnce();
  tick(60000); expect(input.onContinue).not.toHaveBeenCalled();
});

it('turning reduced motion off live never hides already-revealed copy or Continue', () => {
  const listeners = new Set<() => void>();
  const media = {
    matches: true,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn((_type: string, listener: () => void) => { listeners.add(listener); }),
    removeEventListener: vi.fn((_type: string, listener: () => void) => { listeners.delete(listener); }),
  };
  vi.stubGlobal('matchMedia', vi.fn((query: string) => query.includes('prefers-reduced-motion') ? media : { matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const input = props(); render(<AwardCeremony {...input} />);
  ready(); spun(); tick(1000);
  expect(scene().dataset.phase).toBe('3');
  act(() => { media.matches = false; listeners.forEach(listener => listener()); });
  expect(scene().dataset.reduced).toBe('false');
  spun(); // 关掉「减少动态」之后，模型这一圈照常转完
  for (const elapsed of [0, 1900, 300, 500]) {
    tick(elapsed);
    expect(scene().dataset.phase).toBe('3');
    expect(document.querySelector('.award-title')).toHaveAttribute('aria-hidden', 'false');
    expect(document.querySelector('.award-reason')).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByRole('button', { name: '继续' })).toBeTruthy();
  }
  tick(60000);
  expect(input.onRevealComplete).toHaveBeenCalledOnce();
  expect(input.onContinue).not.toHaveBeenCalled();
});

it('an empty selection does not open a modal or load a medal', () => {
  render(<AwardCeremony {...props()} badge={null} preview />);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByTestId('mock-medal')).toBeNull();
});

it('reduced motion never auto-advances a fallback image that is still loading', () => {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('prefers-reduced-motion'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const input=props(); render(<AwardCeremony {...input} remainingCount={2} />);
  fireEvent.click(screen.getByRole('button',{name:'模拟错误'}));
  tick(20000); expect(input.onRevealComplete).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'下一枚'})).toBeTruthy();
  spun(); tick(3199);expect(input.onRevealComplete).not.toHaveBeenCalled();
  tick(1);expect(input.onRevealComplete).toHaveBeenCalledOnce();
});

it('reduced motion also requests fallback when a ready renderer never reports completion', () => {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('prefers-reduced-motion'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const input=props(); render(<AwardCeremony {...input} remainingCount={2} />);
  ready(); tick(6000);
  expect(screen.getByTestId('mock-medal').dataset.fallback).toBe('true');
  expect(input.onRevealComplete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'模拟错误'}));
  spun(); tick(3200);expect(input.onRevealComplete).toHaveBeenCalledOnce();
});

it('all 16 medals have brief copy preserving quantities, word-batch semantics and task dates', () => {
  expect(V5_MEDALS).toHaveLength(16);
  for (const medal of V5_MEDALS) {
    const reason = medalAwardReason(medal.assetId);
    expect(reason.length).toBeGreaterThan(5);
    expect(reason.length).toBeLessThanOrEqual(32);
    expect(reason).not.toContain('每一份努力，都值得珍藏');
    if (medal.series === 'reading') expect(reason).toBe('累计完成 ' + medal.threshold + ' 篇阅读');
    if (medal.series === 'vocabulary') {
      expect(reason).toBe('累计学完 ' + medal.threshold + ' 份每日新词');
      expect(reason).not.toMatch(/个单词|个新词/);
    }
    if (medal.series === 'mastery') expect(reason).toBe(medal.threshold + ' 份正式测验首次达到 80%');
  }
  expect(medalAwardReason('hidden-triad')).toContain('任务日');
  expect(medalAwardReason('hidden-triad')).not.toContain('连续');
  expect(medalAwardReason('hidden-worlds')).toMatch(/5 类主题.*3 篇阅读/);
  expect(medalAwardReason('hidden-starlight')).toBe('4 个自然月，每月至少 15 天正式学习');
  expect(medalAwardReason('crown')).toBe('集齐三大系列的全部四级徽章');
  expect(medalAwardReason('missing')).toBe('每一份努力，都值得珍藏');
});
