import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { OWNED_STORAGE_KEYS } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';

/**
 * 认证生命周期 —— 1–7 与 10。
 *
 * 全部走真实组件 + 打桩的 `fetch`，不去 mock 状态机本身：要验的正是
 * 「一次真实的往返之后，身份落在哪里」。
 */

const PROFILE = { id: 's1', name: '测试一号', nickname: '一号', avatar: null };

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

let fetchMock: ReturnType<typeof vi.fn>;

function route(url: string) {
  return url.replace(/^.*\/api/, '');
}

/**
 * 阶段 6A 起，`/today` 会**真的**去拉 `/lesson/today`。
 *
 * 本文件验的是认证生命周期，不是课程内容 —— 所以在 fetch 外面套一层，
 * 把这一个路由统一答掉，其余全部照旧交给各用例自己的 `fetchMock`。
 * 这样既不用逐个用例改桩，各用例对 `fetchMock.mock.calls` 的断言也不受
 * 影响（课程请求根本不会走到它上面）。
 */
const LESSON_STUB = {
  student: { id: 's1', name: '测试一号' },
  date: '2026-08-28',
  nextAction: { kind: 'no_content', label: '今天的课程还没有发布', href: null },
  rulesVersion: 2,
  completed: 0,
  total: 3,
  allDone: false,
  streakDays: 0,
  targetsFrozenAt: null,
  stage: 'no_content',
  stageAt: null,
  vocabCursor: 0,
  segments: [
    { key: 'read', status: 'none', label: null, questionCount: null, typicalMinutes: 15,
      score: null, maxScore: null, scoresPending: false, submissionId: null, sessionId: null, autoClosed: false },
    { key: 'vocab', status: 'none', progress: 0, target: 0, typicalMinutes: 2, quizScore: { status: 'not_started' } },
    { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 2 },
  ],
};

const CLASS_STUB = {
  classes: [{
    id: 'p1_class', name: '试点班 W1',
    levels: ['olevel', 'ielts_simplified', 'ielts_authentic'],
  }],
};

beforeEach(() => {
  // 认证状态是模块级的 —— 不复位的话上一个用例的身份会漏进下一个
  __resetForTest();
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    if (String(url).endsWith('/lesson/today')) return jsonResponse(200, LESSON_STUB);
    if (String(url).endsWith('/student-auth/registration-classes')) {
      return jsonResponse(200, CLASS_STUB);
    }
    return fetchMock(url, init);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

/** 默认：没有令牌 → bootstrap 直接 anonymous，不发请求 */
function noSession() {
  fetchMock.mockImplementation((url: string) => jsonResponse(404, { code: 'not_stubbed', url }));
}

describe('3. 登录', () => {
  it('成功 → 存下唯一一个令牌 → 落到今天的课', async () => {
    noSession();
    fetchMock.mockImplementation((url: string) => {
      if (route(url) === '/student-auth/login') {
        return jsonResponse(201, { token: 'TK', student: PROFILE, appVersion: 'v1' });
      }
      return jsonResponse(404, {});
    });
    renderAt('/login');
    await screen.findByText('每日英语');
    await userEvent.type(screen.getByLabelText('姓名'), '测试一号');
    await userEvent.type(screen.getByLabelText('密码'), 'pw123456');
    await userEvent.click(screen.getByRole('button', { name: '登录' }));

    await screen.findByRole('heading', { name: '你好，一号' });
    expect(localStorage.getItem('sw:token')).toBe('TK');
    // **只有令牌** —— 姓名 / studentId / profile 一律不落盘
    expect(Object.keys(localStorage)).toEqual(['sw:token']);
  });

  it('密码错 → 学生看得懂的话，且**不提「打开 App 会引导注册」**', async () => {
    fetchMock.mockImplementation(() => jsonResponse(401, { code: 'invalid_credentials' }));
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText('姓名'), '测试一号');
    await userEvent.type(screen.getByLabelText('密码'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: '登录' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('姓名或密码不对');
    expect(alert.textContent).not.toContain('打开 App');
    expect(localStorage.getItem('sw:token')).toBeNull();
  });

  it('锁定 → 说清楚还要等几分钟', async () => {
    fetchMock.mockImplementation(() =>
      jsonResponse(403, { code: 'pin_locked', retryAfterSec: 900 }),
    );
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText('姓名'), '测试一号');
    await userEvent.type(screen.getByLabelText('密码'), 'x');
    await userEvent.click(screen.getByRole('button', { name: '登录' }));
    expect((await screen.findByRole('alert')).textContent).toContain('15 分钟');
  });

  it('**同名消歧**：选中的 studentId 只进这一次请求，不落盘、不进 URL', async () => {
    const calls: unknown[] = [];
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      if (route(url) !== '/student-auth/login') return jsonResponse(404, {});
      const body = JSON.parse(String(init.body));
      calls.push(body);
      if (!body.studentId) {
        return jsonResponse(200, {
          needDisambiguation: true,
          candidates: [
            { studentId: 'a1', name: '测试一号', classes: ['G11'] },
            { studentId: 'a2', name: '测试一号', classes: ['G12'] },
          ],
        });
      }
      return jsonResponse(201, { token: 'TK2', student: PROFILE });
    });
    renderAt('/login');
    await userEvent.type(await screen.findByLabelText('姓名'), '测试一号');
    await userEvent.type(screen.getByLabelText('密码'), 'pw123456');
    await userEvent.click(screen.getByRole('button', { name: '登录' }));

    await screen.findByText(/哪一个是你/);
    await userEvent.click(screen.getByText('G12'));
    await screen.findByRole('heading', { name: '你好，一号' });

    expect((calls[1] as { studentId?: string }).studentId).toBe('a2');
    expect(localStorage.getItem('sw:token')).toBe('TK2');
    expect(Object.keys(localStorage)).toEqual(['sw:token']);
    expect(JSON.stringify(localStorage)).not.toContain('a2');
  });
});

