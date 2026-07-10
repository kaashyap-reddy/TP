import type { Announcement } from '../types/announcement';

export const PRIORITY_STYLES: Record<Announcement['priority'], { border: string; badge: string }> = {
  Critical: { border: 'border-l-red-500', badge: 'bg-red-100 text-red-700' },
  Important: { border: 'border-l-blue-500', badge: 'bg-blue-100 text-blue-700' },
  Normal: { border: 'border-l-gray-300', badge: 'bg-gray-100 text-gray-600' }
};
