import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MistakePracticePage from '../pages/MistakePractice';
it('旧重做链接回到阅读结果，不产生第四项任务', () => {
  render(<MemoryRouter initialEntries={['/mistakes/practice']}><Routes>
    <Route path="/mistakes/practice" element={<MistakePracticePage />} />
    <Route path="/lesson/reading/result" element={<p>阅读结果落点</p>} />
  </Routes></MemoryRouter>);
  expect(screen.getByText('阅读结果落点')).toBeTruthy();
});
