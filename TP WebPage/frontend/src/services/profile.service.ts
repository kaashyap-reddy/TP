import type { Role } from '../types/role';
import type { RoleProfile } from '../types/profile';
import { DEFAULT_PROFILES } from './mockData/profile.mock';

// TODO: replace with a real API call (GET /api/profiles) once a backend exists.
export function getProfiles(): Record<Role, RoleProfile> {
  return DEFAULT_PROFILES;
}

// TODO: replace with a real API call (PATCH /api/profiles/:role) once a backend exists.
export function updateProfile(profiles: Record<Role, RoleProfile>, role: Role, patch: Partial<RoleProfile>): Record<Role, RoleProfile> {
  return { ...profiles, [role]: { ...profiles[role], ...patch } };
}
