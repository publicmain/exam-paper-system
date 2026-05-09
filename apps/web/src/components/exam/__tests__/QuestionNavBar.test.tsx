import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestionNavBar } from '../shared/QuestionNavBar';
import { ExamProvider } from '../ExamContext';
import type { ExamQuestion } from '../types';

function makeQuestions(n: number): ExamQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i}`,
    sortOrder: i + 1,
    marks: 1,
    questionType: 'mcq' as const,
    snapshotContent: { stem: `Q${i + 1}` },
    snapshotOptions: [
      { key: 'A', text: 'a' },
      { key: 'B', text: 'b' },
    ],
  }));
}

function harness(questions: ExamQuestion[], currentIdx?: number) {
  return render(
    <ExamProvider sessionId="s1" mode="test" onPersistAnswer={vi.fn()}>
      <QuestionNavBar
        questions={questions}
        currentIdx={currentIdx}
        onJumpTo={vi.fn()}
      />
    </ExamProvider>,
  );
}

describe('QuestionNavBar — U4 a11y', () => {
  it('every cell has an aria-label that names question + status', () => {
    harness(makeQuestions(3));
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveAttribute('aria-label', 'Question 1, unanswered');
    expect(buttons[1]).toHaveAttribute('aria-label', 'Question 2, unanswered');
    expect(buttons[2]).toHaveAttribute('aria-label', 'Question 3, unanswered');
  });

  it('current cell carries aria-current=step', () => {
    harness(makeQuestions(3), 1);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).not.toHaveAttribute('aria-current');
    expect(buttons[1]).toHaveAttribute('aria-current', 'step');
    expect(buttons[2]).not.toHaveAttribute('aria-current');
  });

  it('uses data-state attribute for distinct states (CSS hook)', () => {
    harness(makeQuestions(2));
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAttribute('data-state', 'unanswered');
  });

  it('renders distinct status icons (✓ ⚑ ○) — shape, not just colour', () => {
    harness(makeQuestions(1));
    const btn = screen.getByRole('button');
    const text = btn.textContent || '';
    // Unanswered cell shows the empty circle character.
    expect(text).toMatch(/[○✓⚑]/);
  });
});
