import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExamProvider } from '../ExamContext';
import { OLevelMcqList } from '../questions/OLevelMcqList';
import type { ExamPaper } from '../types';

function makePaper(): ExamPaper {
  return {
    sessionId: 's-mcq',
    quizEnd: new Date(Date.now() + 600_000).toISOString(),
    level: 'olevel',
    paperMode: 'standard',
    questions: [
      {
        id: 'q1',
        sortOrder: 1,
        marks: 1,
        questionType: 'mcq',
        snapshotContent: { stem: 'Choose the correct word.', correctOption: 'B' },
        snapshotOptions: [
          { key: 'A', text: 'apple' },
          { key: 'B', text: 'banana' },
          { key: 'C', text: 'cherry' },
        ],
      },
      {
        id: 'q2',
        sortOrder: 2,
        marks: 1,
        questionType: 'mcq',
        snapshotContent: { stem: 'Question two.' },
        snapshotOptions: [
          { key: 'A', text: 'one' },
          { key: 'B', text: 'two' },
        ],
      },
    ],
  };
}

describe('OLevelMcqList', () => {
  it('renders the first question + options', () => {
    render(
      <ExamProvider sessionId="s-mcq" mode="test" onPersistAnswer={async () => {}}>
        <OLevelMcqList paper={makePaper()} />
      </ExamProvider>,
    );
    expect(screen.getByText('Choose the correct word.')).toBeInTheDocument();
    expect(screen.getByText('apple')).toBeInTheDocument();
    expect(screen.getByText('banana')).toBeInTheDocument();
  });

  it('lets the user pick an option and shows feedback in practice mode', async () => {
    const user = userEvent.setup();
    const persist = vi.fn().mockResolvedValue(undefined);
    render(
      <ExamProvider sessionId="s-mcq-p" mode="practice" onPersistAnswer={persist}>
        <OLevelMcqList paper={makePaper()} />
      </ExamProvider>,
    );
    const wrong = screen.getByLabelText(/A\./);
    await user.click(wrong);
    expect(screen.getByText(/Correct: B/)).toBeInTheDocument();
  });

  it('Next button advances to question 2', async () => {
    const user = userEvent.setup();
    render(
      <ExamProvider sessionId="s-mcq-n" mode="test" onPersistAnswer={async () => {}}>
        <OLevelMcqList paper={makePaper()} />
      </ExamProvider>,
    );
    expect(screen.queryByText('Question two.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText('Question two.')).toBeInTheDocument();
  });
});
