import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Announcement } from '../types/announcement';

export type { Announcement } from '../types/announcement';

let idCounter = 100;
function nextAnnouncementId() {
  idCounter += 1;
  return `announcement-${idCounter}`;
}

const INITIAL_ANNOUNCEMENTS: Announcement[] = [
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

interface AnnouncementsState {
  announcements: Announcement[];
  postAnnouncement: (input: Omit<Announcement, 'id' | 'readByCount'>) => Announcement;
  markRead: (id: string) => void;
}

export const useAnnouncementsStore = create<AnnouncementsState>()(
  persist(
    (set) => ({
      announcements: INITIAL_ANNOUNCEMENTS,
      postAnnouncement: (input) => {
        const announcement: Announcement = { id: nextAnnouncementId(), readByCount: 0, ...input };
        set((state) => ({ announcements: [announcement, ...state.announcements] }));
        return announcement;
      },
      markRead: (id) => {
        set((state) => ({
          announcements: state.announcements.map((a) => (a.id === id ? { ...a, readByCount: a.readByCount + 1 } : a))
        }));
      }
    }),
    { name: 'tp-announcements' }
  )
);
