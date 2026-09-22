import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { writeToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { shellFor } from '../design/AppShell';
import { printableDays } from '../pages/PrintCenter';
import type { V2Overview } from '../lib/api';

/**
 * 打印 / 下载（2026-09-22）：阅读文章和题目、单词表 / 默写纸。
 * 真组件 + 真路由，只把 fetch 打桩。
 */

const PROFILE = { id: 's7', name: '测试七号', nickname: '七号', avatar: null };
const json = (status: number, body: unknown) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body)) } as Response);

const READING = {
  sessionId: 'mqs-today',
  date: '2026-09-22',
  level: 'olevel',
  levelLabel: 'O-Level 标准',
  className: 'SEC27W',
  reading: {
    title: 'The Armband',
    paragraphs: [
      { label: 'Paragraph 1', text: 'For two years, Arjun had been the captain.' },
      { label: 'Paragraph 2', text: 'The coach read out my name.' },
    ],
    groups: [
      {
        taskType: 'matching_features',
        title: 'Matching Features',
        instruction: 'Choose the word from the box.',
        bank: [
          { key: 'A', text: 'astonished' },
          { key: 'B', text: 'bored' },
          { key: 'C', text: 'nervous' },
        ],
        bankLabel: 'Box',
        questions: [
          { no: 1, item: 'Paragraph 2 — hearing the coach', options: null, lines: 0, marks: 1, answer: null },
          { no: 2, item: 'Paragraph 4 — reading the message', options: null, lines: 0, marks: 1, answer: null },
        ],
      },
      {
        taskType: 'sentence_completion',
        title: 'Sentence Completion',
        instruction: 'Choose ONE WORD ONLY from the passage.',
        bank: null,
        bankLabel: null,
        questions: [{ no: 3, item: 'Arjun wore the [BLANK].', options: null, lines: 1, marks: 1, answer: null }],
      },
      {
        taskType: 'short_answer',
        title: 'Short Answer',
        instruction: '',
        bank: null,
        bankLabel: null,
        questions: [{ no: 4, item: 'Why was it worse?', options: null, lines: 3, marks: 2, answer: null }],
      },
    ],
    questionCount: 4,
    totalMarks: 5,
  },
};
const WORDS = {
  date: '2026-09-22',
  words: [
    { headword: 'beauty', phonetic: '/ˈbjuːti/', pos: 'noun', translation: 'n. 美, 美人', sentence: 'The beauty of the lake surprised us.' },
    { headword: 'install', phonetic: null, pos: 'verb', translation: 'vt. 安装', sentence: null },
  ],
};

function overview(over: Partial<V2Overview> = {}): V2Overview {
  return {
    dailyTarget: 10,
    today: null,
    readingBacklog: [
      { assignmentId: 'a1', sessionId: 'mqs-0918', submissionId: null, date: '2026-09-18', title: 'The Spare Motor', status: 'not_started', level: 'olevel' },
    ],
    learningBacklog: [{ sessionId: 'd-0917', date: '2026-09-17', completed: 3, target: 10, status: 'in_progress' }],
    pendingTests: [],
    home: {
      date: '2026-09-22',
      teachingDay: true,
      reading: { state: 'pending', sessionId: 'mqs-today', title: 'The Armband', level: 'olevel' },
      words: { state: 'in_progress', target: 10, learned: 3 },
      test: { state: 'not_generated', reason: 'learning_unfinished' },
      allDone: false,
    },
    backlogByDate: [],
    backlogTotals: { reading: 1, words: 1, test: 0 },
    ...over,
  } as V2Overview;
}

let fetchMock: ReturnType<typeof vi.fn>;
function stub(extra?: (r: string) => unknown) {
  fetchMock = vi.fn((url: string) => {
    const r = String(url).replace(/^.*\/api/, '');
    const custom = extra?.(r);
    if (custom) return custom;
    if (r === '/student-auth/me') return json(200, { ...PROFILE, appVersion: 'v1' });
    if (r === '/vocab-v2/overview') return json(200, overview());
    if (r === '/print-materials/me/reading/mqs-today') return json(200, READING);
    if (r.startsWith('/print-materials/me/words?date=')) return json(200, WORDS);
    return json(404, { code: 'not_stubbed', r });
  });
  vi.stubGlobal('fetch', fetchMock);
}
const calls = (prefix: string) => fetchMock.mock.calls.map((c) => String(c[0]).replace(/^.*\/api/, '')).filter((r) => r.startsWith(prefix));
const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  writeToken('test-token');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('打印入口', () => {
  it('今天 + 之前没做完的日子：各自列出能印的阅读和单词', () => {
    const days = printableDays(overview(), '2026-09-22');
    expect(days.today).toEqual({ date: '2026-09-22', reading: { sessionId: 'mqs-today', title: 'The Armband' }, words: true });
    expect(days.earlier).toEqual([
      { date: '2026-09-17', reading: null, words: true },
      { date: '2026-09-18', reading: { sessionId: 'mqs-0918', title: 'The Spare Motor' }, words: false },
    ]);
  });

  it('今天没有阅读（还没发布）：不给「打印阅读」', () => {
    const ov = overview();
    ov.home!.reading = { state: 'not_generated' } as any;
    expect(printableDays(ov, '2026-09-22').today.reading).toBeNull();
  });

  it('**首页有「打印 / 下载」入口，点进去看到今天的阅读和单词**', async () => {
    stub();
    renderAt('/today');
    await userEvent.click(await screen.findByTestId('home-print'));
    const today = await screen.findByTestId('print-day-2026-09-22');
    expect(within(today).getByText('阅读 · The Armband')).toBeTruthy();
    expect(within(today).getByRole('button', { name: '打印阅读' })).toBeTruthy();
    expect(within(today).getByRole('button', { name: '默写纸' })).toBeTruthy();
    expect(screen.getByTestId('print-day-2026-09-18')).toBeTruthy();
  });

  it('打印版纸面没有底部标签栏（专注外壳）；入口页有', () => {
    expect(shellFor('/print/reading', true)).toBe('focus');
    expect(shellFor('/print/words', true)).toBe('focus');
    expect(shellFor('/print', true)).toBe('tabs');
  });
});

