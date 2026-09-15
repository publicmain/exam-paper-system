import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LearningReportPage, { reportCsv, readingText, shiftWeek, type ReportDayCell, type ReportStudent, type WeeklyReport } from '../LearningReport';
import { api } from '../../lib/api';

/**
 * 学习周报（2026-09-15）。
 *
 * 数字都是服务端算好的，这里钉的是：摆对了没有（总数、跟进名单、逐人格子）、
 * 能不能换班 / 翻周（请求参数对不对）、点名字能看明细、导出的表能直接用、没权限时说人话。
 */

vi.mock('../../lib/api', () => ({ api: { learningReportWeek: vi.fn() } }));
const mocked = api as unknown as { learningReportWeek: ReturnType<typeof vi.fn> };

const DAYS = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'];
const DOW = ['周一', '周二', '周三', '周四', '周五'];

const cell = (date: string, over: Partial<ReportDayCell> = {}): ReportDayCell => ({
  date,
  reading: 'done',
  readPct: 80,
  awaitingMarking: false,
  title: 'The Umbrella',
  paperLevel: 'ielts_simplified',
  submittedAt: '2026-09-07T08:30:00.000Z',
  learning: 'done',
  learnItemsDone: 10,
  learnItems: 10,
  test: 'done',
  testPct: 90,
  ...over,
});
const blank = (date: string, reading: ReportDayCell['reading']): ReportDayCell =>
  cell(date, { reading, readPct: null, title: reading === 'not_assigned' || reading === 'future' ? null : 'The Umbrella', submittedAt: null, learning: 'none', learnItemsDone: 0, learnItems: 0, test: 'none', testPct: null });

const student = (id: string, name: string, className: string, days: ReportDayCell[], over: Partial<ReportStudent> = {}): ReportStudent => ({
  id,
  name,
  classId: className === 'SEC27W' ? 'c-sec' : 'c-ial',
  className,
  level: 'ielts_simplified',
  registeredOn: '2026-09-07',
  days,
  readN: 0,
  readDue: 0,
  learnN: 0,
  learnPartial: 0,
  testN: 0,
  readAvg: null,
  readMarked: 0,
  testAvg: null,
  awaitingMarking: 0,
  zeroTests: 0,
  none: false,
  readingNoWords: false,
  lowReading: false,
  steady: false,
  noLevel: false,
  ...over,
});

