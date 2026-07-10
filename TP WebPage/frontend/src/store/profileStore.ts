import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '../types/role';
import type { RoleProfile } from '../types/profile';
import * as profileService from '../services/profile.service';

export type { RoleProfile } from '../types/profile';

interface ProfileState {
  profiles: Record<Role, RoleProfile>;
  updateProfile: (role: Role, patch: Partial<RoleProfile>) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profiles: profileService.getProfiles(),
      updateProfile: (role, patch) =>
        set((state) => ({ profiles: profileService.updateProfile(state.profiles, role, patch) }))
    }),
    { name: 'tp_profile' }
  )
);
