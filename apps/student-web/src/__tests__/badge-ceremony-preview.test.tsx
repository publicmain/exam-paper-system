import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BadgeCeremonyPreview, { canPreviewCeremony } from '../components/BadgeCeremonyPreview';
import { __resetForTest, adoptSession, logout } from '../lib/auth-store';

vi.mock('../components/MedalViewer', () => ({
  MedalViewer: ({ assetId, reveal, ceremony, onReady, onRevealComplete, onError }: { assetId: string; reveal?: boolean; ceremony?: boolean; onReady?: () => void; onRevealComplete?: () => void; onError?: () => void }) => <div data-testid="preview-model" data-asset={assetId} data-reveal={String(reveal)} data-ceremony={String(ceremony)}><button onClick={onReady}>模型就绪</button><button onClick={onRevealComplete}>模型旋转结束</button><button onClick={onError}>模型失败</button></div>,
  MedalImage: () => null,
}));
const ID = 'cmtqgmjl200u6stuq31xrad59';
function signIn(id = ID, name = '老师测试号') { act(() => { adoptSession('test-token-'+id, { id, name, nickname: '', avatar: null }); }); }
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const ready = () => fireEvent.click(screen.getByRole('button', { name: '模型就绪' }));
const spun = () => fireEvent.click(screen.getByRole('button', { name: '模型旋转结束' }));
// 预览只许预取静态模型文件，绝不许碰接口。
const apiCalls = () => (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(call => String(call[0])).filter(url => !url.startsWith('/medals/'));
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); __resetForTest(); vi.stubGlobal('fetch', vi.fn((url: string) => String(url).startsWith('/medals/') ? Promise.resolve({ ok: true }) : Promise.reject(Error('Preview must not call the API: ' + url)))); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); __resetForTest(); });

