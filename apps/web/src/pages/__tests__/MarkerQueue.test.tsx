import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';
import MarkerQueuePage from '../MarkerQueue';
import { api } from '../../lib/api';

/**
 * 审计 M01 / M04（2026-09-11）—— 判分队列页。
 *
 * M04 原症状：页面只取第一页（服务端默认 20 份），没有翻页；前 20 份都被
 * 别人认领时，后面可认领的答卷没有入口。
 * M01 原症状：保存完最后一题的答卷从队列消失，没有「已评分待发布」入口。
 */

vi.mock('../../lib/api', () => ({
  BASE: '',
  api: {
    markerQueue: vi.fn(),
    me: vi.fn(),
    morningQuizListAppeals: vi.fn(),
    markerClaim: vi.fn(),
  },
}));

const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const ME = { id: 't-a', name: '甲老师', role: 'teacher' };

function item(n: number, extra: Record<string, any> = {}) {
  return {
    id: `sub-${n}`,
    status: 'submitted',
    stage: 'awaiting',
    autoScore: 1,
    maxScore: 5,
    submittedAt: '2026-09-10T01:00:00.000Z',
    finalSubmittedAt: '2026-09-10T01:00:00.000Z',
    student: { id: `stu-${n}`, name: `学生${n}` },
    assignment: { paper: { id: 'p1', name: '阅读卷' }, class: { id: 'c1', name: 'P1', classCode: 'P1' } },
    structuredCount: 2,
    ungradedCount: 2,
    markerGradedCount: 0,
    claim: null,
    ...extra,
  };
}

function page(items: any[], opts: { total: number; page: number; pageCount: number; stage?: string; counts?: any }) {
  return {
    total: opts.total,
    page: opts.page,
    pageSize: 20,
    pageCount: opts.pageCount,
    stage: opts.stage ?? 'awaiting',
    stageCounts: opts.counts ?? { awaiting: opts.total, in_progress: 0, ready: 0 },
    items,
  };
}

function ScriptStub() {
  const { submissionId } = useParams();
  return <div>SCRIPT PAGE {submissionId}</div>;
}

