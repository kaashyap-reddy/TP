import { RefObject, useEffect, useRef } from 'react';

// Ref-counted so nested/overlapping overlays (e.g. a confirm dialog opened on top of a drawer)
// don't fight over restoring body scroll or #root's inert state when the inner one closes first.
let scrollLockCount = 0;
let savedBodyOverflow = '';
let savedBodyPaddingRight = '';

function lockBodyScroll() {
  if (scrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow;
    savedBodyPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
  scrollLockCount++;
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = savedBodyOverflow;
    document.body.style.paddingRight = savedBodyPaddingRight;
  }
}

let inertCount = 0;

function applyInertRoot() {
  if (inertCount === 0) {
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    root?.setAttribute('aria-hidden', 'true');
  }
  inertCount++;
}

function releaseInertRoot() {
  inertCount = Math.max(0, inertCount - 1);
  if (inertCount === 0) {
    const root = document.getElementById('root');
    root?.removeAttribute('inert');
    root?.removeAttribute('aria-hidden');
  }
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  // Layout-based visibility (offsetParent) isn't checked here -- modal content is never
  // display:none while open, and relying on it would make behavior dependent on a real layout
  // engine (which test environments like jsdom don't provide).
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

// Combines focus trap + scroll lock + background-inert + focus restoration for true modal/drawer
// overlays. Escape and click-outside stay on the existing useEscapeKey/useClickOutside hooks --
// this hook only owns the behaviors those two don't cover.
export function useModalA11y(open: boolean, containerRef: RefObject<HTMLElement>, options?: { initialFocusRef?: RefObject<HTMLElement> }) {
  const initialFocusRef = options?.initialFocusRef;
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    lockBodyScroll();
    applyInertRoot();

    const container = containerRef.current;
    const focusTarget = initialFocusRef?.current ?? container;
    focusTarget?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !container) return;
      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      unlockBodyScroll();
      releaseInertRoot();
      previouslyFocused.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
