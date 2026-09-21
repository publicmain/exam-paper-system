import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { writeToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { isBeforeReadingClass, msUntilReadingClass } from '../lib/teaching-day';
import { READING_CLASS_NOTICE, readingTaskView } from '../pages/Today';
import type { LessonToday } from '../lib/api';

/**
 * 阅读课 16:30 开始（叶老师 2026-09-21）：教学日 16:30 以前，「今日阅读」卡上有一条
 * 醒目提示。只是提示 —— 按钮照常能点，别的什么都不变。
 */

const sgt = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+08:00`);
const MON = '2026-09-21';
const SAT = '2026-09-26';

function lesson(): LessonToday {
  return {
    student: { id: 's7', name: '测试七号' },
    date: MON,
    nextAction: { kind: 'ready_to_start', label: '开始今天的课程', href: null },
    rulesVersion: 2,
    completed: 0,
    total: 2,
    allDone: false,
    streakDays: 0,
    targetsFrozenAt: null,
    stage: 'ready_to_start',
    stageAt: null,
    vocabCursor: 0,
    segments: [
      { key: 'read', status: 'todo', label: 'The Queue', questionCount: 5, typicalMinutes: 15, score: null, maxScore: 5, scoresPending: false, submissionId: null, sessionId: null, autoClosed: false },
      { key: 'vocab', status: 'todo', progress: 0, target: 4, typicalMinutes: 2, quizScore: { status: 'not_started' } },
    ],
  } as unknown as LessonToday;
}

describe('什么时候算「阅读课前」', () => {
  it('教学日 16:30 以前是，16:30 起不是；周末不是', () => {
    expect(isBeforeReadingClass(sgt(MON, '07:00'))).toBe(true);
    expect(isBeforeReadingClass(sgt(MON, '16:29'))).toBe(true);
    expect(isBeforeReadingClass(sgt(MON, '16:30'))).toBe(false);
    expect(isBeforeReadingClass(sgt(MON, '20:00'))).toBe(false);
    expect(isBeforeReadingClass(sgt(SAT, '10:00'))).toBe(false);
  });

  it('离 16:30 还有多久（提示到点自动消失用）', () => {
    expect(msUntilReadingClass(sgt(MON, '16:00'))).toBe(30 * 60 * 1000);
    expect(msUntilReadingClass(sgt(MON, '16:30'))).toBeNull();
    expect(msUntilReadingClass(sgt(SAT, '10:00'))).toBeNull();
  });
});

describe('阅读卡上的提示', () => {
  it('课前、还没开始：有提示，「开始阅读」照常能点', () => {
    const v = readingTaskView(lesson(), { state: 'pending', title: 'The Queue', level: 'olevel' }, true);
    expect(v.notice).toBe(READING_CLASS_NOTICE);
    expect(v.action.kind).toBe('start-reading');
  });

  it('课前、做了一半：也有提示，「继续阅读」照常能点', () => {
    const v = readingTaskView(lesson(), { state: 'in_progress', title: 'The Queue', level: 'olevel' }, true);
    expect(v.notice).toBe(READING_CLASS_NOTICE);
    expect(v.action.kind).toBe('navigate');
  });

  it('已经做完 / 上课以后：没有提示', () => {
    expect(readingTaskView(lesson(), { state: 'completed', title: 'The Queue', level: 'olevel' }, true).notice).toBeUndefined();
    expect(readingTaskView(lesson(), { state: 'pending', title: 'The Queue', level: 'olevel' }, false).notice).toBeUndefined();
  });
});

describe('首页', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const json = (status: number, body: unknown) =>
    Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body)) } as Response);

  beforeEach(() => {
    __resetForTest();
    localStorage.clear();
    writeToken('test-token');
    fetchMock = vi.fn((url: string) => {
      const r = url.replace(/^.*\/api/, '');
      if (r === '/student-auth/me') return json(200, { id: 's7', name: '测试七号', nickname: '七号', avatar: null, appVersion: 'v1' });
      if (r === '/lesson/today') return json(200, lesson());
      if (r === '/vocab-v2/overview') {
        return json(200, {
          dailyTarget: 10, today: null, readingBacklog: [], learningBacklog: [], pendingTests: [],
          home: { date: MON, teachingDay: true, reading: { state: 'pending', sessionId: 'ses1', title: 'The Queue', level: 'olevel' }, words: { state: 'not_generated' }, test: { state: 'not_generated', reason: 'no_word_task_yet' }, allDone: false },
          backlogByDate: [], backlogTotals: { reading: 0, words: 0, test: 0 },
        });
      }
      return json(404, { code: 'not_stubbed' });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const renderToday = () => render(<MemoryRouter initialEntries={['/today']}><App /></MemoryRouter>);

  it('**白天自习课（10:00）：阅读卡上有醒目提示，按钮还在**', async () => {
    vi.setSystemTime(sgt(MON, '10:00'));
    renderToday();
    const notice = await screen.findByTestId('task-reading-notice');
    expect(notice.textContent).toBe('16:30 上课时再做今天的阅读');
    expect(notice.getAttribute('role')).toBe('note');
    expect(screen.getByTestId('task-reading-action').textContent).toBe('开始阅读');
  });

  it('**上课以后（16:45）：没有提示**', async () => {
    vi.setSystemTime(sgt(MON, '16:45'));
    renderToday();
    await waitFor(() => expect(screen.getByTestId('task-reading-action')).toBeTruthy());
    expect(screen.queryByTestId('task-reading-notice')).toBeNull();
  });
});
