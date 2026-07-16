import { Role } from '../../types/role';
import { api, setAccessToken } from './apiClient';
import { isDemoMode } from './demoMode';

// The refresh cookie is httpOnly (invisible to JS), so this flag is the only client-side signal
// that a session might exist. Without it, every cold visit to the login page would fire a
// doomed POST /auth/refresh — which the browser logs as a console error (a 401, or a 500 via
// the Vite proxy when the backend is down) before anyone has ever logged in.
const SESSION_HINT_KEY = 'tp-session-hint';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
}

interface SessionResponse {
  user: AuthUser;
  accessToken: string;
}

export async function login(email: string, password: string, rememberMe = false): Promise<AuthUser> {
  const { user, accessToken } = await api.post<SessionResponse>('/auth/login', { email, password, rememberMe });
  setAccessToken(accessToken);
  localStorage.setItem(SESSION_HINT_KEY, '1');
  return user;
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
    localStorage.removeItem(SESSION_HINT_KEY);
  }
}

/** Silently re-establishes a session from the httpOnly refresh cookie. Returns null (not a throw) on failure. */
export async function refresh(): Promise<AuthUser | null> {
  // Demo sessions are always "refreshable" (handled locally, no network); otherwise don't
  // bother the server unless a login has happened on this browser at some point.
  if (!isDemoMode() && !localStorage.getItem(SESSION_HINT_KEY)) return null;
  try {
    const { user, accessToken } = await api.post<SessionResponse>('/auth/refresh');
    setAccessToken(accessToken);
    if (!isDemoMode()) localStorage.setItem(SESSION_HINT_KEY, '1');
    return user;
  } catch {
    setAccessToken(null);
    localStorage.removeItem(SESSION_HINT_KEY);
    return null;
  }
}

export async function getMe(): Promise<AuthUser> {
  const { user } = await api.get<{ user: AuthUser }>('/auth/me');
  return user;
}

// `token` is only present when the backend has token exposure enabled (dev/test — see
// backend's config.exposeAuthTokens). In production it's omitted since no email provider is
// connected yet to deliver it any other way; callers must handle its absence.
export async function createInvite(email: string, role: Role = 'trainee'): Promise<{ email: string; token?: string; expiresAt: string }> {
  return api.post('/auth/invite', { email, role });
}

export async function acceptInvite(token: string, password: string): Promise<{ role: Role }> {
  return api.post('/auth/invite/accept', { token, password });
}

export async function forgotPassword(email: string, newPassword: string): Promise<void> {
  await api.post('/auth/forgot-password', { email, newPassword });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/auth/change-password', { currentPassword, newPassword });
}
