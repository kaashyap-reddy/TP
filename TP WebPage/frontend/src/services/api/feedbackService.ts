import type { FeedbackDirection, FeedbackEntry } from '../../types/feedback';
import { api } from './apiClient';
import { findUserIdByName } from './userService';

interface ApiFeedback {
  id: string;
  batchId: string;
  category: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  direction: FeedbackDirection;
  trainee: { id: string; name: string; email: string };
  facilitator: { id: string; name: string; email: string };
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

function toFrontendFeedback(apiFeedback: ApiFeedback): FeedbackEntry {
  return {
    id: apiFeedback.id,
    trainee: apiFeedback.trainee?.name ?? '',
    traineeId: apiFeedback.trainee?.id,
    facilitator: apiFeedback.facilitator?.name ?? '',
    facilitatorId: apiFeedback.facilitator?.id,
    batchId: apiFeedback.batchId,
    category: apiFeedback.category,
    rating: apiFeedback.rating,
    comment: apiFeedback.comment ?? '',
    date: new Date(apiFeedback.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    direction: apiFeedback.direction ?? 'FacilitatorToTrainee'
  };
}

export async function listFeedback(filters?: {
  batchId?: string;
  traineeId?: string;
  facilitatorId?: string;
  direction?: FeedbackDirection;
}): Promise<FeedbackEntry[]> {
  const res = await api.get<PaginatedResponse<ApiFeedback>>('/feedback', { ...filters, pageSize: 200 });
  return res.data.map(toFrontendFeedback);
}

/** Admin/facilitator submitting feedback about a trainee (existing flow). */
export async function submitFeedback(input: Omit<FeedbackEntry, 'id' | 'direction'>): Promise<FeedbackEntry> {
  const traineeId = await findUserIdByName(input.trainee, 'trainee');
  if (!traineeId) throw new Error(`No trainee found named "${input.trainee}".`);

  const created = await api.post<{ feedback: ApiFeedback }>('/feedback', {
    batchId: input.batchId,
    traineeId,
    category: input.category,
    rating: input.rating,
    comment: input.comment || undefined
  });
  return toFrontendFeedback(created.feedback);
}

/** A trainee submitting feedback about the facilitator assigned to their batch. */
export async function submitFeedbackAboutFacilitator(input: {
  batchId: string;
  facilitatorId: string;
  category: string;
  rating: number;
  comment?: string;
}): Promise<FeedbackEntry> {
  const created = await api.post<{ feedback: ApiFeedback }>('/feedback', {
    batchId: input.batchId,
    facilitatorId: input.facilitatorId,
    category: input.category,
    rating: input.rating,
    comment: input.comment || undefined
  });
  return toFrontendFeedback(created.feedback);
}
