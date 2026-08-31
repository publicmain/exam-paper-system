/**
 * 阶段 12A —— 生词自测（`/vocab/selftest`）的**行为测试**。
 *
 * 挂真 `App`，只在 `fetch` 打桩，**不 import 页面组件**。
 *
 * 这一屏的规矩：
 *
 *   · **只吃 `/vocab/quiz`**，而且**永远不碰** `/vocab/quiz/attempt/*` ——
 *     那是**正式测试**（记成绩、进历史）。自测是自由练习，两条线混在一起，
 *     学生随手一测就会污染自己的成绩单。
 *   · **每道题第一遍最多写一次 FSRS**：第一遍对 → `good`，错 → `again`。
 *   · **末尾重做错题不再写 FSRS** —— 同一道题写两次，FSRS 会把间隔算歪。
 *   · 断网时**答案不丢、requestId 不变**。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import { writeToken, readToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { ROUTES } from '../routes.contract';

const VOCAB = '/vocab';
const SELFTEST = '/vocab/selftest';

const PROFILE = { id: 't6_done', name: '测试六号', nickname: '六号', avatar: null };
const TOKEN = 'selftest-token';

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
// 夹具 —— 字段照 `vocab-quiz.service.ts` 的 buildQuiz()（自由练习那一路）
// ─────────────────────────────────────────────────────────────

const mcq = (over: Record<string, unknown> = {}) => ({
  qtype: 'word_to_meaning',
  headword: 'ferry',
  prompt: 'ferry',
  options: ['渡船', '桥梁', '灯塔', '码头'],
  correctIndex: 0,
  phonetic: '/ˈferi/',
  translation: '渡船',
  contextSentence: 'The ferries stopped running after dark.',
  ...over,
});

const spelling = (over: Record<string, unknown> = {}) => ({
  qtype: 'spelling',
  headword: 'lighthouse',
  prompt: 'The ＿＿＿ warned every ship away from the rocks.',
  options: [],
  correctIndex: -1,
  phonetic: '/ˈlaɪthaʊs/',
  translation: '灯塔',
  contextSentence: 'The lighthouse warned every ship away from the rocks.',
  answer: 'lighthouse',
  ...over,
});

const quiz = (questions: Record<string, unknown>[] = [mcq()], over: Record<string, unknown> = {}) => ({
  student: { id: PROFILE.id, name: PROFILE.name },
  streakDays: 6,
  totalWords: 12,
  seenWords: 9,
  questions,
  ...over,
});

const receipt = (over: Record<string, unknown> = {}) => ({
  headword: 'ferry',
  state: 'review',
  due: '2026-09-02T00:00:00.000Z',
  intervalDays: 3,
  reps: 3,
  ...over,
});

// ─────────────────────────────────────────────────────────────
// 网络边界
// ─────────────────────────────────────────────────────────────

let quizReply: () => Promise<Response>;
let reviewReply: () => Promise<Response>;

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
    if (path === '/vocab/quiz') return quizReply();
    if (path === '/vocab/review') return reviewReply();
    return jsonResponse(404, { code: 'not_stubbed', path: full });
  });
  vi.stubGlobal('fetch', fetchMock);
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname}</span>;
}

function mount(at: string = SELFTEST) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
}

/**
 * S12L —— 自测现在**先有一屏设置**（题量 5 / 10 / 20 / 全部），选完才出题。
 *
 * 下面这些用例测的是出题之后的行为，所以统一走这个 helper：挂载 →
 * 选「全部」→ 等出题。设置屏本身由 `s12l-pilot.test.tsx` 覆盖。
 */
async function mountAndStart(at: string = SELFTEST) {
  const r = mount(at);
  await settle();
  const go = screen.queryByTestId('selftest-count-all');
  if (go) {
    await act(async () => {
      go.click();
    });
    await settle();
  }
  return r;
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

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
  await settle();
}

async function type(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle();
}

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  writeToken(TOKEN);
  quizReply = () => jsonResponse(200, quiz());
  reviewReply = () => jsonResponse(200, receipt());
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────
// AC-06 —— 只吃 /vocab/quiz，永不碰正式测试
// ─────────────────────────────────────────────────────────────

