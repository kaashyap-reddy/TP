import type { Announcement } from '../../types/announcement';

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'announcement-1',
    title: 'Critical: Server Maintenance',
    message: 'The portal will be down for maintenance from 12 AM to 4 AM on Oct 14.',
    priority: 'Critical',
    audience: 'All Users',
    author: 'Admin',
    date: 'Oct 1, 2026',
    pinned: true,
    scheduledFor: null,
    expiresAt: null,
    readByCount: 42,
    audienceCount: 184
  },
  {
    id: 'announcement-2',
    title: 'AI/ML Mock Assessment Tomorrow',
    message: 'Please ensure your environment is set up. Join 10 minutes early.',
    priority: 'Important',
    audience: 'AI ML BTech',
    author: 'Junaid Mohammed (Facilitator)',
    date: 'Today, 9:00 AM',
    pinned: false,
    scheduledFor: null,
    expiresAt: null,
    readByCount: 18,
    audienceCount: 24
  },
  {
    id: 'announcement-3',
    title: 'Reminder: Assignment Deadline',
    message: 'Reminder that the HTML/CSS Basics assignment is due this Friday at midnight.',
    priority: 'Normal',
    audience: 'All Active Batches',
    author: 'Facilitators',
    date: 'Oct 5, 2026',
    pinned: false,
    scheduledFor: null,
    expiresAt: null,
    readByCount: 55,
    audienceCount: 184
  }
];
