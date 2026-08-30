/**
 * 阶段 12C —— 考试中查词卡（`lesson/ExamWordSheet.tsx`）的**行为测试**。
 *
 * 挂的是**真的 IELTS 渲染器**（真 `ReadingProvider`、真 `ExamContext`、
 * 真 `Highlighter`），只在 `fetch` 和 `caretRangeFromPoint` 两处打桩 ——
 * 后者 jsdom 没有实现，它是**环境**，不是被测行为。被测的是手势判定、
 * 请求边界、屏蔽规则、写入诚实度与填空取词。
 *
 * 这一屏的规矩：
 *
 *   · **不点就不查** —— 挂载、拖选高亮、滚动都不许发一个词汇请求；
 *   · **token-only** —— 查词与写生词本都只带 Bearer，
 *     `studentName` / `studentId` 一个字都不出现；
 *   · **考点词零请求** —— 本卷考的那几个词，连查都不查（不是「查了不显示」）；
 *   · **写入说实话** —— `created:false` 就说「已经在本子里」，
 *     失败就说没存上，绝不因为 fetch resolve 了就报成功；
 *   · **换词之后，旧响应画不上新卡**。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { IELTSReadingPassage } from '../lesson/questions/IELTSReadingPassage';
import { ReadingProvider } from '../lesson/ReadingProvider';
import { ExamModeProvider } from '../lesson/ExamContext';
import { writeToken, readToken, OWNED_STORAGE_KEYS } from '../lib/identity';
import { __resetForTest } from '../lib/auth-store';
import type { ExamPaper, ExamQuestion } from '../lesson/examTypes';

const TOKEN = 'word-sheet-token';

const PASSAGE = [
  'The ferry crossed at dawn.',
  'A resilient community rebuilt the pier after the storm.',
  'After dark the ferry no longer ran.',
].join('\n\n');

type Req = { path: string; method: string; headers: Record<string, string>; body: string | null };
let reqs: Req[] = [];

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

const ENTRY = {
  word: 'resilient',
  query: 'resilient',
  phonetic: 'rɪˈzɪliənt',
  translation: '有韧性的；能快速恢复的',
  definition: 'able to recover quickly from difficult conditions',
  pos: 'adj.',
  collins: 3,
  oxford: true,
  tag: ['ielts', 'gre', 'zk'],
  via: 'direct' as const,
};

// ─────────────────────────────────────────────────────────────
// 卷子夹具
// ─────────────────────────────────────────────────────────────

function q(over: Partial<ExamQuestion> & { id: string }): ExamQuestion {
  return {
    sortOrder: 1,
    marks: 1,
    questionType: 'mcq',
    snapshotContent: {},
    snapshotOptions: null,
    ...over,
  };
}

function paper(over: Partial<ExamPaper> = {}): ExamPaper {
  return {
    sessionId: 's1',
    quizEnd: '2026-08-28T23:59:00.000Z',
    level: 'ielts_authentic',
    paperMode: null,
    mode: 'test',
    questions: [
      q({
        id: 'q1',
        sortOrder: 1,
        snapshotContent: {
          taskType: 'sentence_completion',
          passageTitle: 'The River Ferry',
          passage: PASSAGE,
          stem: 'Complete the sentence.\n\nThe pier was rebuilt by a [BLANK] community.',
        },
      }),
    ],
    ...over,
  };
}

/** 一份带词义题的卷子 —— `resilient` 是本卷考点，必须被屏蔽。 */
function paperWithVocabQuestion(): ExamPaper {
  return paper({
    questions: [
      q({
        id: 'q1',
        sortOrder: 1,
        snapshotContent: {
          taskType: 'sentence_completion',
          passageTitle: 'The River Ferry',
          passage: PASSAGE,
          stem: 'Complete the sentence.\n\nThe pier was rebuilt by a [BLANK] community.',
        },
      }),
      q({
        id: 'q2',
        sortOrder: 2,
        snapshotContent: {
          taskType: 'multiple_choice',
          stem: "What does the word 'resilient' suggest about the community?",
        },
        snapshotOptions: [{ key: 'A', text: 'It recovers' }, { key: 'B', text: 'It leaves' }],
      }),
    ],
  });
}

// ─────────────────────────────────────────────────────────────
// 网络边界
// ─────────────────────────────────────────────────────────────

let lookupReply: () => Promise<Response>;
let addReply: () => Promise<Response>;

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
    if (path === '/vocab/lookup') return lookupReply();
    if (path === '/vocab/words') return addReply();
    return jsonResponse(404, { code: 'not_stubbed', path: full });
  });
  vi.stubGlobal('fetch', fetchMock);
}

const deps = {
  saveAnswer: vi.fn(async () => ({ applied: true, clientSeq: 1 })),
  loadSession: vi.fn(async () => {
    throw new Error('not used');
  }),
};

