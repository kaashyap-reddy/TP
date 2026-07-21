import { useEffect, useRef } from 'react';

/**
 * Reusable building block for "soft" real-time (poll every N seconds instead of only refetching
 * on navigation/reload). Wired into useNotifications.ts today; see the bottom of this file for
 * how to extend the same pattern to announcements.
 *
 * Re-runs `callback` every `intervalMs` while the tab is visible. Pauses automatically when the
 * tab is backgrounded (no point burning requests for a tab nobody's looking at) and fires
 * immediately — both on mount and the moment the tab becomes visible again — so data is never
 * stale-by-a-full-interval after being backgrounded for a while.
 */
export function usePolling(callback: () => void | Promise<void>, intervalMs: number, enabled = true): void {
  // A ref, not a dependency, so changing `callback` identity on every render (as an inline
  // arrow function at the call site would) doesn't tear down and restart the interval.
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    function tick() {
      void callbackRef.current();
    }

    tick();
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') tick();
    }, intervalMs);

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') tick();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [intervalMs, enabled]);
}

/**
 * ---- To also activate polling for announcements (do this later, not now) ----
 *
 * The same pattern applies to store.fetchAnnouncements(batches) in AdminDashboardPage.tsx /
 * FacilitatorDashboardPage.tsx / TraineeDashboardPage.tsx if announcements should also refresh
 * in the background — call usePolling(() => fetchAnnouncements(batches), 30_000) instead of the
 * current one-shot useEffect there. 30s is a reasonable starting interval: frequent enough to
 * feel current, far below anything that would meaningfully load the backend at this app's scale.
 */