/**
 * S12O 起，`/register` 是**自助注册**：选班级 + 姓名 + 自设 PIN + 自选难度，
 * 走 `/student-auth/self-register`。
 *
 * 原来这里三条用例走的是 `/student-auth/register` —— 那条路**认领**教师
 * 已经建好的一行（`already_registered` / 同名消歧都是那条路的语义）。
 * 学生端不再有那个入口，所以那三条用例连同它们验的行为一起搬去了
 * `self-signup.test.tsx`。**服务端那个端点没有删**，教师端仍在用。
 *
 * 这里只留一条：注册成功之后，身份落在该落的地方 —— 那是认证生命周期
 * 的事，正是本文件的题目。
 */
describe('1. 首次注册', () => {
  it('自助注册成功 → 即注册即登录，且**只有令牌**落盘', async () => {
    fetchMock.mockImplementation((url: string) =>
      route(url) === '/student-auth/self-register'
        ? jsonResponse(201, { token: 'RT', student: PROFILE, englishLevel: 'olevel' })
        : jsonResponse(404, {}),
    );
    renderAt('/register');
    await userEvent.selectOptions(await screen.findByLabelText('选择班级'), 'p1_class');
    await userEvent.type(screen.getByLabelText('姓名'), '测试一号');
    await userEvent.type(screen.getByLabelText('设置 6 位数字密码'), '280519');
    await userEvent.type(screen.getByLabelText('再输一次'), '280519');
    await userEvent.click(screen.getByRole('radio', { name: /O-Level/ }));
    await userEvent.click(screen.getByRole('button', { name: '注册并进入' }));

    await screen.findByRole('heading', { name: '你好，一号' });
    expect(localStorage.getItem('sw:token')).toBe('RT');
    expect(Object.keys(localStorage)).toEqual(['sw:token']);
  });

  it('学生端**不再走认领那条路** —— 一个 `/student-auth/register` 都不发', async () => {
    fetchMock.mockImplementation((url: string) =>
      route(url) === '/student-auth/self-register'
        ? jsonResponse(201, { token: 'RT', student: PROFILE, englishLevel: 'olevel' })
        : jsonResponse(404, {}),
    );
    renderAt('/register');
    await userEvent.selectOptions(await screen.findByLabelText('选择班级'), 'p1_class');
    await userEvent.type(screen.getByLabelText('姓名'), '测试一号');
    await userEvent.type(screen.getByLabelText('设置 6 位数字密码'), '280519');
    await userEvent.type(screen.getByLabelText('再输一次'), '280519');
    await userEvent.click(screen.getByRole('radio', { name: /O-Level/ }));
    await userEvent.click(screen.getByRole('button', { name: '注册并进入' }));
    await screen.findByRole('heading', { name: '你好，一号' });

    const legacy = fetchMock.mock.calls.filter(
      (c) => route(String(c[0])) === '/student-auth/register',
    );
    expect(legacy).toHaveLength(0);
  });
});

describe('6. 刷新恢复 / 令牌撤销', () => {
  it('有令牌 → 启动时向 /me 换身份 → 直接进今天的课', async () => {
    localStorage.setItem('sw:token', 'GOOD');
    fetchMock.mockImplementation((url: string) =>
      route(url) === '/student-auth/me' ? jsonResponse(200, PROFILE) : jsonResponse(404, {}),
    );
    renderAt('/today');
    await screen.findByRole('heading', { name: '你好，一号' });
  });

  it('**令牌被撤销（教师重置）→ 清身份、回登录页，并说清下一步是重新设密码**', async () => {
    localStorage.setItem('sw:token', 'STALE');
    fetchMock.mockImplementation((url: string) =>
      route(url) === '/student-auth/me'
        ? jsonResponse(403, { code: 'token_revoked' })
        : jsonResponse(404, {}),
    );
    renderAt('/today');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('登录已失效');
    expect(alert.textContent).toContain('重新设一次密码');
    expect(localStorage.getItem('sw:token')).toBeNull();
    // 登录页上要能看到注册入口 —— 重置之后学生的下一步是重新注册
    expect(screen.getByText('第一次使用？注册')).toBeInTheDocument();
  });

  it('401 同样清身份回登录页', async () => {
    localStorage.setItem('sw:token', 'BAD');
    fetchMock.mockImplementation(() => jsonResponse(401, { code: 'invalid_credentials' }));
    renderAt('/today');
    await screen.findByText('每日英语');
    expect(localStorage.getItem('sw:token')).toBeNull();
  });

  it('**网络故障不把人登出** —— 票可能还是好的', async () => {
    localStorage.setItem('sw:token', 'GOOD');
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    renderAt('/today');
    await screen.findByText('每日英语');
    expect(localStorage.getItem('sw:token')).toBe('GOOD');
  });
});

