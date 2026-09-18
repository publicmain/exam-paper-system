import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MedalImage, MedalViewer } from '../components/MedalViewer';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const message = (frame: HTMLIFrameElement, status: string, origin = window.location.origin, source: Window | null = frame.contentWindow) => fireEvent(window, new MessageEvent('message', { origin, source, data: { type: 'equistar-medal-viewer', status } }));
it('grid thumbnail loads only a picture, with an accessible fallback', () => {
  render(<MedalImage assetId="reading-1" thumbnail locked />);
  expect(document.querySelector('iframe')).toBeNull();
  const img = screen.getByRole('img'); expect(img.getAttribute('src')).toBe('/medals/v5/thumbs/reading-1.png'); expect(img.className).toContain('grayscale');
  fireEvent.error(img); expect(screen.getByRole('img')).toBeTruthy();
});
it('locked 3D cannot start a reveal even when caller passes reveal', () => {
  render(<MedalViewer assetId="reading-2" locked reveal />);
  const frame = screen.getByTestId('medal-3d-frame') as HTMLIFrameElement;
  expect(frame.src).toContain('locked=1'); expect(frame.src).toContain('reveal=0');
  expect(screen.getByTestId('medal-stage').className).toContain('w-full');
});
it('accepts only messages from the exact same-origin active iframe; complete fires once', () => {
  const done = vi.fn(); render(<MedalViewer assetId="reading-1" reveal onRevealComplete={done} />);
  const frame = screen.getByTestId('medal-3d-frame') as HTMLIFrameElement;
  message(frame, 'complete', 'https://evil.example'); message(frame, 'complete', window.location.origin, window); expect(done).not.toHaveBeenCalled();
  message(frame, 'ready'); expect(frame.className).not.toContain('invisible');
  message(frame, 'complete'); message(frame, 'complete'); expect(done).toHaveBeenCalledTimes(1);
});
it('manual reduced motion updates the active iframe without recreating or replaying it', () => {
  render(<MedalViewer assetId="reading-3" reveal />); const frame = screen.getByTestId('medal-3d-frame') as HTMLIFrameElement;
  message(frame, 'ready'); fireEvent.click(screen.getByRole('checkbox')); expect(screen.getByTestId('medal-3d-frame')).toBe(frame);
});
it('WebGL failure releases the iframe, keeps poster, reports failure and completes fallback safely', () => {
  vi.useFakeTimers(); const error = vi.fn(), done = vi.fn(); render(<MedalViewer assetId="reading-4" reveal onError={error} onRevealComplete={done} />);
  message(screen.getByTestId('medal-3d-frame') as HTMLIFrameElement, 'error'); expect(error).toHaveBeenCalledTimes(1); expect(document.querySelector('iframe')).toBeNull(); expect(screen.getByRole('img')).toBeTruthy();
  act(() => vi.advanceTimersByTime(1300)); expect(done).toHaveBeenCalledTimes(1);
});
it('a lost frame/chunk times out to poster rather than trapping students in loading', () => {
  vi.useFakeTimers(); const error = vi.fn(); render(<MedalViewer assetId="crown" onError={error} />);
  act(() => vi.advanceTimersByTime(15100)); expect(error).toHaveBeenCalledTimes(1); expect(document.querySelector('iframe')).toBeNull();
  expect(screen.getByRole('button', { name: '重试三维' })).toBeTruthy();
});
it('ceremony is transparent and control-free, starts once after ready and ignores early completion', () => {
  vi.useFakeTimers(); const ready=vi.fn(),done=vi.fn();
  render(<MedalViewer assetId="reading-1" reveal ceremony onReady={ready} onRevealComplete={done} />);
  const frame=screen.getByTestId('medal-3d-frame') as HTMLIFrameElement;
  const send=vi.spyOn(frame.contentWindow!,'postMessage');
  expect(frame.src).toContain('ceremony=1');
  expect(frame.tabIndex).toBe(-1);
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.queryByRole('button',{name:'背面'})).toBeNull();
  expect(screen.getByTestId('medal-stage').style.background).toBe('');
  message(frame,'complete');expect(done).not.toHaveBeenCalled();
  message(frame,'ready');message(frame,'ready');expect(ready).toHaveBeenCalledOnce();
  act(()=>vi.advanceTimersByTime(299));expect(send.mock.calls.filter(([m])=>m.action==='start')).toHaveLength(0);
  act(()=>vi.advanceTimersByTime(1));expect(send.mock.calls.filter(([m])=>m.action==='start')).toHaveLength(1);
  message(frame,'complete');message(frame,'complete');expect(done).toHaveBeenCalledOnce();
});
it('ceremony falls back within four seconds and does not strand students behind a failed model', () => {
  vi.useFakeTimers();const error=vi.fn();render(<MedalViewer assetId="crown" reveal ceremony onError={error} />);
  act(()=>vi.advanceTimersByTime(4000));expect(error).toHaveBeenCalledOnce();
  expect(screen.queryByTestId('medal-3d-frame')).toBeNull();expect(screen.getByRole('img')).toBeTruthy();
  expect(screen.queryByRole('button',{name:'重试三维'})).toBeNull();
});
it('ceremony iframe explicitly matches the child light color scheme even in a dark parent, without overriding collection viewers', () => {
  const previous = document.documentElement.style.colorScheme;
  document.documentElement.style.colorScheme = 'dark';
  try {
    const { rerender } = render(<MedalViewer assetId="reading-1" reveal ceremony />);
    const frame = screen.getByTestId('medal-3d-frame') as HTMLIFrameElement;
    expect(frame.style.colorScheme).toBe('light');
    expect(frame.src).toContain('ceremony=1');
    message(frame, 'ready');
    expect(frame.style.colorScheme).toBe('light');
    rerender(<MedalViewer assetId="reading-1" />);
    const ordinaryFrame = screen.getByTestId('medal-3d-frame') as HTMLIFrameElement;
    expect(ordinaryFrame.style.colorScheme).toBe('');
    expect(ordinaryFrame.src).not.toContain('ceremony=1');
  } finally {
    document.documentElement.style.colorScheme = previous;
  }
});
it('unmount cancels a pending ceremony start', () => {
  vi.useFakeTimers();const {unmount}=render(<MedalViewer assetId="reading-1" reveal ceremony />);
  const frame=screen.getByTestId('medal-3d-frame') as HTMLIFrameElement;
  const send=vi.spyOn(frame.contentWindow!,'postMessage');message(frame,'ready');unmount();
  act(()=>vi.advanceTimersByTime(500));expect(send.mock.calls.filter(([m])=>m.action==='start')).toHaveLength(0);
});
