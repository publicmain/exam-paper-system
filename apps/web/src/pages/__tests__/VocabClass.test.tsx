import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VocabClassPage from '../VocabClass';
import { api } from '../../lib/api';

/**
 * 审计 UI06（覆盖 T04/T05）—— 教师词表页：
 *   1. 五档名称必须是 ielts_simplified=O-Level 基础 / olevel_intermediate=
 *      O-Level 中级 / olevel=O-Level 标准 / ielts_light=雅思轻量 /
 *      ielts_authentic=雅思 · 真题型，顺序与学生端 levels.ts 一致（从易到难）。
 *   2. 词数规则改为后端现行的 1–20 个、不重复；不再强制"恰好 12 个"。
 *      0/21/重复要有准确提示，且不能调用发布接口；1/10/12/20 合法。
 */

vi.mock('../../lib/api', () => ({
  api: {
    listClasses: vi.fn(),
    vocabV2ClassProgress: vi.fn(),
    vocabV2Assignments: vi.fn(),
    vocabV2PublishAssignment: vi.fn(),
  },
}));

const mockClasses = [{ id: 'c1', name: 'P1 English' }];

function mockProgress(overrides?: Partial<any>) {
  return {
    date: '2026-09-11',
    totals: { students: 5, readingOverdue: 0, unfinishedWords: 0, pendingTests: 0, notebookWords: 0 },
    students: [
      mkStudent('s-simplified', 'ielts_simplified'),
      mkStudent('s-intermediate', 'olevel_intermediate'),
      mkStudent('s-olevel', 'olevel'),
      mkStudent('s-light', 'ielts_light'),
      mkStudent('s-authentic', 'ielts_authentic'),
    ],
    ...overrides,
  };
}

function mkStudent(id: string, level: string) {
  return {
    studentId: id,
    name: id,
    englishLevel: level,
    reading: { assigned: 0, completed: 0, overdue: 0, awaitingMarking: 0, today: 'none' },
    vocabulary: {
      notebookCount: 0,
      totalLearned: 0,
      masteredOrRemoved: 0,
      unfinishedWords: 0,
      completedDailySets: 0,
      pendingTests: 0,
      pendingTestWords: 0,
      todayLearning: 'none',
      todayTest: 'none',
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (api.listClasses as any).mockResolvedValue(mockClasses);
  (api.vocabV2ClassProgress as any).mockResolvedValue(mockProgress());
  (api.vocabV2Assignments as any).mockResolvedValue({ assignments: [] });
  (api.vocabV2PublishAssignment as any).mockResolvedValue({ ok: true });
});

async function open() {
  const utils = render(<VocabClassPage />);
  await waitFor(() => screen.getByText('P1 English'));
  await waitFor(() => expect(api.vocabV2ClassProgress).toHaveBeenCalled());
  return utils;
}

function getTextarea() {
  return screen.getByPlaceholderText(/不重复英文单词/) as HTMLTextAreaElement;
}

function publishButton() {
  return screen.getByRole('button', { name: /发布词表|发布中/ });
}

describe('VocabClass 五档名称（UI06 / T05）', () => {
  it('五档标签与学生端一致，且按从易到难排列', async () => {
    await open();
    // 五个正确标签都出现
    for (const label of ['O-Level 基础', 'O-Level 中级', 'O-Level 标准', '雅思轻量', '雅思 · 真题型']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // 旧的错误标签不应再出现
    expect(screen.queryByText('雅思强化')).toBeNull();
    expect(screen.queryByText('雅思入门')).toBeNull();
    expect(screen.queryByText('雅思进阶')).toBeNull();
    expect(screen.queryByText('O-Level 进阶')).toBeNull();
  });

  it('未选难度的学生显示"未选择"而不是内部枚举', async () => {
    (api.vocabV2ClassProgress as any).mockResolvedValue(
      mockProgress({ students: [mkStudent('s-none', null as any)] }),
    );
    await open();
    expect(screen.getByText('未选择')).toBeTruthy();
  });
});

describe('VocabClass 词表数量规则（UI06 / T04）：1–20 合法，0/21/重复给准确提示', () => {
  it('0 个单词：给出准确提示，不调用发布接口', async () => {
    await open();
    fireEvent.change(getTextarea(), { target: { value: '   ' } });
    fireEvent.click(publishButton());
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/至少.*1.*个/));
    expect(api.vocabV2PublishAssignment).not.toHaveBeenCalled();
  });

  it('21 个单词：给出准确提示（说明上限 20），不调用发布接口', async () => {
    await open();
    const words = Array.from({ length: 21 }, (_, i) => `word${i}`).join(' ');
    fireEvent.change(getTextarea(), { target: { value: words } });
    fireEvent.click(publishButton());
    await waitFor(() => {
      const text = screen.getByRole('status').textContent ?? '';
      expect(text).toMatch(/20/);
      expect(text).toMatch(/21/);
    });
    expect(api.vocabV2PublishAssignment).not.toHaveBeenCalled();
  });

  it('重复单词（大小写不敏感）：给出准确提示，不调用发布接口', async () => {
    await open();
    fireEvent.change(getTextarea(), { target: { value: 'apple Banana apple' } });
    fireEvent.click(publishButton());
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/重复/));
    expect(api.vocabV2PublishAssignment).not.toHaveBeenCalled();
  });

  it.each([1, 10, 12, 20])('%i 个不重复单词合法，能调用发布接口', async (n) => {
    await open();
    const words = Array.from({ length: n }, (_, i) => `word${i}`).join(', ');
    fireEvent.change(getTextarea(), { target: { value: words } });
    fireEvent.click(publishButton());
    await waitFor(() => expect(api.vocabV2PublishAssignment).toHaveBeenCalledTimes(1));
    const call = (api.vocabV2PublishAssignment as any).mock.calls[0][0];
    expect(call.words).toHaveLength(n);
  });

  it('后端拒绝 v2_assignment_words_not_publishable 时给出可读提示（含具体词）', async () => {
    (api.vocabV2PublishAssignment as any).mockRejectedValue(
      Object.assign(new Error('Bad Request'), { body: { code: 'v2_assignment_words_not_publishable', words: ['zzznotaword'] } }),
    );
    await open();
    fireEvent.change(getTextarea(), { target: { value: 'zzznotaword' } });
    fireEvent.click(publishButton());
    await waitFor(() => expect(screen.getByText(/zzznotaword/)).toBeTruthy());
  });
});

