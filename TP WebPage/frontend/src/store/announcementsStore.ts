import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Announcement } from '../types/announcement';
import * as announcementsService from '../services/announcements.service';

export type { Announcement } from '../types/announcement';

interface AnnouncementsState {
  announcements: Announcement[];
  postAnnouncement: (input: Omit<Announcement, 'id' | 'readByCount'>) => Announcement;
  markRead: (id: string) => void;
}

export const useAnnouncementsStore = create<AnnouncementsState>()(
  persist(
    (set) => ({
      announcements: announcementsService.getAnnouncements(),
      postAnnouncement: (input) => {
        const announcement = announcementsService.postAnnouncement(input);
        set((state) => ({ announcements: [announcement, ...state.announcements] }));
        return announcement;
      },
      markRead: (id) => {
        set((state) => ({ announcements: announcementsService.markRead(state.announcements, id) }));
      }
    }),
    { name: 'tp-announcements' }
  )
);
