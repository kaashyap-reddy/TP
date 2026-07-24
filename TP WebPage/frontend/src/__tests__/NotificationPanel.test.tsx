// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotificationPanel from '../components/NotificationPanel';
import type { AppNotification } from '../services/api/notificationService';

function entry(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    type: 'Info',
    title: 'Something happened',
    message: 'Details here.',
    targetUrl: null,
    severity: 'Info',
    createdAt: new Date().toISOString(),
    readAt: null,
    ...overrides
  };
}

const noop = () => undefined;

function renderPanel(overrides: Partial<React.ComponentProps<typeof NotificationPanel>> = {}) {
  return render(
    <NotificationPanel
      entries={[]}
      isLoading={false}
      error={null}
      onRetry={noop}
      onMarkRead={noop}
      onMarkAllRead={noop}
      onSelect={noop}
      hasMore={false}
      isLoadingMore={false}
      onLoadMore={noop}
      {...overrides}
    />
  );
}

afterEach(() => cleanup());

describe('NotificationPanel', () => {
  it('shows a loading state', () => {
    renderPanel({ isLoading: true });
    expect(screen.queryByText('No notifications')).not.toBeInTheDocument();
  });

  it('shows an error with a retry action', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderPanel({ error: 'Could not load', onRetry });
    expect(screen.getByText('Could not load')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state when there are no notifications at all', () => {
    renderPanel({ entries: [] });
    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('shows a distinct empty state when a filter matches nothing', async () => {
    const user = userEvent.setup();
    renderPanel({ entries: [entry({ readAt: new Date().toISOString() })] });
    await user.click(screen.getByRole('button', { name: 'Unread' }));
    expect(screen.getByText('No matching notifications')).toBeInTheDocument();
  });

  it('the Unread tab only shows unread entries', async () => {
    const user = userEvent.setup();
    renderPanel({
      entries: [entry({ id: 'read-1', title: 'Read one', readAt: new Date().toISOString() }), entry({ id: 'unread-1', title: 'Unread one' })]
    });
    await user.click(screen.getByRole('button', { name: 'Unread (1)' }));
    expect(screen.getByText('Unread one')).toBeInTheDocument();
    expect(screen.queryByText('Read one')).not.toBeInTheDocument();
  });

  it('groups entries under a "Today" heading', () => {
    renderPanel({ entries: [entry()] });
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('clicking a notification marks it read and selects it', async () => {
    const user = userEvent.setup();
    const onMarkRead = vi.fn();
    const onSelect = vi.fn();
    const n = entry();
    renderPanel({ entries: [n], onMarkRead, onSelect });

    await user.click(screen.getByText(n.title));
    expect(onMarkRead).toHaveBeenCalledWith('n1');
    expect(onSelect).toHaveBeenCalledWith(n);
  });

  it('disables "Mark all read" when nothing is unread', () => {
    renderPanel({ entries: [entry({ readAt: new Date().toISOString() })] });
    expect(screen.getByRole('button', { name: 'Mark all read' })).toBeDisabled();
  });
});
