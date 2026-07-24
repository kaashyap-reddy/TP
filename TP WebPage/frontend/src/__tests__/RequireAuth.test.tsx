// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import RequireAuth from '../components/RequireAuth';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import type { Role } from '../types/role';

function renderProtected(routeRole: Role | Role[], currentRole: Role | null, hydrated = true) {
  useAuthStore.setState({ role: currentRole, hydrated, id: currentRole ? 'user-1' : null, email: null, displayName: null, permissions: [] });
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <RequireAuth role={routeRole}>
              <div>Protected Content</div>
            </RequireAuth>
          }
        />
        <Route path="/" element={<div>Login Page</div>} />
        <Route path="/access-denied" element={<div>Access Denied Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  useToastStore.setState({ message: null });
});

describe('RequireAuth', () => {
  it('renders children when the role matches (single role)', () => {
    renderProtected('admin', 'admin');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders children when the current role is included in an allowed-roles array', () => {
    renderProtected(['admin', 'facilitator'], 'facilitator');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders nothing while auth is not yet hydrated', () => {
    renderProtected('admin', null, false);
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Access Denied Page')).not.toBeInTheDocument();
  });

  it('redirects an unauthenticated visitor to login, without a toast', async () => {
    renderProtected('admin', null);
    await waitFor(() => expect(screen.getByText('Login Page')).toBeInTheDocument());
    expect(useToastStore.getState().message).toBeNull();
  });

  it('redirects a logged-in wrong-role user to the access-denied page, with a toast', async () => {
    renderProtected('admin', 'trainee');
    await waitFor(() => expect(screen.getByText('Access Denied Page')).toBeInTheDocument());
    expect(useToastStore.getState().message).toBe("You don't have access to that page.");
  });

  it('redirects to access-denied (not login) when the role is outside an allowed-roles array', async () => {
    renderProtected(['admin', 'facilitator'], 'trainee');
    await waitFor(() => expect(screen.getByText('Access Denied Page')).toBeInTheDocument());
  });
});
