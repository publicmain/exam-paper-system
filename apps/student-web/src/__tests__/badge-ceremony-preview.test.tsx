import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BadgeCeremonyPreview, { canPreviewCeremony } from '../components/BadgeCeremonyPreview';
import { __resetForTest, adoptSession, logout } from '../lib/auth-store';

vi.mock('../components/MedalViewer', () => ({
  MedalViewer: ({ assetId, reveal, onRevealComplete, onError }: { assetId: string; reveal?: boolean; onRevealComplete?: () => void; onError?: () => void }) => <div data-testid="preview-model" data-asset={assetId} data-reveal={String(reveal)}><button onClick={onRevealComplete}>完成动画</button><button onClick={onError}>模型失败</button></div>,
  MedalImage: () => null,
}));
const ID = 'cmtqgmjl200u6stuq31xrad59';
function signIn(id = ID, name = '老师测试号') { act(() => { adoptSession('test-token-'+id, { id, name, nickname: '', avatar: null }); }); }
beforeEach(() => { localStorage.clear(); __resetForTest(); vi.stubGlobal('fetch', vi.fn(() => { throw Error('Preview must not make a network request'); })); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); __resetForTest(); });

describe('Display-only teacher-account ceremony', () => {
  it('fails closed for unavailable identity, normal students, and same-name impersonation', () => {
    expect(canPreviewCeremony({status:'loading'})).toBe(false);
    expect(canPreviewCeremony({status:'unreachable'})).toBe(false);
    expect(canPreviewCeremony({status:'anonymous'})).toBe(false);
    expect(canPreviewCeremony({status:'authenticated',profile:{id:'student',name:'老师测试号',nickname:'',avatar:null}})).toBe(false);
    signIn('student','老师测试号'); render(<BadgeCeremonyPreview />);
    expect(screen.queryByRole('button',{name:'体验颁奖'})).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('allows only exact server-profile ID and supports all 16 display choices', () => {
    signIn(ID,'Changed nickname'); render(<BadgeCeremonyPreview />);
    expect(screen.getAllByRole('option')).toHaveLength(16);
    expect(screen.getByRole('button',{name:'体验颁奖'})).toBeTruthy();
    expect(screen.queryByTestId('preview-model')).toBeNull();
  });
  it('plays the real fullscreen view, waits for Continue, can repeat and never writes', () => {
    signIn(); render(<BadgeCeremonyPreview />); const stored=JSON.stringify(localStorage);
    fireEvent.click(screen.getByRole('button',{name:'体验颁奖'}));
    expect(screen.getByTestId('achievement-preview').className).toContain('h-[100dvh]');
    expect(screen.getByTestId('preview-model').getAttribute('data-asset')).toBe('reading-1');
    expect(screen.getByTestId('preview-model').getAttribute('data-reveal')).toBe('true');
    expect(screen.queryByTestId('achievement-award')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'完成动画'}));
    expect(screen.getByTestId('achievement-preview')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'继续'}));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'体验颁奖'}));
    expect(screen.getByTestId('achievement-preview')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'跳过全部动画'}));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(JSON.stringify(localStorage)).toBe(stored); expect(fetch).not.toHaveBeenCalled();
  });
  it('automatically plays four independent levels and leaves the final one open', () => {
    signIn(); render(<BadgeCeremonyPreview />);
    fireEvent.change(screen.getByRole('combobox',{name:'选择体验徽章'}),{target:{value:'vocabulary-2'}});
    fireEvent.click(screen.getByRole('button',{name:'连续体验四级'}));
    for(let tier=1;tier<=4;tier++) {
      expect(screen.getByTestId('preview-model').getAttribute('data-asset')).toBe(`vocabulary-${tier}`);
      fireEvent.click(screen.getByRole('button',{name:'完成动画'}));
    }
    expect(screen.getByTestId('preview-model').getAttribute('data-asset')).toBe('vocabulary-4');
    fireEvent.click(screen.getByRole('button',{name:'继续'}));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(fetch).not.toHaveBeenCalled();
  });
  it('hidden/crown previews do not pretend to be earned and can skip on model errors', () => {
    signIn(); render(<BadgeCeremonyPreview />);
    fireEvent.change(screen.getByRole('combobox',{name:'选择体验徽章'}),{target:{value:'crown'}});
    expect(screen.queryByRole('button',{name:'连续体验四级'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'体验颁奖'}));
    expect(screen.getByTestId('preview-model').getAttribute('data-asset')).toBe('crown');
    fireEvent.click(screen.getByRole('button',{name:'模型失败'}));
    expect(screen.getByTestId('achievement-preview').textContent).not.toContain('徽章已保存');
    fireEvent.click(screen.getByRole('button',{name:'跳过全部动画'}));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(fetch).not.toHaveBeenCalled();
  });
  it('immediately removes the preview on account change and never resumes it for another account', () => {
    signIn(); render(<BadgeCeremonyPreview />); fireEvent.click(screen.getByRole('button',{name:'体验颁奖'}));
    signIn('other-student','老师测试号'); expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.queryByTestId('badge-preview-controls')).toBeNull();
    signIn(); expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByTestId('badge-preview-controls')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'体验颁奖'})); act(()=>logout()); expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
