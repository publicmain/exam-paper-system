/**
 * AC-03 ~ AC-06 / AC-08 —— 课程学词这一屏的行为。
 *
 * 真页面 + 真队列 + 真 api 客户端，只在 `fetch` 那一层打桩。断言落在渲染
 * 出来的 DOM、发出去的请求、以及 localStorage 上。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LessonVocabPage from '../pages/LessonVocab';
import { QUEUE_KEY, __resetFlushGuardForTest, readQueue } from '../lib/review-queue';
import { readToken, writeToken } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import { BLANK } from '../lib/vocab-card';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

type Req = { url: string; init: RequestInit };

// ─────────────────────────────────────────────────────────────
// 线缆
// ─────────────────────────────────────────────────────────────

function todayPayload(kind = 'learn_vocab', over: Record<string, unknown> = {}) {
  return {
    student: { id: 'x', name: 'n' },
    date: '2026-08-29',
    // href 故意塞一个旧端地址 —— 页面必须彻底无视它
    nextAction: { kind, label: '学习本次单词', href: '/my-vocab?name=x' },
    rulesVersion: 4,
    completed: 1,
    total: 3,
    allDone: false,
    streakDays: 2,
    targetsFrozenAt: null,
    stage: 'vocab_learn',
    stageAt: null,
    vocabCursor: 0,
    segments: [
      {
        key: 'read', status: 'done', label: 'The Nile', questionCount: 4, typicalMinutes: 20,
        score: 4, maxScore: 5, scoresPending: false, submissionId: 'sub-1', sessionId: 'sess-1',
        autoClosed: false,
      },
      { key: 'vocab', status: 'todo', progress: 0, target: 3, typicalMinutes: 5, quizScore: { status: 'not_started' } },
      { key: 'drill', status: 'none', progress: 0, target: 0, typicalMinutes: 5 },
    ],
    ...over,
  };
}

function card(over: Record<string, unknown> = {}) {
  return {
    headword: 'nile',
    surfaceForm: 'Nile',
    contextSentence: 'The Nile is the longest river.',
    sourcePassageTitle: 'Rivers of Africa',
    phonetic: 'naɪl',
    translation: '尼罗河',
    pos: 'n.',
    definition: 'A river in Africa.',
    tag: [],
    state: 'review',
    reps: 2,
    needsFirstTeaching: false,
    firstTaughtAt: '2026-08-01T00:00:00.000Z',
    sourceType: 'passage',
    addedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

/** 默认三张：一张教学卡 + 两张复习卡。 */
function cardsPayload(over: Record<string, unknown> = {}) {
  return {
    lessonContext: true,
    cursor: 0,
    totalDue: 3,
    cards: [
      card({ headword: 'delta', surfaceForm: 'delta', translation: '三角洲', needsFirstTeaching: true, reps: 0, state: 'new', firstTaughtAt: null, contextSentence: 'A delta forms at the mouth.' }),
      card(),
      card({ headword: 'silt', surfaceForm: 'silt', translation: '淤泥', contextSentence: 'The silt makes soil rich.' }),
    ],
    ...over,
  };
}

type Reply = { status?: number; body: unknown } | Error;

let reqs: Req[] = [];
let routes: Record<string, (req: Req) => Reply>;

function installFetch() {
  reqs = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      reqs.push({ url, init });
      const key = Object.keys(routes)
        .filter((k) => url.startsWith(k))
        .sort((a, b) => b.length - a.length)[0];
      const r = key ? routes[key]({ url, init }) : { status: 404, body: { code: 'not_stubbed' } };
      if (r instanceof Error) throw r;
      const status = r.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(r.body),
      } as unknown as Response;
    }),
  );
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
}

const mount = () =>
  render(
    <MemoryRouter>
      <LessonVocabPage />
    </MemoryRouter>,
  );

const calls = (frag: string) => reqs.filter((r) => r.url.includes(frag));
const bodyOf = (r: Req) => JSON.parse(String(r.init.body)) as Record<string, unknown>;

