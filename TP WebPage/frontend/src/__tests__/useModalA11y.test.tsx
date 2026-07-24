// @vitest-environment jsdom
import { useRef } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useModalA11y } from '../hooks/useModalA11y';

function TestDialog({ open }: { open: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalA11y(open, ref);
  return (
    <div>
      <button>Trigger</button>
      {open && (
        <div ref={ref} tabIndex={-1} data-testid="dialog">
          <button>First</button>
          <button>Second</button>
        </div>
      )}
    </div>
  );
}

describe('useModalA11y', () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    document.getElementById('root')?.remove();
  });

  it('moves focus into the container when it opens', () => {
    render(<TestDialog open />);
    expect(screen.getByTestId('dialog')).toHaveFocus();
  });

  it('locks body scroll while open and restores it on close', () => {
    const { rerender } = render(<TestDialog open={false} />);
    expect(document.body.style.overflow).not.toBe('hidden');
    rerender(<TestDialog open />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<TestDialog open={false} />);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('marks #root inert while open and releases it on close', () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    const { rerender } = render(<TestDialog open={false} />);
    expect(root.hasAttribute('inert')).toBe(false);
    rerender(<TestDialog open />);
    expect(root.hasAttribute('inert')).toBe(true);
    expect(root.getAttribute('aria-hidden')).toBe('true');
    rerender(<TestDialog open={false} />);
    expect(root.hasAttribute('inert')).toBe(false);
  });

  it('traps Tab focus at the boundaries of the container', () => {
    render(<TestDialog open />);
    const first = screen.getByText('First');
    const second = screen.getByText('Second');

    second.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(second);
  });

  it('restores focus to the previously focused element on close', () => {
    const { rerender } = render(<TestDialog open={false} />);
    const trigger = screen.getByText('Trigger');
    trigger.focus();
    expect(trigger).toHaveFocus();

    rerender(<TestDialog open />);
    expect(screen.getByTestId('dialog')).toHaveFocus();

    rerender(<TestDialog open={false} />);
    expect(trigger).toHaveFocus();
  });
});
