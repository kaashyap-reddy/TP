import { create } from 'zustand';
import type {
  TrainingPlan,
  TrainingPlanAnnouncementInput,
  TrainingPlanAssignmentInput,
  TrainingPlanGeneralInput,
  TrainingPlanResourceInput,
  TrainingPlanSessionInput,
  TrainingPlanSummary
} from '../types/trainingPlan';
import * as trainingPlanService from '../services/api/trainingPlanService';

export type { TrainingPlan, TrainingPlanSummary } from '../types/trainingPlan';

interface TrainingPlansState {
  trainingPlans: TrainingPlanSummary[];
  planDetails: Record<string, TrainingPlan>;
  isLoading: boolean;
  error: string | null;
  fetchTrainingPlans: () => Promise<void>;
  fetchTrainingPlanDetail: (id: string) => Promise<TrainingPlan>;
  updateTrainingPlan: (id: string, changes: TrainingPlanGeneralInput) => Promise<TrainingPlan>;
  addSession: (planId: string, input: TrainingPlanSessionInput) => Promise<void>;
  editSession: (planId: string, sessionId: string, input: Partial<TrainingPlanSessionInput>) => Promise<void>;
  removeSession: (planId: string, sessionId: string) => Promise<void>;
  addAssignment: (planId: string, input: TrainingPlanAssignmentInput) => Promise<void>;
  editAssignment: (planId: string, assignmentId: string, input: Partial<TrainingPlanAssignmentInput>) => Promise<void>;
  removeAssignment: (planId: string, assignmentId: string) => Promise<void>;
  addResource: (planId: string, input: TrainingPlanResourceInput) => Promise<void>;
  editResource: (planId: string, resourceId: string, input: Partial<TrainingPlanResourceInput>) => Promise<void>;
  removeResource: (planId: string, resourceId: string) => Promise<void>;
  addAnnouncement: (planId: string, input: TrainingPlanAnnouncementInput) => Promise<void>;
  editAnnouncement: (planId: string, announcementId: string, input: Partial<TrainingPlanAnnouncementInput>) => Promise<void>;
  removeAnnouncement: (planId: string, announcementId: string) => Promise<void>;
}

export const useTrainingPlansStore = create<TrainingPlansState>()((set, get) => ({
  trainingPlans: [],
  planDetails: {},
  isLoading: false,
  error: null,
  fetchTrainingPlans: async () => {
    set({ isLoading: true, error: null });
    try {
      const trainingPlans = await trainingPlanService.listTrainingPlans();
      set({ trainingPlans, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Unable to load training plans.' });
    }
  },
  fetchTrainingPlanDetail: async (id) => {
    const plan = await trainingPlanService.getTrainingPlan(id);
    set({ planDetails: { ...get().planDetails, [id]: plan } });
    return plan;
  },
  updateTrainingPlan: async (id, changes) => {
    const plan = await trainingPlanService.updateTrainingPlan(id, changes);
    set({
      planDetails: { ...get().planDetails, [id]: plan },
      trainingPlans: get().trainingPlans.map((p) => (p.id === id ? { ...p, name: plan.name, durationMonths: plan.durationMonths } : p))
    });
    return plan;
  },
  addSession: async (planId, input) => {
    await trainingPlanService.createTrainingPlanSession(planId, input);
    await get().fetchTrainingPlanDetail(planId);
    await get().fetchTrainingPlans();
  },
  editSession: async (planId, sessionId, input) => {
    await trainingPlanService.updateTrainingPlanSession(planId, sessionId, input);
    await get().fetchTrainingPlanDetail(planId);
  },
  removeSession: async (planId, sessionId) => {
    await trainingPlanService.deleteTrainingPlanSession(planId, sessionId);
    await get().fetchTrainingPlanDetail(planId);
    await get().fetchTrainingPlans();
  },
  addAssignment: async (planId, input) => {
    await trainingPlanService.createTrainingPlanAssignment(planId, input);
    await get().fetchTrainingPlanDetail(planId);
    await get().fetchTrainingPlans();
  },
  editAssignment: async (planId, assignmentId, input) => {
    await trainingPlanService.updateTrainingPlanAssignment(planId, assignmentId, input);
    await get().fetchTrainingPlanDetail(planId);
  },
  removeAssignment: async (planId, assignmentId) => {
    await trainingPlanService.deleteTrainingPlanAssignment(planId, assignmentId);
    await get().fetchTrainingPlanDetail(planId);
    await get().fetchTrainingPlans();
  },
  addResource: async (planId, input) => {
    await trainingPlanService.createTrainingPlanResource(planId, input);
    await get().fetchTrainingPlanDetail(planId);
    await get().fetchTrainingPlans();
  },
  editResource: async (planId, resourceId, input) => {
    await trainingPlanService.updateTrainingPlanResource(planId, resourceId, input);
    await get().fetchTrainingPlanDetail(planId);
  },
  removeResource: async (planId, resourceId) => {
    await trainingPlanService.deleteTrainingPlanResource(planId, resourceId);
    await get().fetchTrainingPlanDetail(planId);
    await get().fetchTrainingPlans();
  },
  addAnnouncement: async (planId, input) => {
    await trainingPlanService.createTrainingPlanAnnouncement(planId, input);
    await get().fetchTrainingPlanDetail(planId);
    await get().fetchTrainingPlans();
  },
  editAnnouncement: async (planId, announcementId, input) => {
    await trainingPlanService.updateTrainingPlanAnnouncement(planId, announcementId, input);
    await get().fetchTrainingPlanDetail(planId);
  },
  removeAnnouncement: async (planId, announcementId) => {
    await trainingPlanService.deleteTrainingPlanAnnouncement(planId, announcementId);
    await get().fetchTrainingPlanDetail(planId);
    await get().fetchTrainingPlans();
  }
}));
