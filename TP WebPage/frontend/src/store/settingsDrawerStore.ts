import { create } from 'zustand';

// Single source of truth for the Account Settings drawer so the sidebar, the mobile nav drawer,
// and the profile/account dropdown menu -- three different places in the component tree -- all
// open and close the exact same drawer instance instead of each owning their own local state
// (which previously let the profile dropdown navigate to a different full-page experience).
interface SettingsDrawerState {
  open: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useSettingsDrawerStore = create<SettingsDrawerState>((set) => ({
  open: false,
  openSettings: () => set({ open: true }),
  closeSettings: () => set({ open: false })
}));
