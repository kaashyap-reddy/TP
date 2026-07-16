import type { Announcement } from '../types/announcement';
import { INITIAL_ANNOUNCEMENTS } from './mockData/announcements.mock';

let idCounter = 100;
function nextAnnouncementId() {
  idCounter += 1;
  return `announcement-${idCounter}`;
}

// The real backend routes now exist (GET/POST /api/announcements, POST /:id/read — see
// backend/src/routes/announcements.routes.ts) but this store stays on mock fixtures until the
// app runs against a live database; switching it is an async-store refactor across all three
// dashboards, deliberately deferred with the rest of the real-mode wiring.
export function getAnnouncements(): Announcement[] {
  return INITIAL_ANNOUNCEMENTS;
}

export function postAnnouncement(input: Omit<Announcement, 'id' | 'readByCount'>): Announcement {
  return { id: nextAnnouncementId(), readByCount: 0, ...input };
}

export function markRead(announcements: Announcement[], id: string): Announcement[] {
  return announcements.map((a) => (a.id === id ? { ...a, readByCount: a.readByCount + 1 } : a));
}
