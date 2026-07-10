import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SessionStatus, MeetingPlatform, Session } from '../types/session';
import * as sessionsService from '../services/sessions.service';

export type { SessionStatus, MeetingPlatform, Session } from '../types/session';

interface SessionsState {
  sessions: Session[];
  createSession: (input: Omit<Session, 'id' | 'presentCount' | 'absentCount'>) => Session;
  updateSession: (id: string, changes: Partial<Session>) => void;
}

export const useSessionsStore = create<SessionsState>()(
  persist(
    (set) => ({
      sessions: sessionsService.getSessions(),
      createSession: (input) => {
        const session = sessionsService.createSession(input);
        set((state) => ({ sessions: [session, ...state.sessions] }));
        return session;
      },
      updateSession: (id, changes) =>
        set((state) => ({ sessions: sessionsService.updateSession(state.sessions, id, changes) }))
    }),
    { name: 'tp-sessions' }
  )
);
