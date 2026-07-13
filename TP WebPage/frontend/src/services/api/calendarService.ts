import { api } from './apiClient';

export type CalendarEventType = 'session' | 'assignment-deadline';

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  start: string;
  end: string | null;
  batchIds: string[];
  batchNames: string[];
  relatedEntityId: string;
  status: string;
  metadata: {
    platform?: string;
    meetingLink?: string | null;
    facilitatorName?: string | null;
  };
}

export interface CalendarFilters {
  batchId?: string;
  type?: 'all' | CalendarEventType;
}

/** One aggregated request instead of the frontend fetching sessions + assignments separately and merging client-side. */
export async function listCalendarEvents(filters?: CalendarFilters): Promise<CalendarEvent[]> {
  const res = await api.get<{ events: CalendarEvent[] }>('/calendar', filters as Record<string, string | undefined> | undefined);
  return res.events;
}
