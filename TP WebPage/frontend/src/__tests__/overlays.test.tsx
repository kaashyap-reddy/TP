// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import SettingsDrawer from '../components/SettingsDrawer';

// SettingsDrawer renders the full AccountSettingsForm (auth/profile stores, API calls) --
// stubbed here so this file can focus on the drawer's own dialog chrome/a11y behavior. vi.mock
// calls are hoisted above imports by vitest, so declaration order here doesn't matter.
vi.mock('../components/AccountSettingsForm', () => ({
  default: ({ onDone, onDirtyChange }: { onDone: () => void; onDirtyChange?: (dirty: boolean) => void }) => (
    <div>
      Account form
      <button onClick={onDone}>Done</button>
      <button onClick={() => onDirtyChange?.(true)}>Make dirty</button>
    </div>
  )
}));

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('Modal', () => {
  it('renders nothing when closed, and has dialog semantics when open', () => {
    const { rerender } = render(
      <Modal open={false} onClose={vi.fn()} title="Example">
        content
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <Modal open onClose={vi.fn()} title="Example">
        content
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Example');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Example">
        content
      </Modal>
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmDialog', () => {
  it('has dialog semantics and an accessible name from the title', () => {
    render(<ConfirmDialog open title="Delete batch?" message="This cannot be undone." onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Delete batch?');
  });

  it('calls onCancel/onConfirm from their respective buttons', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Delete batch?" message="This cannot be undone." onConfirm={onConfirm} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

function SettingsDrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open settings</button>
      <SettingsDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

describe('SettingsDrawer', () => {
  it('has dialog semantics labelled by its heading', () => {
    render(<SettingsDrawer open onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Account Settings');
  });

  it('restores focus to the trigger element after closing via Escape', async () => {
    const user = userEvent.setup();
    render(<SettingsDrawerHarness />);
    const trigger = screen.getByRole('button', { name: 'Open settings' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
  });

  it('confirms before discarding when the form is dirty, and Escape from the confirm just cancels it', async () => {
    const user = userEvent.setup();
    render(<SettingsDrawerHarness />);
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    await user.click(screen.getByRole('button', { name: 'Make dirty' }));

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Account Settings' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Discard unsaved changes?' })).toBeInTheDocument();

    // Escape again cancels the confirmation, not the underlying discard -- the settings drawer
    // (and the unsaved edits) are still there afterwards.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Account Settings' })).toBeInTheDocument();
  });

  it('closes for good once discarding is confirmed', async () => {
    const user = userEvent.setup();
    render(<SettingsDrawerHarness />);
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    await user.click(screen.getByRole('button', { name: 'Make dirty' }));

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes immediately (no confirmation) when the form has no unsaved changes', async () => {
    const user = userEvent.setup();
    render(<SettingsDrawerHarness />);
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
