export function isRecentlyUpdated(dateStr: string, withinDays = 7): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const diffDays = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= withinDays;
}

/** Formats a raw ISO timestamp (e.g. assignment deadlines) as "Aug 5, 2026, 6:30 PM". Falls back to the original string if it isn't a parseable date. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Formats a raw ISO date (e.g. batch start/end dates) as "Jan 1, 2026" — no time component, since these represent calendar dates rather than a specific moment. Falls back to the original string if it isn't a parseable date. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { dateStyle: 'medium' });
}

/** Formats an ISO timestamp as a short relative label ("5m ago", "2h ago", "3d ago") for
 * glanceable display (e.g. notifications) — pair with formatDateTime(iso) in a `title` tooltip
 * for the exact moment. Falls back to an absolute date once it's more than a week old, since
 * "12d ago" reads worse than a calendar date at that distance. */
export function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(iso);
}
