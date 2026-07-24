import { create } from 'zustand';
import type { Role } from '../types/role';
import type { RoleProfile } from '../types/profile';
import * as userService from '../services/api/userService';
import type { ApiUser } from '../services/api/userService';

export type { RoleProfile } from '../types/profile';

const EMPTY_PROFILE: RoleProfile = { phone: '', location: '', avatarStorageKey: null, avatarUpdatedAt: null };

interface ProfileState {
  profiles: Record<Role, RoleProfile>;
  isLoading: boolean;
  error: string | null;
  /** Loads the currently authenticated user's own profile into profiles[role]. */
  fetchMyProfile: (role: Role) => Promise<void>;
  /** Applies an already-fetched user's profile fields to the cache -- makes no network call
   * itself, so callers that already hold a fresh ApiUser (post-save, post-avatar-upload) don't
   * trigger a redundant GET just to keep the cache in sync. */
  applyUserProfile: (role: Role, user: ApiUser) => void;
}

function profileFromUser(existing: RoleProfile, user: ApiUser): RoleProfile {
  return {
    ...existing,
    phone: user.profile?.phone ?? '',
    location: user.profile?.location ?? '',
    avatarStorageKey: user.profile?.avatarStorageKey ?? null,
    avatarUpdatedAt: user.profile?.avatarUpdatedAt ?? null,
    company: user.profile?.company ?? undefined,
    department: user.profile?.department ?? undefined,
    idNumber: user.profile?.idNumber ?? undefined
  };
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
  profiles: { admin: EMPTY_PROFILE, facilitator: EMPTY_PROFILE, trainee: EMPTY_PROFILE },
  isLoading: false,
  error: null,
  fetchMyProfile: async (role) => {
    set({ isLoading: true, error: null });
    try {
      const user = await userService.getMe();
      set({ isLoading: false, profiles: { ...get().profiles, [role]: profileFromUser(get().profiles[role], user) } });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Unable to load profile.' });
    }
  },
  applyUserProfile: (role, user) => {
    set({ profiles: { ...get().profiles, [role]: profileFromUser(get().profiles[role], user) } });
  }
}));
