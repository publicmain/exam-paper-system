import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResultView } from '../components/ResultView';
import VocabularyCoachTest from '../pages/VocabularyCoachTest';
import { writeToken } from '../lib/identity';
import type { ReadingResult, ReadingResultItem } from '../lib/api';

beforeEach(() => { writeToken('test'); });
const passage = 'Tea is made with boiled water. The garden has a row of hedges.';
function question(over: Partial<ReadingResultItem> = {}): ReadingResultItem {
  return { paperQuestionId: 'q1', sortOrder: 1, questionType: 'mcq', marks: 1, awardedMarks: 1, isCorrect: true, gradingStatus: 'auto_graded', studentAnswer: 'A',
    snapshotContent: { stem: 'How is tea made?', passage }, snapshotOptions: [], correctAnswer: 'A', evidence: 'Tea is made with boiled water.', ...over } as ReadingResultItem;
}
function reading(items = [question()], over: Partial<ReadingResult> = {}) {
  return render(<ResultView result={{ paperName: 'Reading', items, status: 'submitted', scoresPending: false, answersPending: false, ...over } as ReadingResult} submissionId="sub" onAuthLost={() => {}} />);
}
describe('阅读交卷后的原文定位与答案门', () => {
  it('点一下展开原文并高亮完整原句；重复点击仍只高亮一处', () => {
    reading();
    fireEvent.click(screen.getByTestId('passage-toggle'));
    const button = screen.getByRole('button', { name: '答案在原文哪里' });
    fireEvent.click(button);
    expect(screen.getByTestId('answer-highlight')).toHaveTextContent('Tea is made with boiled water.');
    fireEvent.click(button);
    expect(screen.getAllByTestId('answer-highlight')).toHaveLength(1);
  });
  it('无依据时可以用唯一的参考答案定位', () => {
    reading([question({ evidence: null, questionType: 'short_answer', gradingStatus: 'marked', correctAnswer: null, referenceAnswer: 'a row of hedges' })]);
    fireEvent.click(screen.getByRole('button', { name: '答案在原文哪里' }));
    expect(screen.getByTestId('answer-highlight')).toHaveTextContent('The garden has a row of hedges.');
  });
  it.each(['Tea is made with boiled water. Tea is made with boiled water.', 'No such sentence.'])('找不到或重复时不给按钮：%s', (body) => {
    reading([question({ snapshotContent: { passage: body } })]);
    expect(screen.queryByRole('button', { name: '答案在原文哪里' })).toBeNull();
  });
  it('不同篇目的题不指向当前原文', () => {
    reading([question(), question({ paperQuestionId: 'q2', snapshotContent: { passage: 'A different article.' } })]);
    expect(within(screen.getByTestId('item-q2')).queryByRole('button', { name: '答案在原文哪里' })).toBeNull();
  });
  // 08-14 叶老师定：交卷即可见参考答案，主观题待批也照样给；只有服务端说 answersPending 才藏。
  it.each([true, false])('答案门只听服务端：answersPending=%s', (answersPending) => {
    reading([question({ explanation: '客观题解析' }), question({ paperQuestionId: 'q2', questionType: 'short_answer', gradingStatus: 'pending_marking', awardedMarks: null,
      correctAnswer: 'SECRET', referenceAnswer: 'SECRET-REF', explanation: 'SECRET-EXPLANATION', evidence: 'SECRET-EVIDENCE' })], { answersPending, scoresPending: true });
    expect(document.body.textContent?.includes('SECRET')).toBe(!answersPending);
    expect(screen.queryByText('客观题解析') != null).toBe(!answersPending);
    expect(within(screen.getByTestId('item-q2')).queryByRole('button', { name: '答案在原文哪里' })).toBeNull();
  });
});

describe('词测逐题原答回顾', () => {
  it('对错题都显示答案；只给正式错题再考说明；单独显示旧词正确数', async () => {
    const data = { id: 't', type: 'formal_test', date: '2026-11-05', status: 'submitted', total: 2, correct: 1, reviewWords: 1, reviewCorrect: 0, items: [
      { id: 'q1', position: 1, status: 'answered', response: { value: 'aple' }, isCorrect: false, card: { headword: 'apple', pos: 'noun', translation: '苹果' }, question: { type: 'spelling', options: [], answer: 'apple' } },
      { id: 'q2', position: 2, status: 'answered', response: { value: 0 }, isCorrect: true, card: { headword: 'tree', pos: 'noun', translation: '树' }, question: { type: 'meaning_choice', options: ['树', '苹果'], answer: 0 } },
    ] };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify(data) })));
    render(<MemoryRouter initialEntries={['/coach/test?sessionId=t']}><VocabularyCoachTest /></MemoryRouter>);
    expect(await screen.findByTestId('test-result-summary')).toHaveTextContent('本次对 1 / 共 2，其中复习旧词 1 个，对了 0 个。');
    const rows = within(screen.getByTestId('test-review')).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('你写的：aple · 正确答案：apple');
    expect(rows[1]).toHaveTextContent('你写的：树 · 正确答案：树');
    expect(screen.getAllByText('之后的单词测试里会再考')).toHaveLength(1);
  });
});
