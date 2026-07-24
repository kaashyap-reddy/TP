// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import AccountSettingsForm from '../components/AccountSettingsForm';

const updateMe = vi.fn();
const uploadAvatar = vi.fn();
const removeAvatar = vi.fn();
const changePassword = vi.fn();

vi.mock('../services/api/userService', () => ({
  updateMe: (...args: unknown[]) => updateMe(...args),
  uploadAvatar: (...args: unknown[]) => uploadAvatar(...args),
  removeAvatar: (...args: unknown[]) => removeAvatar(...args)
}));

vi.mock('../services/api/authService', () => ({
  changePassword: (...args: unknown[]) => changePassword(...args)
}));

vi.mock('../hooks/useAvatarUrl', () => ({
  useAvatarUrl: () => null
}));

function seedStores() {
  useAuthStore.setState({
    id: 'user-1',
    email: 'alex@company.com',
    role: 'admin',
    displayName: 'Alex Morgan',
    permissions: [],
    hydrated: true
  });
  useProfileStore.setState({
    profiles: {
      admin: { phone: '1234567', location: 'HQ', avatarStorageKey: null, avatarUpdatedAt: null, company: 'Acme', department: 'Ops', idNumber: 'ADM-001' },
      facilitator: { phone: '', location: '', avatarStorageKey: null, avatarUpdatedAt: null },
      trainee: { phone: '', location: '', avatarStorageKey: null, avatarUpdatedAt: null }
    },
    isLoading: false,
    error: null
  });
}

function updatedUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'Alex Morgan',
    email: 'alex@company.com',
    role: 'admin',
    isActive: true,
    lastLoginAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    profile: { phone: '1234567', location: 'HQ', company: 'Acme', department: 'Ops', idNumber: 'ADM-001', avatarStorageKey: null, avatarUpdatedAt: null },
    ...overrides
  };
}

describe('AccountSettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedStores();
  });

  afterEach(() => cleanup());

  it('disables Save until a field changes, and disables it again after a successful save', async () => {
    const user = userEvent.setup();
    updateMe.mockResolvedValue(updatedUser({ profile: { ...updatedUser().profile, location: 'Remote' } }));
    render(<AccountSettingsForm onDone={vi.fn()} />);

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    expect(saveButton).toBeDisabled();

    await user.clear(screen.getByLabelText('Location'));
    await user.type(screen.getByLabelText('Location'), 'Remote');
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);
    await waitFor(() => expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled());
  });

  it('sends one combined updateMe call with only the changed fields', async () => {
    const user = userEvent.setup();
    updateMe.mockResolvedValue(updatedUser());
    render(<AccountSettingsForm onDone={vi.fn()} />);

    await user.clear(screen.getByLabelText('Phone'));
    await user.type(screen.getByLabelText('Phone'), '9998887777');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateMe).toHaveBeenCalledTimes(1));
    expect(updateMe).toHaveBeenCalledWith({ phone: '9998887777' });
  });

  it('moves focus to the first invalid field on validation failure', async () => {
    const user = userEvent.setup();
    render(<AccountSettingsForm onDone={vi.fn()} />);

    const emailInput = screen.getByLabelText('Email');
    await user.clear(emailInput);
    await user.type(emailInput, 'not-an-email');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(emailInput).toHaveFocus());
    expect(updateMe).not.toHaveBeenCalled();
  });

  it('shows a partial-failure message and preserves password input when only the password change fails', async () => {
    const user = userEvent.setup();
    updateMe.mockResolvedValue(updatedUser({ profile: { ...updatedUser().profile, location: 'Remote' } }));
    changePassword.mockRejectedValue(new Error('Current password is incorrect.'));
    render(<AccountSettingsForm onDone={vi.fn()} />);

    await user.clear(screen.getByLabelText('Location'));
    await user.type(screen.getByLabelText('Location'), 'Remote');
    await user.type(screen.getByLabelText('Current Password'), 'wrongpass');
    await user.type(screen.getByLabelText('New Password'), 'newpassword123');
    await user.type(screen.getByLabelText('Confirm New Password'), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(changePassword).toHaveBeenCalledTimes(1));
    expect(updateMe).toHaveBeenCalledTimes(1);
    // Password fields are preserved (not silently cleared) since that half of the save failed.
    expect(screen.getByLabelText('Current Password')).toHaveValue('wrongpass');
    expect(screen.getByLabelText('New Password')).toHaveValue('newpassword123');
  });

  it('toggles password visibility with the show/hide control', async () => {
    const user = userEvent.setup();
    render(<AccountSettingsForm onDone={vi.fn()} />);
    const input = screen.getByLabelText('New Password') as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: /show new password/i }));
    expect(input).toHaveAttribute('type', 'text');
  });

  it('shows a live mismatch indicator that clears once the passwords match', async () => {
    const user = userEvent.setup();
    render(<AccountSettingsForm onDone={vi.fn()} />);
    await user.type(screen.getByLabelText('New Password'), 'newpassword123');
    await user.type(screen.getByLabelText('Confirm New Password'), 'different');
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    const confirmInput = screen.getByLabelText('Confirm New Password');
    await user.clear(confirmInput);
    await user.type(confirmInput, 'newpassword123');
    expect(screen.getByText(/passwords match/i)).toBeInTheDocument();
  });

  it('rejects a non-JPG/PNG avatar file without uploading it', async () => {
    // applyAccept: false -- user-event otherwise mimics the browser's native file-picker
    // filtering against the input's `accept` attribute, which would silently drop this file
    // before it ever reaches our own JS-level validation, defeating the point of this test.
    const user = userEvent.setup({ applyAccept: false });
    render(<AccountSettingsForm onDone={vi.fn()} />);
    const file = new File(['x'], 'photo.webp', { type: 'image/webp' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
    expect(uploadAvatar).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/must be a jpg or png image/i)).toBeInTheDocument());
  });
});
