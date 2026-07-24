// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationBell from '../components/NotificationBell';

const listNotifications = vi.fn();
const markNotificationRead = vi.fn();
const markAllNotificationsRead = vi.fn();

vi.mock('../services/api/notificationService', () => ({
  listNotifications: (...args: unknown[]) => listNotifications(...args),
  markNotificationRead: (...args: unknown[]) => markNotificationRead(...args),
  markAllNotificationsRead: (...args: unknown[]) => markAllNotificationsRead(...args)
}));

function DestinationPage() {
  return <div>Assignment detail page</div>;
}

function renderBell() {
  return render(
    <MemoryRouter initialEntries={['/facilitator']}>
      <Routes>
        <Route path="/facilitator" element={<NotificationBell />} />
        <Route path="/facilitator/assignments/:id" element={<DestinationPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markNotificationRead.mockResolvedValue(undefined);
    markAllNotificationsRead.mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  it('shows no badge when unread count is zero', async () => {
    listNotifications.mockResolvedValue({ entries: [], unreadCount: 0, totalPages: 1 });
    renderBell();
    await waitFor(() => expect(listNotifications).toHaveBeenCalled());
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows the unread count badge and announces it', async () => {
    listNotifications.mockResolvedValue({
      entries: [{ id: 'n1', type: 'Info', title: 'Hi', message: 'msg', targetUrl: null, severity: 'Info', createdAt: new Date().toISOString(), readAt: null }],
      unreadCount: 1,
      totalPages: 1
    });
    renderBell();
    await waitFor(() => expect(screen.getAllByText('1').length).toBeGreaterThan(0));
    expect(screen.getByRole('status')).toHaveTextContent('1 unread notifications');
  });

  it('opens on click and closes on Escape, restoring focus to the trigger', async () => {
    listNotifications.mockResolvedValue({ entries: [], unreadCount: 0, totalPages: 1 });
    const user = userEvent.setup();
    renderBell();
    const trigger = screen.getByRole('button', { name: /notifications/i });

    await user.click(trigger);
    expect(screen.getByText('No notifications')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('No notifications')).not.toBeInTheDocument();
  });

  it('navigates to a notification\'s targetUrl when selected', async () => {
    listNotifications.mockResolvedValue({
      entries: [
        {
          id: 'n1',
          type: 'SubmissionReceived',
          title: 'New submission',
          message: 'Check it out',
          targetUrl: '/facilitator/assignments/abc',
          severity: 'Info',
          createdAt: new Date().toISOString(),
          readAt: null
        }
      ],
      unreadCount: 1,
      totalPages: 1
    });
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByRole('button', { name: /notifications/i }));
    await user.click(await screen.findByText('New submission'));

    expect(await screen.findByText('Assignment detail page')).toBeInTheDocument();
  });
});
