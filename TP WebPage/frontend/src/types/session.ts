export type SessionStatus = 'Upcoming' | 'Live' | 'Completed' | 'Cancelled' | 'Rescheduled';
export type MeetingPlatform = 'Google Meet' | 'Microsoft Teams' | 'Zoom' | 'Other';

export interface Session {
  id: string;
  title: string;
  batchId: string;
  facilitator: string;
  date: string;
  time: string;
  link: string;
  platform: MeetingPlatform;
  status: SessionStatus;
  presentCount: number | null;
  absentCount: number | null;
}