describe('AC-06 只吃 /vocab/quiz', () => {
  // S12L —— 查询串里现在**只允许一个 `limit`**（学生自己选的题量）。
  // 身份仍然一个字都不许出现 —— 那才是这条守卫真正在守的东西。
  it('**只打一个 GET /vocab/quiz**，查询串里只有 limit、零请求体、零写', async () => {
    await mountAndStart();
    expect(at()).toBe(SELFTEST);
    expect(calls('/vocab/quiz')).toHaveLength(1);
    const c = calls('/vocab/quiz')[0];
    expect(c.method).toBe('GET');
    expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(c.path).toMatch(/^\/vocab\/quiz(\?limit=\d+)?$/);
    expect(c.path).not.toMatch(/name=|studentId=/);
    expect(c.body).toBeNull();
    expect(reqs.filter((r) => r.method !== 'GET')).toEqual([]);
  });

  it('**一次 `/vocab/quiz/attempt/*` 都不碰**（那是正式测试）', async () => {
    await mountAndStart();
    await click(screen.getByTestId('option-0'));
    await click(screen.getByTestId('next'));
    for (const r of reqs) {
      expect(r.path).not.toMatch(/quiz\/attempt/);
      expect(r.path).not.toMatch(/^\/lesson\//);
      expect(r.path).not.toMatch(/lesson-cards|mistakes|page-view/);
    }
  });

  it('**零身份参数**', async () => {
    await mountAndStart();
    await click(screen.getByTestId('option-0'));
    await click(screen.getByTestId('next'));
    for (const r of reqs) {
      expect(r.path).not.toMatch(/name=|studentName=|studentId=/);
      if (r.body) expect(r.body).not.toMatch(/"name"|"studentName"|"studentId"/);
    }
  });

  it('**没票时进来去登录页，不发任何词汇请求**', async () => {
    localStorage.clear();
    __resetForTest();
    await mountAndStart();
    expect(at()).toBe(ROUTES.login);
    expect(calls('/vocab/quiz')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 —— 四种题型与判定
// ─────────────────────────────────────────────────────────────

describe('AC-06 题型与判定', () => {
  it('**选择题按 correctIndex 判**，选对当场说对', async () => {
    await mountAndStart();
    expect(screen.getByTestId('question-prompt').textContent).toContain('ferry');
    expect(document.querySelectorAll('[data-testid^="option-"]')).toHaveLength(4);
    await click(screen.getByTestId('option-0'));
    expect(screen.getByTestId('verdict').textContent).toContain('答对');
  });

  it('**选错当场说错，并给出正确选项**', async () => {
    await mountAndStart();
    await click(screen.getByTestId('option-1'));
    expect(screen.getByTestId('verdict').textContent).toContain('答错');
    expect(screen.getByTestId('correct-answer').textContent).toContain('渡船');
  });

  it('**看义选词也走 correctIndex**', async () => {
    quizReply = () =>
      jsonResponse(200, quiz([mcq({ qtype: 'meaning_to_word', prompt: '渡船', options: ['ferry', 'bridge'], correctIndex: 0 })]));
    await mountAndStart();
    expect(screen.getByTestId('question-prompt').textContent).toContain('渡船');
    await click(screen.getByTestId('option-0'));
    expect(screen.getByTestId('verdict').textContent).toContain('答对');
  });

  it('**挖空题渲染挖空句**', async () => {
    quizReply = () =>
      jsonResponse(200, quiz([mcq({ qtype: 'cloze', prompt: 'The ＿＿＿ stopped running after dark.' })]));
    await mountAndStart();
    expect(screen.getByTestId('question-prompt').textContent).toContain('＿＿＿');
    await click(screen.getByTestId('option-0'));
    expect(screen.getByTestId('verdict').textContent).toContain('答对');
  });

  it('**拼写题用输入框 + `answer` 判定**（大小写与首尾空白不计）', async () => {
    quizReply = () => jsonResponse(200, quiz([spelling()]));
    await mountAndStart();
    expect(document.querySelectorAll('[data-testid^="option-"]')).toHaveLength(0);
    await type(screen.getByTestId('spelling-input') as HTMLInputElement, '  LightHouse ');
    await click(screen.getByTestId('spelling-submit'));
    expect(screen.getByTestId('verdict').textContent).toContain('答对');
  });

  it('**拼写错了给出正确拼法**', async () => {
    quizReply = () => jsonResponse(200, quiz([spelling()]));
    await mountAndStart();
    await type(screen.getByTestId('spelling-input') as HTMLInputElement, 'litehouse');
    await click(screen.getByTestId('spelling-submit'));
    expect(screen.getByTestId('verdict').textContent).toContain('答错');
    expect(screen.getByTestId('correct-answer').textContent).toContain('lighthouse');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 —— FSRS 写入
// ─────────────────────────────────────────────────────────────

describe('AC-06 FSRS 写入', () => {
  it('**第一遍答对 → 一条 rating=good**', async () => {
    await mountAndStart();
    await click(screen.getByTestId('option-0'));
    expect(calls('/vocab/review')).toHaveLength(1);
    const b = bodies('/vocab/review')[0];
    expect(Object.keys(b).sort()).toEqual(['elapsedMs', 'headword', 'rating', 'requestId']);
    expect(b.rating).toBe('good');
    expect(b.headword).toBe('ferry');
  });

  it('**第一遍答错 → 一条 rating=again**', async () => {
    await mountAndStart();
    await click(screen.getByTestId('option-1'));
    expect(calls('/vocab/review')).toHaveLength(1);
    expect(bodies('/vocab/review')[0].rating).toBe('again');
  });

  it('**每道题第一遍最多写一次**（连点也一样）', async () => {
    await mountAndStart();
    const opt = screen.getByTestId('option-0');
    await act(async () => {
      opt.click();
      opt.click();
    });
    await settle();
    expect(calls('/vocab/review')).toHaveLength(1);
  });

  it('**末尾重做错题不再写 FSRS**', async () => {
    quizReply = () =>
      jsonResponse(200, quiz([
        mcq({ headword: 'ferry' }),
        mcq({ headword: 'bridge', prompt: 'bridge', translation: '桥梁', options: ['桥梁', '渡船'], correctIndex: 0 }),
      ]));
    await mountAndStart();
    // 第一题故意答错
    await click(screen.getByTestId('option-1'));
    await click(screen.getByTestId('next'));
    // 第二题答对
    await click(screen.getByTestId('option-0'));
    await click(screen.getByTestId('next'));
    expect(calls('/vocab/review')).toHaveLength(2);

    // 进入错题重做
    expect(screen.getByTestId('redo-wrong')).toBeTruthy();
    await click(screen.getByTestId('redo-wrong'));
    await click(screen.getByTestId('option-0'));
    await click(screen.getByTestId('next'));
    // **一条都没有多**
    expect(calls('/vocab/review')).toHaveLength(2);
  });

  it('**写入失败时答案与判定还在，重试用同一个 requestId**', async () => {
    reviewReply = () => jsonResponse(500, { code: 'boom' });
    await mountAndStart();
    await click(screen.getByTestId('option-0'));
    expect(screen.getByTestId('verdict').textContent).toContain('答对');
    expect(screen.getByTestId('write-error')).toBeTruthy();
    const first = bodies('/vocab/review')[0].requestId;

    reviewReply = () => jsonResponse(200, receipt());
    await click(screen.getByTestId('retry-write'));
    expect(bodies('/vocab/review')[1].requestId).toBe(first);
    expect(screen.queryByTestId('write-error')).toBeNull();
  });

  it('**掉票 → 清票回登录页**', async () => {
    reviewReply = () => jsonResponse(401, { code: 'token_revoked' });
    await mountAndStart();
    await click(screen.getByTestId('option-0'));
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 / AC-08 —— 返工 1/2 B-2：在途写入期间不许下一题
//
// 与自由练习那条同源：答完题 FSRS 的 POST 还在路上时「下一题」就能点，
// 于是这一题的写入和界面脱钩 —— 失败了也没人知道，重试按钮挂在一道已经
// 翻过去的题上。第一遍的题**只有写成功了才能往下走**。
//
// 重做那一轮不写 FSRS，所以不受这条约束。
// ─────────────────────────────────────────────────────────────

describe('AC-06 在途写入期间的闭锁（B-2）', () => {
  function heldReview() {
    let resolve!: (v: Response) => void;
    let reject!: (e: unknown) => void;
    const p = new Promise<Response>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    reviewReply = () => p;
    return {
      ok: () =>
        resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(receipt())) } as Response),
      fail: () => reject(new TypeError('network down')),
    };
  }

  const twoQuestions = () =>
    jsonResponse(200, quiz([
      mcq({ headword: 'ferry', prompt: 'ferry' }),
      mcq({ headword: 'bridge', prompt: 'bridge', translation: '桥梁', options: ['桥梁', '渡船'], correctIndex: 0 }),
    ]));

  it('**写入在途时点下一题：题不许动**', async () => {
    quizReply = twoQuestions;
    const held = heldReview();
    await mountAndStart();
    await click(screen.getByTestId('option-0'));

    expect(calls('/vocab/review')).toHaveLength(1);
    expect(screen.getByTestId('question-prompt').textContent).toContain('ferry');

    await click(screen.getByTestId('next'));
    expect(screen.getByTestId('question-prompt').textContent).toContain('ferry');
    expect(screen.getByTestId('verdict').textContent).toContain('答对');

    await act(async () => {
      held.ok();
    });
    await settle();
    // 成功之后才可以走
    await click(screen.getByTestId('next'));
    expect(screen.getByTestId('question-prompt').textContent).toContain('bridge');
  });

  it('**失败之后：同一题、判定还在、requestId 不变、重试之后才走得掉**', async () => {
    quizReply = twoQuestions;
    const held = heldReview();
    await mountAndStart();
    await click(screen.getByTestId('option-1')); // 故意答错
    const first = bodies('/vocab/review')[0].requestId;

    await act(async () => {
      held.fail();
    });
    await settle();

    expect(screen.getByTestId('question-prompt').textContent).toContain('ferry');
    expect(screen.getByTestId('verdict').textContent).toContain('答错');
    expect(screen.getByTestId('correct-answer')).toBeTruthy();
    expect(screen.getByTestId('write-error')).toBeTruthy();

    // 没写成功之前走不掉
    await click(screen.getByTestId('next'));
    expect(screen.getByTestId('question-prompt').textContent).toContain('ferry');

    reviewReply = () => jsonResponse(200, receipt());
    await click(screen.getByTestId('retry-write'));
    expect(bodies('/vocab/review')[1].requestId).toBe(first);

    await click(screen.getByTestId('next'));
    expect(screen.getByTestId('question-prompt').textContent).toContain('bridge');
  });

  it('**一道题只算一次写入**（在途 + 迟到成功也不多发）', async () => {
    quizReply = twoQuestions;
    const held = heldReview();
    await mountAndStart();
    await click(screen.getByTestId('option-0'));
    await click(screen.getByTestId('next'));
    await click(screen.getByTestId('next'));
    await act(async () => {
      held.ok();
    });
    await settle();
    expect(calls('/vocab/review')).toHaveLength(1);
    // 迟到的成功**不自己翻页** —— 翻页仍然是学生点出来的
    expect(screen.getByTestId('question-prompt').textContent).toContain('ferry');
  });

  it('**重做那一轮不写 FSRS，所以照常能走**', async () => {
    quizReply = twoQuestions;
    await mountAndStart();
    await click(screen.getByTestId('option-1')); // 第一题错
    await click(screen.getByTestId('next'));
    await click(screen.getByTestId('option-0')); // 第二题对
    await click(screen.getByTestId('next'));
    expect(calls('/vocab/review')).toHaveLength(2);

    await click(screen.getByTestId('redo-wrong'));
    // 重做轮里答题**不发请求**，下一题立刻可用
    await click(screen.getByTestId('option-0'));
    expect(calls('/vocab/review')).toHaveLength(2);
    await click(screen.getByTestId('next'));
    expect(screen.getByTestId('selftest-done')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-08 —— 空态 / 题目不够 / 完成 / 刷新
// ─────────────────────────────────────────────────────────────

describe('AC-08 空态与完成', () => {
  it('**一道题都出不了时如实说**，并给出去处', async () => {
    quizReply = () => jsonResponse(200, quiz([], { totalWords: 0, seenWords: 0 }));
    await mountAndStart();
    expect(screen.getByTestId('selftest-empty')).toBeTruthy();
    expect(calls('/vocab/review')).toHaveLength(0);
  });

  it('**有词但一个都没学过时，提示先去学**', async () => {
    quizReply = () => jsonResponse(200, quiz([], { totalWords: 12, seenWords: 0 }));
    await mountAndStart();
    expect(screen.getByTestId('selftest-empty').textContent).toContain('还没学过');
  });

  it('**做完给完成页**，带对错统计', async () => {
    quizReply = () =>
      jsonResponse(200, quiz([
        mcq({ headword: 'ferry' }),
        mcq({ headword: 'bridge', prompt: 'bridge', translation: '桥梁', options: ['桥梁', '渡船'], correctIndex: 0 }),
      ]));
    await mountAndStart();
    await click(screen.getByTestId('option-0'));
    await click(screen.getByTestId('next'));
    await click(screen.getByTestId('option-1'));
    await click(screen.getByTestId('next'));
    expect(screen.getByTestId('selftest-done').textContent).toContain('1 / 2');
  });

  it('完成页能回生词本', async () => {
    await mountAndStart();
    await click(screen.getByTestId('option-0'));
    await click(screen.getByTestId('next'));
    await click(screen.getByTestId('back-to-vocab'));
    expect(at()).toBe(VOCAB);
  });

  it('**进度照服务端的题数**', async () => {
    quizReply = () => jsonResponse(200, quiz([mcq(), mcq({ headword: 'b' })]));
    await mountAndStart();
    expect(screen.getByTestId('selftest-progress').textContent).toContain('1 / 2');
  });

  it('先显示载入中', async () => {
    let release: (() => void) | null = null;
    quizReply = () =>
      new Promise<Response>((res) => {
        release = () => res({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(quiz())) } as Response);
      });
    await mountAndStart();
    expect(text()).toContain('载入中');
    await act(async () => {
      release?.();
    });
    await settle();
    expect(screen.getByTestId('question-prompt')).toBeTruthy();
  });

  it('**载入失败 → 错误态 + 重试，票不丢**', async () => {
    quizReply = () => jsonResponse(500, { code: 'boom' });
    await mountAndStart();
    expect(screen.getByTestId('retry')).toBeTruthy();
    expect(readToken()).toBe(TOKEN);
    quizReply = () => jsonResponse(200, quiz());
    await click(screen.getByTestId('retry'));
    expect(screen.getByTestId('question-prompt')).toBeTruthy();
  });

  it('**401 清票回登录页**', async () => {
    quizReply = () => jsonResponse(401, { code: 'token_revoked' });
    await mountAndStart();
    expect(readToken()).toBeNull();
    expect(at()).toBe(ROUTES.login);
  });

  it('**卸载之后回来的响应画不上去**', async () => {
    let release: ((v: Response) => void) | null = null;
    quizReply = () => new Promise<Response>((res) => { release = res; });
    const view = mount();
    await settle();
    view.unmount();
    await act(async () => {
      release?.({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(quiz())) } as Response);
    });
    await settle();
    expect(document.body.textContent).not.toContain('渡船');
  });

  it('**刷新（重新挂载）重出一套，不补写**', async () => {
    const first = mount();
    await settle();
    first.unmount();
    reqs = [];
    await mountAndStart();
    expect(calls('/vocab/quiz')).toHaveLength(1);
    expect(reqs.filter((r) => r.method !== 'GET')).toEqual([]);
  });
});
