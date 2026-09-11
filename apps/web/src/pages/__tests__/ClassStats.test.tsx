import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ClassStatsPage from '../ClassStats';
import { api } from '../../lib/api';

/**
 * 审计 T02 前端部分 + IOS-10（班级统计页）：
 *   - 后端 classOverview 已经按学生实际分配的那一份算应交/缺交、"仅已批"
 *     均分不再混入未发布答卷（见 apps/api/src/analytics/analytics.service.ts
 *     + analytics-class-overview.spec.ts）。这个页面直接渲染后端返回的
 *     totals/perPaper，本身不做欠交口径的二次计算，所以口径修复自动生效；
 *     这里补的是把新字段（autoCollected/awaitingPublish/cancelled）在
 *     界面上说清楚，不让老师看着 0/0 的"已取消"任务误以为是异常。
 */

vi.mock('../../lib/api', () => ({
  api: {
    listClasses: vi.fn(),
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(data: any) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
}

const mockClasses = [{ id: 'c1', name: 'P1 English', classCode: 'P1' }];

function overview(overrides?: Partial<any>) {
  return {
    classId: 'c1',
    className: 'P1 English',
    classCode: 'P1',
    studentCount: 5,
    paperCount: 2,
    totals: {
      expectedSubmissions: 5,
      submitted: 3,
      marked: 2,
      inProgress: 0,
      missing: 2,
      autoCollected: 1,
      awaitingPublish: 1,
    },
    meanAutoScorePct: 60,
    meanTotalScorePct: 80,
    perPaper: [
      {
        paperId: 'p1', paperName: '卷 1', assignmentId: 'a1', date: '2026-09-10', level: 'olevel', cancelled: false,
        studentsExpected: 5, submitted: 3, marked: 2, missing: 2, inProgress: 0,
        meanAutoScore: 3, meanTotalScore: 4, maxScore: 5,
      },
      {
        paperId: 'p2', paperName: '卷 2（已取消场次）', assignmentId: 'a2', date: '2026-09-11', level: 'olevel', cancelled: true,
        studentsExpected: 0, submitted: 0, marked: 0, missing: 0, inProgress: 0,
        meanAutoScore: null, meanTotalScore: null, maxScore: 5,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (api.listClasses as any).mockResolvedValue(mockClasses);
  fetchMock.mockImplementation((url: string) => {
    const u = String(url);
    if (u.includes('/overview')) return jsonResponse(overview());
    if (u.includes('/topic-mastery')) return jsonResponse({ classId: 'c1', paperId: null, topics: [] });
    return jsonResponse({});
  });
});

async function open() {
  render(<ClassStatsPage />);
  await waitFor(() => screen.getByText('学生数'));
  await waitFor(() => expect(screen.getAllByText('卷 1').length).toBeGreaterThan(0));
}

describe('ClassStats —— 已取消的场次不催交、不当异常展示', () => {
  it('已取消且没人分配到的卷子标"已取消"，不是裸的 0/0', async () => {
    await open();
    expect(screen.getByText('已取消')).toBeTruthy();
  });
});

describe('ClassStats —— 自动收卷 / 待发布口径说清楚', () => {
  it('缺交里含自动收卷的部分，标出数量而不是混在"缺交"里让老师误判', async () => {
    await open();
    expect(screen.getByText(/自动收卷/)).toBeTruthy();
  });

  it('展示"待发布"的答卷数量（已交但还没老师确认发布）', async () => {
    await open();
    expect(screen.getAllByText('待发布').length).toBeGreaterThan(0);
  });
});
