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
