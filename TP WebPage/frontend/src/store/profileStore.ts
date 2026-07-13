import { create } from 'zustand';
import type { Role } from '../types/role';
import type { RoleProfile } from '../types/profile';
import * as userService from '../services/api/userService';

export type { RoleProfile } from '../types/profile';

const EMPTY_PROFILE: RoleProfile = { phone: '', location: '', avatarDataUrl: null };

interface ProfileState {
  profiles: Record<Role, RoleProfile>;
  isLoading: boolean;
  error: string | null;
  /** Loads the currently authenticated user's own profile into profiles[role]. */
  fetchMyProfile: (role: Role) => Promise<void>;
  updateProfile: (role: Role, patch: Partial<RoleProfile>) => Promise<void>;
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
  profiles: { admin: EMPTY_PROFILE, facilitator: EMPTY_PROFILE, trainee: EMPTY_PROFILE },
  isLoading: false,
  error: null,
  fetchMyProfile: async (role) => {
    set({ isLoading: true, error: null });
    try {
      const user = await userService.getMe();
      const existing = get().profiles[role];
      set({
        isLoading: false,
        profiles: {
          ...get().profiles,
          [role]: {
            ...existing,
            phone: user.profile?.phone ?? '',
            location: user.profile?.location ?? '',
            company: user.profile?.company ?? undefined,
            department: user.profile?.department ?? undefined,
            idNumber: user.profile?.idNumber ?? undefined
          }
        }
      });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Unable to load profile.' });
    }
  },
  updateProfile: async (role, patch) => {
    // avatarDataUrl has no backend counterpart yet (no avatar-upload endpoint) — kept local-only.
    const { avatarDataUrl, ...editable } = patch;
    if (Object.keys(editable).length > 0) {
      await userService.updateMe(editable);
    }
    set({
      profiles: {
        ...get().profiles,
        [role]: { ...get().profiles[role], ...patch }
      }
    });
  }
}));
