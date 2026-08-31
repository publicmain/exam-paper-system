/**
 * S12O —— 学生自己进得来，也自己改得了难度。
 *
 * 两件事在这之前都不成立：注册页只有「姓名 + 密码」，而且那个端点认领的
 * 是教师**已经建好**的一行；账号页只能改密码。这里把新的样子钉住。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { __resetForTest } from '../lib/auth-store';
import { PILOT_LEVEL_CHOICES } from '../lib/levels';

const PROFILE = { id: 's1', name: '林小雨', nickname: '林小雨', avatar: null };

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

const LESSON_STUB = {
  student: { id: 's1', name: '林小雨' },
  date: '2026-08-31',
  nextAction: { kind: 'no_content', label: '今天的课程还没有发布', href: null },
  rulesVersion: 2,
  completed: 0,
  total: 2,
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
    { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 2, available: false },
  ],
};

let fetchMock: ReturnType<typeof vi.fn>;
const route = (url: string) => url.replace(/^.*\/api/, '');

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) =>
    String(url).endsWith('/lesson/today')
      ? jsonResponse(200, LESSON_STUB)
      : fetchMock(url, init));
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

function bodyOf(call: unknown[]): any {
  return JSON.parse(String((call[1] as RequestInit).body));
}

// ─────────────────────────────────────────────────────────────
// 1. 三档难度的说法
// ─────────────────────────────────────────────────────────────

describe('S12O —— 三档难度怎么写给学生看', () => {
  it('恰好三档，和服务端的白名单逐字一致', () => {
    expect(PILOT_LEVEL_CHOICES.map((c) => c.id)).toEqual([
      'olevel',
      'ielts_simplified',
      'ielts_authentic',
    ]);
  });

  it('**主标签是中文**，内部标识不当标签用', () => {
    for (const c of PILOT_LEVEL_CHOICES) {
      expect(c.label).not.toContain(c.id);
      expect(c.label).toMatch(/[一-龥]/);
      expect(c.blurb.length).toBeGreaterThan(8);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 2. 注册页
// ─────────────────────────────────────────────────────────────

describe('S12O —— 注册页', () => {
  function stubOk() {
    fetchMock.mockImplementation((url: string) =>
      route(url) === '/student-auth/self-register'
        ? jsonResponse(201, { token: 'TK', student: PROFILE, englishLevel: 'olevel' })
        : jsonResponse(404, { code: 'not_stubbed' }));
  }

  async function fillForm(level = '雅思 · 简化版') {
    await userEvent.type(await screen.findByLabelText('班级码'), 'PILOTW1');
    await userEvent.type(screen.getByLabelText('姓名'), '林小雨');
    await userEvent.type(screen.getByLabelText('设置 6 位数字密码'), '280519');
    await userEvent.type(screen.getByLabelText('再输一次'), '280519');
    await userEvent.click(screen.getByRole('radio', { name: new RegExp(level) }));
  }

  it('四个输入 + 三张难度卡都在，且必须自己选一档', async () => {
    stubOk();
    renderAt('/register');
    expect(await screen.findByLabelText('班级码')).toBeTruthy();
    expect(screen.getByLabelText('姓名')).toBeTruthy();
    expect(screen.getByLabelText('设置 6 位数字密码')).toBeTruthy();
    expect(screen.getByLabelText('再输一次')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    // 一进来一档都没选中 —— 不替他默认一个
    for (const r of screen.getAllByRole('radio')) {
      expect((r as HTMLInputElement).checked).toBe(false);
    }
  });

  it('页面上解释了班级码是什么', async () => {
    stubOk();
    renderAt('/register');
    const t = (await screen.findByLabelText('班级码')).closest('form')!.textContent ?? '';
    expect(t).toMatch(/班级码/);
    expect(t).toMatch(/老师/);
  });

  it('填全 → 一次请求 → 进今天的课', async () => {
    stubOk();
    renderAt('/register');
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: '注册并进入' }));

    await screen.findByRole('heading', { name: '你好，林小雨' });
    const calls = fetchMock.mock.calls.filter((c) => route(String(c[0])) === '/student-auth/self-register');
    expect(calls).toHaveLength(1);
    expect(bodyOf(calls[0])).toEqual({
      classCode: 'PILOTW1',
      name: '林小雨',
      pin: '280519',
      englishLevel: 'ielts_simplified',
    });
    expect(localStorage.getItem('sw:token')).toBe('TK');
    expect(Object.keys(localStorage)).toEqual(['sw:token']);
  });

  it('**请求里没有任何客户端给的身份** —— 没有 studentId，URL 也不带查询串', async () => {
    stubOk();
    renderAt('/register');
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: '注册并进入' }));
    await screen.findByRole('heading', { name: '你好，林小雨' });
    const call = fetchMock.mock.calls.find((c) => route(String(c[0])) === '/student-auth/self-register')!;
    expect(String(call[0])).not.toContain('?');
    expect(Object.keys(bodyOf(call)).sort()).toEqual([
      'classCode', 'englishLevel', 'name', 'pin',
    ]);
  });

  it('两次密码不一样 —— **客户端就拦下来**，一个请求都不发', async () => {
    stubOk();
    renderAt('/register');
    await userEvent.type(await screen.findByLabelText('班级码'), 'PILOTW1');
    await userEvent.type(screen.getByLabelText('姓名'), '林小雨');
    await userEvent.type(screen.getByLabelText('设置 6 位数字密码'), '280519');
    await userEvent.type(screen.getByLabelText('再输一次'), '280518');
    await userEvent.click(screen.getByRole('radio', { name: /O-Level/ }));
    await userEvent.click(screen.getByRole('button', { name: '注册并进入' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/两次.*不一样|不一致/);
    expect(fetchMock.mock.calls.filter((c) => route(String(c[0])) === '/student-auth/self-register')).toHaveLength(0);
  });

  it('一档都没选 → 就地报错，不发请求', async () => {
    stubOk();
    renderAt('/register');
    await userEvent.type(await screen.findByLabelText('班级码'), 'PILOTW1');
    await userEvent.type(screen.getByLabelText('姓名'), '林小雨');
    await userEvent.type(screen.getByLabelText('设置 6 位数字密码'), '280519');
    await userEvent.type(screen.getByLabelText('再输一次'), '280519');
    await userEvent.click(screen.getByRole('button', { name: '注册并进入' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/难度|等级/);
    expect(fetchMock.mock.calls.filter((c) => route(String(c[0])) === '/student-auth/self-register')).toHaveLength(0);
  });

  it('PIN 不是 6 位数字 → 就地报错，不发请求', async () => {
    stubOk();
    renderAt('/register');
    await userEvent.type(await screen.findByLabelText('班级码'), 'PILOTW1');
    await userEvent.type(screen.getByLabelText('姓名'), '林小雨');
    await userEvent.type(screen.getByLabelText('设置 6 位数字密码'), '2805');
    await userEvent.type(screen.getByLabelText('再输一次'), '2805');
    await userEvent.click(screen.getByRole('radio', { name: /O-Level/ }));
    await userEvent.click(screen.getByRole('button', { name: '注册并进入' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/6 位/);
    expect(fetchMock.mock.calls.filter((c) => route(String(c[0])) === '/student-auth/self-register')).toHaveLength(0);
  });

  it('**双击只发一个请求**', async () => {
    let resolve!: (v: unknown) => void;
    const pending = new Promise((r) => { resolve = r; });
    fetchMock.mockImplementation((url: string) => {
      if (route(url) === '/student-auth/self-register') {
        return pending.then(() => jsonResponse(201, { token: 'TK', student: PROFILE, englishLevel: 'olevel' }));
      }
      return jsonResponse(404, {});
    });
    renderAt('/register');
    await fillForm();
    const btn = screen.getByRole('button', { name: '注册并进入' });
    await userEvent.click(btn);
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(fetchMock.mock.calls.filter((c) => route(String(c[0])) === '/student-auth/self-register')).toHaveLength(1);
    resolve(null);
    await screen.findByRole('heading', { name: '你好，林小雨' });
  });

  it('服务端说班级码不对 → 说人话，且不落任何东西', async () => {
    fetchMock.mockImplementation((url: string) =>
      route(url) === '/student-auth/self-register'
        ? jsonResponse(400, { code: 'class_code_invalid' })
        : jsonResponse(404, {}));
    renderAt('/register');
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: '注册并进入' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/班级码/);
    expect(localStorage.getItem('sw:token')).toBeNull();
  });

  it('服务端说重名 → 指路去登录', async () => {
    fetchMock.mockImplementation((url: string) =>
      route(url) === '/student-auth/self-register'
        ? jsonResponse(409, { code: 'name_taken_in_class' })
        : jsonResponse(404, {}));
    renderAt('/register');
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: '注册并进入' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/登录/);
  });

  it('失败之后还能再交一次 —— 按钮不会一直卡在「注册中」', async () => {
    let n = 0;
    fetchMock.mockImplementation((url: string) => {
      if (route(url) !== '/student-auth/self-register') return jsonResponse(404, {});
      n += 1;
      return n === 1
        ? jsonResponse(400, { code: 'class_code_invalid' })
        : jsonResponse(201, { token: 'TK', student: PROFILE, englishLevel: 'olevel' });
    });
    renderAt('/register');
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: '注册并进入' }));
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: '注册并进入' }));
    await screen.findByRole('heading', { name: '你好，林小雨' });
    expect(n).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. 登录页的入口
// ─────────────────────────────────────────────────────────────

describe('S12O —— 登录页指得到注册', () => {
  it('有一个说得清楚的「第一次使用」入口', async () => {
    fetchMock.mockImplementation(() => jsonResponse(404, {}));
    renderAt('/login');
    const link = await screen.findByRole('link', { name: /第一次使用/ });
    expect(link.getAttribute('href')).toBe('/register');
  });
});

// ─────────────────────────────────────────────────────────────
// 4. 账号设置里改难度
// ─────────────────────────────────────────────────────────────

describe('S12O —— 账号页改难度', () => {
  function authed(over: Record<string, unknown> = {}) {
    localStorage.setItem('sw:token', 'TK');
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const r = route(url);
      if (r === '/student-auth/me') {
        return jsonResponse(200, { ...PROFILE, pinSet: true, englishLevel: 'olevel', ...over });
      }
      if (r === '/student-auth/me/english-level') {
        return jsonResponse(200, { englishLevel: JSON.parse(String(init!.body)).englishLevel });
      }
      return jsonResponse(404, { code: 'not_stubbed', r });
    });
  }

  it('显示当前难度，用的是中文，不是内部标识', async () => {
    authed();
    renderAt('/account');
    const cur = await screen.findByTestId('current-level');
    expect(cur.textContent).toContain('O-Level');
    expect(cur.textContent).not.toContain('olevel');
  });

  it('三档都在，当前那档是选中的', async () => {
    authed({ englishLevel: 'ielts_simplified' });
    renderAt('/account');
    await screen.findByTestId('current-level');
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    expect(radios.filter((r) => r.checked)).toHaveLength(1);
    expect(radios[1].checked).toBe(true);
  });

  it('**要确认一步才真的改** —— 选中不等于提交', async () => {
    authed();
    renderAt('/account');
    await screen.findByTestId('current-level');
    await userEvent.click(screen.getByRole('radio', { name: /雅思 · 真题型/ }));
    expect(fetchMock.mock.calls.filter((c) => route(String(c[0])) === '/student-auth/me/english-level')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: '确认换难度' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter((c) => route(String(c[0])) === '/student-auth/me/english-level')).toHaveLength(1));
  });

  it('请求是 PATCH，**身份只靠 Bearer**，体里只有一个字段', async () => {
    authed();
    renderAt('/account');
    await screen.findByTestId('current-level');
    await userEvent.click(screen.getByRole('radio', { name: /雅思 · 真题型/ }));
    await userEvent.click(screen.getByRole('button', { name: '确认换难度' }));
    await waitFor(() => screen.getByRole('status'));
    const call = fetchMock.mock.calls.find((c) => route(String(c[0])) === '/student-auth/me/english-level')!;
    const init = call[1] as RequestInit;
    expect(init.method).toBe('PATCH');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer TK');
    expect(String(call[0])).not.toContain('?');
    expect(bodyOf(call)).toEqual({ englishLevel: 'ielts_authentic' });
  });

  it('成功之后有回执，而且当前难度当场就变了', async () => {
    authed();
    renderAt('/account');
    await screen.findByTestId('current-level');
    await userEvent.click(screen.getByRole('radio', { name: /雅思 · 真题型/ }));
    await userEvent.click(screen.getByRole('button', { name: '确认换难度' }));
    const st = await screen.findByRole('status');
    expect(st.textContent).toMatch(/已经换成|已改/);
    await waitFor(() =>
      expect(screen.getByTestId('current-level').textContent).toContain('真题型'));
  });

  it('页面说清楚了**什么时候生效** —— 已经开始的一天不会中途变', async () => {
    authed();
    renderAt('/account');
    const box = (await screen.findByTestId('level-box')).textContent ?? '';
    expect(box).toMatch(/已经开始/);
    expect(box).toMatch(/下一次|明天|下一课/);
  });

  it('失败也要有回执，且当前难度**不动**', async () => {
    localStorage.setItem('sw:token', 'TK');
    fetchMock.mockImplementation((url: string) => {
      const r = route(url);
      if (r === '/student-auth/me') return jsonResponse(200, { ...PROFILE, pinSet: true, englishLevel: 'olevel' });
      if (r === '/student-auth/me/english-level') return jsonResponse(400, { code: 'level_not_offered' });
      return jsonResponse(404, {});
    });
    renderAt('/account');
    await screen.findByTestId('current-level');
    await userEvent.click(screen.getByRole('radio', { name: /雅思 · 真题型/ }));
    await userEvent.click(screen.getByRole('button', { name: '确认换难度' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/这个班/);
    expect(screen.getByTestId('current-level').textContent).toContain('O-Level');
  });

  it('令牌失效 → 走统一的登出，不在账号页上自成一套', async () => {
    localStorage.setItem('sw:token', 'TK');
    fetchMock.mockImplementation((url: string) => {
      const r = route(url);
      if (r === '/student-auth/me') return jsonResponse(200, { ...PROFILE, pinSet: true, englishLevel: 'olevel' });
      if (r === '/student-auth/me/english-level') return jsonResponse(401, { code: 'token_revoked' });
      return jsonResponse(404, {});
    });
    renderAt('/account');
    await screen.findByTestId('current-level');
    await userEvent.click(screen.getByRole('radio', { name: /雅思 · 真题型/ }));
    await userEvent.click(screen.getByRole('button', { name: '确认换难度' }));
    await waitFor(() => expect(localStorage.getItem('sw:token')).toBeNull());
  });

  it('改密码那一块还在 —— 这次不动它', async () => {
    authed();
    renderAt('/account');
    await screen.findByTestId('current-level');
    expect(screen.getByRole('button', { name: '修改密码' })).toBeTruthy();
  });

  it('难度区块和退出登录都在一块屏里，没有把老的入口挤掉', async () => {
    authed();
    renderAt('/account');
    await screen.findByTestId('current-level');
    const shell = screen.getByTestId('level-box').closest('div[class*="max-w"]') ?? document.body;
    expect(within(shell as HTMLElement).getByText('退出登录')).toBeTruthy();
  });
});