function fixture(over: Partial<WeeklyReport> = {}): WeeklyReport {
  const b = student('B', '乙同学', 'IAL27W', [blank(DAYS[0], 'missed'), blank(DAYS[1], 'opened'), blank(DAYS[2], 'not_assigned'), blank(DAYS[3], 'future'), blank(DAYS[4], 'future')], { readDue: 2, none: true, level: 'ielts_light' });
  const a = student('A', '甲同学', 'SEC27W', [cell(DAYS[0]), cell(DAYS[1], { readPct: 60, learning: 'partial', learnItemsDone: 3, test: 'none', testPct: null }), blank(DAYS[2], 'today'), blank(DAYS[3], 'future'), blank(DAYS[4], 'future')], { readN: 2, readDue: 2, learnN: 1, learnPartial: 1, testN: 1, readAvg: 70, testAvg: 90 });
  const c = student('C', '=丙同学', 'SEC27W', [cell(DAYS[0], { readPct: 20, learning: 'none', test: 'none', testPct: null }), cell(DAYS[1], { readPct: 10, learning: 'none', test: 'none', testPct: null, awaitingMarking: false }), blank(DAYS[2], 'not_assigned'), blank(DAYS[3], 'future'), blank(DAYS[4], 'future')], { readN: 2, readDue: 2, readAvg: 15, lowReading: true, readingNoWords: true });
  const brief = (s: ReportStudent, opened = 0) => ({ id: s.id, name: s.name, className: s.className, level: s.level, readN: s.readN, readDue: s.readDue, readAvg: s.readAvg, learnPartial: s.learnPartial, zeroTests: s.zeroTests, opened });
  return {
    weekStart: '2026-09-07',
    weekEnd: '2026-09-13',
    today: '2026-09-09',
    weekComplete: false,
    generatedAt: '2026-09-09T08:00:00.000Z',
    scope: { classId: null, className: null },
    classes: [
      { id: 'c-ial', name: 'IAL27W' },
      { id: 'c-sec', name: 'SEC27W' },
    ],
    excluded: { demoAccounts: 2, registeredAfter: 0 },
    days: DAYS.map((date, i) => ({
      date,
      dow: DOW[i],
      isToday: date === '2026-09-09',
      future: date > '2026-09-09',
      assigned: date > '2026-09-09' ? null : 3,
      readDone: date > '2026-09-09' ? null : 2,
      readAvg: date > '2026-09-09' ? null : 50,
      readMarked: 2,
      learnDone: date > '2026-09-09' ? null : 1,
      testDone: date > '2026-09-09' ? null : 1,
      testAvg: date > '2026-09-09' ? null : 90,
    })),
    totals: { students: 3, joined: 2, none: 1, steady: 0, readDone: 4, readDue: 6, readRate: 67, readAvg: 43, learnDone: 1, testDone: 1, testAvg: 90, awaitingMarking: 0 },
    byClass: [
      { classId: 'c-sec', className: 'SEC27W', students: 2, joined: 2, none: 0, readDone: 4, readDue: 4, readRate: 100, testDaysAvg: 0.5, readAvg: 43 },
      { classId: 'c-ial', className: 'IAL27W', students: 1, joined: 0, none: 1, readDone: 0, readDue: 2, readRate: 0, testDaysAvg: 0, readAvg: null },
    ],
    byLevel: [{ level: 'ielts_simplified', students: 2, due: 4, done: 4, readRate: 100, readAvg: 43, marked: 4 }],
    followUps: { none: [brief(b, 1)], lowReading: [brief(c)], readingNoWords: [brief(c)], zeroTests: [], noLevel: [] },
    students: [b, a, c],
    ...over,
  };
}

const mount = (path = '/learning-report') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LearningReportPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  mocked.learningReportWeek.mockReset();
  mocked.learningReportWeek.mockResolvedValue(fixture());
});

