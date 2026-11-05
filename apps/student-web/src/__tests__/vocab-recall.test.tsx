import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import VocabularyCoachLearnPage from '../pages/VocabularyCoachLearn';
import { writeToken } from '../lib/identity';
import type { V2LearningSession, V2RecallResult } from '../lib/api';

const card = { headword: 'decline', phonetic: null, pos: 'verb', senseKey: 'verb:01', translation: '下降；减少',
  definition: 'to become smaller', sentence: 'Sales decline.', sentenceTranslation: '销量下降。',
  collocations: [], wordFamily: [], confusionWords: [], memoryHint: null, imageUrl: null, audioText: 'decline', list: 'ngsl', rank: 1, attribution: 'test' };
function learning(enabled = true): V2LearningSession {
  return { id: 'daily', version: 'v1', date: '2026-11-05', type: 'daily_learning', mode: 'level_gap',
    status: 'in_progress', target: 2, cursor: 0, completed: 0, learned: 0, pending: 2, deferred: 0,
    sourceSummary: {}, settings: { audioAccent: 'en-GB' }, deferredUntil: null, capabilities: { recallStep: enabled },
    items: ['decline', 'care'].map((headword, i) => ({ id: `item-${i}`, senseId: `sense-${i}`, position: i + 1,
      source: 'level_gap', masteryBefore: 1, status: 'pending', action: null,
      recall: { available: enabled, started: false, state: null }, card: { ...card, headword, audioText: headword } })) };
}
function outcome(attempt: number, correct = false): V2RecallResult {
  return { enabled: true, attempt, wrongAttempts: correct ? attempt - 1 : attempt, isCorrect: correct,
    firstWrongIndex: correct ? null : 0, expectedLength: 7,
    hintLevel: attempt >= 4 ? 7 : correct ? attempt - 1 : attempt,
    nextPrefix: 'decline'.slice(0, Math.min(correct ? attempt - 1 : attempt, 3)),
    answerRevealed: attempt >= 4, correctSpelling: attempt >= 4 ? 'decline' : null };
}
function reply(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, text: async () => JSON.stringify(body) } as Response);
}
function setup(session = learning(), overrides: { recall?: (body: any) => Promise<Response>; action?: () => Promise<Response> } = {}) {
  const requests: Array<{ path: string; body: any }> = [];
  const after = learning(session.capabilities?.recallStep);
  after.items[0].status = 'completed'; after.items[0].action = 'normal';
  after.learned = 1; after.completed = 1; after.pending = 1;
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    const path = url.replace(/^.*\/api/, '');
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({ path, body });
    if (path === '/vocab-v2/daily') return reply(session);
    if (path === '/vocab-v2/daily/recall') return overrides.recall?.(body) ?? reply(outcome(body.attempt, body.typed.trim().toLowerCase() === 'decline'));
    if (path === '/vocab-v2/daily/item') return overrides.action?.() ?? reply(after);
    if (path === '/vocab-v2/daily/replace') return reply({ ...learning(), replacement: { oldHeadword: 'decline', newHeadword: 'care' } });
    return reply({}, 404);
  }));
  render(<MemoryRouter><VocabularyCoachLearnPage /></MemoryRouter>);
  return requests;
}
async function enterRecall() {
  await userEvent.click(await screen.findByRole('button', { name: '看完了，拼一拼' }));
  return screen.getByRole('textbox', { name: '拼写' });
}
beforeEach(() => { localStorage.clear(); writeToken('test-token'); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('词卡后的遮词拼写', () => {
  it('正常拼对后才提交学完，使用同一学词任务；答案不在遮词画面或发音标签里', async () => {
    const requests = setup();
    const input = await enterRecall();
    expect(screen.queryByText('Sales decline.')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'decline' })).toBeNull();
    expect(screen.getByRole('button', { name: '听发音' })).toBeInTheDocument();
    expect(document.querySelector('[aria-label*="decline"]')).toBeNull();
    expect(requests.filter((r) => r.path.endsWith('/item'))).toHaveLength(0);
    await userEvent.type(input, 'DECLINE');
    await userEvent.click(screen.getByRole('button', { name: '检查拼写' }));
    expect(await screen.findByRole('heading', { name: 'care' })).toBeInTheDocument();
    expect(requests.filter((r) => r.path.endsWith('/recall'))[0].body).toEqual({
      sessionId: 'daily', itemId: 'item-0', expectedSenseId: 'sense-0', typed: 'DECLINE', hintLevel: 0, attempt: 1,
    });
    expect(requests.filter((r) => r.path.endsWith('/item'))[0].body).toMatchObject({ sessionId: 'daily', itemId: 'item-0', action: 'normal' });
  });
  it('计数和进度把词卡、拼写各算一步', async () => {
    setup();
    expect(await screen.findByText('1 / 4 步')).toBeInTheDocument();
    await enterRecall();
    expect(screen.getByText('2 / 4 步')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '4');
    expect(screen.getByTestId('learn-progress')).toHaveTextContent('拼一拼');
  });
  it('错一次后标第一个错位、露前缀，再答带提示级别和下一序号', async () => {
    const requests = setup();
    const input = await enterRecall();
    await userEvent.type(input, 'wrong');
    await userEvent.click(screen.getByRole('button', { name: '检查拼写' }));
    expect(await screen.findByText('第 1 个字母不对，已帮你露出开头，再试一次。')).toBeInTheDocument();
    expect(screen.getByTestId('recall-slots').firstChild).toHaveTextContent('d');
    expect(screen.getByTestId('recall-slots').firstChild).toHaveAttribute('data-wrong', 'true');
    await userEvent.type(input, 'decline');
    await userEvent.click(screen.getByRole('button', { name: '检查拼写' }));
    await screen.findByRole('heading', { name: 'care' });
    expect(requests.filter((r) => r.path.endsWith('/recall'))[1].body).toMatchObject({ attempt: 2, hintLevel: 1 });
  });
  it('第四次错误后显示答案，必须照打正确才能继续', async () => {
    const requests = setup();
    const input = await enterRecall();
    for (let i = 0; i < 4; i++) {
      await userEvent.type(input, 'wrong');
      await userEvent.click(screen.getByRole('button', { name: '检查拼写' }));
    }
    expect(await screen.findByText('看着答案，再打一遍。')).toBeInTheDocument();
    expect(screen.getByTestId('recall-answer')).toHaveTextContent('decline');
    expect(requests.filter((r) => r.path.endsWith('/item'))).toHaveLength(0);
    await userEvent.type(input, 'declin');
    await userEvent.click(screen.getByRole('button', { name: '检查拼写' }));
    expect(requests.filter((r) => r.path.endsWith('/item'))).toHaveLength(0);
    await userEvent.type(input, 'decline');
    await userEvent.click(screen.getByRole('button', { name: '检查拼写' }));
    await screen.findByRole('heading', { name: 'care' });
    expect(requests.filter((r) => r.path.endsWith('/recall')).map((r) => r.body.attempt)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('输入框关闭 iPad 自动纠错、大写、补全和拼写检查', async () => {
    setup();
    const input = await enterRecall();
    for (const attr of ['autocapitalize', 'autocorrect', 'autocomplete']) expect(input).toHaveAttribute(attr, 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
    expect(input).toHaveAttribute('enterkeyhint', 'done');
  });
  it('组合输入期间 Enter、表单提交和点击都不判；结束组合也不会自动判', async () => {
    const requests = setup();
    const input = await enterRecall();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'decline' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 });
    fireEvent.submit(input.closest('form')!);
    fireEvent.click(screen.getByRole('button', { name: '检查拼写' }));
    expect(requests.filter((r) => r.path.endsWith('/recall'))).toHaveLength(0);
    fireEvent.compositionEnd(input);
    expect(requests.filter((r) => r.path.endsWith('/recall'))).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: '检查拼写' }));
    await screen.findByRole('heading', { name: 'care' });
  });
  it('键盘可视区域改变时把格子、输入框和按钮一起滚入视野', async () => {
    const viewport = new EventTarget();
    vi.stubGlobal('visualViewport', viewport);
    const scroll = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      setup();
      const input = await enterRecall();
      fireEvent.focus(input); input.focus(); scroll.mockClear();
      viewport.dispatchEvent(new Event('resize'));
      expect(scroll).toHaveBeenCalledWith({ block: 'center' });
    } finally { HTMLElement.prototype.scrollIntoView = original; }
  });
  it('已会换词、稍后再学都不进入拼写', async () => {
    const requests = setup();
    await userEvent.click(await screen.findByRole('button', { name: '已会，换一个' }));
    expect(screen.queryByTestId('recall-spelling')).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: '稍后再学' }));
    expect(screen.queryByTestId('recall-spelling')).toBeNull();
    expect(requests.filter((r) => r.path.endsWith('/recall'))).toHaveLength(0);
  });
  it.each(['off', 'missing', 'unreliable'])('%s 时不出现空拼写步骤', async (mode) => {
    const session = learning(mode !== 'off');
    if (mode === 'missing') delete session.capabilities;
    if (mode === 'unreliable') { session.items[0].card.headword = ''; session.items[0].recall!.available = false; }
    const requests = setup(session);
    await userEvent.click(await screen.findByRole('button', { name: '学完这个词' }));
    await screen.findByRole('heading', { name: 'care' });
    expect(requests.filter((r) => r.path.endsWith('/recall'))).toHaveLength(0);
    expect(screen.queryByTestId('recall-spelling')).toBeNull();
  });
  it('答案是否正确只听服务端，前端即使看起来拼对也不能自行放行', async () => {
    const requests = setup(learning(), { recall: async () => reply(outcome(1, false)) });
    await userEvent.type(await enterRecall(), 'decline');
    await userEvent.click(screen.getByRole('button', { name: '检查拼写' }));
    await screen.findByText('第 1 个字母不对，已帮你露出开头，再试一次。');
    expect(requests.filter((r) => r.path.endsWith('/item'))).toHaveLength(0);
  });
  it('重复点击只发一次；响应丢失时原序号与原答案重发', async () => {
    let release!: () => void;
    const gate = new Promise<void>((ok) => { release = ok; });
    let count = 0;
    const requests = setup(learning(), { recall: async () => {
      if (++count === 1) { await gate; throw new Error('lost response'); }
      return reply(outcome(1, true));
    } });
    const input = await enterRecall();
    await userEvent.type(input, 'decline');
    const button = screen.getByRole('button', { name: '检查拼写' });
    fireEvent.click(button); fireEvent.click(button);
    expect(requests.filter((r) => r.path.endsWith('/recall'))).toHaveLength(1);
    release();
    await screen.findByText('没连上，请再试一次。');
    expect(input).toHaveAttribute('readonly');
    await userEvent.click(screen.getByRole('button', { name: '再试一次' }));
    await screen.findByRole('heading', { name: 'care' });
    const submissions = requests.filter((r) => r.path.endsWith('/recall'));
    expect(submissions[0].body).toEqual(submissions[1].body);
  });
  it('刷新后恢复提示与下一序号', async () => {
    const session = learning(); session.items[0].recall = { available: true, started: true, state: outcome(2) };
    const requests = setup(session);
    const input = await screen.findByRole('textbox', { name: '拼写' });
    expect(screen.getByTestId('recall-slots')).toHaveTextContent('de');
    await userEvent.type(input, 'decline');
    await userEvent.click(screen.getByRole('button', { name: '检查拼写' }));
    await screen.findByRole('heading', { name: 'care' });
    expect(requests.find((r) => r.path.endsWith('/recall'))?.body).toMatchObject({ attempt: 3, hintLevel: 2 });
  });
  it('卡已被另一页换过时刷新任务，不困在原答案重发中', async () => {
    const session = learning();
    const requests = setup(session, { recall: async () => {
      session.items[0].card.headword = 'changed'; session.items[0].senseId = 'changed-sense';
      return reply({ code: 'v2_item_changed' }, 409);
    } });
    await userEvent.type(await enterRecall(), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: '检查拼写' }));
    expect(await screen.findByRole('heading', { name: 'changed' })).toBeInTheDocument();
    expect(requests.filter((r) => r.path === '/vocab-v2/daily')).toHaveLength(2);
  });
  it('刷新恢复已拼对状态时只需继续保存学完，不重复写拼写', async () => {
    const session = learning(); session.items[0].recall = { available: true, started: true, state: outcome(1, true) };
    const requests = setup(session);
    await userEvent.click(await screen.findByRole('button', { name: '继续' }));
    await screen.findByRole('heading', { name: 'care' });
    expect(requests.filter((r) => r.path.endsWith('/recall'))).toHaveLength(0);
  });
  it('拼对后学习动作保存失败，可重试继续，不再提交一遍拼写', async () => {
    let count = 0;
    const session = learning();
    const after = learning(); after.items[0].status = 'completed';
    const requests = setup(session, { action: async () => ++count === 1 ? reply({}, 500) : reply(after) });
    await userEvent.type(await enterRecall(), 'decline');
    await userEvent.click(screen.getByRole('button', { name: '检查拼写' }));
    await screen.findByText('进度没有保存，这个词还在。再试一次。');
    await userEvent.click(screen.getByRole('button', { name: '继续' }));
    await screen.findByRole('heading', { name: 'care' });
    expect(requests.filter((r) => r.path.endsWith('/recall'))).toHaveLength(1);
  });
  it('练习过程中关闭开关时，服务端停用响应让学生正常继续', async () => {
    const requests = setup(learning(), { recall: async () => reply({ enabled: false }) });
    await userEvent.type(await enterRecall(), 'anything');
    await userEvent.click(screen.getByRole('button', { name: '检查拼写' }));
    await screen.findByRole('heading', { name: 'care' });
    expect(requests.filter((r) => r.path.endsWith('/item'))).toHaveLength(1);
  });
});