function mount(p: ExamPaper = paper()) {
  return render(
    <ReadingProvider sessionId="s1" submissionId="sub1" deps={deps as never}>
      <ExamModeProvider mode="test">
        <IELTSReadingPassage paper={p} />
      </ExamModeProvider>
    </ReadingProvider>,
  );
}

async function settle(rounds = 14) {
  await act(async () => {
    for (let i = 0; i < rounds; i++) await Promise.resolve();
  });
}

const calls = (p: string) => reqs.filter((r) => r.path.split('?')[0] === p);
const bodies = (p: string) => calls(p).map((c) => JSON.parse(c.body ?? '{}'));
const text = () => document.body.textContent ?? '';

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
  await settle();
}

// ─────────────────────────────────────────────────────────────
// 点词手势
//
// jsdom **没有** caretRangeFromPoint —— 那是浏览器给的「屏幕坐标 → 文本
// 落点」。它是环境，不是被测行为，所以在这里打桩：测试自己算出目标词在
// 哪个文本节点的第几个字符，手势判定（位移 / 时长 / 是否已有选区 /
// 词边界扩展）仍然走真实代码。
// ─────────────────────────────────────────────────────────────

/** 在渲染出来的文章里找到 `word` 的位置，返回文本节点与偏移。 */
function locate(word: string): { node: Text; offset: number } {
  const root = document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let cur: Node | null;
  while ((cur = walker.nextNode())) {
    const t = cur.textContent ?? '';
    const i = t.indexOf(word);
    if (i >= 0) return { node: cur as Text, offset: i };
  }
  throw new Error(`passage text node containing "${word}" not found`);
}

/** 把 caret API 指到某个词上。 */
function aimCaretAt(word: string) {
  const { node, offset } = locate(word);
  (document as unknown as { caretRangeFromPoint: unknown }).caretRangeFromPoint = () => {
    const r = document.createRange();
    r.setStart(node, offset);
    r.setEnd(node, offset);
    return r;
  };
}

/**
 * 文章那一块。
 *
 * 先找 testid，找不到就退回 `Highlighter` 一直都有的容器类 —— 这样
 * **功能还不存在时手势照样打在真实元素上**，红出来的是「没发请求 /
 * 没弹卡」，而不是「测试自己的辅助函数抛了」。
 */
function passageEl(): HTMLElement {
  const el =
    document.querySelector('[data-testid="passage-body"]') ??
    document.querySelector('.select-text');
  if (!el) throw new Error('passage body not found');
  return el as HTMLElement;
}

/**
 * 自己造一个 pointer 事件并派发。
 *
 * jsdom **没有实现 `PointerEvent`**（实测 `typeof window.PointerEvent ===
 * 'undefined'`），testing-library 只好退回普通 `Event`，坐标就丢了 ——
 * 于是「拖动 / 滚动不算点」这条判据在测试里恒真，等于没测。这里把坐标
 * 直接挂到事件对象上，React 的合成事件照样读得到，位移判定走的仍然是
 * 真实代码。
 */
function firePointer(
  el: HTMLElement,
  type: 'pointerdown' | 'pointerup',
  props: { clientX: number; clientY: number; pointerType: string },
) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(ev, props);
  el.dispatchEvent(ev);
}

/** 一次干净的点击。`over` 可以制造拖动 / 长按 / 触屏。 */
async function tap(
  word: string,
  over: { dx?: number; dy?: number; heldMs?: number; pointerType?: string } = {},
) {
  aimCaretAt(word);
  const el = passageEl();
  const x = 40;
  const y = 40;
  const pointerType = over.pointerType ?? 'mouse';
  await act(async () => {
    firePointer(el, 'pointerdown', { clientX: x, clientY: y, pointerType });
  });
  if (over.heldMs) {
    const real = Date.now;
    const t0 = real();
    vi.spyOn(Date, 'now').mockImplementation(() => t0 + (over.heldMs ?? 0));
    await act(async () => {
      firePointer(el, 'pointerup', {
        clientX: x + (over.dx ?? 0),
        clientY: y + (over.dy ?? 0),
        pointerType,
      });
    });
    (Date.now as unknown as { mockRestore: () => void }).mockRestore();
  } else {
    await act(async () => {
      firePointer(el, 'pointerup', {
        clientX: x + (over.dx ?? 0),
        clientY: y + (over.dy ?? 0),
        pointerType,
      });
    });
  }
  await settle();
}

/** 手动控制的响应 —— 测试自己决定什么时候回、回什么。 */
function held() {
  let resolve!: (v: Response) => void;
  let reject!: (e: unknown) => void;
  const p = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise: p,
    ok: (body: unknown) =>
      resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) } as Response),
    status: (s: number, body: unknown) =>
      resolve({ ok: false, status: s, text: () => Promise.resolve(JSON.stringify(body)) } as Response),
    fail: () => reject(new TypeError('network down')),
  };
}

