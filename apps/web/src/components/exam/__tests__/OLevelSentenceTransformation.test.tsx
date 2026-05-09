import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExamProvider } from '../ExamContext';
import { OLevelSentenceTransformation } from '../questions/OLevelSentenceTransformation';
import type { ExamPaper } from '../types';

function makePaper(): ExamPaper {
  return {
    sessionId: 's-tr',
    quizEnd: new Date(Date.now() + 600_000).toISOString(),
    level: 'olevel',
    paperMode: 'standard',
    questions: [
      {
        id: 'q1',
        sortOrder: 1,
        marks: 2,
        questionType: 'short_answer',
        snapshotContent: {
          original: 'She did not go to the party because she was tired.',
          starter: 'Because',
          maxWords: 12,
        },
        snapshotOptions: null,
      },
    ],
  };
}

describe('OLevelSentenceTransformation', () => {
  it('renders the original sentence and starter', () => {
    render(
      <ExamProvider sessionId="s-tr" mode="test" onPersistAnswer={async () => {}}>
        <OLevelSentenceTransformation paper={makePaper()} />
      </ExamProvider>,
    );
    expect(screen.getByText(/She did not go to the party/)).toBeInTheDocument();
    expect(screen.getByText(/^Because/)).toBeInTheDocument();
  });

  it('shows live word count and over-limit warning', async () => {
    const user = userEvent.setup();
    render(
      <ExamProvider sessionId="s-tr2" mode="test" onPersistAnswer={async () => {}}>
        <OLevelSentenceTransformation paper={makePaper()} />
      </ExamProvider>,
    );
    const ta = screen.getByRole('textbox');
    await user.type(ta, 'Because she was tired she did not go to the party tonight');
    // 12 words max → "tonight" is the 12th word; over-limit only fires
    // when count > maxWords. Type one more.
    await user.type(ta, ' really');
    expect(screen.getByText(/over limit/)).toBeInTheDocument();
  });
});
