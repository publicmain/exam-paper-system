import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { writeToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { __resetWarningsForTest, getWarnings } from '../lib/student-notices';
import { WARNING_READ_SECONDS } from '../components/WarningNotifier';

/**
 * 老师给单个学生的警告弹窗（2026-09-24）：糊弄交卷的学生下次打开 App 要看到专属警告。
 * 真组件 + 真路由，只把 fetch 打桩；倒计时只假 setInterval（waitFor 仍走真的 setTimeout）。
 */

const PROFILE = { id: 'stu-w', name: '小呆呆', nickname: '小呆呆', avatar: null };
const WARNING = {
  id: 'n1',
  type: 'effort_warning',
  title: '严重警告：你的作业被判定为敷衍',
  body: '小呆呆，老师逐份查了你 9 月 7 日以来的记录：\n13 篇阅读里有 11 篇，你十几秒到半分钟就交卷。\n这些记录已全部作废。',
  createdAt: '2026-09-24T02:00:00.000Z',
};
const json = (status: number, body: unknown) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body)) } as Response);

let fetchMock: ReturnType<typeof vi.fn>;
function stub(opts: { notices?: unknown[] | 'fail'; pendingTests?: unknown[] } = {}) {
  fetchMock = vi.fn((url: string) => {
    const r = String(url).replace(/^.*\/api/, '');
    if (r === '/student-auth/me') return json(200, { ...PROFILE, appVersion: 'v1' });
    if (r === '/student-notices') return opts.notices === 'fail' ? json(500, { code: 'boom' }) : json(200, { items: opts.notices ?? [WARNING] });
    if (r === '/student-notices/n1/read') return json(200, { ok: true });
    if (r === '/lesson/today') {
      return json(200, {
        student: { id: PROFILE.id, name: PROFILE.name }, date: '2026-09-24',
        nextAction: { kind: 'ready_to_start', label: '开始今天的课程', href: null },
        rulesVersion: 2, completed: 0, total: 2, allDone: false, streakDays: 0, targetsFrozenAt: null, stage: 'ready_to_start', stageAt: null, vocabCursor: 0,
        segments: [
          { key: 'read', status: 'todo', label: 'A', questionCount: 5, typicalMinutes: 15, score: null, maxScore: 5, scoresPending: false, submissionId: null, sessionId: null, autoClosed: false },
          { key: 'vocab', status: 'todo', progress: 0, target: 4, typicalMinutes: 2, quizScore: { status: 'not_started' } },
        ],
      });
    }
    if (r === '/vocab-v2/overview') {
      return json(200, {
        dailyTarget: 10, today: null, readingBacklog: [], learningBacklog: [], pendingTests: opts.pendingTests ?? [],
        home: { date: '2026-09-24', teachingDay: true, reading: { state: 'pending', sessionId: 's', title: 'A', level: 'olevel' }, words: { state: 'not_generated' }, test: { state: 'not_generated', reason: 'no_word_task_yet' }, allDone: false },
        backlogByDate: [], backlogTotals: { reading: 0, words: 0, test: 0 },
      });
    }
    return json(404, { code: 'not_stubbed', r });
  });
  vi.stubGlobal('fetch', fetchMock);
}
const calls = (r: string) => fetchMock.mock.calls.filter((c) => String(c[0]).replace(/^.*\/api/, '') === r);
const renderAt = (path = '/today') => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

beforeEach(() => {
  __resetForTest();
  __resetWarningsForTest();
  localStorage.clear();
  writeToken('tok-a');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('警告弹窗', () => {
  it('**进首页就弹：标题、老师给你的警告、逐段正文**', async () => {
    stub();
    renderAt();
    const dialog = await screen.findByTestId('effort-warning');
    expect(within(dialog).getByText('严重警告：你的作业被判定为敷衍')).toBeTruthy();
    expect(within(dialog).getByText('老师给你的警告')).toBeTruthy();
    expect(within(dialog).getByText('13 篇阅读里有 11 篇，你十几秒到半分钟就交卷。')).toBeTruthy();
    expect(within(dialog).getByText('这些记录已全部作废。')).toBeTruthy();
  });

  it(`**要读满 ${WARNING_READ_SECONDS} 秒才能点「我知道了」；点了记已读、弹窗关掉**`, async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    stub();
    renderAt();
    const ok = await screen.findByTestId('effort-warning-ok');
    expect((ok as HTMLButtonElement).disabled).toBe(true);
    expect(ok.textContent).toBe(`请先读完（${WARNING_READ_SECONDS}）`);
    act(() => { vi.advanceTimersByTime(WARNING_READ_SECONDS * 1000); });
    expect((ok as HTMLButtonElement).disabled).toBe(false);
    expect(ok.textContent).toBe('我知道了，以后认真做');
    await userEvent.click(ok);
    await waitFor(() => expect(screen.queryByTestId('effort-warning')).toBeNull());
    expect(calls('/student-notices/n1/read')).toHaveLength(1);
  });

  it('**按 Esc 关不掉**', async () => {
    stub();
    renderAt();
    await screen.findByTestId('effort-warning');
    await userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('effort-warning')).toBeTruthy();
    expect(calls('/student-notices/n1/read')).toHaveLength(0);
  });

  it('**警告开着时首页的「学习时间有调整」和「还有测试没做」都先让开，确认后再出来**', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    stub({ pendingTests: [{ dailySessionId: 'd1', testSessionId: 't1', date: '2026-09-23', total: 13, status: 'in_progress' }] });
    renderAt();
    await screen.findByTestId('effort-warning');
    await screen.findByTestId('task-reading');
    expect(screen.queryByTestId('class-time-notice')).toBeNull();
    expect(screen.queryByTestId('pending-test-reminder')).toBeNull();
    act(() => { vi.advanceTimersByTime(WARNING_READ_SECONDS * 1000); });
    await userEvent.click(screen.getByTestId('effort-warning-ok'));
    expect(await screen.findByTestId('class-time-notice')).toBeTruthy();
  });

  it('没有警告 / 取失败：什么都不弹，也不挡别的', async () => {
    stub({ notices: [] });
    const a = renderAt();
    await screen.findByTestId('task-reading');
    expect(screen.queryByTestId('effort-warning')).toBeNull();
    a.unmount();
    __resetForTest();
    __resetWarningsForTest();
    stub({ notices: 'fail' });
    renderAt();
    await screen.findByTestId('task-reading');
    expect(screen.queryByTestId('effort-warning')).toBeNull();
  });

  it('只在首页取，别的页面不多发请求', async () => {
    stub();
    renderAt('/account');
    await screen.findByRole('heading', { name: '账号', level: 1 });
    expect(calls('/student-notices')).toHaveLength(0);
  });

  it('**共用设备：A 的警告没确认就换 B 登录，B 看不到 A 的警告**', async () => {
    stub();
    renderAt();
    await screen.findByTestId('effort-warning');
    expect(getWarnings()).toHaveLength(1);
    writeToken('tok-b');
    expect(getWarnings()).toEqual([]);
  });
});
