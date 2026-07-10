import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FeedbackEntry } from '../types/feedback';

export type { FeedbackEntry } from '../types/feedback';

let idCounter = 100;
function nextFeedbackId() {
  idCounter += 1;
  return `feedback-${idCounter}`;
}

const INITIAL_FEEDBACK: FeedbackEntry[] = [
  { id: 'feedback-1', trainee: 'Priya Sharma', facilitator: 'Srikar Kulkarni', batchId: 'ba-btech', category: 'BA', rating: 4.5, comment: '', date: 'Jul 5, 2026' },
  { id: 'feedback-2', trainee: 'Rahul Verma', facilitator: 'Dinesh Paraman', batchId: 'de-btech', category: 'Data Engineering', rating: 4.8, comment: '', date: 'Jul 4, 2026' },
  { id: 'feedback-3', trainee: 'Ananya Patel', facilitator: 'Junaid Mohammed', batchId: 'aiml-btech', category: 'AI ML', rating: 5, comment: '', date: 'Jul 6, 2026' },
  { id: 'feedback-4', trainee: 'Vikram Singh', facilitator: 'Kaashyap Reddy', batchId: 'uiux-btech', category: 'UI/UX', rating: 4.6, comment: '', date: 'Jul 3, 2026' },
  { id: 'feedback-5', trainee: 'Sarah Connor', facilitator: 'Junaid Mohammed', batchId: 'aiml-btech', category: 'Communication', rating: 5, comment: 'Great presentation skills during the sprint review.', date: 'Oct 1, 2026' }
];

interface FeedbackState {
  feedback: FeedbackEntry[];
  submitFeedback: (input: Omit<FeedbackEntry, 'id'>) => FeedbackEntry;
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set) => ({
      feedback: INITIAL_FEEDBACK,
      submitFeedback: (input) => {
        const entry: FeedbackEntry = { id: nextFeedbackId(), ...input };
        set((state) => ({ feedback: [entry, ...state.feedback] }));
        return entry;
      }
    }),
    { name: 'tp-feedback' }
  )
);