describe('VocabClass 进度口径跟上词汇后端（T01 / VOC06 / VOC08 / IOS-10）', () => {
  function withStudent(reading: Record<string, unknown>, vocabulary: Record<string, unknown>) {
    const s = mkStudent('s-1', 'olevel');
    return mockProgress({ students: [{ ...s, reading: { ...s.reading, ...reading }, vocabulary: { ...s.vocabulary, ...vocabulary } }] });
  }

  it('欠阅读能追到按日期的明细；已取消的另注「不算欠」', async () => {
    (api.vocabV2ClassProgress as any).mockResolvedValue(
      withStudent({ overdue: 2, overdueDates: ['2026-09-08', '2026-09-09'], cancelledArchived: 1 }, {}),
    );
    await open();
    expect(screen.getByText('9/8、9/9')).toBeTruthy();
    expect(screen.getByText('另有 1 份已取消（不算欠）')).toBeTruthy();
    expect(screen.getByText('欠阅读（今天以前）')).toBeTruthy();
  });

  it('全部延后的一天：今日测试写「不需要」，老师不用等一份不存在的卷子（VOC08）', async () => {
    (api.vocabV2ClassProgress as any).mockResolvedValue(
      withStudent({}, { todayLearning: 'completed', todayTest: 'not_needed', todayLearned: 0, todayDeferred: 10 }),
    );
    await open();
    expect(screen.getByText('不需要')).toBeTruthy();
    expect(screen.getByText('学完 0 · 延后 10')).toBeTruthy();
  });

  it('测试待办按题数写，卷子没生成的份数单独说（VOC06）', async () => {
    (api.vocabV2ClassProgress as any).mockResolvedValue(
      withStudent({}, { pendingTests: 2, pendingTestWords: 21, pendingTestsNotGenerated: 1, todayLearning: 'completed', todayTest: 'pending', todayTestQuestions: 13, todayLearned: 10 }),
    );
    await open();
    expect(screen.getByText(/份 \/ 21 题/)).toBeTruthy();
    expect(screen.getByText('其中 1 份卷子还没生成')).toBeTruthy();
    expect(screen.getByText('13 题')).toBeTruthy();
  });
});
