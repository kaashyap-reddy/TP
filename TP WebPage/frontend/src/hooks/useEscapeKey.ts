import { useEffect } from 'react';

export function useEscapeKey(onEscape: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onEscape();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onEscape, active]);
}
