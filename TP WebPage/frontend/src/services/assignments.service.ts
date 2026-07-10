import type { Assignment, AssignmentStatus, Submission, SubmissionStatus } from '../types/assignment';
import { INITIAL_BATCHES } from './mockData/batches.mock';
import { INITIAL_ASSIGNMENTS } from './mockData/assignments.mock';

let idCounter = 100;
export function nextAssignmentId() {
  idCounter += 1;
  return `assign-${idCounter}`;
}

export function isOverdue(assignment: Assignment): boolean {
  if (assignment.status !== 'Open') return false;
  const deadline = new Date(assignment.deadline);
  if (isNaN(deadline.getTime())) return false;
  return deadline.getTime() < Date.now();
}

export function effectiveStatus(assignment: Assignment): AssignmentStatus | 'Overdue' {
  return isOverdue(assignment) ? 'Overdue' : assignment.status;
}

const VALID_ASSIGNMENT_STATUSES: AssignmentStatus[] = ['Draft', 'Open', 'Closed'];
const VALID_SUBMISSION_STATUSES: SubmissionStatus[] = ['Not Started', 'Under Review', 'Completed', 'Late'];

export function sanitizeAssignment(a: Assignment): Assignment {
  return {
    ...a,
    status: VALID_ASSIGNMENT_STATUSES.includes(a.status) ? a.status : 'Open',
    submissions: (a.submissions ?? []).map((s) => ({
      ...s,
      status: VALID_SUBMISSION_STATUSES.includes(s.status) ? s.status : 'Not Started'
    }))
  };
}

// TODO: replace with a real API call (GET /api/assignments) once a backend exists.
export function getAssignments(): Assignment[] {
  return INITIAL_ASSIGNMENTS;
}

// TODO: replace with a real API call (POST /api/assignments) once a backend exists.
export function createAssignment(input: { title: string; batchId: string; facilitator: string; deadline: string; description: string; status?: AssignmentStatus }): Assignment {
  const members = INITIAL_BATCHES.find((b) => b.id === input.batchId)?.members ?? [];
  return {
    id: nextAssignmentId(),
    title: input.title,
    batchId: input.batchId,
    facilitator: input.facilitator,
    deadline: input.deadline,
    description: input.description,
    status: input.status ?? 'Open',
    submissions: members.map((traineeName) => ({ traineeName, status: 'Not Started', submittedOn: '-', grade: null, feedback: '' }))
  };
}

// TODO: replace with a real API call (PATCH /api/assignments/:id/submissions/:traineeName) once a backend exists.
export function updateSubmission(assignments: Assignment[], assignmentId: string, traineeName: string, changes: Partial<Submission>): Assignment[] {
  return assignments.map((a) =>
    a.id === assignmentId
      ? { ...a, submissions: a.submissions.map((s) => (s.traineeName === traineeName ? { ...s, ...changes } : s)) }
      : a
  );
}

// TODO: replace with a real API call (PATCH /api/assignments/:id) once a backend exists.
export function updateAssignment(
  assignments: Assignment[],
  assignmentId: string,
  changes: Partial<Pick<Assignment, 'status' | 'deadline' | 'title' | 'description'>>
): Assignment[] {
  return assignments.map((a) => (a.id === assignmentId ? { ...a, ...changes } : a));
}

// TODO: replace with a real API call (POST /api/assignments/:id/duplicate) once a backend exists.
export function duplicateAssignment(assignments: Assignment[], assignmentId: string): Assignment | null {
  const original = assignments.find((a) => a.id === assignmentId);
  if (!original) return null;
  return {
    ...original,
    id: nextAssignmentId(),
    title: `${original.title} (Copy)`,
    status: 'Draft',
    submissions: original.submissions.map((s) => ({ ...s, status: 'Not Started', submittedOn: '-', grade: null, feedback: '' }))
  };
}

// TODO: replace with a real API call (DELETE /api/assignments) once a backend exists.
export function bulkDelete(assignments: Assignment[], ids: string[]): Assignment[] {
  return assignments.filter((a) => !ids.includes(a.id));
}

// TODO: replace with a real API call (PATCH /api/assignments bulk-close) once a backend exists.
export function bulkClose(assignments: Assignment[], ids: string[]): Assignment[] {
  return assignments.map((a) => (ids.includes(a.id) ? { ...a, status: 'Closed' } : a));
}

// TODO: replace with a real API call (PATCH /api/assignments bulk-extend-deadline) once a backend exists.
export function bulkExtendDeadline(assignments: Assignment[], ids: string[], newDeadline: string): Assignment[] {
  return assignments.map((a) => (ids.includes(a.id) ? { ...a, deadline: newDeadline } : a));
}
