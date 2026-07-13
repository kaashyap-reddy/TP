import { create } from 'zustand';
import type { FeedbackDirection, FeedbackEntry } from '../types/feedback';
import * as feedbackService from '../services/api/feedbackService';

export type { FeedbackEntry, FeedbackDirection } from '../types/feedback';

interface FeedbackState {
  feedback: FeedbackEntry[];
  isLoading: boolean;
  error: string | null;
  fetchFeedback: (filters?: { batchId?: string; traineeId?: string; facilitatorId?: string; direction?: FeedbackDirection }) => Promise<void>;
  submitFeedback: (input: Omit<FeedbackEntry, 'id' | 'direction'>) => Promise<FeedbackEntry>;
  submitFeedbackAboutFacilitator: (input: { batchId: string; facilitatorId: string; category: string; rating: number; comment?: string }) => Promise<FeedbackEntry>;
}

export const useFeedbackStore = create<FeedbackState>()((set, get) => ({
  feedback: [],
  isLoading: false,
  error: null,
  fetchFeedback: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const feedback = await feedbackService.listFeedback(filters);
      set({ feedback, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Unable to load feedback.' });
    }
  },
  submitFeedback: async (input) => {
    const entry = await feedbackService.submitFeedback(input);
    set({ feedback: [entry, ...get().feedback] });
    return entry;
  },
  submitFeedbackAboutFacilitator: async (input) => {
    const entry = await feedbackService.submitFeedbackAboutFacilitator(input);
    set({ feedback: [entry, ...get().feedback] });
    return entry;
  }
}));
