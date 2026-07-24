// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotifications } from '../hooks/useNotifications';

const listNotifications = vi.fn();
const markNotificationRead = vi.fn();
const markAllNotificationsRead = vi.fn();

vi.mock('../services/api/notificationService', () => ({
  listNotifications: (...args: unknown[]) => listNotifications(...args),
  markNotificationRead: (...args: unknown[]) => markNotificationRead(...args),
  markAllNotificationsRead: (...args: unknown[]) => markAllNotificationsRead(...args)
}));

function makeEntry(id: string, readAt: string | null = null) {
  return { id, type: 'Info', title: `Title ${id}`, message: `Message ${id}`, targetUrl: null, severity: 'Info' as const, createdAt: '2026-07-22T00:00:00.000Z', readAt };
}

function Harness() {
  const { entries, unreadCount, isLoading, error, hasMore, markNotificationRead: markOne, markAllNotificationsRead: markAll, loadMore } = useNotifications();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="error">{error ?? ''}</div>
      <div data-testid="unread">{unreadCount}</div>
      <div data-testid="count">{entries.length}</div>
      <div data-testid="hasMore">{String(hasMore)}</div>
      <button onClick={() => markOne('n1')}>mark-one</button>
      <button onClick={markAll}>mark-all</button>
      <button onClick={loadMore}>load-more</button>
    </div>
  );
}

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markNotificationRead.mockResolvedValue(undefined);
    markAllNotificationsRead.mockResolvedValue(undefined);
  });
  afterEach(() => {
    cleanup();
    // Always restore real timers, even if a fake-timer test fails before reaching its own
    // vi.useRealTimers() call -- otherwise the fake clock can leak into later test files sharing
    // this worker and make unrelated tests (waitFor/user-event, which rely on real setTimeout)
    // hang until their own timeout.
    vi.useRealTimers();
  });

  it('loads entries and unread count on mount', async () => {
    listNotifications.mockResolvedValue({ entries: [makeEntry('n1'), makeEntry('n2', '2026-07-21T00:00:00.000Z')], unreadCount: 1, totalPages: 1 });
    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('unread')).toHaveTextContent('1');
    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('surfaces a load error', async () => {
    listNotifications.mockRejectedValue(new Error('Network down'));
    render(<Harness />);

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Network down'));
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('marking one read optimistically updates unread count and calls the API', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    listNotifications.mockResolvedValue({ entries: [makeEntry('n1')], unreadCount: 1, totalPages: 1 });
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId('unread')).toHaveTextContent('1'));

    await user.click(screen.getByText('mark-one'));
    expect(screen.getByTestId('unread')).toHaveTextContent('0');
    expect(markNotificationRead).toHaveBeenCalledWith('n1');
  });

  it('marking all read zeroes the unread count and calls the API', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    listNotifications.mockResolvedValue({ entries: [makeEntry('n1'), makeEntry('n2')], unreadCount: 2, totalPages: 1 });
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId('unread')).toHaveTextContent('2'));

    await user.click(screen.getByText('mark-all'));
    expect(screen.getByTestId('unread')).toHaveTextContent('0');
    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1);
  });

  it('loadMore appends the next page', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    listNotifications.mockResolvedValueOnce({ entries: [makeEntry('n1')], unreadCount: 1, totalPages: 2 });
    render(<Harness />);
    await waitFor(() => expect(screen.getByTestId('hasMore')).toHaveTextContent('true'));

    listNotifications.mockResolvedValueOnce({ entries: [makeEntry('n2')], unreadCount: 1, totalPages: 2 });
    await user.click(screen.getByText('load-more'));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('2'));
    expect(screen.getByTestId('hasMore')).toHaveTextContent('false');
  });

  it('stops polling once the component unmounts', async () => {
    vi.useFakeTimers();
    listNotifications.mockResolvedValue({ entries: [], unreadCount: 0, totalPages: 1 });
    const { unmount } = render(<Harness />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(listNotifications).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(120_000);
      await Promise.resolve();
    });
    expect(listNotifications).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
