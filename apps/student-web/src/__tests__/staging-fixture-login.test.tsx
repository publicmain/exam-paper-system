/**
 * ⚠️ 临时的 staging 一键夹具登录 —— 登录页这一侧的行为。
 *
 * 重点同样是**它在别的地方不存在**：默认构建（以及生产）里那颗按钮
 * 连 DOM 都不该有；只有构建期变量**逐字**等于 `t6_done` 时才渲染。
 *
 * 真页面 + 真 api 客户端 + 真 auth-store，只在 `fetch` 那一层打桩。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage, { stagingFixtureLoginEnabled } from '../pages/Login';
import { __resetForTest, getState } from '../lib/auth-store';
import { readToken } from '../lib/identity';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

type Req = { url: string; method: string; body: string | null };
let reqs: Req[] = [];
let reply: (req: Req) => { status?: number; body: unknown };

function installFetch() {
  reqs = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const req: Req = {
        url,
        method: (init.method as string) ?? 'GET',
        body: init.body ? String(init.body) : null,
      };
      reqs.push(req);
      const r = reply(req);
      const status = r.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(r.body),
      } as unknown as Response;
    }),
  );
}

const FIXTURE_URL = '/api/student-auth/staging-fixture-session';

const SESSION = {
  token: 'fixture-token',
  student: { id: 't6_done', name: '测试六号', nickname: '六号', avatar: null },
  appVersion: 'v2',
};

/** 构建期变量是 `import.meta.env` 上的只读快照 —— 用 stub 换掉整张表。 */
function withFlag(value: string | undefined) {
  const env = value === undefined ? {} : { VITE_STAGING_FIXTURE_LOGIN: value };
  vi.stubEnv('VITE_STAGING_FIXTURE_LOGIN', value ?? '');
  return env;
}

function mount() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  localStorage.clear();
  __resetForTest();
  navigate.mockClear();
  reply = () => ({ status: 404, body: { code: 'not_stubbed' } });
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// 1 —— 判定函数
// ─────────────────────────────────────────────────────────────

describe('构建期开关只认逐字的 t6_done', () => {
  it('**没设 → 关**', () => {
    expect(stagingFixtureLoginEnabled({})).toBe(false);
    expect(stagingFixtureLoginEnabled({ VITE_STAGING_FIXTURE_LOGIN: '' })).toBe(false);
  });

  it('**值不对 → 关**（拼错的值不许把它打开）', () => {
    for (const bad of ['t5_review', 'T6_DONE', ' t6_done', 'true', '1', 'yes']) {
      expect(stagingFixtureLoginEnabled({ VITE_STAGING_FIXTURE_LOGIN: bad }), bad).toBe(false);
    }
  });

  it('逐字相等 → 开', () => {
    expect(stagingFixtureLoginEnabled({ VITE_STAGING_FIXTURE_LOGIN: 't6_done' })).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// 2 —— 按钮的存在性
// ─────────────────────────────────────────────────────────────

describe('按钮：默认不存在，只有 staging 构建才有', () => {
  it('**默认构建里连 DOM 都没有**', async () => {
    withFlag(undefined);
    mount();
    await settle();
    expect(screen.queryByTestId('staging-fixture-login')).toBeNull();
    expect(screen.queryByText(/一键登录测试六号/)).toBeNull();
    // 正常登录一个字都没变
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
  });

  it('**值不对时也没有**', async () => {
    withFlag('t5_review');
    mount();
    await settle();
    expect(screen.queryByTestId('staging-fixture-login')).toBeNull();
  });

  it('**逐字对上才出现**，标签就是合同里那一句', async () => {
    withFlag('t6_done');
    mount();
    await settle();
    const b = screen.getByTestId('staging-fixture-login');
    expect(b).toBeInTheDocument();
    expect(b.textContent).toBe('Staging：一键登录测试六号');
    // 旁边写清楚它是临时的
    expect(screen.getByText(/临时的 staging 测试通道/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// 3 —— 点一下会发生什么
// ─────────────────────────────────────────────────────────────

describe('点击 → 只调夹具端点 → 只存令牌 → 去 /today', () => {
  it('**请求体是空对象，且不带姓名 / studentId / 口令**', async () => {
    withFlag('t6_done');
    reply = (r) => (r.url.endsWith(FIXTURE_URL) ? { body: SESSION } : { status: 404, body: {} });
    mount();
    await settle();

    fireEvent.click(screen.getByTestId('staging-fixture-login'));
    await settle();

    const calls = reqs.filter((r) => r.url.endsWith(FIXTURE_URL));
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(JSON.parse(calls[0].body!)).toEqual({});
    for (const r of reqs) {
      expect(r.body ?? '').not.toMatch(/"name"|"studentId"|"pin"|"password"/);
      expect(r.url).not.toMatch(/[?&](name|studentId)=/);
    }
    // **只调了这一个端点** —— 没有顺手打登录 / 注册 / 消歧
    expect(reqs.every((r) => r.url.endsWith(FIXTURE_URL))).toBe(true);
  });

  it('**只存 sw:token**，然后去 /today', async () => {
    withFlag('t6_done');
    reply = () => ({ body: SESSION });
    mount();
    await settle();

    fireEvent.click(screen.getByTestId('staging-fixture-login'));
    await settle();

    expect(readToken()).toBe('fixture-token');
    expect(Object.keys(localStorage)).toEqual(['sw:token']);
    expect(getState().status).toBe('authenticated');
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
  });

  it('**服务端关掉时（404）不跳转、也不存票**，并如实说没开', async () => {
    withFlag('t6_done');
    reply = () => ({ status: 404, body: {} });
    mount();
    await settle();

    fireEvent.click(screen.getByTestId('staging-fixture-login'));
    await settle();

    expect(readToken()).toBeNull();
    expect(Object.keys(localStorage)).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText('夹具登录没有开启。')).toBeInTheDocument();
  });

  it('**退出之后令牌被清掉，按钮还在**（可以再点一次）', async () => {
    withFlag('t6_done');
    reply = () => ({ body: SESSION });
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('staging-fixture-login'));
    await settle();
    expect(readToken()).toBe('fixture-token');

    // 退出 = auth-store 清票（与「令牌失效回登录页」同一条路）
    __resetForTest();
    localStorage.clear();
    expect(readToken()).toBeNull();

    navigate.mockClear();
    mount();
    await settle();
    fireEvent.click(screen.getAllByTestId('staging-fixture-login')[0]);
    await settle();
    expect(readToken()).toBe('fixture-token');
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
  });
});

// ─────────────────────────────────────────────────────────────
// 4 —— 正常登录没有被改动
// ─────────────────────────────────────────────────────────────

describe('正常登录不受影响', () => {
  it('**姓名 + 密码那条路照旧**，请求体逐字未变', async () => {
    withFlag('t6_done');
    reply = () => ({ body: SESSION });
    mount();
    await settle();

    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '测试六号' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret-not-a-real-pin' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    await settle();

    const login = reqs.filter((r) => r.url.endsWith('/api/student-auth/login'));
    expect(login).toHaveLength(1);
    expect(Object.keys(JSON.parse(login[0].body!)).sort()).toEqual(['name', 'pin']);
    expect(reqs.some((r) => r.url.endsWith(FIXTURE_URL))).toBe(false);
  });

  it('**登录页源码里没有任何口令**', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'pages', 'Login.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/\b\d{6,}\b/); // 六位以上的裸数字串
    expect(src).not.toMatch(/pin\s*[:=]\s*['"][^'"]+['"]/i);
  });
});
