import type { FeedbackEntry } from '../types/feedback';
import { INITIAL_FEEDBACK } from './mockData/feedback.mock';

let idCounter = 100;
function nextFeedbackId() {
  idCounter += 1;
  return `feedback-${idCounter}`;
}

// TODO: replace with a real API call (GET /api/feedback) once a backend exists.
export function getFeedback(): FeedbackEntry[] {
  return INITIAL_FEEDBACK;
}

// TODO: replace with a real API call (POST /api/feedback) once a backend exists.
export function submitFeedback(input: Omit<FeedbackEntry, 'id'>): FeedbackEntry {
  return { id: nextFeedbackId(), ...input };
}
