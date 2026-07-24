// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AuthenticatedDetailLayout from '../layouts/AuthenticatedDetailLayout';

vi.mock('../components/NotificationBell', () => ({ default: () => <div data-testid="notification-bell" /> }));
vi.mock('../components/ProfileDropdown', () => ({ default: () => <div data-testid="profile-dropdown" /> }));

afterEach(() => cleanup());

function renderLayout(role: 'admin' | 'facilitator' | 'trainee', activeTab: string, onBack = vi.fn()) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route
          path="*"
          element={
            <AuthenticatedDetailLayout role={role} activeTab={activeTab} headerTitle="Detail Page" breadcrumbTrail={['Section', 'Detail Page']} onBack={onBack} backLabel="Back to Section">
              <p>Detail content</p>
            </AuthenticatedDetailLayout>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('AuthenticatedDetailLayout', () => {
  it("renders the admin sidebar/brand when role='admin'", () => {
    renderLayout('admin', 'trainingPlans');
    expect(screen.getByText('Admin Portal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Detail Page', level: 1 })).toBeInTheDocument();
  });

  it("renders the facilitator sidebar/brand when role='facilitator'", () => {
    renderLayout('facilitator', 'batches');
    expect(screen.getByText('Facilitator Portal')).toBeInTheDocument();
  });

  it("renders the trainee sidebar/brand when role='trainee'", () => {
    renderLayout('trainee', 'assignments');
    expect(screen.getByText('My Workspace')).toBeInTheDocument();
  });

  it('renders the breadcrumb trail and content', () => {
    renderLayout('admin', 'trainingPlans');
    expect(screen.getByText('Detail content')).toBeInTheDocument();
    expect(screen.getByText('Section')).toBeInTheDocument();
  });

  it('calls onBack when the back button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderLayout('admin', 'trainingPlans', onBack);
    await user.click(screen.getByRole('button', { name: /back to section/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders the shared header actions (notification bell, profile dropdown)', () => {
    renderLayout('admin', 'trainingPlans');
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    expect(screen.getByTestId('profile-dropdown')).toBeInTheDocument();
  });

  it('shows a logout confirmation before actually logging out', async () => {
    const user = userEvent.setup();
    renderLayout('admin', 'trainingPlans');
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('dialog', { name: 'Log out?' })).toBeInTheDocument();
  });
});
