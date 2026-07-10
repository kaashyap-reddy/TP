import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FeedbackEntry } from '../types/feedback';
import * as feedbackService from '../services/feedback.service';

export type { FeedbackEntry } from '../types/feedback';

interface FeedbackState {
  feedback: FeedbackEntry[];
  submitFeedback: (input: Omit<FeedbackEntry, 'id'>) => FeedbackEntry;
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set) => ({
      feedback: feedbackService.getFeedback(),
      submitFeedback: (input) => {
        const entry = feedbackService.submitFeedback(input);
        set((state) => ({ feedback: [entry, ...state.feedback] }));
        return entry;
      }
    }),
    { name: 'tp-feedback' }
  )
);