describe('学习周报页', () => {
  it('打开就是本周：总数、每天、跟进名单都摆出来；本周不能再往后翻', async () => {
    mount();
    await screen.findByTestId('totals');
    expect(mocked.learningReportWeek).toHaveBeenCalledWith({ weekStart: undefined, classId: undefined });
    expect(screen.getByTestId('week-label').textContent).toBe('9月7日 – 9月13日');
    const totals = screen.getByTestId('totals');
    // 67% 在「做过至少一项」和「阅读完成率」里各出现一次 —— 按卡片找
    expect(within(within(totals).getByText('阅读完成率').closest('.card') as HTMLElement).getByText('67%')).toBeInTheDocument();
    expect(within(totals).getByText('交了 4 / 应交 6')).toBeInTheDocument();
    // 周还没过完：不说「整周」
    expect(within(totals).getByText('本周到目前一项没做')).toBeInTheDocument();
    expect(within(totals).queryByText('整周没做')).toBeNull();
    expect(within(screen.getByTestId('followup-none')).getByText('乙同学')).toBeInTheDocument();
    expect(within(screen.getByTestId('followup-none')).getByText('打开过阅读 1 天')).toBeInTheDocument();
    expect(within(screen.getByTestId('followup-low')).getByText('=丙同学')).toBeInTheDocument();
    expect(screen.getByTestId('next-week')).toBeDisabled();
  });

  it('逐人格子：交了显示得分率，打开没交 / 没做 / 没分配 分开写，学了一部分词写出几个', async () => {
    mount();
    await screen.findByTestId('roster');
    const rowA = screen.getByTestId('student-A').closest('tr')!;
    expect(within(rowA).getByText('80%')).toBeInTheDocument();
    expect(within(rowA).getByText('词✓ 测90')).toBeInTheDocument();
    expect(within(rowA).getByText('词3/10')).toBeInTheDocument();
    const rowB = screen.getByTestId('student-B').closest('tr')!;
    expect(within(rowB).getByText('没做')).toBeInTheDocument();
    expect(within(rowB).getByText('没交')).toBeInTheDocument();
  });

  it('换班：带上 classId 重新读；翻到上一周：带上那周的周一', async () => {
    mount();
    await screen.findByTestId('totals');
    fireEvent.change(screen.getByTestId('class-select'), { target: { value: 'c-ial' } });
    await waitFor(() => expect(mocked.learningReportWeek).toHaveBeenLastCalledWith({ weekStart: undefined, classId: 'c-ial' }));
    fireEvent.click(screen.getByTestId('prev-week'));
    await waitFor(() => expect(mocked.learningReportWeek).toHaveBeenLastCalledWith({ weekStart: '2026-08-31', classId: 'c-ial' }));
  });

  it('网址里带着班级和周：直接打开就是那个视图（链接发给领导打开一样）', async () => {
    mount('/learning-report?classId=c-sec&week=2026-08-31');
    await waitFor(() => expect(mocked.learningReportWeek).toHaveBeenCalledWith({ weekStart: '2026-08-31', classId: 'c-sec' }));
  });

  it('点名字展开每天的明细：卷子名、交卷时间、分数、单词', async () => {
    mount();
    await screen.findByTestId('roster');
    expect(screen.queryByTestId('detail-A')).toBeNull();
    fireEvent.click(screen.getByTestId('student-A'));
    const detail = screen.getByTestId('detail-A');
    expect(detail.textContent).toContain('《The Umbrella》');
    expect(detail.textContent).toContain('得分率 80%');
    expect(detail.textContent).toContain('学了 3/10');
    // 从跟进名单点名字也会展开
    fireEvent.click(within(screen.getByTestId('followup-none')).getByText('乙同学'));
    expect(screen.getByTestId('detail-B')).toBeInTheDocument();
  });

  it('没权限看别的班：说清楚是谁能看，不甩原始报错', async () => {
    mocked.learningReportWeek.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403, body: { code: 'not_your_class' } }));
    mount('/learning-report?classId=c-other');
    expect((await screen.findByTestId('report-error')).textContent).toContain('不是你任教的班');
  });

  it('任课老师一个英语班都没有：给一句说明，不显示空表', async () => {
    mocked.learningReportWeek.mockResolvedValue(fixture({ classes: [], students: [] }));
    mount();
    expect(await screen.findByTestId('no-classes')).toBeInTheDocument();
    expect(screen.queryByTestId('roster')).toBeNull();
  });
});

describe('导出 / 小工具', () => {
  it('CSV：Excel 能直接打开（BOM），每天三列，姓名以 = 开头不会被当成公式', () => {
    const csv = reportCsv(fixture());
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toContain('周一9/7 阅读,周一 单词,周一 单词测试');
    expect(lines[0].endsWith('整周没做')).toBe(true);
    expect(lines.find((l) => l.includes('乙同学'))).toContain('没做');
    expect(lines.find((l) => l.includes('丙同学'))).toContain("'=丙同学");
    expect(lines).toHaveLength(4);
  });

  it('格子文字：待判 / 系统收卷 / 今天', () => {
    expect(readingText(cell('2026-09-07', { awaitingMarking: true, readPct: null }))).toBe('待判');
    expect(readingText(blank('2026-09-07', 'auto_closed'))).toBe('系统收卷');
    expect(readingText(blank('2026-09-09', 'today'))).toBe('今天');
  });

  it('翻周按 7 天走', () => {
    expect(shiftWeek('2026-09-07', -7)).toBe('2026-08-31');
    expect(shiftWeek('2026-09-07', 7)).toBe('2026-09-14');
  });
});
