/**
 * 「背一背」—— 学完最后一张卡与开考之间的那一段（2026-09-10）。
 *
 * 起因是生产数据：首发三天 48 次，学生翻完最后一张卡到答出第一道题
 * **中位 30 秒**，73% 的人一分钟内就开始答，整份 10 题 **72 秒**答完。
 * 那不是考试，是抄写 —— 卡片刚从眼前过去。
 *
 * 叶老师定的做法：保留「背今天的、考今天的」，但中间留出背诵时间，
 * **不设时间闸门**，什么时候开考学生自己决定。所以这一页必须自己值得
 * 停留，下面每一条钉的都是这个：
 *
 *   · 学完不再被弹走，也**不自动开考**
 *   · 中文默认盖住 —— 就是纸上用手盖住答案自己默的动作
 *   · 只有学生点「我背好了」才发开考请求
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import VocabularyCoachLearnPage from '../pages/VocabularyCoachLearn';
import { writeToken } from '../lib/identity';

const TOKEN = 'recite-token';

const baseCard = {
  phonetic: '/dɪˈklaɪn/', pos: 'verb', senseKey: 'verb:01',
  definition: 'to become smaller or weaker',
  sentence: null as string | null, sentenceTranslation: null as string | null,
  collocations: [] as string[], wordFamily: [] as string[], confusionWords: [] as string[],
  memoryHint: null as string | null, imageUrl: null as string | null,
  list: 'ngsl', rank: 1180, attribution: 'NGSL Project',
};

type ItemSpec = { headword: string; translation: string; status: string; action: string | null };

function session(items: ItemSpec[], status = 'completed') {
  return {
    id: 'daily-1', version: 'V2-20260910-001', date: '2026-09-10', type: 'daily_learning',
    mode: 'teacher_list', status, target: items.length, cursor: items.length,
    completed: items.length, learned: items.filter((i) => i.status === 'completed').length,
    sourceSummary: { level_gap: items.length }, settings: { audioAccent: 'en-GB' }, deferredUntil: null,
    items: items.map((spec, index) => ({
      id: `item-${index + 1}`, position: index + 1, source: 'level_gap', masteryBefore: 1,
      status: spec.status, action: spec.action,
      card: { ...baseCard, headword: spec.headword, translation: spec.translation, audioText: spec.headword },
    })),
  };
}

const THREE: ItemSpec[] = [
  { headword: 'decline', translation: '下降；减少', status: 'completed', action: 'normal' },
  { headword: 'budget', translation: '预算', status: 'completed', action: 'hard' },
  { headword: 'panel', translation: '面板；专家组', status: 'completed', action: 'normal' },
];

function response(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300, status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}
const pathOf = (url: string) => url.replace(/^.*\/api/, '');

/**
 * 走真实路径：最后一张卡还没学 → 点「学完这个词」→ 落到背一背。
 *
 * 不直接拿一个 completed 的会话开局 —— 那样测不到「学完之后停在本页」，
 * 而事后重新进入这一页仍然应该被送回首页（见 load 里的 redirect）。
 */
