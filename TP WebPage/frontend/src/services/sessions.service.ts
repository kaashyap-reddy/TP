import type { Session } from '../types/session';
import { INITIAL_SESSIONS } from './mockData/sessions.mock';

let idCounter = 100;
function nextSessionId() {
  idCounter += 1;
  return `session-${idCounter}`;
}

// TODO: replace with a real API call (GET /api/sessions) once a backend exists.
export function getSessions(): Session[] {
  return INITIAL_SESSIONS;
}

// TODO: replace with a real API call (POST /api/sessions) once a backend exists.
export function createSession(input: Omit<Session, 'id' | 'presentCount' | 'absentCount'>): Session {
  return { id: nextSessionId(), presentCount: null, absentCount: null, ...input };
}

// TODO: replace with a real API call (PATCH /api/sessions/:id) once a backend exists.
export function updateSession(sessions: Session[], id: string, changes: Partial<Session>): Session[] {
  return sessions.map((s) => (s.id === id ? { ...s, ...changes } : s));
}
