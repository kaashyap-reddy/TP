import { create } from 'zustand';
import type { AddFacilitatorAssignmentInput, FacilitatorAssignment } from '../types/facilitatorAssignment';
import * as facilitatorAssignmentService from '../services/api/facilitatorAssignmentService';

export type { FacilitatorAssignment, FacilitatorRole, FacilitatorAssignmentStatus } from '../types/facilitatorAssignment';

interface FacilitatorAssignmentsState {
  assignments: FacilitatorAssignment[];
  isLoading: boolean;
  error: string | null;
  fetchAssignments: (filters?: { batchId?: string; facilitatorId?: string }) => Promise<void>;
  addAssignment: (input: AddFacilitatorAssignmentInput) => Promise<FacilitatorAssignment>;
  updateAssignment: (id: string, changes: Partial<Pick<FacilitatorAssignment, 'role' | 'status' | 'notes'>>) => Promise<void>;
  setPrimaryCoordinator: (id: string) => Promise<void>;
  removeAssignment: (id: string) => Promise<void>;
}

export const useFacilitatorAssignmentsStore = create<FacilitatorAssignmentsState>()((set, get) => ({
  assignments: [],
  isLoading: false,
  error: null,
  fetchAssignments: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const fetched = await facilitatorAssignmentService.listFacilitatorAssignments(filters);
      set((state) => {
        // A batch-scoped fetch (e.g. the Facilitator Team drawer) should only refresh that
        // batch's rows, not wipe out every other batch's already-loaded team (needed so the
        // Batch Management table can show every row's team at once).
        if (filters?.batchId) {
          return { assignments: [...state.assignments.filter((a) => a.batchId !== filters.batchId), ...fetched], isLoading: false };
        }
        if (filters?.facilitatorId) {
          const ids = new Set(fetched.map((a) => a.id));
          return { assignments: [...state.assignments.filter((a) => !ids.has(a.id)), ...fetched], isLoading: false };
        }
        return { assignments: fetched, isLoading: false };
      });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Unable to load the facilitator team.' });
    }
  },
  addAssignment: async (input) => {
    const created = await facilitatorAssignmentService.addFacilitatorAssignment(input);
    set({ assignments: [...get().assignments, created] });
    return created;
  },
  updateAssignment: async (id, changes) => {
    const updated = await facilitatorAssignmentService.updateFacilitatorAssignment(id, changes);
    set({ assignments: get().assignments.map((a) => (a.id === id ? updated : a)) });
  },
  setPrimaryCoordinator: async (id) => {
    const target = get().assignments.find((a) => a.id === id);
    if (!target) return;
    await facilitatorAssignmentService.setPrimaryCoordinator(id);
    // The demo API demotes the previous coordinator server-side too; refetch that batch's team so
    // local state reflects both changes instead of only the one row returned.
    await get().fetchAssignments({ batchId: target.batchId });
  },
  removeAssignment: async (id) => {
    await facilitatorAssignmentService.removeFacilitatorAssignment(id);
    set({ assignments: get().assignments.filter((a) => a.id !== id) });
  }
}));
