import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No data" description="Nothing to show yet." />);
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('Nothing to show yet.')).toBeInTheDocument();
  });

  it('fires action callback when clicked', () => {
    const cb = vi.fn();
    render(
      <EmptyState
        title="Empty"
        action={{ label: 'Create one', onClick: cb }}
      />,
    );
    fireEvent.click(screen.getByText('Create one'));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('uses role=status with aria-live=polite', () => {
    render(<EmptyState title="Empty" />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-live', 'polite');
  });

  it('renders distinct illustration for each variant', () => {
    const { rerender, container } = render(
      <EmptyState variant="no-paper" title="t" />,
    );
    const svg1 = container.querySelector('svg')?.outerHTML ?? '';
    rerender(<EmptyState variant="offline" title="t" />);
    const svg2 = container.querySelector('svg')?.outerHTML ?? '';
    rerender(<EmptyState variant="no-students" title="t" />);
    const svg3 = container.querySelector('svg')?.outerHTML ?? '';
    expect(svg1).not.toEqual(svg2);
    expect(svg2).not.toEqual(svg3);
  });
});
