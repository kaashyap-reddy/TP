import { Role } from '../api/auth';

const STORAGE_KEY = 'tp_auth';

export interface StoredSession {
  email: string;
  role: Role;
  displayName: string;
}

export function writeSession(session: StoredSession, rememberMe: boolean) {
  const payload = JSON.stringify(session);
  if (rememberMe) {
    localStorage.setItem(STORAGE_KEY, payload);
    sessionStorage.removeItem(STORAGE_KEY);
  } else {
    sessionStorage.setItem(STORAGE_KEY, payload);
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function readSession(): StoredSession | null {
  const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function clearSessionStorage() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}

export function updateStoredSession(patch: Partial<StoredSession>) {
  const current = readSession();
  if (!current) return;
  const updated = { ...current, ...patch };
  const payload = JSON.stringify(updated);
  if (localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, payload);
  } else {
    sessionStorage.setItem(STORAGE_KEY, payload);
  }
}
