import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Batch } from '../types/batch';
import * as batchesService from '../services/batches.service';

export type { Batch } from '../types/batch';

interface BatchesState {
  batches: Batch[];
  updateBatch: (id: string, changes: Partial<Batch>) => void;
  deleteBatch: (id: string) => void;
  createBatch: (input: { name: string; program: Batch['program']; track: Batch['track']; poc: string; traineeCount: number; startMonth: string; members?: string[] }) => Batch;
}

export const useBatchesStore = create<BatchesState>()(
  persist(
    (set) => ({
      batches: batchesService.getBatches(),
      updateBatch: (id, changes) =>
        set((state) => ({ batches: batchesService.updateBatch(state.batches, id, changes) })),
      deleteBatch: (id) =>
        set((state) => ({ batches: batchesService.deleteBatch(state.batches, id) })),
      createBatch: (input) => {
        const batch = batchesService.createBatch(input);
        set((state) => ({ batches: [...state.batches, batch] }));
        return batch;
      }
    }),
    { name: 'tp-batches' }
  )
);
