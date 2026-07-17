export interface Announcement {
  id: string;
  title: string;
  message: string;
  priority: 'Normal' | 'Important' | 'Critical';
  audience: string;
  author: string;
  date: string;
  pinned: boolean;
  scheduledFor: string | null;
  expiresAt: string | null;
  readByCount: number;
  audienceCount: number;
  isRead: boolean;
}
