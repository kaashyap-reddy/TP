import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '../types/role';
import type { RoleProfile } from '../types/profile';

export type { RoleProfile } from '../types/profile';

const DEFAULT_PROFILES: Record<Role, RoleProfile> = {
  admin: {
    phone: '+91 98765 43210',
    location: 'Hyderabad, India',
    avatarDataUrl: null,
    company: 'TechCorp Solutions',
    department: 'Learning & Development',
    idNumber: 'TC-ADM-0042'
  },
  facilitator: {
    phone: '+91 91234 56780',
    location: 'Bengaluru, India',
    avatarDataUrl: null,
    company: 'TechCorp Solutions',
    department: 'AI ML Training',
    idNumber: 'TC-FAC-0117'
  },
  trainee: {
    phone: '+91 90123 45678',
    location: 'Pune, India',
    avatarDataUrl: null,
    batch: 'BA BTech',
    course: 'Business Analysis',
    idNumber: 'TC-TRN-2114'
  }
};

interface ProfileState {
  profiles: Record<Role, RoleProfile>;
  updateProfile: (role: Role, patch: Partial<RoleProfile>) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profiles: DEFAULT_PROFILES,
      updateProfile: (role, patch) =>
        set((state) => ({
          profiles: { ...state.profiles, [role]: { ...state.profiles[role], ...patch } }
        }))
    }),
    { name: 'tp_profile' }
  )
);
