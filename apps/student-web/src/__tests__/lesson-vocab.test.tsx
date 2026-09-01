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
    contextTranslation: '尼罗河是最长的河流。',
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
    '/api/lesson/vocab-replace': () => ({
      body: {
        ok: true,
        oldHeadword: 'delta',
        replacementHeadword: 'estuary',
        alreadyReplaced: false,
        lessonContext: true,
        cursor: 0,
        totalDue: 3,
        cards: [
          card({ headword: 'estuary', surfaceForm: 'estuary', translation: '河口', contextSentence: 'An estuary meets the sea.', contextTranslation: '河口与海洋相接。' }),
          card(),
          card({ headword: 'silt', surfaceForm: 'silt', translation: '淤泥', contextSentence: 'The silt makes soil rich.' }),
        ],
      },
    }),
    '/api/lesson/vocab-test/defer': () => ({
      body: { ok: true, deferredUntil: '2026-08-30' },
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
  // 用例里会 spy 掉 `Storage.prototype.setItem` —— 断言一失败就走不到用例末尾，
  // 必须在这里统一还原，否则后面每个用例都顶着坏掉的 localStorage 跑。
  vi.restoreAllMocks();
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

  it('**今天这一段不是 learn_vocab/vocab_test → 回 /today**，不取卡', async () => {
    routes['/api/lesson/today'] = () => ({ body: todayPayload('summary') });
    mount();
    await settle();
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
    expect(calls('/vocab/lesson-cards')).toHaveLength(0);
  });

  it('刷新学完页面时 vocab_test 仍显示“立即考试 / 明天再考”', async () => {
    routes['/api/lesson/today'] = () => ({ body: todayPayload('vocab_test') });
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 3 }) });
    mount();
    await settle();
    expect(navigate).not.toHaveBeenCalledWith('/today', { replace: true });
    expect(screen.getByTestId('finish')).toHaveTextContent('立即考试');
    expect(screen.getByTestId('defer-test')).toHaveTextContent('明天再考');
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
    expect(screen.getByTestId('teaching-card').getAttribute('data-headword')).toBe('zulu');
    // S12L —— 往下翻用教学卡的「下一个」，课程内已经没有评分那条路了
    fireEvent.click(screen.getByTestId('taught-next'));
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
    expect(screen.getByTestId('teaching-card').getAttribute('data-headword')).toBe('silt');
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

  // 「服务端给了更小的断点也不倒退」由 vocab-card.test.ts 的 advanceCursor
  // 单测钉住；页面这边留住「更靠前时跟进」那一条即可。
  //
  // 原来这里还有一条用 `stored:false` 跑到 3/3 就收工的用例 —— 它把
  // 「断点没落库」当成了完成，正是返工 1/2 的 B-3。换成下面这条。
  // S12L —— 原来这一条靠「评分 + cursor stored:false」制造场景。课程内
  // 不再评分，闸门本身照留：只要还有一条没补传上去的评分，完成页就
  // 不放人进正式测试。这里直接把记录塞进队列来验闸门。
  it('**还有没补传的评分时，完成页不放人走**（B-3 的闸门仍在）', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 3 }) });
    routes['/api/vocab/review'] = () => new Error('offline');
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        { headword: 'silt', rating: 'good', elapsedMs: 2000, requestId: 'r9', cursor: 3, ts: Date.now() },
      ]),
    );
    mount();
    await settle();
    expect(readQueue()).toHaveLength(1);
    expect(screen.getByTestId('complete')).toBeInTheDocument();
    expect(screen.getByTestId('pending-sync')).toBeInTheDocument();
    expect(screen.queryByTestId('finish')).toBeNull();
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
    expect(screen.getByTestId('context-translation').textContent).toBe('句意：尼罗河是最长的河流。');
    expect(screen.getByTestId('source').textContent).toContain('Rivers of Africa');
  });

  it('**不藏词、不让猜、没有评分、没有无记录跳过**', async () => {
    mount();
    await settle();
    expect(screen.queryByTestId('reveal')).toBeNull();
    expect(screen.queryByTestId('rate-again')).toBeNull();
    expect(screen.queryByTestId('rate-good')).toBeNull();
    expect(screen.queryByTestId('skip')).toBeNull();
    expect(screen.getByTestId('teaching-card').textContent).not.toContain('跳过');
    expect(screen.getByTestId('replace-known').textContent).toContain('这个词我已经会了');
  });

  it('可选字段缺了也不崩', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({
      body: cardsPayload({
        cards: [card({ headword: 'bare', needsFirstTeaching: true, phonetic: null, pos: null, definition: null, contextSentence: null, contextTranslation: null, sourcePassageTitle: null, translation: '' })],
      }),
    });
    mount();
    await settle();
    expect(screen.getByTestId('headword').textContent).toBe('bare');
    expect(screen.queryByTestId('phonetic')).toBeNull();
    expect(screen.queryByTestId('context')).toBeNull();
    expect(screen.queryByTestId('context-translation')).toBeNull();
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

  it('**会了就换一个**：原位换卡、分母不变、断点不前进', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('replace-known'));
    await settle();
    const callsMade = calls('/lesson/vocab-replace');
    expect(callsMade).toHaveLength(1);
    expect(bodyOf(callsMade[0])).toEqual({ headword: 'delta', cursor: 0 });
    expect(screen.getByTestId('headword').textContent).toBe('estuary');
    expect(screen.getByTestId('context-translation').textContent).toContain('河口与海洋相接');
    expect(screen.getByTestId('progress').textContent).toBe('0 / 3');
    expect(screen.getByTestId('replacement-notice').textContent).toContain('仍然学习 3 个词');
    expect(calls('/lesson/vocab-taught')).toHaveLength(0);
  });

  it('换词**连点两下只发一个请求**', async () => {
    let resolve!: (v: unknown) => void;
    routes['/api/lesson/vocab-replace'] = () => ({
      body: new Promise((r) => { resolve = r; }),
    } as unknown as Reply);
    // 用 fetch 层的手动 Promise 不便包成 Response body；这里让首个请求永不
    // 结束也足够验证同步闸门，同一帧第二次点击不会再发请求。
    routes['/api/lesson/vocab-replace'] = () => new Error('held');
    mount();
    await settle();
    const btn = screen.getByTestId('replace-known');
    fireEvent.click(btn);
    fireEvent.click(btn);
    await settle();
    expect(calls('/lesson/vocab-replace')).toHaveLength(1);
    void resolve;
  });

  it('没有备用词时停在原卡，并把原因说清楚', async () => {
    routes['/api/lesson/vocab-replace'] = () => ({ status: 400, body: { code: 'vocab_replacement_unavailable' } });
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('replace-known'));
    await settle();
    expect(screen.getByTestId('headword').textContent).toBe('delta');
    expect(screen.getByTestId('progress').textContent).toBe('0 / 3');
    expect(screen.getByTestId('step-error').textContent).toContain('没有合适的新词');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 复习卡
// ─────────────────────────────────────────────────────────────

describe('S12L 课程内**每一张都是教学卡**', () => {
  //
  // 这一组取代了原来的 AC-06（复习卡）与 AC-07（弱网评分）。
  //
  // 那两组测的是**课程内**的主动回忆：挖空、两档评分、1.5 秒停留锁、
  // 撤销、弱网入队。那条路整个搬去了自由复习 `/vocab/practice`，
  // 逐条覆盖它的是 `vocab-practice.test.tsx`（评分四档、requestId 复用、
  // tooFast / duplicate、撤销、在途连点、掉票）——**能力没有被放弃**。
  //
  // 课程内剩下的规矩只有一条：不管这个词以前见没见过，都先教一遍。

  beforeEach(() => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 1 }) });
  });

  it('**教过的词也是教学卡** —— 不遮词、不让猜、没有评分', async () => {
    mount();
    await settle();
    // cursor=1 落在第二张：needsFirstTeaching=false、reps=2 的老词
    expect(screen.getByTestId('teaching-card').getAttribute('data-headword')).toBe('nile');
    expect(screen.queryByTestId('review-card')).toBeNull();
    expect(screen.queryByTestId('reveal')).toBeNull();
    expect(screen.queryByTestId('rate-again')).toBeNull();
    expect(screen.queryByTestId('rate-good')).toBeNull();
    // 词就摆在那儿，不挖空
    expect(screen.getByTestId('teaching-card').textContent).toContain('尼罗河');
  });

  it('**往下翻只打 vocab-taught**，一条复习流水都不写', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('taught-next'));
    await settle();
    expect(calls('/lesson/vocab-taught')).toHaveLength(1);
    expect(calls('/vocab/review')).toHaveLength(0);
    expect(readQueue()).toHaveLength(0);
  });

  it('**教过的词再教一次是幂等的**：服务端说 alreadyTaught 也照常前进', async () => {
    routes['/api/lesson/vocab-taught'] = () => ({
      body: { ok: true, cursor: 2, stored: true, alreadyTaught: true },
    });
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('taught-next'));
    await settle();
    expect(screen.getByTestId('progress').textContent).toBe('2 / 3');
  });

  it('**整条链一次 /vocab/review 都不发**', async () => {
    mount();
    await settle();
    fireEvent.click(screen.getByTestId('taught-next'));
    await settle();
    for (const r of reqs) expect(r.url).not.toContain('/vocab/review');
  });
});

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

  // S12L —— 课程内不再评分，所以待同步的记录只可能是**上一个版本或另一台
  // 设备留下的**。闸门照留：一条没补传上去的评分，放人进正式测试就等于
  // 永久丢失。这里直接把记录塞进队列来验闸门本身。
  it('**还有待同步就不放人进正式测试**', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 3 }) });
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        { headword: 'silt', rating: 'good', elapsedMs: 2000, requestId: 'r1', cursor: 3, ts: Date.now() },
      ]),
    );
    routes['/api/vocab/review'] = () => new Error('offline');
    mount();
    await settle();
    expect(screen.getByTestId('complete')).toBeInTheDocument();
    expect(screen.getByTestId('pending-sync')).toBeInTheDocument();
    expect(screen.queryByTestId('finish')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('**同步完之后才出现下一步**', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 3 }) });
    localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        { headword: 'silt', rating: 'good', elapsedMs: 2000, requestId: 'r1', cursor: 3, ts: Date.now() },
      ]),
    );
    routes['/api/vocab/review'] = () => new Error('offline');
    mount();
    await settle();
    expect(screen.getByTestId('pending-sync')).toBeInTheDocument();

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

  it('学完后可明确选择明天再考，并返回今天主页', async () => {
    routes['/api/vocab/lesson-cards'] = () => ({ body: cardsPayload({ cursor: 3 }) });
    mount();
    await settle();
    expect(screen.getByTestId('finish')).toHaveTextContent('立即考试');
    expect(screen.getByTestId('defer-test')).toHaveTextContent('明天再考');
    fireEvent.click(screen.getByTestId('defer-test'));
    await settle();
    expect(calls('/lesson/vocab-test/defer')).toHaveLength(1);
    expect(navigate).toHaveBeenCalledWith('/today', { replace: true });
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