/** 显示答案 → 熬过 1.5 秒停留锁。 */
async function revealAndWait() {
  fireEvent.click(screen.getByTestId('reveal'));
  await act(async () => {
    vi.advanceTimersByTime(1600);
  });
  await settle();
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  __resetForTest();
  __resetFlushGuardForTest();
  navigate.mockClear();
  writeToken('TK');
  installFetch();
  routes = {
    '/api/lesson/today': () => ({ body: todayPayload() }),
    '/api/vocab/lesson-cards': () => ({ body: cardsPayload() }),
    '/api/lesson/vocab-taught': ({ init }) => ({
      body: {
        ok: true,
        headword: String(JSON.parse(String(init.body)).headword),
        cursor: Number(JSON.parse(String(init.body)).cursor),
        stored: true,
        alreadyTaught: false,
        stage: 'vocab_learn',
      },
    }),
    '/api/vocab/review/undo': () => ({ body: { headword: 'nile', undone: true, reps: 1, state: 'review' } }),
    '/api/vocab/review': () => ({ body: { headword: 'nile', state: 'review', due: 'd', intervalDays: 4, reps: 3 } }),
    '/api/lesson/vocab-cursor': ({ init }) => ({
      body: { ok: true, cursor: Number(JSON.parse(String(init.body)).cursor), stored: true },
    }),
  };
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────
// AC-03 资源链路
// ─────────────────────────────────────────────────────────────

describe('AC-03 队列只来自课程线', () => {
  it('**先 /lesson/today，再 /vocab/lesson-cards**', async () => {
    mount();
    await settle();
    expect(reqs[0].url).toBe('/api/lesson/today');
    expect(calls('/vocab/lesson-cards')).toHaveLength(1);
    expect(screen.getByTestId('teaching-card')).toBeInTheDocument();
  });

  it('**lesson-cards 不带任何查询串** —— 身份只靠 Bearer', async () => {
    mount();
    await settle();
    const c = calls('/vocab/lesson-cards')[0];
    expect(c.url).toBe('/api/vocab/lesson-cards');
    expect(c.url).not.toMatch(/[?&#]/);
    expect((c.init.headers as Record<string, string>).Authorization).toBe('Bearer TK');
  });

  it('**每条请求都零身份**', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('taught-next'));
    await settle();
    for (const r of reqs) {
      expect(r.url).not.toMatch(/[?&#]/);
      expect(r.url).not.toMatch(/name=|studentId=|then=|after=/);
      expect((r.init.headers as Record<string, string>).Authorization).toBe('Bearer TK');
      if (r.init.body) expect(String(r.init.body)).not.toMatch(/"name"|"studentName"|"studentId"/);
    }
  });

  it('**今天这一段不是 learn_vocab → 回 /today**，不取卡', async () => {
    routes['/api/lesson/today'] = () => ({ body: todayPayload('vocab_test') });
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
    expect(calls('/vocab/lesson-cards')).toHaveLength(0);
  });

  it('**lessonContext=false → 回 /today**，绝不退回自由练习', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: { lessonContext: false, cards: [], cursor: 0, totalDue: 0 } });
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
    expect(calls('/vocab/due')).toHaveLength(0);
  });

  it('**卡是空的 → 回 /today**', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: { lessonContext: true, cards: [], cursor: 0, totalDue: 0 } });
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
  });

  it('**整条链一次都不打 /vocab/due**', async () => {
    mount();
    await settle();
    expect(calls('/vocab/due')).toHaveLength(0);
  });

  it('**网络坏了是可重试的**', async () => {
    routes['/api/vocab/lesson-cards'] = () => new Error('offline');
    mount();
    await settle();
    expect(screen.getByTestId('retry-load')).toBeInTheDocument();
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload() });
    fireEvent.click(screen.getByTestId('retry-load'));
    await settle();
    expect(screen.getByTestId('teaching-card')).toBeInTheDocument();
  });

  it('**令牌失效 → 走既有登出**', async () => {
    routes['/api/lesson/today'] = () => ({ status: 401, body: { code: 'token_revoked' } });
    mount();
    await settle();
    expect(readToken()).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-04 固定队列与断点
// ─────────────────────────────────────────────────────────────

describe('AC-04 顺序、张数、断点都听服务端的', () => {
  it('**发卡顺序就是响应顺序**，不按 due / reps 重排', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({
      body: cardsPayload({
        cards: [
          card({ headword: 'zulu', reps: 9, needsFirstTeaching: false }),
          card({ headword: 'alpha', reps: 0, needsFirstTeaching: true }),
          card({ headword: 'mid', reps: 4, needsFirstTeaching: false }),
        ],
      }),
    });
    mount();
    await settle();
    expect(screen.getByTestId('review-card').getAttribute('data-headword')).toBe('zulu');
    await revealAndWait();
    fireEvent.click(screen.getByTestId('rate-good'));
    await settle();
    expect(screen.getByTestId('teaching-card').getAttribute('data-headword')).toBe('alpha');
  });

  it('**分母是进入时的张数**，全程不变', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('progress').textContent).toBe('0 / 3');
    fireEvent.click(screen.getByTestId('taught-next'));
    await settle();
    expect(screen.getByTestId('progress').textContent).toBe('1 / 3');
  });

  it('**刷新后从服务端断点接着走**', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 2 }) });
    mount();
    await settle();
    expect(screen.getByTestId('progress').textContent).toBe('2 / 3');
    expect(screen.getByTestId('review-card').getAttribute('data-headword')).toBe('silt');
  });

  it('**断点是脏值时安全钳制**，不崩、不白屏', async () => {
    for (const bad of [null, -5, 999, 'x']) {
      routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: bad }) });
      const view = mount();
      await settle();
      const p = screen.getByTestId('progress').textContent!;
      expect(['0 / 3', '3 / 3']).toContain(p);
      view.unmount();
    }
  });

  it('**服务端返回的断点更靠前时跟进**（别的标签页推过了）', async () => {
    routes['/api/lesson/vocab-taught'] = () => ({
      body: { ok: true, headword: 'delta', cursor: 2, stored: true, alreadyTaught: true, stage: 'vocab_learn' },
    });
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('taught-next'));
    await settle();
    expect(screen.getByTestId('progress').textContent).toBe('2 / 3');
  });

  it('**服务端返回落后的断点时不倒退**', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 2 }) });
    routes['/api/vocab/review'] = () => ({ body: { headword: 'silt', state: 'review', due: 'd', intervalDays: 2, reps: 1 } });
    routes['/api/lesson/vocab-cursor'] = () => ({ body: { ok: true, cursor: 0, stored: false } });
    mount();
    await settle();
    await revealAndWait();
    fireEvent.click(screen.getByTestId('rate-good'));
    await settle();
    expect(screen.getByTestId('progress').textContent).toBe('3 / 3');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-05 教学卡