beforeEach(() => {
  __resetForTest();
  localStorage.clear();
  writeToken(TOKEN);
  deps.saveAnswer.mockClear();
  lookupReply = () => jsonResponse(200, { found: true, entry: ENTRY });
  addReply = () => jsonResponse(200, { created: true, headword: 'resilient' });
  installFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (document as unknown as { caretRangeFromPoint?: unknown }).caretRangeFromPoint;
});

// ─────────────────────────────────────────────────────────────
// AC-03 —— 手势
// ─────────────────────────────────────────────────────────────

describe('AC-03 点词手势', () => {
  it('**不点就不查**：挂载本身一个词汇请求都不发', async () => {
    mount();
    await settle();
    expect(calls('/vocab/lookup')).toHaveLength(0);
    expect(calls('/vocab/words')).toHaveLength(0);
    expect(reqs).toEqual([]);
  });

  it('**鼠标轻点一个词就弹卡并查词**', async () => {
    mount();
    await settle();
    await tap('resilient');
    expect(screen.getByTestId('word-sheet')).toBeTruthy();
    expect(screen.getByTestId('word-sheet-word').textContent).toContain('resilient');
    expect(calls('/vocab/lookup')).toHaveLength(1);
  });

  it('**触屏轻点也行**（指腹会晃，阈值比鼠标宽）', async () => {
    mount();
    await settle();
    await tap('resilient', { pointerType: 'touch', dx: 12 });
    expect(calls('/vocab/lookup')).toHaveLength(1);
  });

  it('**拖动不算点**（鼠标位移超过阈值）', async () => {
    mount();
    await settle();
    await tap('resilient', { dx: 40 });
    expect(calls('/vocab/lookup')).toHaveLength(0);
    expect(screen.queryByTestId('word-sheet')).toBeNull();
  });

  it('**滚动不算点**（纵向位移）', async () => {
    mount();
    await settle();
    await tap('resilient', { dy: 60, pointerType: 'touch' });
    expect(calls('/vocab/lookup')).toHaveLength(0);
  });

  it('**长按不算点**', async () => {
    mount();
    await settle();
    await tap('resilient', { heldMs: 900 });
    expect(calls('/vocab/lookup')).toHaveLength(0);
  });

  it('**已经有选区时不算点**（拖选高亮的路径优先）', async () => {
    mount();
    await settle();
    const { node } = locate('resilient');
    const sel = window.getSelection()!;
    const r = document.createRange();
    r.setStart(node, 0);
    r.setEnd(node, 5);
    sel.removeAllRanges();
    sel.addRange(r);
    await tap('resilient');
    expect(calls('/vocab/lookup')).toHaveLength(0);
    sel.removeAllRanges();
  });

  it('**词内的撇号与连字符算词的一部分**', async () => {
    const p = paper();
    (p.questions[0].snapshotContent as Record<string, unknown>).passage =
      "The keeper's self-reliant habit saved the pier.";
    mount(p);
    await settle();
    await tap('self-reliant');
    expect(bodies('/vocab/words')[0]?.word ?? '').toContain('self-reliant');
  });

  it('**拖选高亮仍然照常工作**，而且不发查词请求', async () => {
    mount();
    await settle();
    const el = passageEl();
    const { node } = locate('resilient');
    const sel = window.getSelection()!;
    const r = document.createRange();
    r.setStart(node, 0);
    r.setEnd(node, 9);
    sel.removeAllRanges();
    sel.addRange(r);
    await act(async () => {
      fireEvent.mouseUp(el, { button: 0 });
    });
    await settle();
    expect(document.querySelectorAll('mark').length).toBeGreaterThan(0);
    expect(calls('/vocab/lookup')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-02 —— 请求边界
// ─────────────────────────────────────────────────────────────

describe('AC-02 token-only 请求边界', () => {
  it('**查词：Bearer + 只有一个 word 查询串 + 无请求体**', async () => {
    mount();
    await settle();
    await tap('resilient');
    const c = calls('/vocab/lookup')[0];
    expect(c.method).toBe('GET');
    expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(c.body).toBeNull();
    const query = new URLSearchParams(c.path.split('?')[1] ?? '');
    expect([...query.keys()]).toEqual(['word']);
    expect(query.get('word')).toBe('resilient');
  });

  it('**查词的词经过 URL 编码**', async () => {
    const p = paper();
    (p.questions[0].snapshotContent as Record<string, unknown>).passage =
      "The keeper's lamp burned all night.";
    mount(p);
    await settle();
    await tap("keeper's");
    const c = calls('/vocab/lookup')[0];
    expect(c.path).toContain(encodeURIComponent("keeper's"));
    expect(c.path).not.toContain("keeper's?");
  });

  it('**写生词本：Bearer + 无查询串 + 请求体只有约定的键**', async () => {
    mount();
    await settle();
    await tap('resilient');
    const c = calls('/vocab/words')[0];
    expect(c.method).toBe('POST');
    expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(c.path).toBe('/vocab/words');
    const b = JSON.parse(c.body ?? '{}');
    expect(Object.keys(b).sort()).toEqual(['contextSentence', 'sourcePassageTitle', 'word']);
    expect(b.word).toBe('resilient');
    expect(b.sourcePassageTitle).toBe('The River Ferry');
    expect(b.contextSentence).toContain('resilient');
  });

  it('**两条请求都不带任何身份字段**', async () => {
    mount();
    await settle();
    await tap('resilient');
    for (const r of reqs) {
      expect(r.path).not.toMatch(/[?&](name|studentName|studentId|then|after)=/);
      if (r.body) expect(r.body).not.toMatch(/"name"|"studentName"|"studentId"|"role"/);
    }
  });

  it('**不碰课程线 / 正式测试 / 自由练习 / 错题本 / 历史 / 埋点**', async () => {
    mount();
    await settle();
    await tap('resilient');
    for (const r of reqs) {
      expect(r.path).not.toMatch(/^\/lesson\//);
      expect(r.path).not.toMatch(/vocab\/(due|review|quiz|stats|mistakes)/);
      expect(r.path).not.toMatch(/history-by-name|page-view|morning-quiz/);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 返工 1/2 B-2 —— 落库的来源必须是**真的**来源
//
// 「Reading Passage」是**没有标题时给屏幕看的占位**。把它当成来源写进
// 生词本，那条记录就永远指向一个不存在的篇目 —— 学生复习时点进去
// 什么都找不到，而且没有任何办法分辨「这卷真叫 Reading Passage」和
// 「这卷根本没标题」。显示可以兜底，**存下来的东西不许兜底**。
// ─────────────────────────────────────────────────────────────

describe('B-2 落库的来源必须是真的来源', () => {
  it('**有真标题就带上**', async () => {
    mount();
    await settle();
    await tap('resilient');
    expect(bodies('/vocab/words')[0].sourcePassageTitle).toBe('The River Ferry');
  });

  it('**没有标题：屏幕上可以显示占位，请求体里没有这个键**', async () => {
    const p = paper();
    delete (p.questions[0].snapshotContent as Record<string, unknown>).passageTitle;
    mount(p);
    await settle();
    expect(text()).toContain('Reading Passage');
    await tap('resilient');
    const b = bodies('/vocab/words')[0];
    expect(Object.keys(b).sort()).toEqual(['contextSentence', 'word']);
    expect('sourcePassageTitle' in b).toBe(false);
  });

  it('**标题只有空白：同样不带这个键**', async () => {
    const p = paper();
    (p.questions[0].snapshotContent as Record<string, unknown>).passageTitle = '   ';
    mount(p);
    await settle();
    await tap('resilient');
    expect('sourcePassageTitle' in bodies('/vocab/words')[0]).toBe(false);
  });

  it('**这两种情况都不许因此多出身份字段**', async () => {
    const p = paper();
    delete (p.questions[0].snapshotContent as Record<string, unknown>).passageTitle;
    mount(p);
    await settle();
    await tap('resilient');
    for (const r of reqs) {
      expect(r.path).not.toMatch(/[?&](name|studentName|studentId)=/);
      if (r.body) expect(r.body).not.toMatch(/"name"|"studentName"|"studentId"/);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 返工 1/2 B-3 —— 发现性提示必须真的会变
//
// 这个键写了却从来不读，提示条前后一模一样 —— 那它就不是「一次性发现
// 提示」，只是一个没人看的写操作。情境化提示的价值全在「第一次显眼、
// 之后收起」这个对比上；不收起，它就变成长期占版面的噪音。
// ─────────────────────────────────────────────────────────────

describe('B-3 一次性的发现提示', () => {
  it('**没有标记时：显眼的提示**', async () => {
    mount();
    await settle();
    expect(screen.getByTestId('lookup-hint-prominent')).toBeTruthy();
    expect(screen.queryByTestId('lookup-hint-compact')).toBeNull();
  });

  it('**第一次点词之后：写标记并换成常态小字**', async () => {
    mount();
    await settle();
    await tap('resilient');
    expect(localStorage.getItem('sw:reading:looked-up-once')).toBe('1');
    expect(screen.getByTestId('lookup-hint-compact')).toBeTruthy();
    expect(screen.queryByTestId('lookup-hint-prominent')).toBeNull();
  });

  it('**已经有标记时重新挂载：直接就是常态小字**', async () => {
    localStorage.setItem('sw:reading:looked-up-once', '1');
    mount();
    await settle();
    expect(screen.getByTestId('lookup-hint-compact')).toBeTruthy();
    expect(screen.queryByTestId('lookup-hint-prominent')).toBeNull();
  });

  it('**这个标记写不进去也不许影响查词**（隐私模式）', async () => {
    // 只让**这一个键**写失败 —— 阅读页本来就有别的写（标签页归属、
    // 高亮…），把它们一起打挂就不是在测这条了。
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function patched(this: Storage, k: string, v: string) {
      if (k === 'sw:reading:looked-up-once') throw new Error('QuotaExceededError');
      return orig.call(this, k, v);
    };
    try {
      mount();
      await settle();
      await tap('resilient');
      expect(calls('/vocab/lookup')).toHaveLength(1);
      expect(screen.getByTestId('word-sheet-translation')).toBeTruthy();
    } finally {
      Storage.prototype.setItem = orig;
    }
  });

  it('**点词只多出那一个键**，别的什么都不存', async () => {
    mount();
    await settle();
    // 阅读页本来就会写标签页归属 / 高亮 / 分栏这些键 —— 那是既有行为。
    // 这条测的是**点词这一下**多写了什么。
    const before = new Set(Object.keys(localStorage));
    await tap('resilient');
    const added = Object.keys(localStorage).filter(
      (k) => !before.has(k) && !(OWNED_STORAGE_KEYS as readonly string[]).includes(k),
    );
    expect(added).toEqual(['sw:reading:looked-up-once']);
    expect(localStorage.getItem('sw:reading:looked-up-once')).toBe('1');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-04 —— 卡片状态与考点保护
// ─────────────────────────────────────────────────────────────

describe('AC-04 卡片状态', () => {
  it('**语境句在最上面，目标词被安全地标出来**', async () => {
    mount();
    await settle();
    await tap('resilient');
    const s = screen.getByTestId('word-sheet-sentence');
    expect(s.textContent).toContain('A resilient community rebuilt the pier');
    expect(s.querySelector('mark')?.textContent).toBe('resilient');
  });

  it('**释义 / 音标 / 英文释义 / 标签都来自服务端**', async () => {
    mount();
    await settle();
    await tap('resilient');
    expect(screen.getByTestId('word-sheet-translation').textContent).toContain('有韧性的');
    expect(screen.getByTestId('word-sheet-phonetic').textContent).toContain('rɪˈzɪliənt');
    expect(screen.getByTestId('word-sheet-definition').textContent).toContain('recover quickly');
    expect(screen.getByTestId('word-sheet-tags').textContent).toContain('雅思');
  });

  it('**先显示查询中**', async () => {
    const h = held();
    lookupReply = () => h.promise;
    mount();
    await settle();
    await tap('resilient');
    expect(screen.getByTestId('word-sheet-loading')).toBeTruthy();
    await act(async () => {
      h.ok({ found: true, entry: ENTRY });
    });
    await settle();
    expect(screen.getByTestId('word-sheet-translation')).toBeTruthy();
  });

  it('**词典没收录就说没收录**，而且不写生词本', async () => {
    lookupReply = () => jsonResponse(200, { found: false, query: 'resilient' });
    mount();
    await settle();
    await tap('resilient');
    expect(screen.getByTestId('word-sheet-not-found')).toBeTruthy();
    expect(calls('/vocab/words')).toHaveLength(0);
  });

  it('**查询失败给一个明确的重试**', async () => {
    lookupReply = () => jsonResponse(500, { code: 'boom' });
    mount();
    await settle();
    await tap('resilient');
    expect(screen.getByTestId('word-sheet-failed')).toBeTruthy();
    expect(calls('/vocab/words')).toHaveLength(0);

    lookupReply = () => jsonResponse(200, { found: true, entry: ENTRY });
    await click(screen.getByTestId('word-sheet-retry-lookup'));
    expect(calls('/vocab/lookup')).toHaveLength(2);
    expect(screen.getByTestId('word-sheet-translation')).toBeTruthy();
  });

  it('**关掉卡片**', async () => {
    mount();
    await settle();
    await tap('resilient');
    await click(screen.getByTestId('word-sheet-close'));
    expect(screen.queryByTestId('word-sheet')).toBeNull();
  });
});

describe('AC-04 考点词零请求', () => {
  it('**点到本卷考的那个词：一个请求都不发**', async () => {
    mount(paperWithVocabQuestion());
    await settle();
    await tap('resilient');
    expect(screen.getByTestId('word-sheet')).toBeTruthy();
    expect(screen.getByTestId('word-sheet-blocked')).toBeTruthy();
    expect(calls('/vocab/lookup')).toHaveLength(0);
    expect(calls('/vocab/words')).toHaveLength(0);
    expect(reqs).toEqual([]);
  });

  it('**考点词不显示任何释义材料**', async () => {
    mount(paperWithVocabQuestion());
    await settle();
    await tap('resilient');
    expect(screen.queryByTestId('word-sheet-translation')).toBeNull();
    expect(screen.queryByTestId('word-sheet-definition')).toBeNull();
    expect(screen.queryByTestId('word-sheet-phonetic')).toBeNull();
    expect(screen.queryByTestId('word-sheet-tags')).toBeNull();
    expect(text()).not.toContain('有韧性的');
  });

  it('**同一卷里的普通词照查不误**（屏蔽是精确的，不是一刀切）', async () => {
    mount(paperWithVocabQuestion());
    await settle();
    await tap('community');
    expect(screen.queryByTestId('word-sheet-blocked')).toBeNull();
    expect(calls('/vocab/lookup')).toHaveLength(1);
  });

  it('**叙事引语不算考点**（只有「问这个词什么意思」才屏蔽）', async () => {
    const p = paper({
      questions: [
        q({
          id: 'q1',
          sortOrder: 1,
          snapshotContent: {
            taskType: 'multiple_choice',
            passageTitle: 'The River Ferry',
            passage: PASSAGE,
            stem: "The keeper shouted 'resilient' across the water.",
          },
          snapshotOptions: [{ key: 'A', text: 'a' }],
        }),
      ],
    });
    mount(p);
    await settle();
    await tap('resilient');
    expect(calls('/vocab/lookup')).toHaveLength(1);
  });

  it('**显式 targetWord 也屏蔽**', async () => {
    const p = paper({
      questions: [
        q({
          id: 'q1',
          sortOrder: 1,
          snapshotContent: {
            taskType: 'multiple_choice',
            passageTitle: 'The River Ferry',
            passage: PASSAGE,
            stem: 'Pick one.',
            targetWord: 'resilient',
          },
          snapshotOptions: [{ key: 'A', text: 'a' }],
        }),
      ],
    });
    mount(p);
    await settle();
    await tap('resilient');
    expect(screen.getByTestId('word-sheet-blocked')).toBeTruthy();
    expect(reqs).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-05 —— 写生词本要说实话
// ─────────────────────────────────────────────────────────────

describe('AC-05 写生词本', () => {
  it('**created:true → 说存进去了**，而且只发一条', async () => {
    mount();
    await settle();
    await tap('resilient');
    expect(calls('/vocab/words')).toHaveLength(1);
    expect(screen.getByTestId('word-sheet-saved').textContent).toContain('已存入');
  });

  it('**created:false → 说本来就在本子里**', async () => {
    addReply = () => jsonResponse(200, { created: false, headword: 'resilient' });
    mount();
    await settle();
    await tap('resilient');
    expect(screen.getByTestId('word-sheet-saved').textContent).toContain('已经在');
  });

  it('**写失败 → 释义还在，但明说没存上，并给重试**', async () => {
    addReply = () => jsonResponse(500, { code: 'boom' });
    mount();
    await settle();
    await tap('resilient');
    expect(screen.getByTestId('word-sheet-translation')).toBeTruthy();
    expect(screen.getByTestId('word-sheet-save-failed')).toBeTruthy();
    expect(screen.queryByTestId('word-sheet-saved')).toBeNull();

    addReply = () => jsonResponse(200, { created: true, headword: 'resilient' });
    await click(screen.getByTestId('word-sheet-retry-save'));
    expect(calls('/vocab/words')).toHaveLength(2);
    expect(bodies('/vocab/words')[1]).toEqual(bodies('/vocab/words')[0]);
    expect(screen.getByTestId('word-sheet-saved')).toBeTruthy();
  });

  it('**响应形状不对也算失败**，不因为 fetch 成功就报成功', async () => {
    addReply = () => jsonResponse(200, { nope: true });
    mount();
    await settle();
    await tap('resilient');
    expect(screen.getByTestId('word-sheet-save-failed')).toBeTruthy();
    expect(screen.queryByTestId('word-sheet-saved')).toBeNull();
  });

  /**
   * 返工 1/2 —— B-1。
   *
   * 回执**整条**都要验，不是只验 `created`。
   * `{created:true}` 少了 `headword`：那意味着服务端根本没走到「查词典定
   * headword」那一步，这次到底记的是哪个词无从谈起 —— 报成功就是在替一次
   * 半截的响应背书。学生下次翻生词本找不到那个词，只会以为系统丢了东西。
   */
  const malformed: Array<[string, unknown]> = [
    ['缺 headword（created:true）', { created: true }],
    ['缺 headword（created:false）', { created: false }],
    ['headword 不是字符串', { created: true, headword: 123 }],
    ['headword 是 null', { created: false, headword: null }],
    ['headword 是空串', { created: true, headword: '' }],
    ['headword 只有空白', { created: true, headword: '   ' }],
    ['created 不是布尔', { created: 'yes', headword: 'resilient' }],
    ['整个是 null', null],
  ];
  for (const [label, body] of malformed) {
    it(`**回执不完整就算失败**：${label}`, async () => {
      addReply = () => jsonResponse(200, body);
      mount();
      await settle();
      await tap('resilient');
      // 释义照常显示 —— 查词是成功的
      expect(screen.getByTestId('word-sheet-translation')).toBeTruthy();
      expect(screen.getByTestId('word-sheet-save-failed')).toBeTruthy();
      expect(screen.queryByTestId('word-sheet-saved')).toBeNull();
    });
  }

  it('**完整的 created:true 才算存进去了**', async () => {
    addReply = () => jsonResponse(200, { created: true, headword: 'resilient' });
    mount();
    await settle();
    await tap('resilient');
    expect(screen.getByTestId('word-sheet-saved').textContent).toContain('已存入');
    expect(screen.queryByTestId('word-sheet-save-failed')).toBeNull();
  });

  it('**完整的 created:false 才算本来就在本子里**', async () => {
    addReply = () => jsonResponse(200, { created: false, headword: 'resilient' });
    mount();
    await settle();
    await tap('resilient');
    expect(screen.getByTestId('word-sheet-saved').textContent).toContain('已经在');
    expect(screen.queryByTestId('word-sheet-save-failed')).toBeNull();
  });

  it('**重试连点两下只发一条**', async () => {
    addReply = () => jsonResponse(500, { code: 'boom' });
    mount();
    await settle();
    await tap('resilient');
    addReply = () => jsonResponse(200, { created: true, headword: 'resilient' });
    const btn = screen.getByTestId('word-sheet-retry-save');
    await act(async () => {
      btn.click();
      btn.click();
    });
    await settle();
    expect(calls('/vocab/words')).toHaveLength(2); // 首次 + 一次重试
  });

  it('**查词掉票 → 清票**', async () => {
    lookupReply = () => jsonResponse(401, { code: 'token_revoked' });
    mount();
    await settle();
    await tap('resilient');
    expect(readToken()).toBeNull();
  });

  it('**写生词本掉票 → 清票**', async () => {
    addReply = () => jsonResponse(401, { code: 'student_token_required' });
    mount();
    await settle();
    await tap('resilient');
    expect(readToken()).toBeNull();
  });
});

describe('AC-05 过期响应画不上新卡', () => {
  it('**换词之后，上一个词的查词结果不许画上来**', async () => {
    const first = held();
    lookupReply = () => first.promise;
    mount();
    await settle();
    await tap('resilient');
    expect(screen.getByTestId('word-sheet-loading')).toBeTruthy();

    // 换到另一个词
    lookupReply = () => jsonResponse(200, { found: true, entry: { ...ENTRY, word: 'community', translation: '社区' } });
    await tap('community');
    expect(screen.getByTestId('word-sheet-translation').textContent).toContain('社区');

    // 迟到的第一个响应回来了
    await act(async () => {
      first.ok({ found: true, entry: ENTRY });
    });
    await settle();
    expect(screen.getByTestId('word-sheet-word').textContent).toContain('community');
    expect(screen.getByTestId('word-sheet-translation').textContent).toContain('社区');
    expect(text()).not.toContain('有韧性的');
  });

  it('**迟到的写入回执不许挂到另一个词上**', async () => {
    const firstAdd = held();
    addReply = () => firstAdd.promise;
    mount();
    await settle();
    await tap('resilient');

    addReply = () => jsonResponse(200, { created: false, headword: 'community' });
    lookupReply = () => jsonResponse(200, { found: true, entry: { ...ENTRY, word: 'community' } });
    await tap('community');
    expect(screen.getByTestId('word-sheet-saved').textContent).toContain('已经在');

    await act(async () => {
      firstAdd.ok({ created: true, headword: 'resilient' });
    });
    await settle();
    expect(screen.getByTestId('word-sheet-saved').textContent).toContain('已经在');
  });

  it('**关掉卡片之后回来的响应不许再动界面**', async () => {
    const h = held();
    lookupReply = () => h.promise;
    mount();
    await settle();
    await tap('resilient');
    await click(screen.getByTestId('word-sheet-close'));
    await act(async () => {
      h.ok({ found: true, entry: ENTRY });
    });
    await settle();
    expect(screen.queryByTestId('word-sheet')).toBeNull();
    expect(text()).not.toContain('有韧性的');
  });

  it('**卸载之后回来的响应不许报错也不许画**', async () => {
    const h = held();
    lookupReply = () => h.promise;
    const view = mount();
    await settle();
    await tap('resilient');
    view.unmount();
    await act(async () => {
      h.ok({ found: true, entry: ENTRY });
    });
    await settle();
    expect(document.body.textContent).not.toContain('有韧性的');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-06 —— 填空取词
// ─────────────────────────────────────────────────────────────

describe('AC-06 填空取词', () => {
  function answerInput(): HTMLInputElement {
    const el = document.querySelector('input[aria-label="Your answer"]');
    if (!el) throw new Error('answer input not found');
    return el as HTMLInputElement;
  }

  async function focusAnswer() {
    await act(async () => {
      fireEvent.focus(answerInput());
    });
    await settle();
  }

  it('**没有登记过填空题时不显示填入按钮**', async () => {
    mount();
    await settle();
    await tap('resilient');
    expect(screen.queryByTestId('word-sheet-fill')).toBeNull();
  });

  it('**空答案 → 直接填入**', async () => {
    mount();
    await settle();
    await focusAnswer();
    await tap('resilient');
    await click(screen.getByTestId('word-sheet-fill'));
    expect(answerInput().value).toBe('resilient');
    expect(screen.queryByTestId('word-sheet')).toBeNull();
  });

  it('**已有答案 → 追加一个空格再加词**', async () => {
    mount();
    await settle();
    const input = answerInput();
    await act(async () => {
      fireEvent.change(input, { target: { value: 'very' } });
      fireEvent.focus(input);
    });
    await settle();
    await tap('resilient');
    await click(screen.getByTestId('word-sheet-fill'));
    expect(answerInput().value).toBe('very resilient');
  });

  it('**关掉卡片而不填，答案一个字都不变**', async () => {
    mount();
    await settle();
    const input = answerInput();
    await act(async () => {
      fireEvent.change(input, { target: { value: 'very' } });
      fireEvent.focus(input);
    });
    await settle();
    await tap('resilient');
    await click(screen.getByTestId('word-sheet-close'));
    expect(answerInput().value).toBe('very');
  });

  it('**考点词也能填**（屏蔽的是释义，不是「这个词在原文里」）', async () => {
    mount(paperWithVocabQuestion());
    await settle();
    await focusAnswer();
    await tap('resilient');
    expect(screen.getByTestId('word-sheet-blocked')).toBeTruthy();
    await click(screen.getByTestId('word-sheet-fill'));
    expect(answerInput().value).toBe('resilient');
    expect(reqs).toEqual([]); // 填空不发请求
  });

  it('**多行的 O-Level 长答题不会变成填空目标**', async () => {
    const p = paper({
      level: 'olevel',
      questions: [
        q({
          id: 'q1',
          sortOrder: 1,
          marks: 5,
          snapshotContent: {
            taskType: 'short_answer',
            uiKind: 'olevel_short_answer',
            passageTitle: 'The River Ferry',
            passage: PASSAGE,
            stem: 'Explain.\n\nWhy did the pier need rebuilding?',
          },
        }),
      ],
    });
    mount(p);
    await settle();
    const ta = document.querySelector('textarea');
    expect(ta).toBeTruthy();
    await act(async () => {
      fireEvent.focus(ta as HTMLTextAreaElement);
    });
    await settle();
    await tap('resilient');
    expect(screen.queryByTestId('word-sheet-fill')).toBeNull();
  });

  it('**换了聚焦的题目，填入的目标跟着换**', async () => {
    const p = paper({
      questions: [
        q({
          id: 'q1',
          sortOrder: 1,
          snapshotContent: {
            taskType: 'sentence_completion',
            passageTitle: 'The River Ferry',
            passage: PASSAGE,
            stem: 'Complete.\n\nFirst [BLANK].',
          },
        }),
        q({
          id: 'q2',
          sortOrder: 2,
          snapshotContent: {
            taskType: 'sentence_completion',
            stem: 'Complete.\n\nSecond [BLANK].',
          },
        }),
      ],
    });
    mount(p);
    await settle();
    const inputs = [...document.querySelectorAll('input[aria-label="Your answer"]')] as HTMLInputElement[];
    expect(inputs).toHaveLength(2);
    await act(async () => {
      fireEvent.focus(inputs[1]);
    });
    await settle();
    await tap('resilient');
    await click(screen.getByTestId('word-sheet-fill'));
    expect(inputs[1].value).toBe('resilient');
    expect(inputs[0].value).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────
// AC-07 —— 存储
// ─────────────────────────────────────────────────────────────

describe('AC-07 存储只写 sw:', () => {
  it('**查过一次之后写一个 `sw:` 发现标记**，没有 `mq:`', async () => {
    mount();
    await settle();
    await tap('resilient');
    const keys = Object.keys(localStorage);
    expect(keys.some((k) => k.startsWith('mq:'))).toBe(false);
    expect(keys).toContain('sw:reading:looked-up-once');
    expect(localStorage.getItem('sw:reading:looked-up-once')).toBe('1');
  });

  it('**存储里不放词条、身份、令牌副本、答案或待写队列**', async () => {
    mount();
    await settle();
    await tap('resilient');
    for (const k of Object.keys(localStorage)) {
      // 会话令牌本来就存在 `identity.ts` 自己那个键里 —— 那是登录态，
      // 不是这个功能写的。这里查的是**这个功能有没有另外抄一份**。
      if ((OWNED_STORAGE_KEYS as readonly string[]).includes(k)) continue;
      const v = localStorage.getItem(k) ?? '';
      expect(v).not.toContain('有韧性的');
      expect(v).not.toContain(TOKEN);
      expect(v).not.toContain('studentName');
      expect(k).not.toMatch(/pending|queue/i);
    }
  });
});
