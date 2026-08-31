/**
 * 阶段 12B —— 错题重练（`/mistakes/practice`）的**行为测试**。
 *
 * 挂真 `App`，只在 `fetch` 打桩，**不 import 页面组件**；路径写字面量。
 *
 * 这一屏的规矩：
 *
 *   · **一个 GET**（`/vocab/mistakes/practice-queue`），四种作答方式全支持；
 *   · **作答之前，答案材料一个字都不许进 DOM** —— 响应里带着它们是正常的
 *     （这是自由重练，不是考试），但屏幕上不能先漏出来；
 *   · **一次作答只发一条 `practice-result`**，而且它**没有幂等键** ——
 *     所以网络失败**绝不盲目重发**，先把队列读回来看看到底记上没有；
 *   · **销账与连胜由服务端说了算**，前端不自己算。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { writeToken, readToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { ROUTES } from '../routes.contract';

const MISTAKES = '/mistakes';
const PRACTICE = '/mistakes/practice';

const PROFILE = { id: 't6_done', name: '测试六号', nickname: '六号', avatar: null };
const TOKEN = 'practice-token';

type Req = { path: string; method: string; headers: Record<string, string>; body: string | null };
let reqs: Req[] = [];

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

// ─────────────────────────────────────────────────────────────
// 夹具 —— 字段照 `mistake.service.ts` 的 practiceQueue()
// ─────────────────────────────────────────────────────────────

/**
 * 作答之前一个字都不许露的那几样。
 *
 * `evidence` 带了一个尾巴（`（证据句）`）**是刻意的**：证据句按定义就是
 * 原文里的一句话，而原文是**该显示**的。拿一段原文子串去断言「没泄漏」，
 * 那条断言永远会红 —— 它分不清「证据字段漏了」和「原文正常渲染」。
 * 加一个只属于这个字段的尾巴，断言才真的在测那件事。
 */
const SECRETS = {
  correctAnswer: 'FALSE',
  answerPoints: ['FALSE'],
  answerModel: '天黑之后渡船就不开了。',
  explanation: '第三段最后一句直接否定了这个说法。',
  evidence: 'After dark the ferry no longer ran.（证据句）',
};

const item = (over: Record<string, unknown> = {}) => ({
  id: 'q1',
  taskType: 'true_false_not_given',
  reason: 'repeated_tasktype',
  passageTitle: 'The River Ferry',
  quizDay: '2026-08-29',
  stem: 'The ferry ran after dark before the bridge was built.',
  myOldAnswer: 'TRUE',
  markerComment: '第三段说天黑之后就停了。',
  practiceKind: 'tfng',
  options: ['TRUE', 'FALSE', 'NOT GIVEN'],
  correctStreak: 0,
  passage: 'The ferry crossed at dawn. After dark the ferry no longer ran.',
  submissionId: 'sub-a',
  paperQuestionId: 'pq-1',
  ...SECRETS,
  ...over,
});

const queue = (items: Record<string, unknown>[] = [item()], over: Record<string, unknown> = {}) => ({
  student: { id: PROFILE.id, name: PROFILE.name },
  remaining: items.length,
  items,
  ...over,
});

// ─────────────────────────────────────────────────────────────
// 网络边界
// ─────────────────────────────────────────────────────────────

let queueReply: () => Promise<Response>;
let resultReply: () => Promise<Response>;

function installFetch() {
  reqs = [];
  const fetchMock = vi.fn((url: string, init: RequestInit = {}) => {
    const full = String(url).replace(/^.*\/api/, '');
    const path = full.split('?')[0];
    reqs.push({
      path: full,
      method: (init.method as string) ?? 'GET',
      headers: (init.headers as Record<string, string>) ?? {},
      body: init.body ? String(init.body) : null,
    });
    if (path === '/student-auth/me') return jsonResponse(200, { ...PROFILE, appVersion: 'v2' });
    if (path === '/vocab/mistakes/practice-queue') return queueReply();
    if (path === '/vocab/mistakes/practice-result') return resultReply();
    return jsonResponse(404, { code: 'not_stubbed', path: full });
  });
  vi.stubGlobal('fetch', fetchMock);
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname}</span>;
}

