import { Role } from '../../types/role';
import type { TeamsContactable } from '../../utils/teamsContact';
import { api } from './apiClient';

export interface ApiUserProfile {
  phone: string | null;
  location: string | null;
  company: string | null;
  department: string | null;
  idNumber: string | null;
  avatarStorageKey: string | null;
}

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  profile: ApiUserProfile | null;
  /** Teams contact fields (Phase 10) -- absent/undefined means "not configured", not "no Teams access". */
  teamsUserId?: string | null;
  teamsChatUrl?: string | null;
  teamsEnabled?: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function listUsers(params?: {
  role?: Role;
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<ApiUser>> {
  return api.get<PaginatedResponse<ApiUser>>('/users', params);
}

export async function getUser(id: string): Promise<ApiUser> {
  const { user } = await api.get<{ user: ApiUser }>(`/users/${id}`);
  return user;
}

export async function getMe(): Promise<ApiUser> {
  const { user } = await api.get<{ user: ApiUser }>('/users/me');
  return user;
}

export async function updateMe(input: { name?: string; email?: string; phone?: string; location?: string }): Promise<ApiUser> {
  const { user } = await api.patch<{ user: ApiUser }>('/users/me', input);
  return user;
}

export async function updateUser(
  id: string,
  input: Partial<{
    name: string;
    email: string;
    role: Role;
    isActive: boolean;
    phone: string;
    location: string;
    company: string;
    department: string;
    idNumber: string;
  }>
): Promise<ApiUser> {
  const { user } = await api.patch<{ user: ApiUser }>(`/users/${id}`, input);
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}

/** Best-effort resolution for UI flows that only collect a free-text name (e.g. batch POC, invite recipient). */
export async function findUserIdByName(name: string, role: Role): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data } = await listUsers({ role, search: trimmed, pageSize: 5 });
  const exact = data.find((u) => u.name.toLowerCase() === trimmed.toLowerCase());
  return exact?.id ?? data[0]?.id ?? null;
}

/** Resolves a trainee/facilitator's real email from a display name — used by internal/admin
 * email actions that are NOT the trainee's primary Contact action (see Phase 13). */
export async function findUserEmailByName(name: string, role: Role): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data } = await listUsers({ role, search: trimmed, pageSize: 5 });
  const exact = data.find((u) => u.name.toLowerCase() === trimmed.toLowerCase());
  return exact?.email ?? data[0]?.email ?? null;
}

/** Resolves a facilitator's Teams-contact fields from a display name -- used by every trainee
 * "Contact" action (see utils/teamsContact.ts). Returns null if no user matches at all. */
export async function findFacilitatorContactByName(name: string): Promise<TeamsContactable | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data } = await listUsers({ role: 'facilitator', search: trimmed, pageSize: 5 });
  const match = data.find((u) => u.name.toLowerCase() === trimmed.toLowerCase()) ?? data[0];
  if (!match) return null;
  return { name: match.name, email: match.email, teamsUserId: match.teamsUserId, teamsChatUrl: match.teamsChatUrl, teamsEnabled: match.teamsEnabled };
}
