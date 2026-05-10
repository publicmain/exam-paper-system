import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { CommandPalette } from '../CommandPalette';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

function renderWith(role: 'admin' | 'teacher' | 'student') {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <CommandPalette role={role} />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CommandPalette (R10-Bug3)', () => {
  beforeEach(() => {
    // jsdom doesn't reset focus between tests; nothing else to clean.
  });

  it('is hidden by default — no input rendered', () => {
    renderWith('admin');
    expect(screen.queryByTestId('command-palette-input')).toBeNull();
  });

  it('opens on Ctrl+K and shows the full action list when query is empty', () => {
    renderWith('admin');
    act(() => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    });
    expect(screen.getByTestId('command-palette-input')).toBeInTheDocument();
    // empty query → must NOT show "no matches"; full list visible
    expect(screen.queryByText('没有匹配项')).toBeNull();
    expect(screen.getByTestId('command-palette-item-papers')).toBeInTheDocument();
    expect(screen.getByTestId('command-palette-item-classes')).toBeInTheDocument();
  });

  it('also opens on Cmd+K (Mac)', () => {
    renderWith('admin');
    act(() => {
      fireEvent.keyDown(window, { key: 'K', metaKey: true });
    });
    expect(screen.getByTestId('command-palette-input')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    renderWith('admin');
    act(() => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); });
    expect(screen.getByTestId('command-palette-input')).toBeInTheDocument();
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
    expect(screen.queryByTestId('command-palette-input')).toBeNull();
  });

  it('filters by query text', () => {
    renderWith('admin');
    act(() => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); });
    const input = screen.getByTestId('command-palette-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'classes' } });
    expect(screen.getByTestId('command-palette-item-classes')).toBeInTheDocument();
    expect(screen.queryByTestId('command-palette-item-papers')).toBeNull();
  });

  it('Enter on empty query navigates to first item — no dead state', () => {
    renderWith('admin');
    act(() => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); });
    const input = screen.getByTestId('command-palette-input');
    // Don't type anything; just press Enter.
    fireEvent.keyDown(input, { key: 'Enter' });
    // First admin item is Dashboard "/"
    expect(screen.getByTestId('loc').textContent).toBe('/');
  });

  it('mouse click on an item navigates', () => {
    renderWith('admin');
    act(() => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); });
    fireEvent.click(screen.getByTestId('command-palette-item-classes'));
    expect(screen.getByTestId('loc').textContent).toBe('/classes');
  });

  it('ArrowDown moves cursor and Enter opens highlighted item', () => {
    renderWith('admin');
    act(() => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); });
    const input = screen.getByTestId('command-palette-input');
    // First item dash → second item practice → third item papers
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('loc').textContent).toBe('/papers');
  });

  it('student role only sees student-scoped items', () => {
    renderWith('student');
    act(() => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); });
    expect(screen.getByTestId('command-palette-item-tutor')).toBeInTheDocument();
    expect(screen.getByTestId('command-palette-item-student-home')).toBeInTheDocument();
    // Admin-only items must NOT appear
    expect(screen.queryByTestId('command-palette-item-syllabus')).toBeNull();
    expect(screen.queryByTestId('command-palette-item-cost')).toBeNull();
  });
});
