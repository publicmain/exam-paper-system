import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExamProvider, useExam } from '../ExamContext';

function Probe() {
  const { mode, fontScale, setFontScale, isFlagged, toggleFlag, flaggedCount, setAnswer, answers } =
    useExam();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="font">{fontScale}</span>
      <span data-testid="flag-count">{flaggedCount}</span>
      <span data-testid="flagged-q1">{String(isFlagged('q1'))}</span>
      <span data-testid="answer-q1">{answers['q1']?.selectedOption ?? ''}</span>
      <button onClick={() => setFontScale(1.2)}>up</button>
      <button onClick={() => toggleFlag('q1')}>flag</button>
      <button onClick={() => setAnswer('q1', { selectedOption: 'A' })}>answer</button>
    </div>
  );
}

describe('ExamProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exposes mode and updates font scale', async () => {
    const user = userEvent.setup();
    render(
      <ExamProvider sessionId="s1" mode="practice" onPersistAnswer={async () => {}}>
        <Probe />
      </ExamProvider>,
    );
    expect(screen.getByTestId('mode').textContent).toBe('practice');
    expect(screen.getByTestId('font').textContent).toBe('1');
    await user.click(screen.getByText('up'));
    expect(screen.getByTestId('font').textContent).toBe('1.2');
    expect(localStorage.getItem('mq:fontScale')).toBe('1.2');
  });

  it('toggles flagged questions and persists', async () => {
    const user = userEvent.setup();
    render(
      <ExamProvider sessionId="s2" mode="test" onPersistAnswer={async () => {}}>
        <Probe />
      </ExamProvider>,
    );
    expect(screen.getByTestId('flagged-q1').textContent).toBe('false');
    await user.click(screen.getByText('flag'));
    expect(screen.getByTestId('flagged-q1').textContent).toBe('true');
    expect(screen.getByTestId('flag-count').textContent).toBe('1');
    expect(JSON.parse(localStorage.getItem('mq:flags:s2')!)).toEqual(['q1']);
  });

  it('caches answers locally and debounce-fires server save', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ExamProvider sessionId="s3" mode="test" onPersistAnswer={persist}>
        <Probe />
      </ExamProvider>,
    );
    await user.click(screen.getByText('answer'));
    expect(screen.getByTestId('answer-q1').textContent).toBe('A');
    expect(JSON.parse(localStorage.getItem('mq:answers:s3')!).q1.selectedOption).toBe('A');
    // Debounce is 600ms; allow the timer to fire.
    await waitFor(() => expect(persist).toHaveBeenCalledOnce(), { timeout: 2000 });
    expect(persist).toHaveBeenCalledWith('q1', { selectedOption: 'A', textAnswer: null });
  });

  it('hydrates from localStorage on mount', () => {
    localStorage.setItem('mq:answers:s4', JSON.stringify({ q1: { selectedOption: 'B' } }));
    render(
      <ExamProvider sessionId="s4" mode="test" onPersistAnswer={async () => {}}>
        <Probe />
      </ExamProvider>,
    );
    expect(screen.getByTestId('answer-q1').textContent).toBe('B');
  });

  // R15-followup-12 — when a different student previously took this same
  // session on this device, their answer draft sits in localStorage
  // under the legacy unscoped key OR a different-submission scoped key.
  // The new student MUST NOT see those answers — both keys get wiped at
  // mount, and the take page hydrates clean.
  it('does NOT hydrate a previous student\'s draft when submissionId is set', () => {
    // Previous student left a draft under the legacy unscoped key
    localStorage.setItem(
      'mq:answers:shared-session',
      JSON.stringify({ q1: { selectedOption: 'STALE' } }),
    );
    // And another previous student left one under a different scoped key
    localStorage.setItem(
      'mq:answers:shared-session:sub-previous',
      JSON.stringify({ q1: { selectedOption: 'ALSO-STALE' } }),
    );
    render(
      <ExamProvider
        sessionId="shared-session"
        submissionId="sub-current"
        mode="test"
        onPersistAnswer={async () => {}}
      >
        <Probe />
      </ExamProvider>,
    );
    // Fresh state — no draft from either previous student bleeds through
    expect(screen.getByTestId('answer-q1').textContent).toBe('');
    // Both stale keys removed
    expect(localStorage.getItem('mq:answers:shared-session')).toBe(null);
    expect(localStorage.getItem('mq:answers:shared-session:sub-previous')).toBe(null);
  });

  it('preserves own-submission draft across remounts (page refresh mid-quiz)', () => {
    localStorage.setItem(
      'mq:answers:s5:sub-me',
      JSON.stringify({ q1: { selectedOption: 'KEEPME' } }),
    );
    render(
      <ExamProvider
        sessionId="s5"
        submissionId="sub-me"
        mode="test"
        onPersistAnswer={async () => {}}
      >
        <Probe />
      </ExamProvider>,
    );
    expect(screen.getByTestId('answer-q1').textContent).toBe('KEEPME');
  });
});
