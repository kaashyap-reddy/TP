import { create } from 'zustand';
import type { Batch } from '../types/batch';
import * as batchService from '../services/api/batchService';

export type { Batch } from '../types/batch';

interface BatchesState {
  batches: Batch[];
  isLoading: boolean;
  error: string | null;
  fetchBatches: (filters?: { facilitatorId?: string; traineeId?: string }) => Promise<void>;
  updateBatch: (id: string, changes: Partial<Batch>) => Promise<Batch>;
  deleteBatch: (id: string) => Promise<void>;
  createBatch: (input: batchService.CreateBatchInput) => Promise<Batch>;
}

export const useBatchesStore = create<BatchesState>()((set, get) => ({
  batches: [],
  isLoading: false,
  error: null,
  fetchBatches: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const batches = await batchService.listBatches(filters);
      set({ batches, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Unable to load batches.' });
    }
  },
  updateBatch: async (id, changes) => {
    const updated = await batchService.updateBatch(id, changes);
    set({ batches: get().batches.map((b) => (b.id === id ? updated : b)) });
    return updated;
  },
  deleteBatch: async (id) => {
    await batchService.deleteBatch(id);
    set({ batches: get().batches.filter((b) => b.id !== id) });
  },
  createBatch: async (input) => {
    const batch = await batchService.createBatch(input);
    set({ batches: [...get().batches, batch] });
    return batch;
  }
}));
