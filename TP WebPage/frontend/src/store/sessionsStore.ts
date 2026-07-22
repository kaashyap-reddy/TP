import { create } from 'zustand';
import type { Session } from '../types/session';
import * as sessionService from '../services/api/sessionService';

export type { SessionStatus, MeetingPlatform, Session } from '../types/session';

interface SessionsState {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
  fetchSessions: (filters?: { batchId?: string }) => Promise<void>;
  createSession: (input: sessionService.CreateSessionInput) => Promise<Session>;
  updateSession: (id: string, changes: Partial<Session>) => Promise<void>;
  assignSessionTrainer: (id: string, input: sessionService.TrainerAssignmentInput) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
}

export const useSessionsStore = create<SessionsState>()((set, get) => ({
  sessions: [],
  isLoading: false,
  error: null,
  fetchSessions: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const sessions = await sessionService.listSessions(filters);
      set({ sessions, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Unable to load sessions.' });
    }
  },
  createSession: async (input) => {
    const session = await sessionService.createSession(input);
    set({ sessions: [session, ...get().sessions] });
    return session;
  },
  updateSession: async (id, changes) => {
    const updated = await sessionService.updateSession(id, changes);
    set({ sessions: get().sessions.map((s) => (s.id === id ? { ...s, ...updated } : s)) });
  },
  assignSessionTrainer: async (id, input) => {
    const updated = await sessionService.assignSessionTrainer(id, input);
    set({ sessions: get().sessions.map((s) => (s.id === id ? updated : s)) });
    return updated;
  },
  deleteSession: async (id) => {
    await sessionService.deleteSession(id);
    set({ sessions: get().sessions.filter((s) => s.id !== id) });
  }
}));
