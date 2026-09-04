import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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

const learning = (headword = 'decline') => ({
  id: 'daily-1', version: 'V2-20260901-001', date: '2026-09-01', type: 'daily_learning', mode: 'teacher_list',
  status: 'in_progress', target: 12, cursor: 0, completed: 0, sourceSummary: { teacher_list: 12 }, settings: { audioAccent: 'en-GB' }, deferredUntil: null,
  items: Array.from({ length: 12 }, (_, index) => ({
    id: `item-${index + 1}`, position: index + 1, source: 'teacher_list', masteryBefore: 1,
    status: index === 0 ? 'pending' : 'queued', card: { ...card, headword: index === 0 ? headword : `word-${index + 1}`, audioText: index === 0 ? headword : `word-${index + 1}` },
  })),
});

function response(body: unknown, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, text: () => Promise.resolve(JSON.stringify(body)) } as Response);
}

function pathOf(url: string) {
  return url.replace(/^.*\/api/, '');
}

beforeEach(() => {
  localStorage.clear();
  writeToken(TOKEN);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('个人词汇教练 V2 学习流', () => {
  it('当天还没有任务时，空响应会自动创建任务而不是白屏', async () => {
    const fetchMock = vi.fn((url: string) => {
      const path = pathOf(url);
      if (path === '/vocab-v2/daily') {
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') } as Response);
      }
      if (path === '/vocab-v2/daily/start') return response(learning());
      return response({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><VocabularyCoachLearnPage /></MemoryRouter>);

    expect(await screen.findByText('Sales may decline when customers lose confidence.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('周末打开学习页：说清楚没有任务，而不是报「无法生成」', async () => {
    const fetchMock = vi.fn((url: string) => {
      const path = pathOf(url);
      if (path === '/vocab-v2/daily') {
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') } as Response);
      }
      if (path === '/vocab-v2/daily/start') return response({ code: 'v2_no_task_on_weekend' }, 400);
      return response({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><VocabularyCoachLearnPage /></MemoryRouter>);

    expect(await screen.findByText(/周六周日没有新词任务/)).toBeInTheDocument();
    expect(screen.queryByText(/无法生成/)).toBeNull();
  });

  it('从欠交入口进入时，读取并创建指定日期的同一份任务', async () => {
    const fetchMock = vi.fn((url: string) => {
      const path = pathOf(url);
      if (path === '/vocab-v2/daily?date=2026-09-01') return response(learning());
      return response({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <MemoryRouter initialEntries={['/coach/learn?date=2026-09-01']}>
        <VocabularyCoachLearnPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('9月1日新词补做')).toBeInTheDocument();
    expect(screen.getByText('Sales may decline when customers lose confidence.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('每个词只显示一个完整学习页面，不增加第二步或混入考题', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => pathOf(url) === '/vocab-v2/daily' ? response(learning()) : response({}, 404)));
    render(<MemoryRouter><VocabularyCoachLearnPage /></MemoryRouter>);

    expect(await screen.findByText('Sales may decline when customers lose confidence.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '查看用法' })).not.toBeInTheDocument();
    expect(screen.getByText('decline sharply')).toBeInTheDocument();
    expect(screen.getByText('de- 向下 + cline- 倾斜')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '学完这个词' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/第 1 阶段|主动回忆|补全短句|核对答案/);
  });

  it('扩展内容为空时直接隐藏栏目，不显示无信息占位卡片', async () => {
    const sparse = learning('belong');
    sparse.items[0].card = { ...sparse.items[0].card, collocations: [], wordFamily: [], confusionWords: [], memoryHint: '' };
    vi.stubGlobal('fetch', vi.fn((url: string) => pathOf(url) === '/vocab-v2/daily' ? response(sparse) : response({}, 404)));
    render(<MemoryRouter><VocabularyCoachLearnPage /></MemoryRouter>);

    expect(await screen.findByText('belong')).toBeInTheDocument();
    expect(screen.queryByText('这一项暂时没有可靠内容')).not.toBeInTheDocument();
    expect(screen.queryByText('常见搭配')).not.toBeInTheDocument();
    expect(screen.queryByText('词族')).not.toBeInTheDocument();
    expect(screen.queryByText('易混词')).not.toBeInTheDocument();
    expect(screen.queryByText('记忆提示')).not.toBeInTheDocument();
  });

  it('会的词一对一替换，冻结任务仍保持 12 项', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      const path = pathOf(url);
      if (path === '/vocab-v2/daily') return response(learning());
      if (path === '/vocab-v2/daily/replace') {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ sessionId: 'daily-1', itemId: 'item-1' });
        return response({ ...learning('evidence'), replacement: { position: 1, oldHeadword: 'decline', newHeadword: 'evidence' } });
      }
      return response({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<MemoryRouter><VocabularyCoachLearnPage /></MemoryRouter>);

    await screen.findByRole('button', { name: '这个词我会了，换一个' });
    await user.click(screen.getByRole('button', { name: '这个词我会了，换一个' }));
    expect(await screen.findByText(/换成“evidence”/)).toBeInTheDocument();
    expect(screen.getByText('1 / 12')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('个人词汇教练 V2 正式测试', () => {
  it('恢复同一份 12 题冻结测试，客户端拿不到答案字段', async () => {
    const session = {
      id: 'test-1', version: 'V2-20260901-001-test-001', date: '2026-09-01', type: 'formal_test', status: 'in_progress', total: 12, answered: 0, correct: null, retry: null,
      items: Array.from({ length: 12 }, (_, index) => ({
        id: `q-${index + 1}`, position: index + 1, status: 'pending', response: null, isCorrect: null, card: null,
        question: index === 0
          ? { type: 'spelling', prompt: '根据中文、词性或发音，写出英文单词。', cue: { pos: 'verb', translation: '下降；减少', audioText: 'decline' }, options: [] }
          : { type: 'meaning_choice', prompt: `word-${index + 1}`, cue: null, options: ['意思一', '意思二', '意思三', '意思四'] },
      })),
    };
    const fetchMock = vi.fn((url: string) => pathOf(url).startsWith('/vocab-v2/test?sessionId=test-1') ? response(session) : response({}, 404));
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter initialEntries={['/coach/test?sessionId=test-1']}><VocabularyCoachTestPage /></MemoryRouter>);

    expect(await screen.findByText('9月1日单词测试')).toBeInTheDocument();
    expect(screen.getByText('1 / 12')).toBeInTheDocument();
    expect(screen.getByText('verb. 下降；减少')).toBeInTheDocument();
    const wireBody = await (await fetchMock.mock.results[0].value).clone?.().text?.();
    expect(JSON.stringify(session)).not.toContain('"answer"');
    expect(wireBody ?? '').not.toContain('"answer"');
  });
});
