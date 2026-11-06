import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CommonMisspellings, WeekWordsSheet, WordsSheet } from '../../print/PrintSheets';
import PrintAllWords, { buildSheets } from '../PrintAllWords';
import PrintMaterials from '../PrintMaterials';
import { api } from '../../lib/api';
vi.mock('../../lib/api', () => ({ api: { listClasses: vi.fn(), printClassDay: vi.fn(), printClassWeek: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const word = { senseId: 'sense', headword: 'receive', phonetic: null, pos: null, translation: '收到', sentence: null, learned: true,
  commonMisspellings: [{ spelling: 'recieve', count: 3 }, { spelling: 'receve', count: 2 }] };
const props = { title: '默写纸', meta: '演示班', mode: 'dictation' as const, showAnswers: true };
describe('默写答案常错拼法开关', () => {
  it('日版和周版只在答案页显示错拼与次数；关闭后不显示', () => {
    const page = render(<WordsSheet {...props} words={[word]} />);
    expect(screen.getByTestId('print-dictation-answers')).toHaveTextContent('recieve，3 次；receve，2 次');
    expect(screen.getByTestId('print-dictation')).not.toHaveTextContent('recieve');
    page.rerender(<WordsSheet {...props} words={[word]} showMisspellings={false} />);
    expect(screen.queryByText(/recieve/)).toBeNull();
    page.rerender(<WeekWordsSheet {...props} days={[{ date: '2026-11-04', label: '周三', words: [word] }]} />);
    expect(screen.getByTestId('print-week-dictation-answers')).toHaveTextContent('recieve，3 次');
    page.rerender(<WeekWordsSheet {...props} showMisspellings={false} days={[{ date: '2026-11-04', label: '周三', words: [word] }]} />);
    expect(screen.queryByText(/recieve/)).toBeNull();
  });
  it('批量打印开关默认开，仅答案出现拼法，关闭后隐藏', async () => {
    vi.mocked(api.listClasses).mockResolvedValue([{ id: 'class', name: '演示班' }]);
    vi.mocked(api.printClassDay).mockResolvedValue({ classId: 'class', className: '演示班', readings: [], students: [{ name: '演示学生', words: [word] }] });
    render(<MemoryRouter><PrintAllWords /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByTestId('pw-student-page')).toHaveLength(1));
    expect(screen.getByLabelText('标出班里常见的错拼')).toBeChecked();
    expect(screen.queryByText(/recieve/)).toBeNull();
    fireEvent.click(screen.getByTestId('pw-answers'));
    expect(screen.getByTestId('pw-answer-page')).toHaveTextContent('recieve，3 次');
    fireEvent.click(screen.getByLabelText('标出班里常见的错拼'));
    expect(screen.getByTestId('pw-answer-page')).not.toHaveTextContent('recieve');
  });
  it('打印材料有回填入口；默认只印学完的词；错拼开关控制答案页', async () => {
    vi.mocked(api.listClasses).mockResolvedValue([{ id: 'class', name: '演示班' }]);
    vi.mocked(api.printClassDay).mockResolvedValue({ classId: 'class', className: '演示班', date: '2026-11-04', readings: [], students: [{ name: '演示学生', words: [word, { ...word, senseId: 'pending', headword: 'pendingword', learned: false }] }] });
    render(<MemoryRouter><PrintMaterials /></MemoryRouter>);
    await screen.findByRole('link', { name: '早读默写回填' });
    expect(screen.getByRole('link', { name: '早读默写回填' })).toHaveAttribute('href', expect.stringMatching(/^\/classes\/class\/dictation\?learnedDate=\d{4}-\d{2}-\d{2}$/));
    fireEvent.click(screen.getByTestId('print-kind-dictation'));
    expect(screen.getByLabelText('只印学完的词')).toBeChecked();
    expect(screen.getByLabelText('标出班里常见的错拼')).toBeChecked();
    fireEvent.click(screen.getByTestId('print-answers'));
    expect(await screen.findByTestId('print-dictation-answers')).toHaveTextContent('recieve，3 次');
    expect(screen.getByTestId('print-dictation-answers')).not.toHaveTextContent('pendingword');
    fireEvent.click(screen.getByLabelText('标出班里常见的错拼'));
    expect(screen.getByTestId('print-dictation-answers')).not.toHaveTextContent('recieve');
  });
  it('没有统计数据时不展示空提示', () => {
    const view = render(<CommonMisspellings word={{ ...word, commonMisspellings: [] }} />);
    expect(view.container.textContent).toBe('');
  });
  it('批量默写按已生成的冻结清单；单词表可继续打印后来学的词', () => {
    const loaded = [{ classId: 'class', className: '演示班', forbidden: false, data: {
      classId: 'class', className: '演示班', date: '2026-11-04', readings: [], withAnswers: false,
      students: [{ name: '演示学生', level: null, levelLabel: null, dictationSenseIds: ['sense'], words: [word, { ...word, senseId: 'later', headword: 'later' }] }],
    } }];
    expect(buildSheets(loaded, true).sheets[0].words.map((w) => w.headword)).toEqual(['receive']);
    expect(buildSheets(loaded, false).sheets[0].words.map((w) => w.headword)).toEqual(['receive']);
    expect(buildSheets(loaded, true, false).sheets[0].words.map((w) => w.headword)).toEqual(['receive', 'later']);
  });
  it('单班默写按冻结范围；切回单词表仍显示完整词表', async () => {
    vi.mocked(api.listClasses).mockResolvedValue([{ id: 'class', name: '演示班' }]);
    vi.mocked(api.printClassDay).mockResolvedValue({ classId: 'class', className: '演示班', date: '2026-11-04', readings: [],
      students: [{ name: '演示学生', dictationSenseIds: ['sense'], words: [word, { ...word, senseId: 'later', headword: 'later' }] }] });
    render(<MemoryRouter><PrintMaterials /></MemoryRouter>);
    await screen.findByRole('link', { name: '早读默写回填' });
    fireEvent.click(screen.getByTestId('print-kind-dictation'));
    fireEvent.click(screen.getByTestId('print-answers'));
    expect(await screen.findByTestId('print-dictation-answers')).toHaveTextContent('receive');
    expect(screen.getByTestId('print-dictation-answers')).not.toHaveTextContent('later');
    fireEvent.click(screen.getByTestId('print-kind-list'));
    expect(screen.getByText('later')).toBeInTheDocument();
  });
});