async function mount(items: ItemSpec[] = THREE) {
  const calls: string[] = [];
  const pending = session(items, 'in_progress');
  // 最后一张卡留着没学
  pending.items[pending.items.length - 1].status = 'pending';
  pending.completed = items.length - 1;

  const fetchMock = vi.fn((url: string) => {
    const path = pathOf(url);
    calls.push(path);
    if (path === '/vocab-v2/daily') return response(pending);
    if (path === '/vocab-v2/daily/item') return response(session(items));
    if (path === '/vocab-v2/test/start') return response({ id: 'test-1', items: [] });
    return response({}, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<MemoryRouter><VocabularyCoachLearnPage /></MemoryRouter>);
  await userEvent.click(await screen.findByText('学完这个词'));
  return { calls };
}

beforeEach(() => {
  localStorage.clear();
  writeToken(TOKEN);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('背一背', () => {
  it('今天的词学完了 → 停在背诵页，**不自动开考**', async () => {
    const { calls } = await mount();
    expect(await screen.findByText('先自己默一遍，再去测试')).toBeInTheDocument();
    // 一个开考请求都没发出去
    expect(calls.filter((p) => p === '/vocab-v2/test/start')).toHaveLength(0);
  });

  it('中文默认盖住，点一下才露出来', async () => {
    await mount();
    await screen.findByText('先自己默一遍，再去测试');
    // 英文一直在
    expect(screen.getByText('decline')).toBeInTheDocument();
    // 中文一开始看不到
    expect(screen.queryByText(/下降；减少/)).toBeNull();

    await userEvent.click(screen.getByTestId('reveal-decline'));
    expect(await screen.findByText(/下降；减少/)).toBeInTheDocument();
    // 其他词仍然盖着 —— 一次只翻一个
    expect(screen.queryByText(/^预算$/)).toBeNull();
  });

  it('「全部翻开」一次露出所有中文，再点又盖回去', async () => {
    await mount();
    await screen.findByText('先自己默一遍，再去测试');
    await userEvent.click(screen.getByText('全部翻开'));
    expect(await screen.findByText(/下降；减少/)).toBeInTheDocument();
    expect(screen.getByText(/预算/)).toBeInTheDocument();

    await userEvent.click(screen.getByText('重新盖住全部'));
    expect(screen.queryByText(/下降；减少/)).toBeNull();
  });

  it('点了「我背好了」才开考', async () => {
    const { calls } = await mount();
    await screen.findByText('先自己默一遍，再去测试');
    expect(calls.filter((p) => p === '/vocab-v2/test/start')).toHaveLength(0);

    await userEvent.click(screen.getByText('我背好了，开始测试'));
    expect(calls.filter((p) => p === '/vocab-v2/test/start')).toHaveLength(1);
  });

  it('自己标过「有点难」的词排在最前面', async () => {
    await mount();
    await screen.findByText('先自己默一遍，再去测试');
    const words = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    // budget 在学习顺序里是第二个，但它被标了「有点难」
    expect(words[0]).toContain('budget');
    expect(words[0]).toContain('刚才标了有点难');
  });

  it('「稍后再学」的词不进背诵单 —— 它也不会被考', async () => {
    await mount([
      ...THREE,
      { headword: 'induce', translation: '引起', status: 'skipped', action: 'skip' },
    ]);
    await screen.findByText('先自己默一遍，再去测试');
    // 背诵单里没有它；页头把学完和延后分开写（VOC08），并说清延后的去哪了
    expect(screen.getAllByRole('listitem').some((li) => li.textContent?.includes('induce'))).toBe(false);
    expect(screen.getByText('学完 3 个 · 延后 1 个')).toBeInTheDocument();
    expect(screen.getByText(/延后的 1 个（induce）不算学完，也不进这次测试/)).toBeInTheDocument();
  });

  it('明说考试会抽查以前学过的词 —— 别让学生觉得考了没学的', async () => {
    await mount();
    const box = await screen.findByTestId('recite-test-size');
    expect(box.textContent).toMatch(/另有最多 3 个以前学过的词抽查/);
  });

  it('全都点了「稍后再学」→ 没得考，说清楚而不是给一个开不了的按钮', async () => {
    await mount([{ headword: 'induce', translation: '引起', status: 'skipped', action: 'skip' }]);
    // VOC08：全延后 = 没有学完的词，不需要测试；说清这些词去哪了
    expect(await screen.findByText('这批词都延后了')).toBeInTheDocument();
    expect(screen.getByText(/induce 没有算学完，也不用考；之后的新词里还会再出现/)).toBeInTheDocument();
    expect(screen.queryByText('我背好了，开始测试')).toBeNull();
  });
  it('**考完之后再回到这一页 → 只读回看原来那批词**（VOC12），不再给「开始测试」、不重建卷子', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = pathOf(url);
      calls.push(path);
      if (path === '/vocab-v2/daily') return response(session(THREE));
      if (path === '/vocab-v2/daily/review?date=2026-09-10') {
        const s3 = session(THREE);
        return response({
          readOnly: true, date: '2026-09-10', sessionId: 'daily-1', status: 'completed', mode: 'teacher_list', learningPhase: 'finished',
          target: 3, learned: 3, deferred: 0, replaced: 0, pending: 0,
          recite: s3.items.map((it) => ({ id: it.id, position: it.position, action: it.action, card: it.card })),
          deferredWords: [], pendingWords: [],
          test: { testSessionId: 'test-9', generated: true, status: 'submitted', total: 6, newWords: 3, reviewWords: 3, answered: 6 },
        });
      }
      return response({}, 404);
    }));
    render(<MemoryRouter><VocabularyCoachLearnPage /></MemoryRouter>);
    expect(await screen.findByText('回看这一天学的词')).toBeInTheDocument();
    expect(screen.getByText('decline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '看测试回顾' })).toBeInTheDocument();
    expect(screen.queryByText(/开始测试/)).toBeNull();
    expect(calls.filter((p) => p === '/vocab-v2/test/start')).toHaveLength(0);
    expect(calls.filter((p) => p === '/vocab-v2/daily/start')).toHaveLength(0);
  });

  it('**学完了但还没测，刷新再进来**：仍是背一背，开测打开已生成的那份卷，不再生成', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = pathOf(url);
      calls.push(path);
      if (path === '/vocab-v2/daily') return response(session(THREE));
      if (path.startsWith('/vocab-v2/daily/review')) {
        const s3 = session(THREE);
        return response({
          readOnly: true, date: '2026-09-10', sessionId: 'daily-1', status: 'completed', mode: 'teacher_list', learningPhase: 'finished',
          target: 3, learned: 3, deferred: 0, replaced: 0, pending: 0,
          recite: s3.items.map((it) => ({ id: it.id, position: it.position, action: it.action, card: it.card })),
          deferredWords: [], pendingWords: [],
          test: { testSessionId: 'test-9', generated: true, status: 'not_started', total: 6, newWords: 3, reviewWords: 3, answered: 0 },
        });
      }
      return response({}, 404);
    }));
    render(<MemoryRouter><VocabularyCoachLearnPage /></MemoryRouter>);
    expect(await screen.findByText('先自己默一遍，再去测试')).toBeInTheDocument();
    expect(screen.getByTestId('recite-test-size').textContent).toContain('6 题（新词 3 + 旧词抽查 3）');
    await userEvent.click(screen.getByText('我背好了，开始测试'));
    expect(calls.filter((p) => p === '/vocab-v2/test/start')).toHaveLength(0);
  });

  it('回看接口取不到也不白屏：用手上的会话照样能背', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = pathOf(url);
      if (path === '/vocab-v2/daily') return response(session(THREE));
      return response({ code: 'boom' }, 500);
    }));
    render(<MemoryRouter><VocabularyCoachLearnPage /></MemoryRouter>);
    expect(await screen.findByText('先自己默一遍，再去测试')).toBeInTheDocument();
  });
});
