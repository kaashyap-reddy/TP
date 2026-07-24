// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Button from '../components/Button';

describe('Button', () => {
  afterEach(() => cleanup());

  it('defaults to type="button" so it never accidentally submits a form', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('honors an explicit type="submit"', () => {
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  });

  it('fires onClick on keyboard activation (Enter)', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Save</Button>);
    screen.getByRole('button', { name: 'Save' }).focus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and aria-busy while loading, and drops clicks', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button onClick={onClick} loading loadingLabel="Saving…">
        Save
      </Button>
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Saving…')).toBeInTheDocument();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button onClick={onClick} disabled>
        Save
      </Button>
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('requires an accessible name for icon-only buttons', () => {
    render(
      <Button size="icon" aria-label="Close">
        <svg aria-hidden="true" />
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button).toHaveAccessibleName('Close');
    expect(button).toHaveAttribute('title', 'Close');
  });

  it('merges a custom className with the variant/size classes instead of replacing them', () => {
    render(
      <Button variant="secondary" className="mb-4 -ml-2">
        Save
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.className).toContain('mb-4');
    expect(button.className).toContain('-ml-2');
    // Variant/size classes must survive the merge.
    expect(button.className).toContain('bg-white');
    expect(button.className).toContain('h-10');
  });

  it('appends w-full when fullWidth is set', () => {
    render(<Button fullWidth>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('w-full');
  });
});
