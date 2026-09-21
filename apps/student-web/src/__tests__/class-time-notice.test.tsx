import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { clearIdentity, ownerDigest, writeToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { CLASS_TIME_NOTICE_KEY } from '../lib/class-time-notice';

/**
 * 「学习时间有调整」一次性通知（叶老师 2026-09-21）。
 *
 * 每个学生第一次进首页弹一次：下午 4:30 词汇阅读课上做今日阅读、每日新词；
 * 复习、补做随时都可以做，落下的要尽快补上。点「知道了」以后不再弹。
 */

const PROFILE = { id: 'stu-9', name: '测试九号', nickname: '九号', avatar: null };

const json = (status: number, body: unknown) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body)) } as Response);

function stub(pendingTests: unknown[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const r = String(url).replace(/^.*\/api/, '');
      if (r === '/student-auth/me') return json(200, { ...PROFILE, appVersion: 'v1' });
      if (r === '/lesson/today') {
        return json(200, {
          student: { id: PROFILE.id, name: PROFILE.name }, date: '2026-09-21',
          nextAction: { kind: 'ready_to_start', label: '开始今天的课程', href: null },
          rulesVersion: 2, completed: 0, total: 2, allDone: false, streakDays: 0, targetsFrozenAt: null,
          stage: 'ready_to_start', stageAt: null, vocabCursor: 0,
          segments: [
            { key: 'read', status: 'todo', label: 'The Queue', questionCount: 5, typicalMinutes: 15, score: null, maxScore: 5, scoresPending: false, submissionId: null, sessionId: null, autoClosed: false },
            { key: 'vocab', status: 'todo', progress: 0, target: 4, typicalMinutes: 2, quizScore: { status: 'not_started' } },
          ],
        });
      }
      if (r === '/vocab-v2/overview') {
        return json(200, {
          dailyTarget: 10, today: null, readingBacklog: [], learningBacklog: [], pendingTests,
          home: { date: '2026-09-21', teachingDay: true, reading: { state: 'pending', sessionId: 'ses1', title: 'The Queue', level: 'olevel' }, words: { state: 'not_generated' }, test: { state: 'not_generated', reason: 'no_word_task_yet' }, allDone: false },
          backlogByDate: [], backlogTotals: { reading: 0, words: 0, test: 0 },
        });
      }
      return json(404, { code: 'not_stubbed', r });
    }),
  );
}

const renderToday = () => render(<MemoryRouter initialEntries={['/today']}><App /></MemoryRouter>);

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  writeToken('test-token');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('「学习时间有调整」通知', () => {
  it('**第一次进首页就弹：写清 4:30 课上做什么、随时能做什么、落下的要尽快补**', async () => {
    stub();
    renderToday();
    const dialog = await screen.findByTestId('class-time-notice');
    expect(within(dialog).getByText('学习时间有调整')).toBeTruthy();
    expect(within(dialog).getByText('下午 4:30 词汇阅读课上做')).toBeTruthy();
    expect(within(dialog).getByText('今日阅读、每日新词')).toBeTruthy();
    expect(within(dialog).getByText('随时都可以做')).toBeTruthy();
    expect(within(dialog).getByText('单词复习、补做之前没做完的')).toBeTruthy();
    expect(within(dialog).getByText('落下的内容要尽快补上，别越积越多。')).toBeTruthy();
    // 焦点落在「知道了」上
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('class-time-notice-ok')));
  });

  it('**点「知道了」：关掉，下次再进首页不再弹**；本机只存摘要、不存 id', async () => {
    stub();
    const first = renderToday();
    await userEvent.click(await screen.findByTestId('class-time-notice-ok'));
    await waitFor(() => expect(screen.queryByTestId('class-time-notice')).toBeNull());
    expect(localStorage.getItem(CLASS_TIME_NOTICE_KEY)).toBe(ownerDigest(PROFILE.id));
    expect(localStorage.getItem(CLASS_TIME_NOTICE_KEY)).not.toContain(PROFILE.id);
    first.unmount();

    __resetForTest();
    renderToday();
    await screen.findByTestId('task-reading');
    expect(screen.queryByTestId('class-time-notice')).toBeNull();
  });

  it('按 Esc 关掉也算看过', async () => {
    stub();
    renderToday();
    await screen.findByTestId('class-time-notice');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('class-time-notice')).toBeNull());
    expect(localStorage.getItem(CLASS_TIME_NOTICE_KEY)).toBe(ownerDigest(PROFILE.id));
  });

  it('共用设备：上一个看过的是别人，这个学生照样会弹', async () => {
    localStorage.setItem(CLASS_TIME_NOTICE_KEY, ownerDigest('someone-else'));
    stub();
    renderToday();
    expect(await screen.findByTestId('class-time-notice')).toBeTruthy();
  });

  it('退出登录时记号跟着清掉（sw: 前缀扫除）', () => {
    localStorage.setItem(CLASS_TIME_NOTICE_KEY, ownerDigest(PROFILE.id));
    clearIdentity();
    expect(localStorage.getItem(CLASS_TIME_NOTICE_KEY)).toBeNull();
  });

  it('**有没做的单词测试：这次只弹通知，不接着弹「还有测试没做」；下次进首页再提醒**', async () => {
    const pending = [{ dailySessionId: 'd-0918', testSessionId: 't-0918', date: '2026-09-18', total: 13, status: 'in_progress' }];
    stub(pending);
    const first = renderToday();
    await screen.findByTestId('class-time-notice');
    expect(screen.queryByTestId('pending-test-reminder')).toBeNull();
    await userEvent.click(screen.getByTestId('class-time-notice-ok'));
    await waitFor(() => expect(screen.queryByTestId('class-time-notice')).toBeNull());
    expect(screen.queryByTestId('pending-test-reminder')).toBeNull();
    first.unmount();

    __resetForTest();
    renderToday();
    expect(await screen.findByTestId('pending-test-reminder')).toBeTruthy();
    expect(screen.queryByTestId('class-time-notice')).toBeNull();
  });
});
