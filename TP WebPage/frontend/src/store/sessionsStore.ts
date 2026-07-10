import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SessionStatus, MeetingPlatform, Session } from '../types/session';

export type { SessionStatus, MeetingPlatform, Session } from '../types/session';

let idCounter = 100;
function nextSessionId() {
  idCounter += 1;
  return `session-${idCounter}`;
}

const INITIAL_SESSIONS: Session[] = [
  { id: 'session-1', title: 'BA Mock Assessment', batchId: 'ba-btech', facilitator: 'Srikar Kulkarni', date: 'Jul 10, 2026', time: '10:00 AM - 11:30 AM', link: '', platform: 'Google Meet', status: 'Upcoming', presentCount: null, absentCount: null },
  { id: 'session-2', title: 'Data Pipeline Review', batchId: 'de-btech', facilitator: 'Dinesh Paraman', date: 'Jul 11, 2026', time: '2:00 PM - 3:30 PM', link: '', platform: 'Microsoft Teams', status: 'Upcoming', presentCount: null, absentCount: null },
  { id: 'session-3', title: 'ML Model Walkthrough', batchId: 'aiml-btech', facilitator: 'Junaid Mohammed', date: 'Jul 9, 2026', time: '11:00 AM - 12:00 PM', link: '', platform: 'Zoom', status: 'Upcoming', presentCount: null, absentCount: null },
  { id: 'session-4', title: 'Design Critique Session', batchId: 'uiux-btech', facilitator: 'Kaashyap Reddy', date: 'Jul 3, 2026', time: '3:00 PM - 4:00 PM', link: '', platform: 'Google Meet', status: 'Completed', presentCount: 22, absentCount: 3 },
  { id: 'session-5', title: 'Weekly Sync Call', batchId: 'ba-mba', facilitator: 'Srikar Kulkarni', date: 'Oct 8, 2026', time: '2:00 PM - 3:00 PM', link: '', platform: 'Zoom', status: 'Completed', presentCount: 19, absentCount: 3 }
];

interface SessionsState {
  sessions: Session[];
  createSession: (input: Omit<Session, 'id' | 'presentCount' | 'absentCount'>) => Session;
  updateSession: (id: string, changes: Partial<Session>) => void;
}

export const useSessionsStore = create<SessionsState>()(
  persist(
    (set) => ({
  sessions: INITIAL_SESSIONS,
  createSession: (input) => {
    const session: Session = { id: nextSessionId(), presentCount: null, absentCount: null, ...input };
    set((state) => ({ sessions: [session, ...state.sessions] }));
    return session;
  },
  updateSession: (id, changes) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...changes } : s))
    }))
    }),
    { name: 'tp-sessions' }
  )
);