describe('Display-only teacher-account ceremony', () => {
  it('fails closed for unavailable identity, normal students, and same-name impersonation', () => {
    expect(canPreviewCeremony({status:'loading'})).toBe(false);
    expect(canPreviewCeremony({status:'unreachable'})).toBe(false);
    expect(canPreviewCeremony({status:'anonymous'})).toBe(false);
    expect(canPreviewCeremony({status:'authenticated',profile:{id:'student',name:'老师测试号',nickname:'',avatar:null}})).toBe(false);
    signIn('student','老师测试号'); render(<BadgeCeremonyPreview />);
    expect(screen.queryByRole('button',{name:'体验颁奖'})).toBeNull();
    expect(apiCalls()).toEqual([]);
  });
  it('allows only exact server-profile ID and supports all 16 display choices', () => {
    signIn(ID,'Changed nickname'); render(<BadgeCeremonyPreview />);
    expect(screen.getAllByRole('option')).toHaveLength(16);
    expect(screen.getByRole('button',{name:'体验颁奖'})).toBeTruthy();
    expect(screen.queryByTestId('preview-model')).toBeNull();
  });
  it('plays the cinematic view, holds the final medal indefinitely, can repeat and never writes', () => {
    signIn(); render(<BadgeCeremonyPreview />); const stored=JSON.stringify(localStorage);
    fireEvent.click(screen.getByRole('button',{name:'体验颁奖'}));
    expect(screen.getByTestId('achievement-preview').className).toContain('h-[100dvh]');
    expect(screen.getByTestId('preview-model').dataset.asset).toBe('reading-1');
    expect(screen.getByTestId('preview-model').dataset.reveal).toBe('true');
    expect(screen.getByTestId('preview-model').dataset.ceremony).toBe('true');
    expect(screen.queryByTestId('achievement-award')).toBeNull();
    expect(screen.queryByRole('button',{name:'继续'})).toBeNull();
    ready(); spun(); tick(60000);
    expect(screen.getByTestId('achievement-preview')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'继续'}));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'体验颁奖'}));
    expect(document.querySelector('.award-scene')).toHaveAttribute('data-phase','0');
    expect(screen.queryByRole('button',{name:'继续'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'跳过全部动画'}));
    tick(60000); expect(screen.queryByRole('dialog')).toBeNull();
    expect(JSON.stringify(localStorage)).toBe(stored); expect(apiCalls()).toEqual([]);
  });
  it('automatically plays four independent levels after their text dwell, leaving the final one open', () => {
    signIn(); render(<BadgeCeremonyPreview />);
    fireEvent.change(screen.getByRole('combobox',{name:'选择体验徽章'}),{target:{value:'vocabulary-2'}});
    fireEvent.click(screen.getByRole('button',{name:'连续体验四级'}));
    for(let tier=1;tier<=4;tier++) {
      expect(screen.getByTestId('preview-model').dataset.asset).toBe('vocabulary-'+tier);
      ready(); spun();
      tick(2899);
      expect(screen.getByTestId('preview-model').dataset.asset).toBe('vocabulary-'+tier);
      tick(1);
      if(tier<4) expect(screen.getByTestId('preview-model').dataset.asset).toBe('vocabulary-'+(tier+1));
    }
    tick(60000);
    expect(screen.getByTestId('preview-model').dataset.asset).toBe('vocabulary-4');
    fireEvent.click(screen.getByRole('button',{name:'继续'}));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(apiCalls()).toEqual([]);
  });
  it('manual next cannot leave the previous badge timer advancing the new badge', () => {
    signIn(); render(<BadgeCeremonyPreview />);
    fireEvent.click(screen.getByRole('button',{name:'连续体验四级'})); ready(); spun(); tick(800);
    fireEvent.click(screen.getByRole('button',{name:'下一枚'}));
    expect(screen.getByTestId('preview-model').dataset.asset).toBe('reading-2');
    tick(60000);
    expect(screen.getByTestId('preview-model').dataset.asset).toBe('reading-2');
    expect(screen.queryByRole('button',{name:'下一枚'})).toBeNull();
    ready(); spun(); tick(2900);
    expect(screen.getByTestId('preview-model').dataset.asset).toBe('reading-3');
  });
  it.each([0, 1000, 2700, 4700])('skip-all at %i ms cancels the entire queue and its pending timers', (elapsed) => {
    signIn(); render(<BadgeCeremonyPreview />);
    fireEvent.click(screen.getByRole('button',{name:'连续体验四级'})); ready(); tick(elapsed);
    fireEvent.click(screen.getByRole('button',{name:'跳过全部动画'}));
    tick(60000);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByTestId('preview-model')).toBeNull();
    expect(apiCalls()).toEqual([]);
  });
  it('hidden/crown previews do not pretend to be earned and model fallback remains usable', () => {
    signIn(); render(<BadgeCeremonyPreview />);
    fireEvent.change(screen.getByRole('combobox',{name:'选择体验徽章'}),{target:{value:'crown'}});
    expect(screen.queryByRole('button',{name:'连续体验四级'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'体验颁奖'}));
    expect(screen.getByTestId('preview-model').dataset.asset).toBe('crown');
    fireEvent.click(screen.getByRole('button',{name:'模型失败'}));
    expect(screen.getByTestId('achievement-preview').textContent).not.toContain('徽章已保存');
    tick(2700);
    expect(screen.getByRole('button',{name:'继续'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'跳过全部动画'}));
    tick(60000); expect(screen.queryByRole('dialog')).toBeNull(); expect(apiCalls()).toEqual([]);
  });
  it('reduced-motion queues retain reading time and do not dismiss the last badge', () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('prefers-reduced-motion'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    signIn(); render(<BadgeCeremonyPreview />);
    fireEvent.click(screen.getByRole('button',{name:'连续体验四级'}));
    for(let tier=1;tier<=4;tier++) {
      ready();
      expect(document.querySelector('.award-scene')).toHaveAttribute('data-phase','3');
      tick(3199);
      expect(screen.getByTestId('preview-model').dataset.asset).toBe('reading-'+tier);
      tick(1);
    }
    tick(60000);
    expect(screen.getByTestId('preview-model').dataset.asset).toBe('reading-4');
    expect(screen.getByRole('button',{name:'继续'})).toBeTruthy();
  });
  it('account change and logout cancel the running queue permanently', () => {
    signIn(); render(<BadgeCeremonyPreview />);
    fireEvent.click(screen.getByRole('button',{name:'连续体验四级'})); ready(); tick(2000);
    signIn('other-student','老师测试号'); tick(60000);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.queryByTestId('badge-preview-controls')).toBeNull();
    signIn(); expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByTestId('badge-preview-controls')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'连续体验四级'})); ready();
    act(()=>logout()); tick(60000);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(apiCalls()).toEqual([]);
  });
});
