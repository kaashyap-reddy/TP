import { create } from 'zustand';
import type { AssignmentStatus, Submission, Assignment } from '../types/assignment';
import * as assignmentService from '../services/api/assignmentService';
import * as submissionService from '../services/api/submissionService';

export type { SubmissionStatus, AssignmentStatus, Submission, Assignment } from '../types/assignment';
export { isOverdue, effectiveStatus } from '../services/api/assignmentService';

interface AssignmentsState {
  assignments: Assignment[];
  isLoading: boolean;
  error: string | null;
  fetchAssignments: (filters?: { batchId?: string }) => Promise<void>;
  /** Replaces one assignment's `submissions` with the full roster (incl. "Not submitted" placeholders + batch info) from GET /assignments/:id/submissions. */
  fetchSubmissionsForAssignment: (assignmentId: string) => Promise<void>;
  createAssignment: (input: assignmentService.CreateAssignmentInput) => Promise<Assignment>;
  /** Facilitator grading an existing submission. */
  updateSubmission: (assignmentId: string, traineeName: string, changes: Partial<Submission>) => Promise<void>;
  /** The current (authenticated) trainee submitting their own work — upserts, unlike updateSubmission. */
  submitOwnAssignment: (assignmentId: string, comment?: string) => Promise<Submission>;
  /** Attaches/replaces the file on an already-created submission (first submission or a resubmit). */
  uploadSubmissionAttachment: (assignmentId: string, submissionId: string, file: File) => Promise<void>;
  updateAssignment: (assignmentId: string, changes: assignmentService.UpdateAssignmentInput) => Promise<void>;
  duplicateAssignment: (assignmentId: string) => Promise<Assignment | null>;
  bulkDelete: (ids: string[]) => Promise<void>;
  bulkClose: (ids: string[]) => Promise<void>;
  bulkExtendDeadline: (ids: string[], newDeadline: string) => Promise<void>;
}

export const useAssignmentsStore = create<AssignmentsState>()((set, get) => ({
  assignments: [],
  isLoading: false,
  error: null,
  fetchAssignments: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const assignments = await assignmentService.listAssignments(filters);
      set({ assignments, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Unable to load assignments.' });
    }
  },
  createAssignment: async (input) => {
    const assignment = await assignmentService.createAssignment(input);
    set({ assignments: [assignment, ...get().assignments] });
    return assignment;
  },
  fetchSubmissionsForAssignment: async (assignmentId) => {
    const submissions = await submissionService.listSubmissionsForAssignment(assignmentId);
    set({ assignments: get().assignments.map((a) => (a.id === assignmentId ? { ...a, submissions } : a)) });
  },
  updateSubmission: async (assignmentId, traineeName, changes) => {
    const assignment = get().assignments.find((a) => a.id === assignmentId);
    const submission = assignment?.submissions.find((s) => s.traineeName === traineeName);
    if (!submission?.id) return;

    const updated = await submissionService.gradeSubmission(submission.id, {
      grade: changes.grade ?? undefined,
      feedback: changes.feedback,
      status: changes.status
    });

    set({
      assignments: get().assignments.map((a) =>
        a.id === assignmentId
          ? { ...a, submissions: a.submissions.map((s) => (s.traineeName === traineeName ? { ...s, ...updated } : s)) }
          : a
      )
    });
  },
  submitOwnAssignment: async (assignmentId, comment) => {
    let submission = await submissionService.submitOwn(assignmentId);
    if (comment) {
      submission = await submissionService.gradeSubmission(submission.id!, { feedback: comment });
    }

    set({
      assignments: get().assignments.map((a) =>
        a.id === assignmentId
          ? {
              ...a,
              submissions: a.submissions.some((s) => s.traineeId === submission.traineeId)
                ? a.submissions.map((s) => (s.traineeId === submission.traineeId ? submission : s))
                : [...a.submissions, submission]
            }
          : a
      )
    });
    return submission;
  },
  uploadSubmissionAttachment: async (assignmentId, submissionId, file) => {
    const attachment = await submissionService.uploadAttachment(submissionId, file);
    set({
      assignments: get().assignments.map((a) =>
        a.id === assignmentId
          ? {
              ...a,
              submissions: a.submissions.map((s) =>
                s.id === submissionId
                  ? { ...s, attachmentId: attachment.id, attachmentFilename: attachment.originalFilename, attachmentMimeType: attachment.mimeType }
                  : s
              )
            }
          : a
      )
    });
  },
  updateAssignment: async (assignmentId, changes) => {
    const updated = await assignmentService.updateAssignment(assignmentId, changes);
    set({ assignments: get().assignments.map((a) => (a.id === assignmentId ? updated : a)) });
  },
  duplicateAssignment: async (assignmentId) => {
    const original = get().assignments.find((a) => a.id === assignmentId);
    if (!original) return null;
    const copy = await assignmentService.duplicateAssignment(original);
    set({ assignments: [copy, ...get().assignments] });
    return copy;
  },
  bulkDelete: async (ids) => {
    await Promise.all(ids.map((id) => assignmentService.deleteAssignment(id)));
    set({ assignments: get().assignments.filter((a) => !ids.includes(a.id)) });
  },
  bulkClose: async (ids) => {
    await Promise.all(ids.map((id) => assignmentService.updateAssignment(id, { status: 'Closed' as AssignmentStatus })));
    set({ assignments: get().assignments.map((a) => (ids.includes(a.id) ? { ...a, status: 'Closed' } : a)) });
  },
  bulkExtendDeadline: async (ids, newDeadline) => {
    await Promise.all(ids.map((id) => assignmentService.updateAssignment(id, { deadline: newDeadline })));
    set({ assignments: get().assignments.map((a) => (ids.includes(a.id) ? { ...a, deadline: newDeadline } : a)) });
  }
}));

export function getAssignmentById(id: string): Assignment | undefined {
  return useAssignmentsStore.getState().assignments.find((a) => a.id === id);
}
