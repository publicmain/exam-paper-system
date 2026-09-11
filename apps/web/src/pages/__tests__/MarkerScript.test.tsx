import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MarkerScriptPage from '../MarkerScript';
import { api } from '../../lib/api';

/**
 * 审计 M01 / M02 / M03（2026-09-11）—— 逐题判分页。
 *
 * M02 原症状：保存一题后整页重新 load，编辑缓冲按服务端重建 —— 另一题
 * 已经填好但没保存的分数和评语被清空；保存期间继续输入的内容也会被
 * 覆盖；发布按钮只看库里的分数，有未保存修改时照样能发布旧分数。
 * M03 原症状：客观题（MCQ）也有「得分」输入框和保存按钮，但正式服务
 * 对 MCQ 一律 400 —— 一个永远保存不了的假功能。
 * M01（前端）：保存完最后一题后页面要明确进入「已评分待发布」并给出发布入口。
 *
 * 查询方式刻意同时兼容改造前后的页面结构（按「Q2.」所在卡片取输入框），
 * 这样同一组用例能在旧代码上复现原症状（红），修复后变绿。
 */

vi.mock('../../lib/api', () => ({
  api: {
    markerSubmission: vi.fn(),
    markerScoreScript: vi.fn(),
    markerFinalize: vi.fn(),
    markerClaim: vi.fn(),
    markerRelease: vi.fn(),
    paperRetractQuestion: vi.fn(),
  },
}));

const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function fixture(opts: { sa1?: number | null; sa2?: number | null; status?: string; myClaim?: boolean } = {}) {
  const sa1 = opts.sa1 === undefined ? null : opts.sa1;
  const sa2 = opts.sa2 === undefined ? null : opts.sa2;
  return {
    id: 'sub-1',
    status: opts.status ?? 'submitted',
    autoScore: 1,
    manualScore: null,
    totalScore: 1,
    maxScore: 5,
    myClaim: opts.myClaim ?? true,
    claim: { status: 'active', markerId: 't-a', marker: { id: 't-a', name: '甲老师' } },
    student: { id: 's1', name: '学生甲', email: 's1@x' },
    assignment: {
      class: { id: 'c1', name: 'P1', classCode: 'P1' },
      paper: {
        id: 'p1',
        name: '阅读卷',
        questions: [
          { id: 'pq-mcq', marks: 1, question: { questionType: 'mcq', assets: [] }, snapshotContent: { stem: '选择题' }, snapshotOptions: [{ key: 'A', text: 'yes', correct: true }, { key: 'B', text: 'no' }] },
          { id: 'pq-sa1', marks: 2, question: { questionType: 'short_answer', assets: [] }, snapshotContent: { stem: '第一道简答' }, snapshotAnswer: { text: 'boiled' } },
          { id: 'pq-sa2', marks: 2, question: { questionType: 'short_answer', assets: [] }, snapshotContent: { stem: '第二道简答' }, snapshotAnswer: { text: 'glass' } },
        ],
      },
    },
    scripts: [
      { id: 'sc-mcq', paperQuestionId: 'pq-mcq', selectedOption: 'A', autoCorrect: true, awardedMarks: 1, markerComment: null, markedById: null, paperQuestion: { question: { questionType: 'mcq' } } },
      { id: 'sc-sa1', paperQuestionId: 'pq-sa1', textAnswer: 'boiled water', awardedMarks: sa1, markerComment: null, markedById: sa1 == null ? null : 't-a', paperQuestion: { question: { questionType: 'short_answer' } } },
      { id: 'sc-sa2', paperQuestionId: 'pq-sa2', textAnswer: 'glass case', awardedMarks: sa2, markerComment: null, markedById: sa2 == null ? null : 't-a', paperQuestion: { question: { questionType: 'short_answer' } } },
    ],
  };
}