describe('阅读打印版', () => {
  it('**印出文章（段首标签）和全部题目；配对题的选项框只印一次；填空印横线；简答留三行**', async () => {
    stub();
    renderAt('/print/reading?sessionId=mqs-today');
    const sheet = await screen.findByTestId('print-reading');
    expect(within(sheet).getByRole('heading', { name: 'The Armband' })).toBeTruthy();
    expect(within(sheet).getByText('O-Level 标准 · 9月22日 周二 · SEC27W')).toBeTruthy();
    expect(within(sheet).getByText('Paragraph 1')).toBeTruthy();
    expect(within(sheet).getAllByTestId('print-question')).toHaveLength(4);
    expect(within(sheet).getAllByTestId('print-bank')).toHaveLength(1);
    expect(within(sheet).getByText('Questions 1–2 · Matching Features')).toBeTruthy();
    expect(within(sheet).getByText('Arjun wore the __________.')).toBeTruthy();
    expect(sheet.querySelectorAll('.ps-line')).toHaveLength(4);
    expect(screen.queryByTestId('print-answer-key')).toBeNull();
  });

  it('只读：打开打印版不开始阅读（不调 lesson/start、不开答卷）', async () => {
    stub();
    renderAt('/print/reading?sessionId=mqs-today');
    await screen.findByTestId('print-reading');
    expect(calls('/lesson/start')).toEqual([]);
    expect(calls('/morning-quiz/sessions')).toEqual([]);
  });

  it('点「打印 / 存 PDF」调起系统打印', async () => {
    stub();
    const print = vi.fn();
    vi.stubGlobal('print', print);
    renderAt('/print/reading?sessionId=mqs-today');
    await userEvent.click(await screen.findByTestId('print-now'));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('不是自己班的 / 找不到：说清楚，不写「网络不好」', async () => {
    stub((r) => (r === '/print-materials/me/reading/mqs-x' ? json(403, { code: 'not_enrolled' }) : null));
    renderAt('/print/reading?sessionId=mqs-x');
    expect(await screen.findByText('没有找到这篇阅读')).toBeTruthy();
  });
});

describe('单词打印版', () => {
  it('**单词表：英文 + 音标 + 中文 + 例句**', async () => {
    stub();
    renderAt('/print/words?date=2026-09-22&mode=list');
    const sheet = await screen.findByTestId('print-wordlist');
    expect(within(sheet).getByText('单词表 · 9月22日 周二')).toBeTruthy();
    expect(within(sheet).getByText('beauty')).toBeTruthy();
    expect(within(sheet).getByText('/ˈbjuːti/')).toBeTruthy();
    expect(within(sheet).getByText('n. 美, 美人')).toBeTruthy();
    expect(within(sheet).getByText('The beauty of the lake surprised us.')).toBeTruthy();
    expect(calls('/print-materials/me/words')).toEqual(['/print-materials/me/words?date=2026-09-22']);
  });

  it('**默写纸：纸面上只有中文、英文留空；答案另起一页，可以不印**', async () => {
    stub();
    renderAt('/print/words?date=2026-09-22&mode=dictation');
    const sheet = await screen.findByTestId('print-dictation');
    expect(within(sheet).getByText('n. 美, 美人')).toBeTruthy();
    expect(within(sheet).queryByText('beauty')).toBeNull();
    const answers = screen.getByTestId('print-dictation-answers');
    expect(within(answers).getByText('beauty')).toBeTruthy();
    await userEvent.click(screen.getByTestId('with-answers'));
    expect(screen.queryByTestId('print-dictation-answers')).toBeNull();
  });

  it('在页面上切换单词表 / 默写纸', async () => {
    stub();
    renderAt('/print/words?date=2026-09-22&mode=list');
    await screen.findByTestId('print-wordlist');
    await userEvent.click(screen.getByTestId('mode-dictation'));
    expect(await screen.findByTestId('print-dictation')).toBeTruthy();
  });

  it('那一天没有单词：写清楚', async () => {
    stub((r) => (r.startsWith('/print-materials/me/words') ? json(200, { date: '2026-09-20', words: [] }) : null));
    renderAt('/print/words?date=2026-09-20&mode=list');
    expect(await screen.findByText('这一天没有单词任务。')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('print-dictation-answers')).toBeNull());
  });
});
