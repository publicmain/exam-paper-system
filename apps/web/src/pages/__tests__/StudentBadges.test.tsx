import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import StudentBadgesPage from '../StudentBadges';
import { api } from '../../lib/api';
vi.mock('../../lib/api', () => ({ api: { listClasses: vi.fn(), getClass: vi.fn() } }));
vi.mock('../../components/StudentBadgesCard', () => ({ default: ({ classId, studentId }: { classId: string; studentId: string }) => <div data-testid="collection-scope">{classId}:{studentId}</div> }));
const m = vi.mocked(api);
const roster = (id: string) => ({ enrollments: [{ role: 'student', user: { id, name: id } }, { role: 'teacher', user: { id: 'teacher', name: 'teacher' } }, { role: 'student', user: { id: 'archived', name: 'archived', archivedAt: '2026-01-01' } }] });
beforeEach(() => { vi.clearAllMocks(); m.listClasses.mockResolvedValue([{ id: 'a', name: 'A班' }, { id: 'b', name: 'B班' }]); m.getClass.mockImplementation(async (id) => roster(id + '-student')); });
it('only selected active student collection is mounted, without loading growth or goals', async () => {
  render(<StudentBadgesPage />); await screen.findByText('A班');
  fireEvent.change(screen.getByLabelText('班级'), { target: { value: 'a' } }); await screen.findByText('a-student');
  expect(screen.queryByText('archived')).toBeNull(); expect(screen.queryByText('teacher')).toBeNull();
  fireEvent.change(screen.getByLabelText('学生'), { target: { value: 'a-student' } });
  expect(screen.getByTestId('collection-scope').textContent).toBe('a:a-student');
  fireEvent.change(screen.getByLabelText('班级'), { target: { value: 'b' } });
  expect(screen.queryByTestId('collection-scope')).toBeNull(); await screen.findByText('b-student');
});
it('late response from old class cannot replace the current roster', async () => {
  let finish: (value: any) => void = () => {};
  m.getClass.mockImplementation(id => id === 'a' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(roster('b-student')));
  render(<StudentBadgesPage />); await screen.findByText('A班');
  fireEvent.change(screen.getByLabelText('班级'), { target: { value: 'a' } });
  fireEvent.change(screen.getByLabelText('班级'), { target: { value: 'b' } }); await screen.findByText('b-student');
  await act(async () => finish(roster('a-student')));
  expect(screen.queryByText('a-student')).toBeNull(); expect(screen.getByText('b-student')).toBeTruthy();
});
it('failed list can retry without entering another feature', async () => {
  m.listClasses.mockRejectedValueOnce(new Error('offline'));
  render(<StudentBadgesPage />); await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await screen.findByText('A班'); expect(screen.queryByRole('alert')).toBeNull();
});
it('clearing class during a pending roster request leaves no stuck spinner or collection', async () => {
  m.getClass.mockImplementation(() => new Promise(() => {}));
  render(<StudentBadgesPage />); await screen.findByText('A班');
  fireEvent.change(screen.getByLabelText('班级'), { target: { value: 'a' } }); expect(screen.getByRole('status')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('班级'), { target: { value: '' } });
  expect(screen.queryByRole('status')).toBeNull(); expect(screen.queryByTestId('collection-scope')).toBeNull();
});