function renderQueue(url = '/marker') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/marker" element={<MarkerQueuePage />} />
        <Route path="/marker/submission/:submissionId" element={<ScriptStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** 45 份待批，每页 20：按 page 参数切片。 */
function serve45(counts = { awaiting: 45, in_progress: 0, ready: 0 }) {
  const all = Array.from({ length: 45 }, (_, i) => item(i + 1));
  m.markerQueue.mockImplementation(async (params: any = {}) => {
    const p = params.page ?? 1;
    return page(all.slice((p - 1) * 20, p * 20), { total: 45, page: p, pageCount: 3, stage: params.stage, counts });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.me.mockResolvedValue(ME);
  m.morningQuizListAppeals.mockResolvedValue({ items: [] });
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('M04 —— 翻页、总数、阶段分栏', () => {
  it('默认进「待批」栏，按阶段 + 第 1 页请求；分栏按钮显示各阶段数量', async () => {
    serve45({ awaiting: 25, in_progress: 20, ready: 1 });
    renderQueue();
    await waitFor(() => expect(m.markerQueue).toHaveBeenCalledWith({ stage: 'awaiting', page: 1, pageSize: 20 }));
    expect(await screen.findByRole('button', { name: /待批\s*25/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /批改中\s*20/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /已评分待发布\s*1/ })).toBeInTheDocument();
  });

  it('45 份三页：下一页 / 上一页，页码与总数正确，末页「下一页」不可用', async () => {
    serve45();
    renderQueue();
    await screen.findByText('学生1');
    expect(screen.getByText(/第 1 \/ 3 页/)).toBeInTheDocument();
    expect(screen.getByText(/共 45 份/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    await screen.findByText('学生21');
    expect(m.markerQueue).toHaveBeenLastCalledWith({ stage: 'awaiting', page: 2, pageSize: 20 });
    expect(screen.getByText(/第 2 \/ 3 页/)).toBeInTheDocument();
    expect(screen.queryByText('学生1')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    await screen.findByText('学生45');
    expect(screen.getAllByRole('row').length - 1).toBe(5);
    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '上一页' }));
    await screen.findByText('学生21');
  });

  it('阶段与页码写在网址里：带 ?stage=ready&page=2 打开（刷新 / 重登）回到同一栏同一页', async () => {
    serve45();
    renderQueue('/marker?stage=ready&page=2');
    await waitFor(() => expect(m.markerQueue).toHaveBeenCalledWith({ stage: 'ready', page: 2, pageSize: 20 }));
  });

  it('发布后最后一页空了：自动回到最后一页有内容的那页', async () => {
    const all = Array.from({ length: 40 }, (_, i) => item(i + 1));
    m.markerQueue.mockImplementation(async (params: any = {}) => {
      const p = params.page ?? 1;
      return page(all.slice((p - 1) * 20, p * 20), { total: 40, page: p, pageCount: 2 });
    });
    renderQueue('/marker?page=3');
    await screen.findByText('学生21');
    expect(m.markerQueue).toHaveBeenLastCalledWith({ stage: 'awaiting', page: 2, pageSize: 20 });
    expect(screen.getByText(/第 2 \/ 2 页/)).toBeInTheDocument();
  });

  it('前 20 份被别人认领：待批栏第一页就是后面可认领的卷，认领成功直接进判分页', async () => {
    const unclaimed = Array.from({ length: 25 }, (_, i) => item(i + 21));
    m.markerQueue.mockImplementation(async (params: any = {}) =>
      params.stage === 'awaiting'
        ? page(unclaimed.slice(0, 20), { total: 25, page: 1, pageCount: 2, counts: { awaiting: 25, in_progress: 20, ready: 0 } })
        : page([], { total: 0, page: 1, pageCount: 1 }),
    );
    m.markerClaim.mockResolvedValue({ status: 'active', markerId: ME.id });
    renderQueue();
    const row = (await screen.findByText('学生21')).closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: '认领' }));
    await waitFor(() => expect(m.markerClaim).toHaveBeenCalledWith('sub-21'));
    expect(await screen.findByText('SCRIPT PAGE sub-21')).toBeInTheDocument();
  });

  it('认领冲突：错误写在页面里（不是 alert），并刷新列表', async () => {
    serve45();
    m.markerClaim.mockRejectedValue(Object.assign(new Error('submission already claimed by marker t-b'), { status: 409 }));
    renderQueue();
    const row = (await screen.findByText('学生1')).closest('tr') as HTMLElement;
    const before = m.markerQueue.mock.calls.length;
    fireEvent.click(within(row).getByRole('button', { name: '认领' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/认领失败.*其他老师/);
    await waitFor(() => expect(m.markerQueue.mock.calls.length).toBeGreaterThan(before));
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('切换分栏时丢弃过期响应：慢的旧请求回来也不会覆盖新选择', async () => {
    let resolveAwaiting!: (v: any) => void;
    m.markerQueue.mockImplementation((params: any = {}) => {
      if (params.stage === 'awaiting') return new Promise((r) => { resolveAwaiting = r; });
      return Promise.resolve(
        page([item(99, { stage: 'ready', ungradedCount: 0, markerGradedCount: 2, claim: { status: 'active', markerId: ME.id, marker: ME } })], {
          total: 1, page: 1, pageCount: 1, stage: 'ready', counts: { awaiting: 5, in_progress: 0, ready: 1 },
        }),
      );
    });
    renderQueue();
    await waitFor(() => expect(m.markerQueue).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /已评分待发布/ }));
    await screen.findByText('学生99');
    await act(async () => {
      resolveAwaiting(page([item(1)], { total: 1, page: 1, pageCount: 1 }));
    });
    expect(screen.getByText('学生99')).toBeInTheDocument();
    expect(screen.queryByText('学生1')).toBeNull();
  });
});

describe('M01 —— 「已评分待发布」栏是找回发布的入口', () => {
  it('自己保存完最后一题的卷显示「去发布」；自动判完没人认领的显示「认领并发布」', async () => {
    m.markerQueue.mockImplementation(async (params: any = {}) =>
      params.stage === 'ready'
        ? page(
            [
              item(1, { stage: 'ready', ungradedCount: 0, markerGradedCount: 2, claim: { status: 'active', markerId: ME.id, marker: ME } }),
              item(2, { stage: 'ready', ungradedCount: 0, markerGradedCount: 0, claim: null }),
            ],
            { total: 2, page: 1, pageCount: 1, stage: 'ready', counts: { awaiting: 0, in_progress: 0, ready: 2 } },
          )
        : page([], { total: 0, page: 1, pageCount: 1, counts: { awaiting: 0, in_progress: 0, ready: 2 } }),
    );
    m.markerClaim.mockResolvedValue({ status: 'active' });
    renderQueue();
    fireEvent.click(await screen.findByRole('button', { name: /已评分待发布\s*2/ }));
    const mine = (await screen.findByText('学生1')).closest('tr') as HTMLElement;
    expect(within(mine).getByRole('link', { name: '去发布' })).toHaveAttribute('href', '/marker/submission/sub-1');
    expect(within(mine).getByText('你已评完')).toBeInTheDocument();
    const auto = screen.getByText('学生2').closest('tr') as HTMLElement;
    expect(within(auto).getByText('自动判分')).toBeInTheDocument();
    fireEvent.click(within(auto).getByRole('button', { name: '认领并发布' }));
    expect(await screen.findByText('SCRIPT PAGE sub-2')).toBeInTheDocument();
  });

  it('别人认领的卷不给必然失败的认领按钮，只显示认领人并可查看', async () => {
    m.markerQueue.mockImplementation(async (params: any = {}) =>
      page(
        [item(3, { stage: 'in_progress', claim: { status: 'active', markerId: 't-b', marker: { id: 't-b', name: '乙老师' } } })],
        { total: 1, page: 1, pageCount: 1, stage: params.stage, counts: { awaiting: 0, in_progress: 1, ready: 0 } },
      ),
    );
    renderQueue('/marker?stage=in_progress');
    const row = (await screen.findByText('学生3')).closest('tr') as HTMLElement;
    expect(within(row).queryByRole('button', { name: /认领/ })).toBeNull();
    expect(within(row).getByText(/乙老师/)).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: '查看' })).toHaveAttribute('href', '/marker/submission/sub-3');
  });
});
