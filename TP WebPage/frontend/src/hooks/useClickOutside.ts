import { RefObject, useEffect } from 'react';

export function useClickOutside(ref: RefObject<HTMLElement>, onOutsideClick: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;

    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutsideClick();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [ref, onOutsideClick, active]);
}
