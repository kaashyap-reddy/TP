import { useEffect, useRef } from 'react';

/**
 * Not wired into any component yet — this is the ready-to-use building block for "soft"
 * real-time (poll every N seconds instead of only refetching on navigation/reload). See the
 * bottom of this file for exactly how to turn it on for the notification bell, the most likely
 * first use — no other file needs to change to activate it.
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
 * ---- To activate polling for the notification bell (do this later, not now) ----
 *
 * In hooks/useNotifications.ts, extract the existing fetch effect's body into a named function
 * and call it from usePolling instead of a bare useEffect:
 *
 *   import { usePolling } from './usePolling';
 *
 *   function refreshNotifications() {
 *     return notificationService.listNotifications().then(({ entries, readIds }) => {
 *       if (entries.length === 0) return;
 *       setApiEntries(entries);
 *       setReadLogIds(readIds);
 *     }).catch(() => undefined);
 *   }
 *
 *   usePolling(refreshNotifications, 30_000); // every 30s while the tab is visible
 *
 * The same pattern applies to store.fetchAnnouncements(batches) in AdminDashboardPage.tsx /
 * FacilitatorDashboardPage.tsx / TraineeDashboardPage.tsx if announcements should also refresh
 * in the background — call usePolling(() => fetchAnnouncements(batches), 30_000) instead of the
 * current one-shot useEffect there. 30s is a reasonable starting interval for both: frequent
 * enough to feel current, far below anything that would meaningfully load the backend at this
 * app's scale.
 */
