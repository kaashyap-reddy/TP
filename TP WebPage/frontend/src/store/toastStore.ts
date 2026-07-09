import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastState {
  message: string | null;
  variant: ToastVariant;
  key: number;
  showToast: (message: string, variant?: ToastVariant) => void;
  clearToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  variant: 'success',
  key: 0,
  showToast: (message, variant = 'success') => set((state) => ({ message, variant, key: state.key + 1 })),
  clearToast: () => set({ message: null })
}));
