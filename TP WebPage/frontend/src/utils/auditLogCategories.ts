// Buckets a raw audit-log event type into a broad category -- used by AdminDashboardHome's
// Recent Activity widget to decide which admin tab an entry's click should navigate to.
// Previously lived in NotificationPanel.tsx; moved here once notifications became a real,
// independently-typed backend feed decoupled from the audit log (see notificationService.ts).
export type AuditLogCategory = 'Assignment' | 'Session' | 'Announcement' | 'Resource' | 'Feedback' | 'Batch' | 'Other';

export function categorize(type: string): AuditLogCategory {
  if (['Assignment', 'Submission'].includes(type)) return 'Assignment';
  if (type === 'Session') return 'Session';
  if (type === 'Announcement') return 'Announcement';
  if (type === 'Resource') return 'Resource';
  if (type === 'Feedback') return 'Feedback';
  if (['Batch', 'Onboarding'].includes(type)) return 'Batch';
  return 'Other';
}
