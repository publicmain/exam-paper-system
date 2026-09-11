/**
 * 学词与单词测试（审计 IOS-07 / VOC04 / VOC08 / VOC10 / VOC11 / UI02）。
 *
 * 真页面 + 真 api 客户端，只在 `fetch` 打桩；断言落在渲染出来的 DOM 与发出去的请求上。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import VocabularyCoachLearnPage from '../pages/VocabularyCoachLearn';
import VocabularyCoachTestPage from '../pages/VocabularyCoachTest';
import { writeToken } from '../lib/identity';

const TOKEN = 'v2-test-token';
const card = {
  headword: 'decline', phonetic: '/dɪˈklaɪn/', pos: 'verb', senseKey: 'verb:01',
  translation: '下降；减少', definition: 'to become smaller or weaker',
  sentence: 'Sales may decline when customers lose confidence.',
  sentenceTranslation: '顾客失去信心时，销量可能下降。',
  collocations: ['decline sharply'], wordFamily: ['declining'], confusionWords: ['decrease'],
  memoryHint: 'de- 向下 + cline- 倾斜', imageUrl: null, audioText: 'decline',
  list: 'ngsl', rank: 1180, attribution: 'NGSL Project',
};

const learning = (headword = 'decline', over: Record<string, unknown> = {}) => ({
  id: 'daily-1', version: 'V2-20260901-001', date: '2026-09-01', type: 'daily_learning', mode: 'teacher_list',
  status: 'in_progress', target: 12, cursor: 0, completed: 0, learned: 0, deferred: 0, pending: 12, sourceSummary: { teacher_list: 12 }, settings: { audioAccent: 'en-GB' }, deferredUntil: null,
  items: Array.from({ length: 12 }, (_, index) => ({
    id: `item-${index + 1}`, position: index + 1, source: 'teacher_list', masteryBefore: 1, action: null as string | null,
    senseId: index === 0 ? `sense-${headword}` : `sense-${index + 1}`,
    status: 'pending', card: { ...card, headword: index === 0 ? headword : `word-${index + 1}`, audioText: index === 0 ? headword : `word-${index + 1}` },
  })),
  ...over,
});

function response(body: unknown, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body)), blob: () => Promise.resolve(new Blob(['x'])) } as Response);
}
const pathOf = (url: string) => url.replace(/^.*\/api/, '');

function Where() {
  const l = useLocation();
  return <span data-testid="loc">{l.pathname + l.search}</span>;
}
function mountLearn(at = '/coach/learn') {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/coach/learn" element={<VocabularyCoachLearnPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}
function mountTest(at: string) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/coach/test" element={<VocabularyCoachTestPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  writeToken(TOKEN);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('学词 · 一屏教清一个词（IOS-07）', () => {
  it('当天还没有任务时，空响应会自动创建任务而不是白屏', async () => {
    const fetchMock = vi.fn((url: string) => {
      const path = pathOf(url);
      if (path === '/vocab-v2/daily') return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') } as Response);
      if (path === '/vocab-v2/daily/start') return response(learning());
      return response({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    mountLearn();
    expect(await screen.findByText('Sales may decline when customers lose confidence.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('周末打开学习页：说清楚没有任务，给回今日的路，而不是报「无法生成」', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = pathOf(url);
      if (path === '/vocab-v2/daily') return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') } as Response);
      if (path === '/vocab-v2/daily/start') return response({ code: 'v2_no_task_on_weekend' }, 400);
      return response({}, 404);
    }));
    mountLearn();
    expect(await screen.findByText('周六周日没有新词任务')).toBeInTheDocument();
    expect(screen.queryByText(/无法生成/)).toBeNull();
    expect(screen.getByRole('button', { name: '回到今日' })).toBeInTheDocument();
  });

  it('从欠交入口进入时，读取指定日期的同一份任务，页头写日期', async () => {
    const fetchMock = vi.fn((url: string) => (pathOf(url) === '/vocab-v2/daily?date=2026-09-01' ? response(learning()) : response({}, 404)));
    vi.stubGlobal('fetch', fetchMock);
    mountLearn('/coach/learn?date=2026-09-01');
    expect(await screen.findByText('9月1日 周二 新词')).toBeInTheDocument();
    expect(screen.getByText('Sales may decline when customers lose confidence.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('英文、发音、词性 + 中文、释义、例句在一屏；扩展内容收在「更多」里，点开才显示', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => (pathOf(url) === '/vocab-v2/daily' ? response(learning()) : response({}, 404))));
    const user = userEvent.setup();
    mountLearn();
    expect(await screen.findByRole('heading', { name: 'decline', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '播放 decline 的发音' })).toBeInTheDocument();
    expect(screen.getByText('v. 下降；减少')).toBeInTheDocument();
    expect(screen.getByText('to become smaller or weaker')).toBeInTheDocument();
    expect(screen.queryByText('decline sharply')).toBeNull();
    await user.click(screen.getByRole('button', { name: /更多：常见搭配、词族、易混词、记忆提示/ }));
    expect(screen.getByText('decline sharply')).toBeInTheDocument();
    expect(screen.getByText('de- 向下 + cline- 倾斜')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '学完这个词' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/第 1 阶段|主动回忆|补全短句|核对答案|▶|→/);
  });

  it('扩展内容为空时连「更多」都不出现，不摆空的占位卡', async () => {
    const sparse = learning('belong');
    sparse.items[0].card = { ...sparse.items[0].card, collocations: [], wordFamily: [], confusionWords: [], memoryHint: '' };
    vi.stubGlobal('fetch', vi.fn((url: string) => (pathOf(url) === '/vocab-v2/daily' ? response(sparse) : response({}, 404))));
    mountLearn();
    expect(await screen.findByRole('heading', { name: 'belong' })).toBeInTheDocument();
    expect(screen.queryByText(/更多/)).toBeNull();
    expect(screen.queryByText('这一项暂时没有可靠内容')).toBeNull();
  });
});

describe('学词 · 三个动作说清发生了什么（IOS-07 / VOC08 / UI02）', () => {
  it('**「已会，换一个」带上屏幕这张卡的 senseId**；反馈写清换成了谁、总数不变', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const path = pathOf(url);
      if (path === '/vocab-v2/daily') return response(learning());
      if (path === '/vocab-v2/daily/replace') {
        expect(JSON.parse(String(init?.body))).toEqual({ sessionId: 'daily-1', itemId: 'item-1', expectedSenseId: 'sense-decline' });
        return response({ ...learning('evidence'), replacement: { position: 1, oldHeadword: 'decline', newHeadword: 'evidence' } });
      }
      return response({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    mountLearn();
    await user.click(await screen.findByRole('button', { name: '已会，换一个' }));
    expect(await screen.findByText('decline 记为已会，换成 evidence。今天的总数不变。')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'evidence' })).toBeInTheDocument();
    expect(screen.getByText('1 / 12')).toBeInTheDocument();
  });

  it('**换词双击只发一次**（重试不会把刚换上的新词再换掉）', async () => {
    let release!: () => void;
    const gate = new Promise<void>((ok) => { release = ok; });
    const fetchMock = vi.fn((url: string) => {
      const path = pathOf(url);
      if (path === '/vocab-v2/daily') return response(learning());
      if (path === '/vocab-v2/daily/replace') return gate.then(() => response({ ...learning('evidence'), replacement: { position: 1, oldHeadword: 'decline', newHeadword: 'evidence' } }));
      return response({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    mountLearn();
    const btn = await screen.findByRole('button', { name: '已会，换一个' });
    await user.click(btn);
    await user.click(btn);
    release();
    await screen.findByRole('heading', { name: 'evidence' });
    expect(fetchMock.mock.calls.filter((c) => pathOf(c[0] as string) === '/vocab-v2/daily/replace')).toHaveLength(1);
  });

  it('**没词可换：原词还在，说清可以学它或稍后再学**', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = pathOf(url);
      if (path === '/vocab-v2/daily') return response(learning());
      if (path === '/vocab-v2/daily/replace') return response({ code: 'v2_replacement_exhausted', kept: true, options: ['learn', 'later'] }, 503);
      return response({}, 404);
    }));
    const user = userEvent.setup();
    mountLearn();
    await user.click(await screen.findByRole('button', { name: '已会，换一个' }));
    expect(await screen.findByText(/没有符合你难度的新词可换了。decline 还在/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'decline' })).toBeInTheDocument();
  });

  it('**稍后再学：写明不算学完、之后还会出现**；进度把学完 / 延后 / 还剩分开写', async () => {
    const after = learning('decline', { completed: 1, learned: 0, deferred: 1, pending: 11 });
    after.items[0] = { ...after.items[0], status: 'skipped', action: 'skip' };
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = pathOf(url);
      if (path === '/vocab-v2/daily') return response(learning());
      if (path === '/vocab-v2/daily/item') return response(after);
      return response({}, 404);
    }));
    const user = userEvent.setup();
    mountLearn();
    await user.click(await screen.findByRole('button', { name: '稍后再学' }));
    expect(await screen.findByText(/decline 延后了，不算学完，之后的新词里还会出现。学完 0 · 延后 1 · 还剩 11/)).toBeInTheDocument();
    expect(screen.getByTestId('learn-progress').textContent).toBe('学完 0 · 延后 1 · 还剩 11');
  });
});

describe('单词测试 · 标清楚、不泄题（IOS-07 / VOC04）', () => {
  const formal = (over: Record<string, unknown> = {}) => ({
    id: 'test-1', version: 'V2-20260901-001-test-001', date: '2026-09-01', type: 'formal_test', status: 'in_progress', total: 13, newWords: 10, reviewWords: 3, answered: 0, correct: null, retry: null,
    items: Array.from({ length: 13 }, (_, index) => ({
      id: `q-${index + 1}`, position: index + 1, status: 'pending', response: null, isCorrect: null, card: null,
      question: index === 0
        ? { type: 'spelling', prompt: '根据中文和词性，写出英文单词。', cue: { pos: 'verb', translation: '下降；减少' }, options: [] }
        : { type: 'meaning_choice', prompt: `word-${index + 1}`, cue: null, options: ['意思一', '意思二', '意思三', '意思四'] },
    })),
    ...over,
  });

  it('**页头写日期、新词几题 + 旧词抽查几题、共几题**；拼写题只给词性和中文，没有发音按钮', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => (pathOf(url).startsWith('/vocab-v2/test?sessionId=test-1') ? response(formal()) : response({}, 404))));
    mountTest('/coach/test?sessionId=test-1');
    expect(await screen.findByText('9月1日 周二 单词测试')).toBeInTheDocument();
    expect(screen.getByText('新词 10 + 旧词抽查 3 · 共 13 题')).toBeInTheDocument();
    expect(screen.getByLabelText('第 1 题，共 13 题')).toBeInTheDocument();
    expect(screen.getByText('v. 下降；减少')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /播放/ })).toBeNull();
  });

  it('**选项题写明「点选即作答，答了不能改」**', async () => {
    const s = formal();
    s.items[0] = { ...s.items[1], id: 'q-1', position: 1 };
    vi.stubGlobal('fetch', vi.fn((url: string) => (pathOf(url).startsWith('/vocab-v2/test?') ? response(s) : response({}, 404))));
    mountTest('/coach/test?sessionId=test-1');
    expect(await screen.findByText('点选即作答，答了不能改。')).toBeInTheDocument();
  });

  it('**听写题凭 sessionId + itemId 取音频，题面里没有目标词**；放不出来就说放不出来，不念答案', async () => {
    const s = formal({ type: 'custom_test' });
    s.items[0] = { ...s.items[0], question: { type: 'listening_spelling', prompt: '听发音，写出单词。', cue: { pos: 'verb', audio: 'item' }, options: [] } } as never;
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = pathOf(url);
      calls.push(path);
      if (path.startsWith('/vocab-v2/test?')) return response(s);
      if (path.startsWith('/vocab-v2/test/audio?')) return response({ code: 'v2_audio_not_available' }, 404);
      return response({}, 404);
    }));
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak });
    const user = userEvent.setup();
    mountTest('/coach/test?sessionId=test-1');
    await user.click(await screen.findByTestId('listening-play'));
    expect(await screen.findByTestId('listening-failed')).toBeInTheDocument();
    expect(calls).toContain('/vocab-v2/test/audio?sessionId=test-1&itemId=q-1');
    expect(speak).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('decline');
  });
});

describe('造句题 · 如实说怎么判（VOC11）', () => {
  const base = {
    id: 'test-3', version: 'V2-CUSTOM-3', date: '2026-09-05', type: 'custom_test', status: 'in_progress', total: 1, answered: 0, correct: null, retry: null,
    items: [{ id: 'q-1', position: 1, status: 'pending', response: null, isCorrect: null, card: null, question: { type: 'active_use', prompt: '用目标词写一个完整英文句子。', cue: { headword: 'apple', translation: '苹果' }, options: [], grading: 'target_word_only' } }],
  };
  it('作答前写明只检查有没有用上目标词；反馈照服务端的检查结果写，**永远不说「句子正确」**', async () => {
    const answered = {
      ...base, answered: 1,
      items: [{ ...base.items[0], status: 'answered', response: { value: 'apple apple apple' }, isCorrect: false, card: { ...card, headword: 'apple', translation: '苹果' }, question: { ...base.items[0].question, answer: 'apple' }, check: { targetDetected: false, sentenceQuality: 'not_evaluated', reason: 'only_target_repeated', label: '只重复了目标词，没有写成句子' } }],
    };
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = pathOf(url);
      if (path.startsWith('/vocab-v2/test?')) return response(base);
      if (path === '/vocab-v2/test/answer') return response(answered);
      return response({}, 404);
    }));
    const user = userEvent.setup();
    mountTest('/coach/test?sessionId=test-3');
    expect((await screen.findByTestId('active-use-rule')).textContent).toBe('只检查有没有用上这个词（或它的变形），不评判语法和意思。');
    await user.type(screen.getByPlaceholderText('写一个包含目标词的完整英文句子'), 'apple apple apple');
    await user.click(screen.getByRole('button', { name: '提交这题' }));
    expect((await screen.findByTestId('active-use-check')).textContent).toBe('只重复了目标词，没有写成句子');
    expect(document.body.textContent).not.toMatch(/句子正确|语法正确/);
  });
});

describe('自助抽查的生命周期（VOC10）', () => {
  const practice = {
    id: 'p-1', version: 'V2-CUSTOM-1', date: '2026-09-05', type: 'custom_test', status: 'in_progress', total: 2, answered: 1, correct: null, retry: null,
    items: [
      { id: 'q-1', position: 1, status: 'answered', response: { value: 0 }, isCorrect: true, card, question: { type: 'meaning_choice', prompt: 'decline', cue: null, options: ['下降', '属于'], answer: 0 } },
      { id: 'q-2', position: 2, status: 'pending', response: null, isCorrect: null, card: null, question: { type: 'meaning_choice', prompt: 'belong', cue: null, options: ['属于', '下降'] } },
    ],
  };

  it('**答了一半退出要确认；确认后请服务端删掉临时卷，再回我的单词**', async () => {
    const calls: Array<{ path: string; body: string | null }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      const path = pathOf(url);
      calls.push({ path, body: init?.body ? String(init.body) : null });
      if (path.startsWith('/vocab-v2/test?')) return response(practice);
      if (path === '/vocab-v2/custom-test/cancel') return response({ ok: true, cancelled: true });
      return response({}, 404);
    }));
    const user = userEvent.setup();
    mountTest('/coach/test?sessionId=p-1');
    expect(await screen.findByText('个人练习，不记正式成绩 · 共 2 题')).toBeInTheDocument();
    await user.click(screen.getByTestId('top-back'));
    expect(await screen.findByRole('dialog', { name: '退出这次抽查？' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '退出并删除' }));
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/vocab'));
    expect(calls.find((c) => c.path === '/vocab-v2/custom-test/cancel')?.body).toBe(JSON.stringify({ sessionId: 'p-1' }));
  });

  it('**过期的抽查（410）：明说过期、结果只保留 2 小时，给回我的单词的路**', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => (pathOf(url).startsWith('/vocab-v2/test?') ? response({ code: 'v2_practice_expired' }, 410) : response({}, 404))));
    mountTest('/coach/test?sessionId=p-old');
    expect(await screen.findByText('这次抽查已经过期了')).toBeInTheDocument();
    expect(screen.getByText(/结果只保留 2 小时/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '回到我的单词' })).toBeInTheDocument();
  });

  it('**答错一题 → 立刻看到正确答案，点「下一题」才继续；交卷后有逐题回顾**', async () => {
    const cardB = { ...card, headword: 'belong', translation: '属于' };
    const start = {
      id: 'test-2', version: 'V2-CUSTOM-1', date: '2026-09-05', type: 'custom_test', status: 'in_progress', total: 2, answered: 0, correct: null, retry: null,
      items: [
        { id: 'q-1', position: 1, status: 'pending', response: null, isCorrect: null, card: null, question: { type: 'spelling', prompt: '写出英文单词。', cue: { pos: 'verb', translation: '下降；减少' }, options: [] } },
        { id: 'q-2', position: 2, status: 'pending', response: null, isCorrect: null, card: null, question: { type: 'meaning_choice', prompt: 'belong', cue: null, options: ['属于', '拒绝', '下降', '增加'] } },
      ],
    };
    const afterFirst = { ...start, answered: 1, items: [{ ...start.items[0], status: 'answered', response: { value: 'decLine' }, isCorrect: false, card, question: { ...start.items[0].question, answer: 'decline' } }, start.items[1]] };
    const afterSecond = { ...afterFirst, answered: 2, items: [afterFirst.items[0], { ...start.items[1], status: 'answered', response: { value: 0 }, isCorrect: true, card: cardB, question: { ...start.items[1].question, answer: 0 } }] };
    const submitted = { ...afterSecond, status: 'submitted', correct: 1 };
    let state: unknown = start;
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const path = pathOf(url);
      if (path.startsWith('/vocab-v2/test?')) return response(state);
      if (path === '/vocab-v2/test/answer') { state = state === start ? afterFirst : afterSecond; return response(state); }
      if (path === '/vocab-v2/test/submit') { state = submitted; return response(state); }
      return response({}, 404);
    }));
    const user = userEvent.setup();
    mountTest('/coach/test?sessionId=test-2');
    await user.type(await screen.findByPlaceholderText('输入答案'), 'decLine');
    await user.click(screen.getByRole('button', { name: '提交这题' }));
    expect((await screen.findByTestId('test-feedback')).textContent).toContain('不对');
    expect(screen.getByText(/正确答案/).textContent).toContain('decline');
    await user.click(screen.getByRole('button', { name: '下一题' }));
    await user.click(await screen.findByRole('button', { name: '属于' }));
    expect((await screen.findByTestId('test-feedback')).textContent).toContain('答对了');
    await user.click(screen.getByRole('button', { name: '看回顾' }));
    await user.click(await screen.findByRole('button', { name: '看本次回顾' }));
    const review = await screen.findByTestId('test-review');
    expect(review.textContent).toContain('decline');
    expect(review.textContent).toContain('你写的：decLine');
    expect(review.textContent).toContain('belong');
    expect(screen.getByText(/个人练习，不进正式成绩/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[✓✗]/);
  });
});