function mount(at: string = PRACTICE) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}

async function settle(rounds = 14) {
  await act(async () => {
    for (let i = 0; i < rounds; i++) await Promise.resolve();
  });
}

const at = () => screen.getByTestId('loc').textContent;
const text = () => document.body.textContent ?? '';
const calls = (p: string) => reqs.filter((r) => r.path.split('?')[0] === p);
const bodies = (p: string) => calls(p).map((c) => JSON.parse(c.body ?? '{}'));
const results = () => calls('/vocab/mistakes/practice-result');

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
  await settle();
}

/** 手动控制的 practice-result 响应。 */
function heldResult() {
  let resolve!: (v: Response) => void;
  let reject!: (e: unknown) => void;
  const p = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  resultReply = () => p;
  return {
    ok: (body: unknown = { ok: true, correctStreak: 1, resolved: false }) =>
      resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) } as Response),
    fail: () => reject(new TypeError('network down')),
  };
}

/** 答案材料**一个字都不许出现在屏幕上**。 */
function expectNoAnswerMaterial() {
  const t = text();
  expect(t).not.toContain(SECRETS.answerModel);
  expect(t).not.toContain(SECRETS.explanation);
  expect(t).not.toContain(SECRETS.evidence);
  expect(screen.queryByTestId('correct-answer')).toBeNull();
  expect(screen.queryByTestId('answer-points')).toBeNull();
  expect(screen.queryByTestId('answer-model')).toBeNull();
  expect(screen.queryByTestId('explanation')).toBeNull();
  expect(screen.queryByTestId('evidence')).toBeNull();
  expect(screen.queryByTestId('marker-comment')).toBeNull();
}

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  writeToken(TOKEN);
  queueReply = () => jsonResponse(200, queue());
  resultReply = () => jsonResponse(200, { ok: true, correctStreak: 1, resolved: false });
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// AC-06 —— 只吃 practice-queue
// ─────────────────────────────────────────────────────────────

