/**
 * 我的单词（审计 IOS-08 / UI02 / UI03 / UI04 / VOC13）。
 *
 * 一个假的「生词本服务端」：按服务端同样的规则分页（每批 30，游标接着取）、按关键字过滤、
 * 移出 / 重新加入真的改集合。断言落在 DOM 与发出去的请求上。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import VocabularyCoachPage, { __clearVocabCacheForTest, appendUnique, availableFor } from '../pages/VocabularyCoach';
import { ToastProvider } from '../design/Toast';
import { writeToken } from '../lib/identity';

const TOKEN = 'center-token';
const PAGE = 30;

type Row = { studentSenseId: string; senseId: string; headword: string; inNotebook: boolean };
let words: Row[] = [];
let reqs: Array<{ path: string; method: string; body: string | null }> = [];
let centerDelay: (q: string) => Promise<void> = () => Promise.resolve();

function makeWords(n: number) {
  words = Array.from({ length: n }, (_, i) => ({ studentSenseId: `ss-${i + 1}`, senseId: `sense-${i + 1}`, headword: `word${String(i + 1).padStart(3, '0')}`, inNotebook: true }));
}

function item(r: Row) {
  return {
    studentSenseId: r.studentSenseId, senseId: r.senseId, headword: r.headword, phonetic: null, pos: 'noun', translation: `释义${r.headword.slice(4)}`,
    definition: '', masteryStage: 2, due: '2026-09-10T00:00:00.000Z', source: 'level_gap', sources: ['level_gap'], sourceTitle: null,
    firstSeenAt: '2026-09-01T00:00:00.000Z', inNotebook: r.inNotebook, skills: {}, context: null,
  };
}

function center(params: URLSearchParams) {
  const q = params.get('q') ?? '';
  const stage = params.get('stage') ?? '';
  const cursor = Number(params.get('cursor') ?? '0') || 0;
  const pool = words.filter((w) => (stage === 'removed' ? !w.inNotebook : w.inNotebook)).filter((w) => !q || w.headword.includes(q));
  const slice = pool.slice(cursor, cursor + PAGE);
  const next = cursor + PAGE < pool.length ? String(cursor + PAGE) : null;
  const active = words.filter((w) => w.inNotebook).length;
  return {
    stats: { total: active, totalLearned: words.length, removed: words.length - active, new: 0, learning: active, mastered: 0 },
    growth: [],
    filters: { sources: ['level_gap', 'search'], stages: ['new', 'learning', 'mastered', 'removed'], articles: [], topics: [], lists: [] },
    total: pool.length, page: Math.floor(cursor / PAGE) + 1, pageSize: PAGE, pageCount: Math.max(1, Math.ceil(pool.length / PAGE)),
    hasMore: next !== null, nextCursor: next,
    items: slice.map(item),
  };
}

function json(body: unknown, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body)) } as Response);
}

let dictionary: Record<string, { id: string | null; headword: string; translation: string }> = {};
let dictDelay: (w: string) => Promise<void> = () => Promise.resolve();

function install() {
  reqs = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const u = new URL(String(url).replace(/^.*\/api/, 'http://x'));
    const path = u.pathname;
    const body = init.body ? String(init.body) : null;
    reqs.push({ path: path + u.search, method: init.method ?? 'GET', body });
    if (path === '/vocab-v2/center') {
      await centerDelay(u.searchParams.get('q') ?? '');
      return json(center(u.searchParams));
    }
    if (path === '/vocab-v2/overview') {
      return json({ dailyTarget: 10, today: null, readingBacklog: [], learningBacklog: [], pendingTests: [
        { dailySessionId: 'd-0909', testSessionId: null, date: '2026-09-09', total: null, generated: false, expectedNewWords: 8, reviewWordsMax: 3, answered: 0, status: 'not_started' },
      ], home: { date: '2026-09-11', teachingDay: true, reading: { state: 'pending' }, words: { state: 'not_generated' }, test: { state: 'not_generated', reason: 'no_word_task_yet' }, allDone: false } });
    }
    if (path === '/vocab-v2/notebook/remove' || path === '/vocab-v2/notebook/restore') {
      const { senseId } = JSON.parse(body!);
      const w = words.find((x) => x.senseId === senseId)!;
      w.inNotebook = path.endsWith('restore');
      return json({ ok: true, senseId, headword: w.headword, inNotebook: w.inNotebook });
    }
    if (path === '/vocab-v2/collect') {
      const b = JSON.parse(body!);
      if (b.action === 'lookup_only') {
        await dictDelay(b.headword);
        const hit = dictionary[b.headword];
        if (!hit) return json({ code: 'v2_word_not_found' }, 404);
        return json({ ok: true, action: 'lookup_only', added: false, sense: { ...hit, senseKey: 'k', pos: 'noun', phonetic: null, definition: '' } });
      }
      return json({ ok: true, action: b.action, added: true, sense: { ...dictionary[b.headword], senseKey: 'k', pos: 'noun', phonetic: null, definition: '' } });
    }
    if (path === '/vocab-v2/custom-test/start') return json({ code: 'v2_custom_test_empty' }, 400);
    return json({ code: 'not_stubbed', path }, 404);
  }));
}

function Where() {
  const l = useLocation();
  return <span data-testid="loc">{l.pathname + l.search}</span>;
}
function mount(at = '/vocab') {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <ToastProvider>
        <Routes>
          <Route path="/vocab" element={<><VocabularyCoachPage /><Where /></>} />
          <Route path="*" element={<Where />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}
const centerCalls = () => reqs.filter((r) => r.path.startsWith('/vocab-v2/center'));
const rows = () => within(screen.getByTestId('word-list')).getAllByRole('listitem');

beforeEach(() => {
  localStorage.clear();
  writeToken(TOKEN);
  __clearVocabCacheForTest();
  centerDelay = () => Promise.resolve();
  dictDelay = () => Promise.resolve();
  dictionary = {
    apple: { id: 'sense-apple', headword: 'apple', translation: '苹果' },
    banana: { id: 'sense-banana', headword: 'banana', translation: '香蕉' },
  };
  makeWords(65);
  install();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('UI03 · 长列表每一个都够得着', () => {
  // 审计 §8.2 极端数据：1 / 30 / 31 / 65 / 500 / 1000 词（0 词见下一个用例）
  for (const n of [1, 30, 31, 65, 500, 1000]) {
    it(`**${n} 个词：一批批「加载更多」到底，不漏不重**`, async () => {
      makeWords(n);
      const user = userEvent.setup();
      mount();
      await waitFor(() => expect(rows()).toHaveLength(Math.min(PAGE, n)));
      expect(screen.getByTestId('list-count').textContent).toContain(`共 ${n} 个单词`);
      while (screen.queryByTestId('load-more')) {
        await user.click(screen.getByTestId('load-more'));
        await waitFor(() => expect(screen.getByTestId('list-count').textContent).not.toMatch(/正在查找/));
      }
      const heads = rows().map((li) => li.getAttribute('data-testid'));
      expect(heads).toHaveLength(n);
      expect(new Set(heads).size).toBe(n);
      expect(heads[n - 1]).toBe(`word-word${String(n).padStart(3, '0')}`);
    });
  }

  it('**0 个词：说清生词本是空的、词从哪来，没有「加载更多」**', async () => {
    makeWords(0);
    mount();
    expect(await screen.findByTestId('list-empty')).toHaveTextContent('生词本还是空的。学每日新词、阅读时查词，都会收进这里。');
    expect(screen.queryByTestId('load-more')).toBeNull();
    expect(screen.getByTestId('list-count').textContent).toContain('共 0 个单词');
  });

  it('appendUnique：跨批重叠的项只留一份', () => {
    const a = [{ studentSenseId: '1' }, { studentSenseId: '2' }] as never[];
    const b = [{ studentSenseId: '2' }, { studentSenseId: '3' }] as never[];
    expect(appendUnique(a, b).map((x: { studentSenseId: string }) => x.studentSenseId)).toEqual(['1', '2', '3']);
  });

  it('**移出这一批的最后一个、后面还有 → 自动取下一批，不困在空页**', async () => {
    makeWords(31);
    const user = userEvent.setup();
    mount('/vocab?q=word03');
    // word030 / word031 两个；按关键字只剩一批
    await waitFor(() => expect(rows()).toHaveLength(2));
    await user.click(screen.getByTestId('remove-word030'));
    await waitFor(() => expect(rows()).toHaveLength(1));
    await user.click(screen.getByTestId('remove-word031'));
    await waitFor(() => expect(screen.getByTestId('list-empty')).toBeInTheDocument());
    expect(screen.getByTestId('list-count').textContent).toContain('找到 0 个单词');
  });
});

describe('UI04 · 搜索不卸载输入框', () => {
  it('**连续输入：输入框一直是同一个节点、焦点一直在；停手后只查一次**', async () => {
    const user = userEvent.setup();
    mount();
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const input = screen.getByTestId('vocab-search');
    input.focus();
    const before = centerCalls().length;
    await user.type(input, 'word06');
    expect(screen.getByTestId('vocab-search')).toBe(input);
    expect(document.activeElement).toBe(input);
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toContain('q=word06'));
    await waitFor(() => expect(rows()).toHaveLength(6)); // word060..word065
    expect(centerCalls().length - before).toBe(1);
    expect(document.activeElement).toBe(input);
  });

  it('**慢的旧请求回来晚了，不覆盖新条件**', async () => {
    let releaseOld!: () => void;
    centerDelay = (q) => (q === 'word01' ? new Promise((ok) => { releaseOld = ok; }) : Promise.resolve());
    const user = userEvent.setup();
    mount();
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const input = screen.getByTestId('vocab-search');
    await user.type(input, 'word01');
    await waitFor(() => expect(centerCalls().some((c) => c.path.includes('q=word01'))).toBe(true));
    await user.clear(input);
    await user.type(input, 'word06');
    await waitFor(() => expect(rows()).toHaveLength(6));
    await act(async () => { releaseOld(); });
    // 旧的 word01 结果（10 个）没有盖上来
    expect(rows()).toHaveLength(6);
    expect(rows()[0].getAttribute('data-testid')).toBe('word-word060');
  });

  it('**中文输入法组合过程中不查，组合结束才查**', async () => {
    mount();
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const input = screen.getByTestId('vocab-search');
    const before = centerCalls().length;
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'wo' } });
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(centerCalls().length).toBe(before);
    fireEvent.compositionEnd(input, { target: { value: 'word065' } });
    fireEvent.change(input, { target: { value: 'word065' } });
    await waitFor(() => expect(rows()).toHaveLength(1));
  });

  it('**返回保留条件**：搜索词、筛选、分段都在网址里，带着网址进来就是原样', async () => {
    mount('/vocab?q=word06&view=words');
    expect((screen.getByTestId('vocab-search') as HTMLInputElement).value).toBe('word06');
    await waitFor(() => expect(rows()).toHaveLength(6));
  });
});

describe('移出与重新加入（IOS-08 / VOC13）', () => {
  it('**移出就地消失 + 「撤销」放回原位**；学习记录不删', async () => {
    const user = userEvent.setup();
    mount();
    await waitFor(() => expect(rows()).toHaveLength(30));
    await user.click(screen.getByTestId('remove-word002'));
    await waitFor(() => expect(screen.queryByTestId('word-word002')).toBeNull());
    expect(screen.getByText(/已移出 word002。学习记录都还在。/)).toBeInTheDocument();
    await user.click(screen.getByTestId('toast-action'));
    await waitFor(() => expect(screen.getByTestId('word-word002')).toBeInTheDocument());
    expect(rows()[1].getAttribute('data-testid')).toBe('word-word002');
    expect(reqs.filter((r) => r.path === '/vocab-v2/notebook/restore')).toHaveLength(1);
  });

  it('**已移出里按钮叫「重新加入」**，走 notebook/restore；提示说清不算新词、不马上要求复习', async () => {
    words[0].inNotebook = false;
    const user = userEvent.setup();
    mount('/vocab?view=removed');
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.getByTestId('restore-word001').textContent).toBe('重新加入');
    expect(document.body.textContent).not.toContain('重新学习');
    await user.click(screen.getByTestId('restore-word001'));
    await waitFor(() => expect(screen.getByText(/已重新加入 word001（不算新词，也不会马上要求复习）/)).toBeInTheDocument());
    const call = reqs.find((r) => r.path === '/vocab-v2/notebook/restore');
    expect(JSON.parse(call!.body!)).toEqual({ senseId: 'sense-1' });
  });
});

describe('UI02 · 查词按钮只作用于卡上显示的那个词', () => {
  it('**查出 apple 后把输入改成 banana、不查就点：按钮停用，不会把「加入」发给 banana**', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByTestId('open-dictionary'));
    const input = await screen.findByTestId('dictionary-input');
    await user.type(input, 'apple');
    await user.click(screen.getByRole('button', { name: '查询' }));
    expect(await screen.findByTestId('dictionary-result')).toHaveTextContent('apple');
    await user.clear(input);
    await user.type(input, 'banana');
    expect(screen.getByTestId('dictionary-stale')).toHaveTextContent('输入已经改成「banana」');
    expect(screen.getByTestId('dict-learn')).toBeDisabled();
    await user.click(screen.getByTestId('dict-learn'));
    expect(reqs.filter((r) => r.path === '/vocab-v2/collect' && !r.body!.includes('lookup_only'))).toHaveLength(0);
  });

  it('**点「加入」发的是卡上的 headword + senseId**，不读输入框', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByTestId('open-dictionary'));
    await user.type(await screen.findByTestId('dictionary-input'), 'apple');
    await user.click(screen.getByRole('button', { name: '查询' }));
    await screen.findByTestId('dictionary-result');
    await user.click(screen.getByTestId('dict-learn'));
    await screen.findByTestId('dictionary-done');
    const sent = reqs.filter((r) => r.path === '/vocab-v2/collect').map((r) => JSON.parse(r.body!)).find((b) => b.action === 'learn');
    expect(sent).toMatchObject({ headword: 'apple', senseId: 'sense-apple', action: 'learn', source: 'search' });
    expect(screen.getByTestId('dictionary-done')).toHaveTextContent('apple 已加入我的单词');
  });

  it('**慢查询回来晚了不串词**：先查 apple（慢）再查 banana，卡上是 banana', async () => {
    let releaseApple!: () => void;
    dictDelay = (w) => (w === 'apple' ? new Promise((ok) => { releaseApple = ok; }) : Promise.resolve());
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByTestId('open-dictionary'));
    const input = await screen.findByTestId('dictionary-input');
    await user.type(input, 'apple');
    await user.click(screen.getByRole('button', { name: '查询' }));
    await user.clear(input);
    await user.type(input, 'banana');
    await user.click(screen.getByRole('button', { name: '查询' }));
    expect(await screen.findByTestId('dictionary-result')).toHaveTextContent('banana');
    await act(async () => { releaseApple(); });
    expect(screen.getByTestId('dictionary-result')).toHaveTextContent('banana');
    expect(screen.getByTestId('dictionary-result')).not.toHaveTextContent('apple');
  });

  it('生词本里搜不到 → 一键到词典里查这个词', async () => {
    const user = userEvent.setup();
    mount('/vocab?q=apple');
    await user.click(await screen.findByRole('button', { name: '在词典里查「apple」' }));
    expect(await screen.findByTestId('dictionary-result')).toHaveTextContent('苹果');
  });
});

describe('测试待办与自助抽查（IOS-08 / VOC06 / VOC10）', () => {
  it('**卷子没生成的待测写「预计」**，不编一个题数', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByTestId('view-tests'));
    expect(await screen.findByTestId('pending-2026-09-09')).toHaveTextContent('预计 8 个新词，另有最多 3 个旧词抽查');
    expect(screen.getByTestId('pending-2026-09-09').textContent).not.toMatch(/null|NaN/);
  });

  it('**抽查表单**：选范围和题数，写明能抽多少、不记正式成绩；范围里没词时说清楚', async () => {
    const user = userEvent.setup();
    mount();
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(screen.getByTestId('open-practice'));
    const sheet = await screen.findByTestId('practice-sheet');
    expect(sheet).toHaveTextContent('不记正式成绩');
    expect(screen.getByTestId('practice-available')).toHaveTextContent('这个范围最多能抽 65 个。');
    await user.click(screen.getByTestId('scope-mastered'));
    expect(screen.getByTestId('practice-available')).toHaveTextContent('这个范围现在没有词。');
    expect(screen.getByTestId('practice-start')).toBeDisabled();
    await user.click(screen.getByTestId('scope-weak'));
    await user.click(screen.getByTestId('practice-start'));
    expect(await within(sheet).findByText('这个范围现在没有可以抽的词，换一个范围试试。')).toBeInTheDocument();
  });

  it('availableFor：只写能确定的上限，确定不了就不编', () => {
    const c = { stats: { total: 12, totalLearned: 20, removed: 1, new: 2, learning: 7, mastered: 3 }, growth: [{ date: 'a', added: 2, total: 2 }, { date: 'b', added: 3, total: 5 }] } as never;
    expect(availableFor('all', c)).toBe(12);
    expect(availableFor('mastered', c)).toBe(3);
    expect(availableFor('week', c)).toBe(5);
    expect(availableFor('weak', c)).toBeNull();
  });
});
