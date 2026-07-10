import type { MockUser } from '../types/user';
import { MOCK_USERS } from './mockData/users.mock';
import { getPermissionsForRole } from '../constants/permissions';
import { useAuthStore } from '../store/authStore';
import { clearSessionStorage } from '../utils/authSession';

const MOCK_LATENCY_MS = 500;

function delay<T>(value: T, ms = MOCK_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function findRecord(email: string) {
  return MOCK_USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
}

// TODO: replace with a real API call (POST /api/auth/login) once JWT/API auth is wired up.
export async function login(email: string, password: string): Promise<MockUser> {
  await delay(undefined);
  const record = findRecord(email);
  if (!record || !record.active) {
    throw new Error('No account found for this email.');
  }
  if (record.password !== password) {
    throw new Error('Incorrect password.');
  }
  return { id: record.id, name: record.name, email: record.email, role: record.role, permissions: getPermissionsForRole(record.role) };
}

// TODO: replace with a real API call (POST /api/auth/reset-password) once a backend exists.
export async function resetPassword(email: string, newPassword: string): Promise<void> {
  await delay(undefined, 400);
  const record = findRecord(email);
  if (!record || !record.active) {
    throw new Error('No account found for this email.');
  }
  record.password = newPassword;
}

export function logout(): void {
  useAuthStore.getState().clearSession();
  clearSessionStorage();
}
