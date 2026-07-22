import { create } from 'zustand';
import type { CreateReassignmentRequestInput, ReassignmentRequest, ReassignmentRequestStatus } from '../types/reassignmentRequest';
import * as reassignmentRequestService from '../services/api/reassignmentRequestService';

export type { ReassignmentRequest, ReassignmentRequestStatus } from '../types/reassignmentRequest';

interface ReassignmentRequestsState {
  requests: ReassignmentRequest[];
  isLoading: boolean;
  error: string | null;
  fetchRequests: (filters?: { batchId?: string; status?: ReassignmentRequestStatus }) => Promise<void>;
  createRequest: (input: CreateReassignmentRequestInput) => Promise<ReassignmentRequest>;
  reviewRequest: (id: string, changes: { status: 'Approved' | 'Rejected' | 'Resolved' | 'Cancelled'; reviewNotes?: string }) => Promise<void>;
}

export const useReassignmentRequestsStore = create<ReassignmentRequestsState>()((set, get) => ({
  requests: [],
  isLoading: false,
  error: null,
  fetchRequests: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const requests = await reassignmentRequestService.listReassignmentRequests(filters);
      set({ requests, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Unable to load reassignment requests.' });
    }
  },
  createRequest: async (input) => {
    const created = await reassignmentRequestService.createReassignmentRequest(input);
    set({ requests: [created, ...get().requests] });
    return created;
  },
  reviewRequest: async (id, changes) => {
    const updated = await reassignmentRequestService.reviewReassignmentRequest(id, changes);
    set({ requests: get().requests.map((r) => (r.id === id ? updated : r)) });
  }
}));
