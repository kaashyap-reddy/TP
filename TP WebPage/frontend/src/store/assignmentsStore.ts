import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SubmissionStatus, AssignmentStatus, Submission, Assignment } from '../types/assignment';
import * as assignmentsService from '../services/assignments.service';

export type { SubmissionStatus, AssignmentStatus, Submission, Assignment } from '../types/assignment';
export { isOverdue, effectiveStatus, nextAssignmentId } from '../services/assignments.service';

interface AssignmentsState {
  assignments: Assignment[];
  createAssignment: (input: { title: string; batchId: string; facilitator: string; deadline: string; description: string; status?: AssignmentStatus }) => Assignment;
  updateSubmission: (assignmentId: string, traineeName: string, changes: Partial<Submission>) => void;
  updateAssignment: (assignmentId: string, changes: Partial<Pick<Assignment, 'status' | 'deadline' | 'title' | 'description'>>) => void;
  duplicateAssignment: (assignmentId: string) => Assignment | null;
  bulkDelete: (ids: string[]) => void;
  bulkClose: (ids: string[]) => void;
  bulkExtendDeadline: (ids: string[], newDeadline: string) => void;
}

export const useAssignmentsStore = create<AssignmentsState>()(
  persist(
    (set, get) => ({
      assignments: assignmentsService.getAssignments(),
      createAssignment: (input) => {
        const assignment = assignmentsService.createAssignment(input);
        set((state) => ({ assignments: [assignment, ...state.assignments] }));
        return assignment;
      },
      updateSubmission: (assignmentId, traineeName, changes) => {
        set((state) => ({ assignments: assignmentsService.updateSubmission(state.assignments, assignmentId, traineeName, changes) }));
      },
      updateAssignment: (assignmentId, changes) => {
        set((state) => ({ assignments: assignmentsService.updateAssignment(state.assignments, assignmentId, changes) }));
      },
      duplicateAssignment: (assignmentId) => {
        const copy = assignmentsService.duplicateAssignment(get().assignments, assignmentId);
        if (!copy) return null;
        set((state) => ({ assignments: [copy, ...state.assignments] }));
        return copy;
      },
      bulkDelete: (ids) => {
        set((state) => ({ assignments: assignmentsService.bulkDelete(state.assignments, ids) }));
      },
      bulkClose: (ids) => {
        set((state) => ({ assignments: assignmentsService.bulkClose(state.assignments, ids) }));
      },
      bulkExtendDeadline: (ids, newDeadline) => {
        set((state) => ({ assignments: assignmentsService.bulkExtendDeadline(state.assignments, ids, newDeadline) }));
      }
    }),
    {
      name: 'tp-assignments',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AssignmentsState> | undefined;
        if (!Array.isArray(persisted?.assignments)) return currentState;
        return { ...currentState, ...persisted, assignments: persisted.assignments.map(assignmentsService.sanitizeAssignment) };
      }
    }
  )
);

export function getAssignmentById(id: string): Assignment | undefined {
  return useAssignmentsStore.getState().assignments.find((a) => a.id === id);
}
