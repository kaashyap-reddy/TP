import { create } from 'zustand';
import type { Announcement } from '../types/announcement';
import type { Batch } from '../types/batch';
import * as announcementsService from '../services/announcements.service';

export type { Announcement } from '../types/announcement';

interface AnnouncementsState {
  announcements: Announcement[];
  isLoading: boolean;
  error: string | null;
  fetchAnnouncements: (batches: Batch[], filters?: { batchId?: string }) => Promise<void>;
  postAnnouncement: (input: announcementsService.CreateAnnouncementInput, batches: Batch[]) => Promise<Announcement>;
  markRead: (id: string) => void;
}

export const useAnnouncementsStore = create<AnnouncementsState>()((set, get) => ({
  announcements: [],
  isLoading: false,
  error: null,
  fetchAnnouncements: async (batches, filters) => {
    set({ isLoading: true, error: null });
    try {
      const announcements = await announcementsService.listAnnouncements(batches, filters);
      set({ announcements, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Unable to load announcements.' });
    }
  },
  postAnnouncement: async (input, batches) => {
    const announcement = await announcementsService.postAnnouncement(input, batches);
    set((state) => ({ announcements: [announcement, ...state.announcements] }));
    return announcement;
  },
  markRead: (id) => {
    const target = get().announcements.find((a) => a.id === id);
    if (!target || target.isRead) return; // already read — the real endpoint upserts anyway, but skip the round trip
    set((state) => ({
      announcements: state.announcements.map((a) => (a.id === id ? { ...a, isRead: true, readByCount: a.readByCount + 1 } : a))
    }));
    void announcementsService.markAnnouncementRead(id).catch(() => undefined);
  }
}));
