// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Tabs from '../components/Tabs';

afterEach(() => cleanup());

const TABS = [
  { value: 'all', label: 'All', count: 5 },
  { value: 'open', label: 'Open', count: 2 },
  { value: 'closed', label: 'Closed', count: 3 }
];

describe('Tabs', () => {
  it('renders every tab with its label and count', () => {
    render(<Tabs tabs={TABS} active="all" onChange={vi.fn()} aria-label="Filter" />);
    expect(screen.getByRole('tab', { name: /All.*5/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Open.*2/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Closed.*3/ })).toBeInTheDocument();
  });

  it('marks the active tab as aria-selected', () => {
    render(<Tabs tabs={TABS} active="open" onChange={vi.fn()} aria-label="Filter" />);
    expect(screen.getByRole('tab', { name: /Open/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /All/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange with the clicked tab value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} active="all" onChange={onChange} aria-label="Filter" />);
    await user.click(screen.getByRole('tab', { name: /Closed/ }));
    expect(onChange).toHaveBeenCalledWith('closed');
  });

  it('renders without a count badge when count is omitted', () => {
    render(<Tabs tabs={[{ value: 'x', label: 'Everything' }]} active="x" onChange={vi.fn()} aria-label="Filter" />);
    expect(screen.getByRole('tab', { name: 'Everything' })).toBeInTheDocument();
  });

  it('exposes a tablist with the given aria-label', () => {
    render(<Tabs tabs={TABS} active="all" onChange={vi.fn()} aria-label="Filter by status" />);
    expect(screen.getByRole('tablist', { name: 'Filter by status' })).toBeInTheDocument();
  });
});
