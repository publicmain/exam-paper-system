import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrintAllWordsPage, { prevTeachingDay } from '../PrintAllWords';
import { sgtToday, type ClassDayPrint } from '../PrintMaterials';
import { api } from '../../lib/api';

/**
 * 一次印全部学生的单词（2026-10-01）：不用先选班级，选一天就把所有班每人一页印出来。
 * 钉住：测试班 / 测试号不印；默认只印学完的词；词多了分页、每页都带姓名；答案按班集中在最后。
 */

vi.mock('../../lib/api', () => ({ api: { listClasses: vi.fn(), printClassDay: vi.fn() } }));
const mocked = api as unknown as { listClasses: ReturnType<typeof vi.fn>; printClassDay: ReturnType<typeof vi.fn> };

const w = (headword: string, learned = true) => ({ headword, phonetic: null, pos: null, translation: `n. ${headword}的意思, 别的意思；v. 另一个`, sentence: null, learned });

function day(classId: string, className: string, students: ClassDayPrint['students']): ClassDayPrint {
  return { classId, className, date: '2026-09-29', withAnswers: false, readings: [], students };
}

const DAYS: Record<string, ClassDayPrint> = {
  'c-sec': day('c-sec', 'SEC27W', [
    { name: '甲', level: 'olevel', levelLabel: 'O-Level 标准', words: [w('calm'), w('retain'), w('orbit', false)] },
    { name: '乙', level: 'olevel', levelLabel: 'O-Level 标准', words: [w('storm', false)] },
  ]),
  'c-ial': day('c-ial', 'IAL27M', [
    { name: '丙', level: 'ielts_authentic', levelLabel: '雅思真题', words: Array.from({ length: 35 }, (_, i) => w(`word${i + 1}`)) },
    { name: '老师测试号', level: 'olevel', levelLabel: 'O-Level 标准', words: [w('test')] },
  ]),
  'c-test': day('c-test', '【测试】作业功能测试班', [{ name: '丁', level: 'olevel', levelLabel: null, words: [w('nope')] }]),
};

beforeEach(() => {
  mocked.listClasses.mockResolvedValue([
    { id: 'c-sec', name: 'SEC27W' },
    { id: 'c-ial', name: 'IAL27M' },
    { id: 'c-test', name: '【测试】作业功能测试班' },
    { id: 'c-old', name: 'G11 旧班', archivedAt: '2026-09-01' },
  ]);
  mocked.printClassDay.mockImplementation(async (id: string) => DAYS[id]);
});
afterEach(() => vi.clearAllMocks());

function mount() {
  return render(
    <MemoryRouter>
      <PrintAllWordsPage />
    </MemoryRouter>,
  );
}

const pages = () => screen.queryAllByTestId('pw-student-page');

describe('一次印全部学生的单词', () => {
  it('不用选班级：所有真实班都取，测试班和已归档的不取', async () => {
    mount();
    await waitFor(() => expect(pages().length).toBeGreaterThan(0));
    const asked = mocked.printClassDay.mock.calls.map((c) => c[0]).sort();
    expect(asked).toEqual(['c-ial', 'c-sec']);
    expect(mocked.printClassDay.mock.calls[0][1]).toBe(sgtToday());
  });

  it('默认只印学完的词；没学完的学生列出来；测试号不印', async () => {
    mount();
    await waitFor(() => expect(pages().length).toBeGreaterThan(0));
    const names = pages().map((p) => p.getAttribute('data-student'));
    // 班按名字排：IAL27M 在 SEC27W 前面；丙 35 个词分两页
    expect(names).toEqual(['丙', '丙', '甲']);
    const jia = pages()[2];
    expect(jia.textContent).toContain('共 2 个');
    expect(jia.textContent).not.toContain('orbit');
    expect(screen.getByTestId('pw-no-words').textContent).toContain('乙（SEC27W）');
    expect(document.body.textContent).not.toContain('老师测试号 · 默写纸');

    fireEvent.click(screen.getByTestId('pw-only-learned'));
    await waitFor(() => expect(pages().map((p) => p.getAttribute('data-student'))).toEqual(['丙', '丙', '甲', '乙']));
  });

  it('词多了分页，每一页都印姓名，题号接着排；超过 15 个词行距收紧', async () => {
    mount();
    await waitFor(() => expect(pages().length).toBe(3));
    const [p1, p2] = pages();
    expect(p1.textContent).toContain('丙 · 默写纸（1/2）');
    expect(p2.textContent).toContain('丙 · 默写纸（2/2）');
    expect(p1.querySelectorAll('tbody tr')).toHaveLength(30);
    expect(p2.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(p2.querySelector('tbody tr td')?.textContent).toBe('31');
    expect(p1.className).toContain('ps-dense');
    expect(p2.className).not.toContain('ps-dense');
    // 中文提示只留第一组词性的前两个意思
    expect(p1.querySelector('tbody tr td:nth-child(2)')?.textContent).toBe('n. word1的意思，别的意思');
  });

  it('答案按班集中印在最后，不夹在学生中间', async () => {
    mount();
    await waitFor(() => expect(pages().length).toBe(3));
    fireEvent.click(screen.getByTestId('pw-answers'));
    const answers = await screen.findAllByTestId('pw-answer-page');
    expect(answers.map((a) => a.querySelector('.ps-title')?.textContent)).toEqual(['默写答案 · IAL27M', '默写答案 · SEC27W']);
    const all = Array.from(document.querySelectorAll('article.ps-paper'));
    const firstAnswer = all.findIndex((a) => a.getAttribute('data-testid') === 'pw-answer-page');
    expect(all.slice(0, firstAnswer).every((a) => a.getAttribute('data-testid') === 'pw-student-page')).toBe(true);
    expect(answers[1].textContent).toMatch(/1\.\s*calm/);
    expect(answers[1].textContent).not.toContain('orbit');
  });

  it('换成单词表：带英文，一页 12 个', async () => {
    mount();
    await waitFor(() => expect(pages().length).toBe(3));
    fireEvent.click(screen.getByTestId('pw-kind-list'));
    await waitFor(() => expect(pages().length).toBe(4));
    expect(pages()[0].textContent).toContain('丙 · 单词表（1/3）');
    expect(pages()[3].textContent).toContain('calm');
  });

  it('上一个上课日跳过周末', () => {
    expect(prevTeachingDay('2026-10-05')).toBe('2026-10-02');
    expect(prevTeachingDay('2026-09-30')).toBe('2026-09-29');
  });
});
