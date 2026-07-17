import type { Announcement } from '../types/announcement';
import type { Batch } from '../types/batch';
import { api } from './api/apiClient';

interface ApiAnnouncement {
  id: string;
  title: string;
  message: string;
  priority: 'Normal' | 'Important' | 'Critical';
  audience: string;
  pinned: boolean;
  scheduledFor: string | null;
  expiresAt: string | null;
  createdAt: string;
  author: { id: string; name: string; email: string };
  batch: { id: string; name: string; code: string } | null;
  readByCount: number;
  isRead: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

/**
 * The backend tracks real *readers* (readByCount) but not a target audience size — that's a
 * purely client-side estimate for display, derived from the same free-text `audience` label
 * the poster chose. Shared here so both the create-time estimate and the list-time estimate
 * use identical logic.
 */
export function computeAudienceCount(audience: string, batches: Batch[]): number {
  if (audience === 'All Users' || audience === 'All Active Batches' || audience === 'Trainees Only') {
    return batches.reduce((sum, b) => sum + b.traineeCount, 0);
  }
  if (audience === 'Facilitators Only') {
    return new Set(batches.map((b) => b.poc)).size;
  }
  const batch = batches.find((b) => b.name === audience);
  return batch?.traineeCount ?? 0;
}

function toFrontendAnnouncement(row: ApiAnnouncement, batches: Batch[]): Announcement {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    priority: row.priority,
    audience: row.audience,
    author: row.author.name,
    date: new Date(row.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    pinned: row.pinned,
    scheduledFor: row.scheduledFor,
    expiresAt: row.expiresAt,
    readByCount: row.readByCount,
    isRead: row.isRead,
    audienceCount: computeAudienceCount(row.audience, batches)
  };
}

export async function listAnnouncements(batches: Batch[], filters?: { batchId?: string }): Promise<Announcement[]> {
  const res = await api.get<PaginatedResponse<ApiAnnouncement>>('/announcements', { ...filters, pageSize: 100 });
  return res.data.map((row) => toFrontendAnnouncement(row, batches));
}

export interface CreateAnnouncementInput {
  title: string;
  message: string;
  priority: Announcement['priority'];
  /** Free-text label shown in the UI (e.g. "All Trainees", a specific batch's name). */
  audience: string;
  /** Real visibility scope: null = global (admin only), a batch id = that batch's members. */
  batchId: string | null;
  pinned: boolean;
  scheduledFor: string | null;
  expiresAt: string | null;
}

export async function postAnnouncement(input: CreateAnnouncementInput, batches: Batch[]): Promise<Announcement> {
  const created = await api.post<{ announcement: ApiAnnouncement }>('/announcements', {
    title: input.title,
    message: input.message,
    priority: input.priority,
    audience: input.audience,
    batchId: input.batchId,
    pinned: input.pinned,
    scheduledFor: input.scheduledFor || undefined,
    expiresAt: input.expiresAt || undefined
  });
  return toFrontendAnnouncement(created.announcement, batches);
}

export async function markAnnouncementRead(id: string): Promise<void> {
  await api.post(`/announcements/${id}/read`);
}
