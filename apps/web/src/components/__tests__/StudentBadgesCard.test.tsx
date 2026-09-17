import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StudentBadgesCard from '../StudentBadgesCard';
import { api } from '../../lib/api';
vi.mock('../../lib/api', () => ({ api: { teachingStudentBadges: vi.fn(), teachingRevokeBadge: vi.fn(), teachingRestoreBadge: vi.fn() } }));
const m = vi.mocked(api);
const badge = { key: 'v5_reading_1', title: '阅读探索者 · 启程', description: '完成15篇', threshold: 15, unit: '篇', current: 15, earned: true, saved: true, earnedOn: '2026-09-17', grantedAt: '2026-09-17T00:00:00Z', revoked: null, evidence: { dates: [], submissionIds: [] } };
beforeEach(() => { vi.clearAllMocks(); m.teachingStudentBadges.mockResolvedValue({ rulesVersion: 5, badges: [badge], legacyBadges: [], unsaved: [] }); });
it('reads only explicit selected class and student and shows permanent collection', async () => {
  render(<StudentBadgesCard classId="a" studentId="s" />); await screen.findByTestId('t-v5-summary');
  expect(m.teachingStudentBadges).toHaveBeenCalledWith('a', 's'); expect(screen.getByTestId('t-v5-summary').textContent).toContain('1 / 16');
  expect(m.teachingRevokeBadge).not.toHaveBeenCalled(); expect(m.teachingRestoreBadge).not.toHaveBeenCalled();
});
it('server scope denial exposes no previous collection and offers a retry', async () => {
  m.teachingStudentBadges.mockRejectedValue({ body: { code: 'not_your_class' } });
  render(<StudentBadgesCard classId="other" studentId="s" />); await screen.findByText('这不是你任教的班。');
  expect(screen.queryByTestId('t-v5-summary')).toBeNull(); fireEvent.click(screen.getByText('重新读取徽章'));
  await waitFor(() => expect(m.teachingStudentBadges).toHaveBeenCalledTimes(2));
});
