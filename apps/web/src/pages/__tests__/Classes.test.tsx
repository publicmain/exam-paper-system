import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ClassesPage from '../Classes';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => {
  return {
    api: {
      listClasses: vi.fn(),
      getClass: vi.fn(),
      createClass: vi.fn(),
      rosterClass: vi.fn(),
      unenrollClass: vi.fn(),
      updateClass: vi.fn(),
      renameStudent: vi.fn(),
    },
  };
});

const mockClasses = [
  {
    id: 'cls1',
    name: 'G11 IELTS Test',
    classCode: 'TEST_MQ',
    englishLevel: { level: 'ielts_authentic' },
    englishLevels: [{ level: 'ielts_authentic' }],
    _count: { enrollments: 36 },
  },
];

const mockClassDetail = {
  id: 'cls1',
  name: 'G11 IELTS Test',
  classCode: 'TEST_MQ',
  englishLevel: { level: 'ielts_authentic' }, // legacy singular (list card)
  englishLevels: [{ level: 'ielts_authentic' }], // R10 multi-level (detail modal)
  weeklyFocus: 'matching headings',
  enrollments: [
    { id: 'e1', userId: 'u1', role: 'student', user: { id: 'u1', name: 'Alice', email: 'a@x.com', role: 'student' } },
  ],
  assignments: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  (api.listClasses as any).mockResolvedValue(mockClasses);
  (api.getClass as any).mockResolvedValue(mockClassDetail);
  (api.updateClass as any).mockResolvedValue({});
});

function open() {
  return render(
    <MemoryRouter>
      <ClassesPage />
    </MemoryRouter>,
  );
}

describe('Classes page (R10-Bug1)', () => {
  it('renders classes list and opens detail modal', async () => {
    open();
    await waitFor(() => screen.getByText('G11 IELTS Test'));
    fireEvent.click(screen.getByText('G11 IELTS Test'));
    await waitFor(() => screen.getByText(/强\(IELTS Auth\)/));
  });

  it('detail modal closes on Escape (R10-Bug1)', async () => {
    open();
    await waitFor(() => screen.getByText('G11 IELTS Test'));
    fireEvent.click(screen.getByText('G11 IELTS Test'));
    await waitFor(() => screen.getByText(/强\(IELTS Auth\)/));
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
    await waitFor(() => {
      expect(screen.queryByText(/强\(IELTS Auth\)/)).toBeNull();
    });
  });

  it('detail modal header level matches list-card englishLevel (R10-Bug1)', async () => {
    open();
    await waitFor(() => screen.getByText('G11 IELTS Test'));
    fireEvent.click(screen.getByText('G11 IELTS Test'));
    // Both card AND modal show ielts_authentic — no "—" mismatch
    await waitFor(() => screen.getByText(/强\(IELTS Auth\)/));
  });

  it('weeklyFocus textarea renders, edits, and PATCHes class (R10-Bug1)', async () => {
    open();
    await waitFor(() => screen.getByText('G11 IELTS Test'));
    fireEvent.click(screen.getByText('G11 IELTS Test'));
    const textarea = await screen.findByLabelText('weekly focus textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('matching headings');
    fireEvent.change(textarea, { target: { value: 'relative clauses' } });
    fireEvent.click(screen.getByText('保存本周重点'));
    await waitFor(() => {
      expect(api.updateClass).toHaveBeenCalledWith('cls1', { weeklyFocus: 'relative clauses' });
    });
  });

  it('empty weeklyFocus is sent as null', async () => {
    (api.getClass as any).mockResolvedValueOnce({ ...mockClassDetail, weeklyFocus: 'something' });
    open();
    await waitFor(() => screen.getByText('G11 IELTS Test'));
    fireEvent.click(screen.getByText('G11 IELTS Test'));
    const textarea = await screen.findByLabelText('weekly focus textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.click(screen.getByText('保存本周重点'));
    await waitFor(() => {
      expect(api.updateClass).toHaveBeenCalledWith('cls1', { weeklyFocus: null });
    });
  });
});

describe('班级名单改学生登录名（2026-09-15）', () => {
  it('保存 → 走改名接口（姓名昵称一起改）；同班重名 → 就地说清楚', async () => {
    (api.renameStudent as any)
      .mockResolvedValueOnce({ id: 'u1', name: 'Alice Wang', nickname: 'Alice Wang', previousName: 'Alice' })
      .mockRejectedValueOnce(Object.assign(new Error('Conflict'), { body: { code: 'name_taken_in_class' } }));
    open();
    await waitFor(() => screen.getByText('G11 IELTS Test'));
    fireEvent.click(screen.getByText('G11 IELTS Test'));
    fireEvent.click(await screen.findByLabelText('rename'));
    fireEvent.change(screen.getByLabelText('edit student name'), { target: { value: 'Alice Wang' } });
    fireEvent.click(screen.getByLabelText('save'));
    await waitFor(() => expect(api.renameStudent).toHaveBeenCalledWith('u1', 'Alice Wang'));

    fireEvent.click(await screen.findByLabelText('rename'));
    fireEvent.change(screen.getByLabelText('edit student name'), { target: { value: 'Bob' } });
    fireEvent.click(screen.getByLabelText('save'));
    expect(await screen.findByText(/这个班里已经有人叫这个名字了/)).toBeTruthy();
  });
});
