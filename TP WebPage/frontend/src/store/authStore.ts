import { create } from 'zustand';
import { Role } from '../api/auth';

interface AuthState {
  email: string | null;
  role: Role | null;
  displayName: string | null;
  hydrated: boolean;
  setSession: (session: { email: string; role: Role; displayName?: string }) => void;
  updateDisplayName: (name: string) => void;
  clearSession: () => void;
  markHydrated: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  email: null,
  role: null,
  displayName: null,
  hydrated: false,
  setSession: ({ email, role, displayName }) =>
    set({ email, role, displayName: displayName ?? email.split('@')[0], hydrated: true }),
  updateDisplayName: (name) => set({ displayName: name }),
  clearSession: () => set({ email: null, role: null, displayName: null }),
  markHydrated: () => set({ hydrated: true })
}));
