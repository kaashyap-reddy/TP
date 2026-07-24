// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MobileNavDrawer from '../components/MobileNavDrawer';
import { useSettingsDrawerStore } from '../store/settingsDrawerStore';

type TestTabId = 'dashboard' | 'batches' | 'reports';

const NAV_ITEMS = [
  { tabId: 'dashboard' as TestTabId, label: 'Dashboard', iconPath: 'M0 0h1v1H0z' },
  { tabId: 'batches' as TestTabId, label: 'Batches', iconPath: 'M0 0h1v1H0z', group: 'me' },
  { tabId: 'reports' as TestTabId, label: 'Reports', iconPath: 'M0 0h1v1H0z', group: 'me' }
];
const NAV_GROUPS = [{ key: 'me', label: 'Me', iconPath: 'M0 0h1v1H0z' }];

function renderDrawer(overrides: Partial<React.ComponentProps<typeof MobileNavDrawer<TestTabId>>> = {}) {
  const onClose = vi.fn();
  const onTabChange = vi.fn();
  const onLogout = vi.fn();
  render(
    <MobileNavDrawer
      open
      onClose={onClose}
      brandLabel="Test Portal"
      navItems={NAV_ITEMS}
      navGroups={NAV_GROUPS}
      activeTab="dashboard"
      onTabChange={onTabChange}
      onLogout={onLogout}
      {...overrides}
    />
  );
  return { onClose, onTabChange, onLogout };
}

describe('MobileNavDrawer', () => {
  beforeEach(() => {
    useSettingsDrawerStore.setState({ open: false });
  });

  afterEach(() => cleanup());

  it('renders nothing when closed', () => {
    render(
      <MobileNavDrawer
        open={false}
        onClose={vi.fn()}
        brandLabel="Test Portal"
        navItems={NAV_ITEMS}
        navGroups={NAV_GROUPS}
        activeTab="dashboard"
        onTabChange={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('has dialog semantics with an accessible name', () => {
    renderDrawer();
    expect(screen.getByRole('dialog', { name: 'Test Portal' })).toBeInTheDocument();
  });

  it('closes and navigates when a destination is selected', async () => {
    const user = userEvent.setup();
    const { onClose, onTabChange } = renderDrawer();
    await user.click(screen.getByRole('button', { name: 'Batches' }));
    expect(onTabChange).toHaveBeenCalledWith('batches');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes via the close button', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes and calls onLogout when Logout is selected', async () => {
    const user = userEvent.setup();
    const { onClose, onLogout } = renderDrawer();
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes and opens the settings drawer when Settings is selected', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDrawer();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(useSettingsDrawerStore.getState().open).toBe(true);
  });
});