describe('4 + 7. 改密码与退出', () => {
  async function loggedIn() {
    localStorage.setItem('sw:token', 'TK');
    fetchMock.mockImplementation((url: string) =>
      route(url) === '/student-auth/me' ? jsonResponse(200, PROFILE) : jsonResponse(404, {}),
    );
    renderAt('/account');
    await screen.findByText('账号');
  }

  it('**改密码成功 → 令牌当场作废，清掉并回登录页 + 成功提示**', async () => {
    await loggedIn();
    fetchMock.mockImplementation((url: string) =>
      route(url) === '/student-auth/change-pin'
        ? jsonResponse(200, { ok: true })
        : jsonResponse(200, PROFILE),
    );
    await userEvent.type(screen.getByLabelText('当前密码'), 'old12345');
    await userEvent.type(screen.getByLabelText('新密码'), 'new12345');
    await userEvent.click(screen.getByRole('button', { name: '修改密码' }));

    await screen.findByText('每日英语');
    expect(localStorage.getItem('sw:token')).toBeNull();
    expect((await screen.findByRole('alert')).textContent).toContain('密码已经改好了');
  });

  it('当前密码错 → 停在原地，不清票', async () => {
    await loggedIn();
    fetchMock.mockImplementation((url: string) =>
      route(url) === '/student-auth/change-pin'
        ? jsonResponse(401, { code: 'invalid_credentials' })
        : jsonResponse(200, PROFILE),
    );
    await userEvent.type(screen.getByLabelText('当前密码'), 'wrong');
    await userEvent.type(screen.getByLabelText('新密码'), 'new12345');
    await userEvent.click(screen.getByRole('button', { name: '修改密码' }));
    expect((await screen.findByRole('alert')).textContent).toContain('当前密码不对');
    expect(localStorage.getItem('sw:token')).toBe('TK');
  });

  it('**退出 → 本包写过的键一个不剩**', async () => {
    await loggedIn();
    await userEvent.click(screen.getByText('退出登录'));
    await screen.findByText('每日英语');
    for (const k of OWNED_STORAGE_KEYS) expect(localStorage.getItem(k)).toBeNull();
    expect(Object.keys(localStorage)).toEqual([]);
  });
});

describe('10. 未知 URL', () => {
  it('未登录闯私有页 → 登录页', async () => {
    noSession();
    renderAt('/whatever/deep');
    await screen.findByText('每日英语');
  });

  it('已登录闯未知页 → 今天的课', async () => {
    localStorage.setItem('sw:token', 'TK');
    fetchMock.mockImplementation((url: string) =>
      route(url) === '/student-auth/me' ? jsonResponse(200, PROFILE) : jsonResponse(404, {}),
    );
    renderAt('/nope');
    await screen.findByRole('heading', { name: '你好，一号' });
  });

  it('已登录访问登录页 → 送回今天的课', async () => {
    localStorage.setItem('sw:token', 'TK');
    fetchMock.mockImplementation((url: string) =>
      route(url) === '/student-auth/me' ? jsonResponse(200, PROFILE) : jsonResponse(404, {}),
    );
    renderAt('/login');
    await screen.findByRole('heading', { name: '你好，一号' });
  });
});

describe('认证后的请求不带任何身份参数', () => {
  it('**/me 与 change-pin 的 URL 与请求体里都没有 name / studentId**', async () => {
    localStorage.setItem('sw:token', 'TK');
    const seen: { url: string; body: string }[] = [];
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      seen.push({ url, body: String(init?.body ?? '') });
      return route(url) === '/student-auth/change-pin'
        ? jsonResponse(200, { ok: true })
        : jsonResponse(200, PROFILE);
    });
    renderAt('/account');
    await screen.findByText('账号');
    await userEvent.type(screen.getByLabelText('当前密码'), 'old12345');
    await userEvent.type(screen.getByLabelText('新密码'), 'new12345');
    await userEvent.click(screen.getByRole('button', { name: '修改密码' }));
    await waitFor(() => expect(seen.length).toBeGreaterThan(1));

    for (const s of seen) {
      expect(s.url).not.toMatch(/name=|studentId=/);
      expect(s.body).not.toMatch(/"name"|"studentId"/);
    }
  });
});
