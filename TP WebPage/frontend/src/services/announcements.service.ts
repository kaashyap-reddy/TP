import type { Announcement } from '../types/announcement';
import { INITIAL_ANNOUNCEMENTS } from './mockData/announcements.mock';

let idCounter = 100;
function nextAnnouncementId() {
  idCounter += 1;
  return `announcement-${idCounter}`;
}

// TODO: replace with a real API call (GET /api/announcements) once a backend exists.
export function getAnnouncements(): Announcement[] {
  return INITIAL_ANNOUNCEMENTS;
}

// TODO: replace with a real API call (POST /api/announcements) once a backend exists.
export function postAnnouncement(input: Omit<Announcement, 'id' | 'readByCount'>): Announcement {
  return { id: nextAnnouncementId(), readByCount: 0, ...input };
}

// TODO: replace with a real API call (POST /api/announcements/:id/read) once a backend exists.
export function markRead(announcements: Announcement[], id: string): Announcement[] {
  return announcements.map((a) => (a.id === id ? { ...a, readByCount: a.readByCount + 1 } : a));
}