// ─────────────────────────────────────────────────────────────

describe('AC-05 首次教学卡', () => {
  it('**把词摊开**：拼写、音标、词性、翻译、释义、例句、出处', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('headword').textContent).toBe('delta');
    expect(screen.getByTestId('phonetic')).toBeInTheDocument();
    expect(screen.getByTestId('pos')).toBeInTheDocument();
    expect(screen.getByTestId('translation').textContent).toBe('三角洲');
    expect(screen.getByTestId('definition')).toBeInTheDocument();
    // 教学卡**不挖空** —— 看词怎么用才是这张卡的意义
    expect(screen.getByTestId('context').textContent).toContain('delta');
    expect(screen.getByTestId('context').textContent).not.toContain(BLANK);
    expect(screen.getByTestId('source').textContent).toContain('Rivers of Africa');
  });

  it('**不藏词、不让猜、没有评分、没有跳过**', async () => {
    mount();
    await settle();
    expect(screen.queryByTestId('reveal')).toBeNull();
    expect(screen.queryByTestId('rate-again')).toBeNull();
    expect(screen.queryByTestId('rate-good')).toBeNull();
    expect(screen.queryByTestId('skip')).toBeNull();
    expect(screen.getByTestId('teaching-card').textContent).not.toContain('跳过');
  });

  it('可选字段缺了也不崩', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({
      body: cardsPayload({
        cards: [card({ headword: 'bare', needsFirstTeaching: true, phonetic: null, pos: null, definition: null, contextSentence: null, sourcePassageTitle: null, translation: '' })],
      }),
    });
    mount();
    await settle();
    expect(screen.getByTestId('headword').textContent).toBe('bare');
    expect(screen.queryByTestId('phonetic')).toBeNull();
    expect(screen.queryByTestId('context')).toBeNull();
    expect(screen.queryByTestId('source')).toBeNull();
  });

  it('**「下一个」只打 /lesson/vocab-taught**，请求体精确', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('taught-next'));
    await settle();
    const t = calls('/lesson/vocab-taught');
    expect(t).toHaveLength(1);
    expect(t[0].init.method).toBe('POST');
    expect(bodyOf(t[0])).toEqual({ headword: 'delta', cursor: 1 });
    // 教学**不写 FSRS**
    expect(calls('/vocab/review')).toHaveLength(0);
    expect(readQueue()).toEqual([]);
  });

  it('**连点两下只发一个请求**', async () => {
    mount();
    await settle();
    const btn = screen.getByTestId('taught-next');
    fireEvent.click(btn);
    fireEvent.click(btn);
    await settle();
    expect(calls('/lesson/vocab-taught')).toHaveLength(1);
  });

  it('**失败不推进**，重试落在同一张卡上', async () => {
    routes['/api/lesson/vocab-taught'] = () => new Error('offline');
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('taught-next'));
    await settle();
    expect(screen.getByTestId('step-error')).toBeInTheDocument();
    expect(screen.getByTestId('progress').textContent).toBe('0 / 3');
    expect(screen.getByTestId('teaching-card').getAttribute('data-headword')).toBe('delta');

    routes['/api/lesson/vocab-taught'] = ({ init }) => ({
      body: { ok: true, headword: 'delta', cursor: Number(JSON.parse(String(init.body)).cursor), stored: true, alreadyTaught: false, stage: 'vocab_learn' },
    });
    fireEvent.click(screen.getByTestId('taught-next'));
    await settle();
    expect(screen.getByTestId('progress').textContent).toBe('1 / 3');
  });

  it('**stored=false 不算成功**，也不推进', async () => {
    routes['/api/lesson/vocab-taught'] = () => ({
      body: { ok: true, headword: 'delta', cursor: 0, stored: false, alreadyTaught: false, stage: 'vocab_learn' },
    });
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('taught-next'));
    await settle();
    expect(screen.getByTestId('step-error')).toBeInTheDocument();
    expect(screen.getByTestId('progress').textContent).toBe('0 / 3');
  });

  it('**最后一张教学卡教完直接进完成页**', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({
      body: cardsPayload({ cards: [card({ headword: 'only', needsFirstTeaching: true })] }),
    });
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('taught-next'));
    await settle();
    expect(screen.getByTestId('complete')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 复习卡
// ─────────────────────────────────────────────────────────────

describe('AC-06 复习卡', () => {
  beforeEach(() => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 1 }) });
  });

  it('正面：中文提示 + 挖空例句 + 出处 + 显示答案；**不露词**', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('hint').textContent).toBe('尼罗河');
    expect(screen.getByTestId('cloze').textContent).toContain(BLANK);
    expect(screen.getByTestId('cloze').textContent!.toLowerCase()).not.toContain('nile');
    expect(screen.getByTestId('source')).toBeInTheDocument();
    expect(screen.getByTestId('reveal')).toBeInTheDocument();
    expect(screen.queryByTestId('headword')).toBeNull();
  });

  it('**遮不干净的例句整句不显示**', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({
      body: cardsPayload({ cursor: 0, cards: [card({ headword: 'run', surfaceForm: 'run', contextSentence: 'The runaway train.' })] }),
    });
    mount();
    await settle();
    expect(screen.getByTestId('cloze-withheld')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('runaway');
  });

  it('背面：拼写、音标、翻译、出处 + **恰好两档评分**', async () => {
    mount();
    await settle();
    await revealAndWait();
    expect(screen.getByTestId('headword').textContent).toBe('nile');
    expect(screen.getByTestId('phonetic')).toBeInTheDocument();
    expect(screen.getByTestId('translation')).toBeInTheDocument();
    expect(screen.getByTestId('rate-again')).toBeInTheDocument();
    expect(screen.getByTestId('rate-good')).toBeInTheDocument();
    expect(screen.queryByTestId('rate-hard')).toBeNull();
    expect(screen.queryByTestId('rate-easy')).toBeNull();
  });

  it('**1.5 秒之内不给评分**', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('reveal'));
    await settle();
    expect((screen.getByTestId('rate-good') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('dwell-lock')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(1499); });
    expect((screen.getByTestId('rate-good') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { vi.advanceTimersByTime(1); });
    expect((screen.getByTestId('rate-good') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('dwell-lock')).toBeNull();
  });

  it('**评分请求体精确**，elapsedMs 从显示答案算起', async () => {
    mount();
    await settle();
    await revealAndWait();
    fireEvent.click(screen.getByTestId('rate-good'));
    await settle();
    const b = bodyOf(calls('/vocab/review')[0]);
    expect(Object.keys(b).sort()).toEqual(['elapsedMs', 'headword', 'rating', 'requestId']);
    expect(b.headword).toBe('nile');
    expect(b.rating).toBe('good');
    expect(Number(b.elapsedMs)).toBeGreaterThanOrEqual(1500);
    expect(Number(b.elapsedMs)).toBeLessThanOrEqual(600000);
  });

  it('**成功后前进一张，并显示服务端的回执**', async () => {
    mount();
    await settle();
    await revealAndWait();
    fireEvent.click(screen.getByTestId('rate-good'));
    await settle();
    expect(screen.getByTestId('receipt-ok').textContent).toContain('4 天');
    expect(screen.getByTestId('progress').textContent).toBe('2 / 3');
  });

  it('**连点两下只算一次复习**', async () => {
    mount();
    await settle();
    await revealAndWait();
    const btn = screen.getByTestId('rate-good');
    fireEvent.click(btn);
    fireEvent.click(btn);
    await settle();
    expect(calls('/vocab/review')).toHaveLength(1);
  });

  it('**tooFast 不算学会**：不前进、不给撤销、说清楚', async () => {
    routes['/api/vocab/review'] = () => ({
      body: { headword: 'nile', state: 'review', due: 'd', intervalDays: 0, reps: 2, tooFast: true },
    });
    mount();
    await settle();
    await revealAndWait();
    fireEvent.click(screen.getByTestId('rate-good'));
    await settle();
    expect(screen.getByTestId('receipt-too-fast')).toBeInTheDocument();
    expect(screen.queryByTestId('receipt-ok')).toBeNull();
    expect(screen.queryByTestId('undo')).toBeNull();
    expect(screen.getByTestId('progress').textContent).toBe('1 / 3');
  });

  it('**撤销回到那张卡，且不离开课程路由**', async () => {
    mount();
    await settle();
    await revealAndWait();
    fireEvent.click(screen.getByTestId('rate-good'));
    await settle();
    fireEvent.click(screen.getByTestId('undo'));
    await settle();
    const u = calls('/vocab/review/undo');
    expect(u).toHaveLength(1);
    expect(bodyOf(u[0])).toEqual({ headword: 'nile' });
    expect(screen.getByTestId('progress').textContent).toBe('1 / 3');
    expect(screen.getByTestId('review-card').getAttribute('data-headword')).toBe('nile');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('**重发命中去重的那条不给撤销**', async () => {
    routes['/api/vocab/review'] = () => ({
      body: { headword: 'nile', state: 'review', due: 'd', intervalDays: 4, reps: 3, duplicate: true },
    });
    mount();
    await settle();
    await revealAndWait();
    fireEvent.click(screen.getByTestId('rate-good'));
    await settle();
    expect(screen.getByTestId('receipt-ok')).toBeInTheDocument();
    expect(screen.queryByTestId('undo')).toBeNull();
  });

  it('**撤销失败给提示**，可以再点', async () => {
    routes['/api/vocab/review/undo'] = () => new Error('offline');
    mount();
    await settle();
    await revealAndWait();
    fireEvent.click(screen.getByTestId('rate-good'));
    await settle();
    fireEvent.click(screen.getByTestId('undo'));
    await settle();
    expect(screen.getByTestId('step-error')).toBeInTheDocument();
    expect(screen.getByTestId('undo')).toBeInTheDocument();
  });

  it('没有中文释义时给一句替代提示，不留空白', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({
      body: cardsPayload({ cursor: 0, cards: [card({ translation: '' })] }),
    });
    mount();
    await settle();
    expect(screen.getByTestId('hint-missing')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-07 弱网在页面上的表现
// ─────────────────────────────────────────────────────────────

describe('AC-07 弱网评分在页面上的表现', () => {
  beforeEach(() => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 1 }) });
  });

  it('**发不出去时说「已存下、待同步」**，不说服务端记下了', async () => {
    routes['/api/vocab/review'] = () => new Error('offline');
    mount();
    await settle();
    await revealAndWait();
    fireEvent.click(screen.getByTestId('rate-good'));
    await settle();
    expect(screen.getByTestId('receipt-queued')).toBeInTheDocument();
    expect(screen.queryByTestId('receipt-ok')).toBeNull();
    expect(readQueue()).toHaveLength(1);
    expect(screen.getByTestId('pending-badge').textContent).toContain('1');
  });

  it('**队列里的记录带着下一个断点**', async () => {
    routes['/api/vocab/review'] = () => new Error('offline');
    mount();
    await settle();
    await revealAndWait();
    fireEvent.click(screen.getByTestId('rate-good'));
    await settle();
    expect(readQueue()[0].cursor).toBe(2);
  });

  it('**进页面就先补传一次**', async () => {
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([{ headword: 'old', rating: 'good', elapsedMs: 2000, requestId: 'r1', cursor: 1, ts: Date.now() }]),
    );
    mount();
    await settle();
    expect(bodyOf(calls('/vocab/review')[0]).requestId).toBe('r1');
    expect(readQueue()).toEqual([]);
  });

  it('**浏览器回到线上时自动补传**', async () => {
    routes['/api/vocab/review'] = () => new Error('offline');
    mount();
    await settle();
    await revealAndWait();
    fireEvent.click(screen.getByTestId('rate-good'));
    await settle();
    expect(readQueue()).toHaveLength(1);

    routes['/api/vocab/review'] = () => ({ body: { headword: 'nile', state: 'review', due: 'd', intervalDays: 4, reps: 3 } });
    __resetFlushGuardForTest();
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await settle();
    expect(readQueue()).toEqual([]);
    expect(screen.queryByTestId('pending-badge')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-08 出口与完成
// ─────────────────────────────────────────────────────────────

describe('AC-08 出口与完成', () => {
  it('**「稍后再学」回 /today，且一个写请求都不发**', async () => {
    mount();
    await settle();
    const before = reqs.length;
    fireEvent.click(screen.getByTestId('later'));
    expect(navigate).toHaveBeenCalledWith('/today');
    expect(reqs).toHaveLength(before);
    expect(calls('/lesson/vocab-taught')).toHaveLength(0);
    expect(calls('/vocab/review')).toHaveLength(0);
    expect(calls('/vocab-cursor')).toHaveLength(0);
    expect(screen.getByTestId('later').textContent).toBe('稍后再学');
    expect(document.body.textContent).not.toContain('返回我的记录');
  });

  it('**还有待同步就不放人进正式测试**', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 2 }) });
    routes['/api/vocab/review'] = () => new Error('offline');
    mount();
    await settle();
    await revealAndWait();
    fireEvent.click(screen.getByTestId('rate-good'));
    await settle();
    expect(screen.getByTestId('complete')).toBeInTheDocument();
    expect(screen.getByTestId('pending-sync')).toBeInTheDocument();
    expect(screen.queryByTestId('finish')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('**同步完之后才出现下一步**', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 2 }) });
    routes['/api/vocab/review'] = () => new Error('offline');
    mount();
    await settle();
    await revealAndWait();
    fireEvent.click(screen.getByTestId('rate-good'));
    await settle();

    routes['/api/vocab/review'] = () => ({ body: { headword: 'silt', state: 'review', due: 'd', intervalDays: 2, reps: 1 } });
    __resetFlushGuardForTest();
    fireEvent.click(screen.getByTestId('sync-now'));
    await settle();
    expect(screen.queryByTestId('pending-sync')).toBeNull();
    expect(screen.getByTestId('finish')).toBeInTheDocument();
  });

  it('**完成后重新问 today，按 kind 走**：vocab_test → /lesson/test', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 3 }) });
    mount();
    await settle();
    routes['/api/lesson/today'] = () => ({ body: todayPayload('vocab_test') });
    fireEvent.click(screen.getByTestId('finish'));
    await settle();
    expect(navigate).toHaveBeenCalledWith('/lesson/test');
  });

  it('kind=summary → /lesson/summary', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 3 }) });
    mount();
    await settle();
    routes['/api/lesson/today'] = () => ({ body: todayPayload('summary') });
    fireEvent.click(screen.getByTestId('finish'));
    await settle();
    expect(navigate).toHaveBeenCalledWith('/lesson/summary');
  });

  it('其它 kind → /today', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 3 }) });
    mount();
    await settle();
    routes['/api/lesson/today'] = () => ({ body: todayPayload('all_done') });
    fireEvent.click(screen.getByTestId('finish'));
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today');
  });

  it('**后端 href 一律无视**：从头到尾没去过旧页面', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 3 }) });
    mount();
    await settle();
    routes['/api/lesson/today'] = () => ({ body: todayPayload('vocab_test') });
    fireEvent.click(screen.getByTestId('finish'));
    await settle();
    for (const c of navigate.mock.calls) {
      expect(String(c[0])).not.toMatch(/my-history|my-vocab|scan|then=|after=/);
    }
    for (const r of reqs) expect(r.url).not.toMatch(/my-history|my-vocab/);
  });
});
