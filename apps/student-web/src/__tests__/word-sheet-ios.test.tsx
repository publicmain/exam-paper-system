/**
 * 查词面板（审计 IOS-06）—— 摆法、焦点、分层与失败反馈。
 *
 *   · 是真正的模态：焦点进入面板、Esc 关闭、关闭后焦点回到原来的位置；
 *   · 宽屏（≥768px）贴着点到的那个词弹出，不遮住整篇文章；
 *   · 只查不入本：打开面板、查到释义，一个收词请求都不发；
 *   · 原句翻译没取到：给「再取一次」，不把报错当译文；
 *   · 发音放不出来：按钮上说清楚。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ExamWordSheet } from '../lesson/ExamWordSheet';
import { writeToken } from '../lib/identity';

const ENTRY = {
  word: 'resilient',
  query: 'resilient',
  phonetic: 'rɪˈzɪliənt',
  translation: '有韧性的；能快速恢复的',
  definition: 'able to recover quickly from difficult conditions',
  pos: 'adj.',
  tag: ['ielts'],
  via: 'direct' as const,
};

let reqs: string[] = [];
let lookupBody: unknown = { found: true, entry: ENTRY };

function stubFetch() {
  reqs = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      reqs.push(String(url).replace(/^.*\/api/, ''));
      return { ok: true, status: 200, text: async () => JSON.stringify(lookupBody) } as Response;
    }),
  );
}

function setWide(wide: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((q: string) => ({
      matches: wide && q.includes('min-width: 768px'),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

function Harness({ anchor }: { anchor?: DOMRect | null }) {
  const [word, setWord] = useState<string | null>(null);
  return (
    <div>
      <button onClick={() => setWord('resilient')}>正文里的 resilient</button>
      <ExamWordSheet
        word={word}
        contextSentence="The resilient community rebuilt the pier."
        passageTitle="The River Ferry"
        blocked={false}
        fillTarget={null}
        onFill={vi.fn()}
        onClose={() => setWord(null)}
        anchor={anchor}
      />
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  writeToken('TK');
  lookupBody = { found: true, entry: ENTRY };
  stubFetch();
  setWide(false);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('IOS-06 查词面板', () => {
  it('**真正的模态**：焦点进入、Esc 关闭、焦点回到点词的地方', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: '正文里的 resilient' });
    await userEvent.click(opener);
    await settle();
    const dlg = screen.getByRole('dialog', { name: /resilient/ });
    expect(dlg.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('**只查不入本**：查到释义也一个收词请求都不发', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: '正文里的 resilient' }));
    await settle();
    expect(screen.getByTestId('word-sheet-translation').textContent).toContain('有韧性的');
    expect(reqs.filter((p) => p.startsWith('/vocab-v2/collect'))).toHaveLength(0);
  });

  it('**宽屏贴着点到的词弹出**（不是盖住整篇文章的居中大卡）', async () => {
    setWide(true);
    const anchor = { left: 300, top: 200, right: 380, bottom: 224, width: 80, height: 24, x: 300, y: 200, toJSON: () => ({}) } as DOMRect;
    render(<Harness anchor={anchor} />);
    await userEvent.click(screen.getByRole('button', { name: '正文里的 resilient' }));
    await settle();
    const dlg = screen.getByTestId('word-sheet');
    expect(dlg.style.position).toBe('fixed');
    // 面板顶部在词的下方 8px
    expect(dlg.style.top).toBe('232px');
  });

  it('**原句翻译没取到 → 给「再取一次」，不把报错当译文**', async () => {
    lookupBody = { found: true, entry: { ...ENTRY, contextTranslation: null } };
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: '正文里的 resilient' }));
    await settle();
    expect(screen.queryByTestId('word-sheet-sentence-translation')).toBeNull();
    expect(screen.getByTestId('word-sheet-sentence-translation-missing').textContent).toContain('暂时没取到');
    const before = reqs.length;
    await userEvent.click(screen.getByRole('button', { name: '再取一次' }));
    await settle();
    expect(reqs.length).toBe(before + 1);
  });

  it('**翻译重试也没用（服务端说 retryable:false）→ 如实说没有，不给永远无效的「再取一次」**（VOC15 / IOS-11）', async () => {
    lookupBody = { found: true, entry: { ...ENTRY, contextTranslation: null, contextTranslationStatus: { status: 'no_chinese', retryable: false } } };
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: '正文里的 resilient' }));
    await settle();
    expect(screen.getByTestId('word-sheet-sentence-translation-missing').textContent).toBe('这句暂时没有可靠的中文翻译。');
    expect(screen.queryByRole('button', { name: '再取一次' })).toBeNull();
  });

  it('**翻译服务限流 → 写几秒后再取，仍给「再取一次」**', async () => {
    lookupBody = { found: true, entry: { ...ENTRY, contextTranslation: null, contextTranslationStatus: { status: 'rate_limited', retryable: true, retryAfterSec: 20 } } };
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: '正文里的 resilient' }));
    await settle();
    expect(screen.getByTestId('word-sheet-sentence-translation-missing').textContent).toContain('约 20 秒后再取');
    expect(screen.getByRole('button', { name: '再取一次' })).toBeTruthy();
  });

  it('**发音放不出来 → 按钮上说清楚**', async () => {
    class FailingAudio {
      addEventListener(type: string, cb: () => void) {
        if (type === 'error') setTimeout(cb, 0);
      }
      play() {
        return Promise.reject(new Error('blocked'));
      }
      pause() {}
    }
    vi.stubGlobal('Audio', FailingAudio);
    vi.stubGlobal('speechSynthesis', undefined);
    // 没有系统语音可退
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: '正文里的 resilient' }));
    await settle();
    await userEvent.click(screen.getByTestId('word-sheet-speak'));
    await settle();
    expect(screen.getByTestId('word-sheet-speak').textContent).toContain('放不出来');
  });
});
