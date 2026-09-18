import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AwardCeremony, type AwardCeremonyProps } from '../components/AwardCeremony';

vi.mock('../components/MedalViewer', () => ({
  MedalViewer: ({ assetId, reveal, onRevealComplete, onError }: { assetId: string; reveal?: boolean; onRevealComplete: () => void; onError: () => void }) => <div data-testid="mock-medal" data-asset={assetId} data-reveal={String(reveal)}><button onClick={onRevealComplete}>完成动画</button><button onClick={onError}>模拟错误</button></div>,
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const props = (): AwardCeremonyProps => ({
  open: true,
  badge: { key: 'v5_reading_1', assetId: 'reading-1', title: '阅读探索者 · 初航' },
  remainingCount: 0,
  onContinue: vi.fn(), onSkipAll: vi.fn(), onRevealComplete: vi.fn(),
});

it('preview uses the real fullscreen reveal but clearly identifies display-only and performs no requests', () => {
  const input = props(), fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  render(<AwardCeremony {...input} preview />);
  expect(screen.getByTestId('achievement-preview').className).toContain('h-[100dvh]');
  expect(screen.queryByTestId('achievement-award')).toBeNull();
  expect(screen.getByText('颁奖体验 · 仅展示动画，不解锁徽章，也不改变学习记录。')).toBeTruthy();
  expect(screen.getByTestId('mock-medal').getAttribute('data-reveal')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: '完成动画' }));
  expect(input.onRevealComplete).toHaveBeenCalledOnce();
  expect(screen.getByText('可以转动、翻面欣赏。准备好后点「继续」。')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '继续' }));
  expect(input.onContinue).toHaveBeenCalledOnce();
  expect(fetch).not.toHaveBeenCalled();
});

it('preview error never claims a medal was earned or saved, and Escape exits through the preview callback', () => {
  const input = props(); render(<AwardCeremony {...input} preview />);
  fireEvent.click(screen.getByRole('button', { name: '模拟错误' }));
  expect(screen.getByText('三维暂时不可用，已改为静态体验。不会解锁徽章或改变学习记录。')).toBeTruthy();
  expect(screen.queryByText(/徽章已保存/)).toBeNull();
  expect(screen.queryByText(/成为一枚新的收藏/)).toBeNull();
  fireEvent.keyDown(screen.getByTestId('achievement-preview'), { key: 'Escape' });
  expect(input.onSkipAll).toHaveBeenCalledOnce();
});

it('new badges and repeated openings reset completed/error UI', () => {
  const input = props(); const { rerender } = render(<AwardCeremony {...input} preview />);
  fireEvent.click(screen.getByRole('button', { name: '模拟错误' }));
  rerender(<AwardCeremony {...input} preview badge={{ key: 'v5_reading_2', assetId: 'reading-2', title: '阅读探索者 · 远航' }} />);
  expect(screen.queryByText(/三维暂时不可用/)).toBeNull();
  expect(screen.queryByText(/可以转动、翻面欣赏/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '完成动画' }));
  rerender(<AwardCeremony {...input} preview open={false} />);
  expect(screen.queryByRole('dialog')).toBeNull();
  rerender(<AwardCeremony {...input} preview />);
  expect(screen.queryByText(/可以转动、翻面欣赏/)).toBeNull();
});

it('normal award semantics and queue controls remain unchanged', () => {
  const input = props(); render(<AwardCeremony {...input} remainingCount={2} />);
  expect(screen.getByTestId('achievement-award')).toBeTruthy();
  expect(screen.queryByTestId('achievement-preview')).toBeNull();
  expect(screen.getByText('你的努力，已成为一枚新的收藏。')).toBeTruthy();
  expect(screen.getByText('此后还有 2 枚，依次为你呈现')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '下一枚' }));
  expect(input.onContinue).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '跳过全部动画' }));
  expect(input.onSkipAll).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: '模拟错误' }));
  expect(screen.getByText('三维暂时不可用，徽章已保存。可以继续，之后在收藏里再看。')).toBeTruthy();
});

it('an empty selection does not open a modal or load a medal', () => {
  render(<AwardCeremony {...props()} badge={null} preview />);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByTestId('mock-medal')).toBeNull();
});
