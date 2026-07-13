import { create } from 'zustand';
import { refresh as refreshSession } from '../services/api/authService';
import { Role } from '../types/role';

interface AuthState {
  id: string | null;
  email: string | null;
  role: Role | null;
  displayName: string | null;
  permissions: string[];
  hydrated: boolean;
  setSession: (session: { id?: string; email: string; role: Role; displayName?: string; permissions?: string[] }) => void;
  updateDisplayName: (name: string) => void;
  updateEmail: (email: string) => void;
  clearSession: () => void;
  /** Silently re-establishes a session from the refresh cookie on app boot. */
  bootstrap: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  id: null,
  email: null,
  role: null,
  displayName: null,
  permissions: [],
  hydrated: false,
  setSession: ({ id, email, role, displayName, permissions }) =>
    set({
      id: id ?? email,
      email,
      role,
      displayName: displayName ?? email.split('@')[0],
      permissions: permissions ?? [],
      hydrated: true
    }),
  updateDisplayName: (name) => set({ displayName: name }),
  updateEmail: (email) => set({ email }),
  clearSession: () => set({ id: null, email: null, role: null, displayName: null, permissions: [] }),
  bootstrap: async () => {
    const user = await refreshSession();
    if (user) {
      set({
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.name,
        permissions: user.permissions,
        hydrated: true
      });
    } else {
      set({ hydrated: true });
    }
  }
}));