/** 服务端「库」：scoreScript 写这里，markerSubmission 从这里读 —— 旧页面保存后全量 reload 读到的就是它。 */
let server: ReturnType<typeof fixture>;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/marker/submission/sub-1']}>
      <Routes>
        <Route path="/marker/submission/:submissionId" element={<MarkerScriptPage />} />
        <Route path="/marker" element={<div>QUEUE PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const card = (n: number) => screen.getByText(`Q${n}.`).closest('.card') as HTMLElement;
const marksInput = (n: number) => within(card(n)).getByRole('spinbutton') as HTMLInputElement;
const commentInput = (n: number) => within(card(n)).getByPlaceholderText(/评语/) as HTMLTextAreaElement;
const saveBtn = (n: number) => within(card(n)).getByRole('button', { name: /保存得分/ });
const publishBtn = () => screen.getByRole('button', { name: /完成判分|发布成绩/ });

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  server = fixture();
  m.markerSubmission.mockImplementation(async () => JSON.parse(JSON.stringify(server)));
  m.markerScoreScript.mockImplementation(async (scriptId: string, body: any) => {
    const s = server.scripts.find((x) => x.id === scriptId)!;
    Object.assign(s, { awardedMarks: body.awardedMarks, markerComment: body.markerComment ?? null, markedById: 't-a' });
    return { ...s };
  });
  m.markerFinalize.mockImplementation(async () => {
    server.status = 'marked';
    return { ...server, status: 'marked', autoScore: 1, manualScore: 3, totalScore: 4 };
  });
  // 旧页面用 alert / confirm —— jsdom 未实现，这里吞掉以便旧代码能跑到出症状的那一步
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('M02 —— 保存一题不能清掉其他题未保存的输入', () => {
  it('第二题填了 2 分和评语，保存第一题后第二题内容完整；不整页重载', async () => {
    renderPage();
    await waitFor(() => card(3));

    fireEvent.change(marksInput(3), { target: { value: '2' } });
    fireEvent.change(commentInput(3), { target: { value: '答到了 glass 两点' } });
    fireEvent.change(marksInput(2), { target: { value: '1' } });
    fireEvent.click(saveBtn(2));

    await waitFor(() => expect(m.markerScoreScript).toHaveBeenCalledWith('sc-sa1', { awardedMarks: 1, markerComment: null }));
    // 让保存后的一切（旧页面在这里会整页 reload）跑完
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(marksInput(3).value).toBe('2');
    expect(commentInput(3).value).toBe('答到了 glass 两点');
    await waitFor(() => expect(within(card(2)).getByText('已保存')).toBeInTheDocument());
    expect(within(card(3)).getByText('未保存')).toBeInTheDocument();
    // 只在进页面时拉过一次，保存后没有全量 reload
    expect(m.markerSubmission).toHaveBeenCalledTimes(1);
  });

  it('慢网：保存请求还没回来时继续输入，回来后新输入不丢，且仍标为未保存', async () => {
    const pending = deferred<any>();
    m.markerScoreScript.mockImplementationOnce(() => pending.promise);
    renderPage();
    await waitFor(() => card(2));

    fireEvent.change(marksInput(2), { target: { value: '1' } });
    fireEvent.click(saveBtn(2));
    await waitFor(() => expect(within(card(2)).getByText('保存中…')).toBeInTheDocument());
    // 保存中继续打字（本题评语 + 另一题分数）
    fireEvent.change(commentInput(2), { target: { value: '只答到一点' } });
    fireEvent.change(marksInput(3), { target: { value: '2' } });

    await act(async () => {
      pending.resolve({ id: 'sc-sa1', awardedMarks: 1, markerComment: null, markedById: 't-a' });
    });
    expect(commentInput(2).value).toBe('只答到一点');
    expect(marksInput(2).value).toBe('1');
    expect(marksInput(3).value).toBe('2');
    expect(within(card(2)).getByText('未保存')).toBeInTheDocument();
  });

  it('保存失败：输入保留、错误显示在这一题里，点重试可以恢复', async () => {
    m.markerScoreScript.mockRejectedValueOnce(new Error('网络断开'));
    renderPage();
    await waitFor(() => card(2));
    fireEvent.change(marksInput(2), { target: { value: '2' } });
    fireEvent.change(commentInput(2), { target: { value: '完整' } });
    fireEvent.click(saveBtn(2));

    const alertBox = await within(card(2)).findByRole('alert');
    expect(alertBox).toHaveTextContent(/保存失败/);
    expect(alertBox).toHaveTextContent(/网络断开/);
    expect(marksInput(2).value).toBe('2');
    expect(commentInput(2).value).toBe('完整');

    fireEvent.click(within(card(2)).getByRole('button', { name: /重试保存/ }));
    await waitFor(() => expect(within(card(2)).getByText('已保存')).toBeInTheDocument());
    expect(server.scripts[1]).toMatchObject({ awardedMarks: 2, markerComment: '完整' });
  });

  it('分数越界在本题提示，不发请求', async () => {
    renderPage();
    await waitFor(() => card(2));
    fireEvent.change(marksInput(2), { target: { value: '3' } });
    fireEvent.click(saveBtn(2));
    expect(await within(card(2)).findByRole('alert')).toHaveTextContent('0–2');
    expect(m.markerScoreScript).not.toHaveBeenCalled();
  });
});

describe('M02 —— 有未保存 / 保存中的修改时不能静默发布旧分数', () => {
  it('库里两题都已有分，但本地改了一题：发布被挡住并说明原因；保存全部后才能发布，且只调一次', async () => {
    server = fixture({ sa1: 2, sa2: 1 });
    renderPage();
    await waitFor(() => card(2));
    expect(publishBtn()).toBeEnabled();

    fireEvent.change(marksInput(3), { target: { value: '2' } });
    expect(publishBtn()).toBeDisabled();
    expect(screen.getByText(/1 题未保存/)).toBeInTheDocument();
    expect(m.markerFinalize).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /保存全部/ }));
    await waitFor(() => expect(m.markerScoreScript).toHaveBeenCalledWith('sc-sa2', { awardedMarks: 2, markerComment: null }));
    await waitFor(() => expect(publishBtn()).toBeEnabled());

    fireEvent.click(publishBtn());
    const dialog = await screen.findByRole('dialog', { name: /发布成绩/ });
    fireEvent.click(within(dialog).getByRole('button', { name: '确认发布' }));
    await waitFor(() => expect(m.markerFinalize).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getAllByText('已发布').length).toBeGreaterThan(0));
    expect(m.markerFinalize).toHaveBeenCalledTimes(1);
  });

  it('保存进行中发布按钮不可用', async () => {
    server = fixture({ sa1: 2, sa2: null });
    const pending = deferred<any>();
    m.markerScoreScript.mockImplementationOnce(() => pending.promise);
    renderPage();
    await waitFor(() => card(3));
    fireEvent.change(marksInput(3), { target: { value: '1' } });
    fireEvent.click(saveBtn(3));
    await waitFor(() => expect(within(card(3)).getByText('保存中…')).toBeInTheDocument());
    expect(publishBtn()).toBeDisabled();
    await act(async () => {
      pending.resolve({ id: 'sc-sa2', awardedMarks: 1, markerComment: null, markedById: 't-a' });
    });
    await waitFor(() => expect(publishBtn()).toBeEnabled());
  });

  it('有未保存修改时离开页面（刷新 / 关闭）会被浏览器拦下提示', async () => {
    renderPage();
    await waitFor(() => card(2));
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    fireEvent.change(marksInput(2), { target: { value: '1' } });
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it('站内离开：点「返回判分队列」时弹出选择，可以留下或保存全部后离开', async () => {
    renderPage();
    await waitFor(() => card(2));
    fireEvent.change(marksInput(2), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('link', { name: /返回判分队列/ }));
    const dialog = await screen.findByRole('dialog', { name: /未保存/ });
    fireEvent.click(within(dialog).getByRole('button', { name: '留在本页' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(marksInput(2).value).toBe('1');

    fireEvent.click(screen.getByRole('link', { name: /返回判分队列/ }));
    const again = await screen.findByRole('dialog', { name: /未保存/ });
    fireEvent.click(within(again).getByRole('button', { name: '保存全部后离开' }));
    await waitFor(() => expect(screen.getByText('QUEUE PAGE')).toBeInTheDocument());
    expect(m.markerScoreScript).toHaveBeenCalledWith('sc-sa1', { awardedMarks: 1, markerComment: null });
  });

  it('未保存的输入写进本标签页草稿，刷新后恢复并提示', async () => {
    const first = renderPage();
    await waitFor(() => card(2));
    fireEvent.change(marksInput(2), { target: { value: '1.5' } });
    fireEvent.change(commentInput(2), { target: { value: '部分正确' } });
    first.unmount();

    renderPage();
    await waitFor(() => card(2));
    expect(marksInput(2).value).toBe('1.5');
    expect(commentInput(2).value).toBe('部分正确');
    expect(screen.getByText(/恢复了 1 题上次没保存的修改/)).toBeInTheDocument();
    expect(within(card(2)).getByText('未保存')).toBeInTheDocument();
  });
});

describe('M03 —— 客观题不提供必被后端拒绝的改分控件', () => {
  it('MCQ 只读显示自动分，没有输入框、没有保存按钮', async () => {
    renderPage();
    await waitFor(() => card(1));
    expect(within(card(1)).queryByRole('spinbutton')).toBeNull();
    expect(within(card(1)).queryByRole('button', { name: /保存得分/ })).toBeNull();
    expect(within(card(1)).getByText(/客观题自动判分/)).toBeInTheDocument();
    expect(within(card(1)).getByText(/1 \/ 1 分/)).toBeInTheDocument();
  });
});

describe('M01（前端）—— 保存完最后一题就进入「已评分待发布」', () => {
  it('最后一题保存成功后，不用刷新就显示阶段并可以发布；发布对话框焦点受控', async () => {
    server = fixture({ sa1: 2, sa2: null });
    renderPage();
    await waitFor(() => card(3));
    expect(screen.getAllByText('批改中').length).toBeGreaterThan(0);
    expect(publishBtn()).toBeDisabled();

    fireEvent.change(marksInput(3), { target: { value: '1' } });
    fireEvent.click(saveBtn(3));
    await waitFor(() => expect(screen.getAllByText('已评分待发布').length).toBeGreaterThan(0));
    expect(publishBtn()).toBeEnabled();

    const trigger = publishBtn();
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: /发布成绩/ });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(m.markerFinalize).not.toHaveBeenCalled();
  });
});