describe('AC-06 只吃 practice-queue', () => {
  it('**挂载只打一个 GET**，零查询串、零请求体、零写', async () => {
    mount();
    await settle();
    expect(at()).toBe(PRACTICE);
    expect(calls('/vocab/mistakes/practice-queue')).toHaveLength(1);
    const c = calls('/vocab/mistakes/practice-queue')[0];
    expect(c.method).toBe('GET');
    expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(c.path).toBe('/vocab/mistakes/practice-queue');
    expect(c.body).toBeNull();
    expect(reqs.filter((r) => r.method !== 'GET')).toEqual([]);
  });

  it('**不碰课程线 / 生词本 / 成绩线 / 正式测试 / 埋点 / 错题列表**', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('option-1'));
    for (const r of reqs) {
      expect(r.path).not.toMatch(/^\/lesson\//);
      expect(r.path).not.toMatch(/vocab\/(words|due|review|quiz)/);
      expect(r.path).not.toMatch(/history-by-name|quiz\/attempt|page-view/);
      expect(r.path.split('?')[0]).not.toBe('/vocab/mistakes');
    }
  });

  it('**零身份参数**', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('option-1'));
    for (const r of reqs) {
      expect(r.path).not.toMatch(/[?&](name|studentName|studentId)=/);
      if (r.body) expect(r.body).not.toMatch(/"name"|"studentName"|"studentId"/);
    }
  });

  it('**没票时去登录页，不发任何错题请求**', async () => {
    localStorage.clear();
    __resetForTest();
    mount();
    await settle();
    expect(at()).toBe(ROUTES.login);
    expect(calls('/vocab/mistakes/practice-queue')).toHaveLength(0);
  });

  it('**服务端顺序与 remaining 都照搬**', async () => {
    queueReply = () =>
      jsonResponse(200, queue([item({ id: 'zzz' }), item({ id: 'aaa' })], { remaining: 7 }));
    mount();
    await settle();
    expect(screen.getByTestId('remaining').textContent).toContain('7');
    expect(screen.getByTestId('practice-progress').textContent).toContain('1 / 2');
    await click(screen.getByTestId('skip'));
    expect(bodies('/vocab/mistakes/practice-result')).toEqual([]);
    await click(screen.getByTestId('option-1'));
    expect(results()[0] && JSON.parse(results()[0].body ?? '{}').id).toBe('aaa');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 —— 作答之前不许漏答案
// ─────────────────────────────────────────────────────────────

describe('AC-06 作答之前不漏答案', () => {
  it('**题干与原文在，答案材料一个字都没有**', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('item-stem').textContent).toContain('The ferry ran after dark');
    // S12I —— 原文收进了「查看原文并定位」（默认收起）。
    await act(async () => {
      fireEvent.click(screen.getByTestId('locate-toggle'));
    });
    expect(screen.getByTestId('locate-body').textContent).toContain('The ferry crossed at dawn');
    expectNoAnswerMaterial();
  });

  it('**翻卡题在翻开之前同样不漏**', async () => {
    queueReply = () =>
      jsonResponse(200, queue([item({ practiceKind: 'reveal', options: [], taskType: 'short_answer' })]));
    mount();
    await settle();
    expectNoAnswerMaterial();
    expect(screen.getByTestId('reveal')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 —— 四种作答方式
// ─────────────────────────────────────────────────────────────

describe('AC-06 四种作答方式', () => {
  it('**tfng：只用服务端给的三个选项**，判定不分大小写与首尾空白', async () => {
    queueReply = () => jsonResponse(200, queue([item({ correctAnswer: '  false ' })]));
    mount();
    await settle();
    const opts = [...document.querySelectorAll('[data-testid^="option-"]')].map((e) => e.textContent);
    expect(opts).toEqual(['TRUE', 'FALSE', 'NOT GIVEN']);
    await click(screen.getByTestId('option-1'));
    expect(screen.getByTestId('verdict').textContent).toContain('答对');
  });

  it('**tfng：选错就说错**', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('option-0'));
    expect(screen.getByTestId('verdict').textContent).toContain('答错');
    expect(screen.getByTestId('correct-answer').textContent).toContain('FALSE');
  });

  it('**letters：用服务端给的段落字母**', async () => {
    queueReply = () =>
      jsonResponse(200, queue([
        item({ taskType: 'matching_information', practiceKind: 'letters',
               options: ['A', 'B', 'C', 'D'], correctAnswer: 'C' }),
      ]));
    mount();
    await settle();
    const opts = [...document.querySelectorAll('[data-testid^="option-"]')].map((e) => e.textContent);
    expect(opts).toEqual(['A', 'B', 'C', 'D']);
    await click(screen.getByTestId('option-2'));
    expect(screen.getByTestId('verdict').textContent).toContain('答对');
  });

  it('**options：{key,text} 原样渲染，按 key 判**', async () => {
    queueReply = () =>
      jsonResponse(200, queue([
        item({ taskType: 'mcq', practiceKind: 'options', correctAnswer: 'B',
               options: [{ key: 'A', text: '渡船停运了' }, { key: 'B', text: '桥建成了' }] }),
      ]));
    mount();
    await settle();
    expect(screen.getByTestId('option-0').textContent).toContain('渡船停运了');
    expect(screen.getByTestId('option-1').textContent).toContain('桥建成了');
    await click(screen.getByTestId('option-1'));
    expect(screen.getByTestId('verdict').textContent).toContain('答对');
    expect(bodies('/vocab/mistakes/practice-result')[0].correct).toBe(true);
  });

  it('**options：字符串选项也照样渲染**', async () => {
    queueReply = () =>
      jsonResponse(200, queue([
        item({ practiceKind: 'options', options: ['甲', '乙'], correctAnswer: '乙' }),
      ]));
    mount();
    await settle();
    expect(screen.getByTestId('option-1').textContent).toContain('乙');
    await click(screen.getByTestId('option-1'));
    expect(screen.getByTestId('verdict').textContent).toContain('答对');
  });

  it('**reveal：先翻卡，再自评**', async () => {
    queueReply = () =>
      jsonResponse(200, queue([item({ practiceKind: 'reveal', options: [], taskType: 'short_answer' })]));
    mount();
    await settle();
    expect(document.querySelectorAll('[data-testid^="option-"]')).toHaveLength(0);
    expect(results()).toHaveLength(0);

    await click(screen.getByTestId('reveal'));
    // 翻开之后答案材料才出现，但**还没写**
    expect(screen.getByTestId('correct-answer')).toBeTruthy();
    expect(screen.getByTestId('explanation')).toBeTruthy();
    expect(results()).toHaveLength(0);

    await click(screen.getByTestId('self-correct'));
    expect(results()).toHaveLength(1);
    expect(bodies('/vocab/mistakes/practice-result')[0].correct).toBe(true);
  });

  it('**reveal：自评「还没掌握」发 correct:false**', async () => {
    queueReply = () =>
      jsonResponse(200, queue([item({ practiceKind: 'reveal', options: [], taskType: 'short_answer' })]));
    mount();
    await settle();
    await click(screen.getByTestId('reveal'));
    await click(screen.getByTestId('self-wrong'));
    expect(bodies('/vocab/mistakes/practice-result')[0].correct).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 —— 反馈与写入
// ─────────────────────────────────────────────────────────────

describe('AC-06 反馈与写入', () => {
  it('**答完才显示旧答案与老师评语**，以及全部答案材料', async () => {
    mount();
    await settle();
    expect(screen.queryByTestId('old-answer')).toBeNull();
    await click(screen.getByTestId('option-1'));
    expect(screen.getByTestId('old-answer').textContent).toContain('TRUE');
    expect(screen.getByTestId('marker-comment').textContent).toContain('第三段说天黑之后就停了');
    expect(screen.getByTestId('answer-points').textContent).toContain('FALSE');
    expect(screen.getByTestId('evidence').textContent).toContain('After dark the ferry');
  });

  it('**请求体恰好两个字段**', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('option-1'));
    const b = bodies('/vocab/mistakes/practice-result')[0];
    expect(Object.keys(b).sort()).toEqual(['correct', 'id']);
    expect(b.id).toBe('q1');
  });

  it('**同一 tick 连点两下只发一条**', async () => {
    mount();
    await settle();
    const btn = screen.getByTestId('option-1');
    await act(async () => {
      btn.click();
      btn.click();
    });
    await settle();
    expect(results()).toHaveLength(1);
  });

  it('**连胜与销账照搬服务端**，前端不自己算', async () => {
    resultReply = () => jsonResponse(200, { ok: true, correctStreak: 2, resolved: true });
    mount();
    await settle();
    await click(screen.getByTestId('option-1'));
    const r = screen.getByTestId('streak-receipt').textContent ?? '';
    expect(r).toContain('2');
    expect(r).toContain('弄懂');
  });

  it('**`{ok:false}` 是失败**：留在原题，可重试，不许翻页', async () => {
    resultReply = () => jsonResponse(200, { ok: false });
    queueReply = () => jsonResponse(200, queue([item({ id: 'q1' }), item({ id: 'q2' })]));
    mount();
    await settle();
    await click(screen.getByTestId('option-1'));
    expect(screen.getByTestId('result-error')).toBeTruthy();
    await click(screen.getByTestId('next'));
    expect(bodies('/vocab/mistakes/practice-result')[0].id).toBe('q1');
    expect(screen.getByTestId('item-stem')).toBeTruthy();
    expect(results()).toHaveLength(1);
  });

  it('**掉票 → 清票回登录页**', async () => {
    resultReply = () => jsonResponse(401, { code: 'token_revoked' });
    mount();
    await settle();
    await click(screen.getByTestId('option-1'));
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-07 —— 含糊写入的对账（practice-result 没有幂等键）
// ─────────────────────────────────────────────────────────────

describe('AC-07 含糊写入不许盲目重发', () => {
  const twoItems = () => jsonResponse(200, queue([item({ id: 'q1' }), item({ id: 'q2' })]));

  it('**在途期间下一题与跳过都不接受**', async () => {
    queueReply = twoItems;
    const held = heldResult();
    mount();
    await settle();
    await click(screen.getByTestId('option-1'));

    await click(screen.getByTestId('next'));
    expect(screen.getByTestId('item-stem')).toBeTruthy();
    expect(results()).toHaveLength(1);
    expect(screen.queryByTestId('skip')).toBeNull();

    await act(async () => {
      held.ok();
    });
    await settle();
    await click(screen.getByTestId('next'));
    expect(screen.getByTestId('practice-progress').textContent).toContain('2 / 2');
  });

  it('**失败 + 队列里还有这题 = 没记上**：允许重试，且没有盲目重发', async () => {
    queueReply = twoItems;
    const held = heldResult();
    mount();
    await settle();
    await click(screen.getByTestId('option-1'));
    await act(async () => {
      held.fail();
    });
    await settle();

    // 对账读了一次队列；**写只有那一次**
    expect(calls('/vocab/mistakes/practice-queue')).toHaveLength(2);
    expect(results()).toHaveLength(1);
    expect(screen.getByTestId('result-error')).toBeTruthy();
    expect(screen.getByTestId('verdict').textContent).toContain('答对');

    resultReply = () => jsonResponse(200, { ok: true, correctStreak: 1, resolved: false });
    await click(screen.getByTestId('retry-result'));
    expect(results()).toHaveLength(2);
    await click(screen.getByTestId('next'));
    expect(screen.getByTestId('practice-progress').textContent).toContain('2 / 2');
  });

  it('**失败 + 队列里已经没这题 = 记上了**：给一个不编数字的回执', async () => {
    queueReply = twoItems;
    const held = heldResult();
    mount();
    await settle();
    await click(screen.getByTestId('option-1'));
    queueReply = () => jsonResponse(200, queue([item({ id: 'q2' })], { remaining: 1 }));
    await act(async () => {
      held.fail();
    });
    await settle();

    expect(results()).toHaveLength(1); // **没有第二次写**
    expect(screen.getByTestId('recorded-receipt')).toBeTruthy();
    expect(screen.queryByTestId('streak-receipt')).toBeNull(); // 不编连胜
    expect(screen.queryByTestId('result-error')).toBeNull();
    await click(screen.getByTestId('next'));
    expect(screen.getByTestId('practice-progress').textContent).toContain('2 / 2');
  });

  it('**对账也失败 → 锁在这一题，只给「再查一次」，绝不自动重发**', async () => {
    queueReply = twoItems;
    const held = heldResult();
    mount();
    await settle();
    await click(screen.getByTestId('option-1'));
    queueReply = () => jsonResponse(500, { code: 'boom' });
    await act(async () => {
      held.fail();
    });
    await settle();

    expect(results()).toHaveLength(1);
    expect(screen.getByTestId('recheck')).toBeTruthy();
    await click(screen.getByTestId('next'));
    expect(screen.getByTestId('item-stem')).toBeTruthy();
    expect(results()).toHaveLength(1);

    // 「再查一次」只读，不写
    queueReply = () => jsonResponse(200, queue([item({ id: 'q2' })], { remaining: 1 }));
    await click(screen.getByTestId('recheck'));
    expect(results()).toHaveLength(1);
    expect(screen.getByTestId('recorded-receipt')).toBeTruthy();
  });

  it('**对账期间掉票 → 清票回登录页**', async () => {
    queueReply = twoItems;
    const held = heldResult();
    mount();
    await settle();
    await click(screen.getByTestId('option-1'));
    queueReply = () => jsonResponse(401, { code: 'token_revoked' });
    await act(async () => {
      held.fail();
    });
    await settle();
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-08 —— 载入 / 空 / 完成 / 跳过 / 刷新
// ─────────────────────────────────────────────────────────────

describe('AC-08 载入与完成', () => {
  it('先显示载入中', async () => {
    let release: (() => void) | null = null;
    queueReply = () =>
      new Promise<Response>((res) => {
        release = () => res({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(queue())) } as Response);
      });
    mount();
    await settle();
    expect(text()).toContain('载入中');
    await act(async () => {
      release?.();
    });
    await settle();
    expect(screen.getByTestId('item-stem')).toBeTruthy();
  });

  it('**空队列有明确的空态**', async () => {
    queueReply = () => jsonResponse(200, queue([], { remaining: 0 }));
    mount();
    await settle();
    expect(screen.getByTestId('practice-empty')).toBeTruthy();
    expect(results()).toHaveLength(0);
  });

  it('**做完给完成页**，并说清楚还剩多少（不编内容）', async () => {
    queueReply = () => jsonResponse(200, queue([item()], { remaining: 5 }));
    mount();
    await settle();
    await click(screen.getByTestId('option-1'));
    await click(screen.getByTestId('next'));
    const done = screen.getByTestId('practice-done').textContent ?? '';
    expect(done).toContain('1');
    expect(screen.getByTestId('remaining-after').textContent).toContain('4');
  });

  it('**跳过不写**，而且写开始之后就没有跳过了', async () => {
    queueReply = () => jsonResponse(200, queue([item({ id: 'q1' }), item({ id: 'q2' })]));
    mount();
    await settle();
    expect(screen.getByTestId('skip')).toBeTruthy();
    await click(screen.getByTestId('skip'));
    expect(results()).toHaveLength(0);
    expect(screen.getByTestId('practice-progress').textContent).toContain('2 / 2');

    await click(screen.getByTestId('option-1'));
    expect(screen.queryByTestId('skip')).toBeNull();
  });

  it('**载入失败 → 错误态 + 重试，票不丢**', async () => {
    queueReply = () => jsonResponse(500, { code: 'boom' });
    mount();
    await settle();
    expect(screen.getByTestId('retry')).toBeTruthy();
    expect(readToken()).toBe(TOKEN);
    queueReply = () => jsonResponse(200, queue());
    await click(screen.getByTestId('retry'));
    expect(screen.getByTestId('item-stem')).toBeTruthy();
  });

  it('**401 清票回登录页**', async () => {
    queueReply = () => jsonResponse(401, { code: 'token_revoked' });
    mount();
    await settle();
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });

  it('**卸载之后回来的响应画不上去**', async () => {
    let release: ((v: Response) => void) | null = null;
    queueReply = () => new Promise<Response>((res) => { release = res; });
    const view = mount();
    await settle();
    view.unmount();
    await act(async () => {
      release?.({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(queue())) } as Response);
    });
    await settle();
    expect(document.body.textContent).not.toContain('The ferry ran after dark');
  });

  it('**重新挂载只重新拉一次队列，不补写**', async () => {
    const first = mount();
    await settle();
    first.unmount();
    reqs = [];
    mount();
    await settle();
    expect(calls('/vocab/mistakes/practice-queue')).toHaveLength(1);
    expect(reqs.filter((r) => r.method !== 'GET')).toEqual([]);
  });

  it('**能回错题本**', async () => {
    mount();
    await settle();
    await click(screen.getByTestId('back-to-mistakes'));
    expect(at()).toBe(MISTAKES);
  });
});
