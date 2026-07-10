import { create } from 'zustand';
import { Role } from '../api/auth';
import { getPermissionsForRole } from '../constants/permissions';

interface AuthState {
  id: string | null;
  email: string | null;
  role: Role | null;
  displayName: string | null;
  permissions: string[];
  hydrated: boolean;
  setSession: (session: { id?: string; email: string; role: Role; displayName?: string }) => void;
  updateDisplayName: (name: string) => void;
  updateEmail: (email: string) => void;
  clearSession: () => void;
  markHydrated: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  id: null,
  email: null,
  role: null,
  displayName: null,
  permissions: [],
  hydrated: false,
  setSession: ({ id, email, role, displayName }) =>
    set({
      id: id ?? email,
      email,
      role,
      displayName: displayName ?? email.split('@')[0],
      permissions: getPermissionsForRole(role),
      hydrated: true
    }),
  updateDisplayName: (name) => set({ displayName: name }),
  updateEmail: (email) => set({ email }),
  clearSession: () => set({ id: null, email: null, role: null, displayName: null, permissions: [] }),
  markHydrated: () => set({ hydrated: true })
}));
