import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AsyncState } from '../AsyncState';

describe('AsyncState', () => {
  it('shows a spinner while loading', () => {
    render(
      <AsyncState loading error={null} isEmpty={false}>
        <div>content</div>
      </AsyncState>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('content')).toBeNull();
  });

  it('loading takes precedence over a lingering error (retry shows spinner)', () => {
    render(
      <AsyncState loading error={'boom'} isEmpty={false}>
        <div>content</div>
      </AsyncState>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows an error with a working Retry button', () => {
    const onRetry = vi.fn();
    render(
      <AsyncState loading={false} error={'网络错误'} isEmpty={false} onRetry={onRetry}>
        <div>content</div>
      </AsyncState>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('网络错误')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/重试/));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the Retry button when no onRetry is given', () => {
    render(
      <AsyncState loading={false} error={'err'} isEmpty={false}>
        <div>content</div>
      </AsyncState>,
    );
    expect(screen.queryByText(/重试/)).toBeNull();
  });

  it('shows the empty state when isEmpty', () => {
    render(
      <AsyncState loading={false} error={null} isEmpty emptyTitle="还没有记录">
        <div>content</div>
      </AsyncState>,
    );
    expect(screen.getByText('还没有记录')).toBeInTheDocument();
    expect(screen.queryByText('content')).toBeNull();
  });

  it('renders children when not loading/error/empty', () => {
    render(
      <AsyncState loading={false} error={null} isEmpty={false}>
        <div>content</div>
      </AsyncState>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
