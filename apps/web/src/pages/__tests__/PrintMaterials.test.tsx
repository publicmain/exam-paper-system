import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrintMaterialsPage, { sgtToday, type ClassDayPrint } from '../PrintMaterials';
import { api } from '../../lib/api';

/**
 * 打印材料（2026-09-22）：老师选班级和日期，印阅读（每档一份，可附答案）或每个学生自己的
 * 单词表 / 默写纸（每人一页）。数据是服务端排好的，这里钉：请求参数、摆对没有、答案开关。
 */

vi.mock('../../lib/api', () => ({ api: { listClasses: vi.fn(), printClassDay: vi.fn() } }));
const mocked = api as unknown as { listClasses: ReturnType<typeof vi.fn>; printClassDay: ReturnType<typeof vi.fn> };

const reading = (title: string, answer: string | null) => ({
  title,
  paragraphs: [{ label: 'Paragraph 1', text: `${title} text.` }],
  groups: [
    {
      taskType: 'multiple_choice',
      title: 'Multiple Choice',
      instruction: 'Choose the correct letter.',
      bank: null,
      bankLabel: null,
      questions: [{ no: 1, item: 'Why?', options: [{ key: 'A', text: 'Because' }, { key: 'B', text: 'No' }], lines: 0, marks: 1, answer }],
    },
  ],
  questionCount: 1,
  totalMarks: 1,
});

function day(withAnswers: boolean): ClassDayPrint {
  return {
    classId: 'c-sec',
    className: 'SEC27W',
    date: '2026-09-22',
    withAnswers,
    readings: [
      { sessionId: 's1', date: '2026-09-22', level: 'olevel', levelLabel: 'O-Level 标准', reading: reading('The Armband', withAnswers ? 'A  Because' : null) },
      { sessionId: 's2', date: '2026-09-22', level: 'ielts_simplified', levelLabel: 'O-Level 基础', reading: reading('The Early Alarm', withAnswers ? 'B  No' : null) },
    ],
    students: [
      { name: '小呆呆', level: 'olevel', levelLabel: 'O-Level 标准', words: [{ headword: 'beauty', phonetic: null, pos: 'noun', translation: 'n. 美', sentence: null }] },
      { name: '曹展嘉', level: 'olevel', levelLabel: 'O-Level 标准', words: [{ headword: 'install', phonetic: null, pos: 'verb', translation: 'vt. 安装', sentence: null }] },
      { name: '新同学', level: null, levelLabel: null, words: [] },
    ],
  };
}

beforeEach(() => {
  mocked.listClasses.mockReset().mockResolvedValue([
    { id: 'c-sec', name: 'SEC27W' },
    { id: 'c-old', name: 'OLD', archivedAt: '2026-01-01T00:00:00Z' },
    { id: 'c-ial', name: 'IAL28S' },
  ]);
  mocked.printClassDay.mockReset().mockImplementation(async (_c: string, _d: string, answers: boolean) => day(answers));
});

const renderPage = () => render(<MemoryRouter><PrintMaterialsPage /></MemoryRouter>);

describe('打印材料', () => {
  it('**默认第一个班、今天；请求带班级 / 日期 / 不要答案；已归档的班不出现**', async () => {
    renderPage();
    await waitFor(() => expect(mocked.printClassDay).toHaveBeenCalledWith('c-sec', sgtToday(), false));
    const options = within(screen.getByTestId('print-class')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['SEC27W', 'IAL28S']);
  });

  it('**阅读：每个档位一份；可以只印其中一档**', async () => {
    renderPage();
    expect(await screen.findAllByTestId('print-reading')).toHaveLength(2);
    expect(screen.getByText('O-Level 标准 · 9月22日 周二 · SEC27W')).toBeTruthy();
    fireEvent.change(screen.getByTestId('print-level'), { target: { value: 'ielts_simplified' } });
    const sheets = screen.getAllByTestId('print-reading');
    expect(sheets).toHaveLength(1);
    expect(within(sheets[0]).getByRole('heading', { name: 'The Early Alarm' })).toBeTruthy();
  });

  it('**勾「附答案页」：重新取带答案的数据，每份阅读后面跟一页答案**', async () => {
    renderPage();
    await screen.findAllByTestId('print-reading');
    expect(screen.queryByTestId('print-answer-key')).toBeNull();
    fireEvent.click(screen.getByTestId('print-answers'));
    await waitFor(() => expect(mocked.printClassDay).toHaveBeenLastCalledWith('c-sec', sgtToday(), true));
    const keys = await screen.findAllByTestId('print-answer-key');
    expect(keys).toHaveLength(2);
    expect(keys[0].textContent).toContain('A  Because');
  });

  it('**默写纸：每个学生一页，印他自己的词；没有单词任务的学生不印、列出来**', async () => {
    renderPage();
    await screen.findAllByTestId('print-reading');
    fireEvent.click(screen.getByTestId('print-kind-dictation'));
    const sheets = screen.getAllByTestId('print-dictation');
    expect(sheets).toHaveLength(2);
    expect(within(sheets[0]).getByRole('heading', { name: '小呆呆 · 默写纸' })).toBeTruthy();
    expect(within(sheets[0]).getByText('n. 美')).toBeTruthy();
    expect(within(sheets[0]).queryByText('beauty')).toBeNull();
    expect(screen.getByTestId('print-no-words').textContent).toContain('新同学');
  });

  it('单词表：英文和中文都在', async () => {
    renderPage();
    await screen.findAllByTestId('print-reading');
    fireEvent.click(screen.getByTestId('print-kind-list'));
    const sheets = screen.getAllByTestId('print-wordlist');
    expect(within(sheets[1]).getByText('install')).toBeTruthy();
    expect(within(sheets[1]).getByText('vt. 安装')).toBeTruthy();
  });

  it('换班 / 换日期：重新取', async () => {
    renderPage();
    await screen.findAllByTestId('print-reading');
    fireEvent.change(screen.getByTestId('print-class'), { target: { value: 'c-ial' } });
    await waitFor(() => expect(mocked.printClassDay).toHaveBeenLastCalledWith('c-ial', sgtToday(), false));
    fireEvent.change(screen.getByTestId('print-date'), { target: { value: '2026-09-18' } });
    await waitFor(() => expect(mocked.printClassDay).toHaveBeenLastCalledWith('c-ial', '2026-09-18', false));
  });

  it('这天没有阅读：说清楚，打印按钮不能点', async () => {
    mocked.printClassDay.mockResolvedValue({ ...day(false), readings: [] });
    renderPage();
    expect(await screen.findByTestId('print-no-reading')).toBeTruthy();
    expect((screen.getByTestId('print-now') as HTMLButtonElement).disabled).toBe(true);
  });

  it('不是任课老师（403）：说人话', async () => {
    mocked.printClassDay.mockRejectedValue(Object.assign(new Error('forbidden'), { status: 403 }));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', '你不是这个班的任课老师，看不到这个班的材料。');
  });

  it('点「打印 / 存 PDF」调起系统打印', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderPage();
    await screen.findAllByTestId('print-reading');
    fireEvent.click(screen.getByTestId('print-now'));
    expect(print).toHaveBeenCalledTimes(1);
  });
});
