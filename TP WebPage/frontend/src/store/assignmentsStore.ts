import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { INITIAL_BATCHES } from './batchesStore';

export type SubmissionStatus = 'Not Started' | 'Under Review' | 'Completed' | 'Late';
export type AssignmentStatus = 'Draft' | 'Open' | 'Closed';

export interface Submission {
  traineeName: string;
  status: SubmissionStatus;
  submittedOn: string;
  grade: number | null;
  feedback: string;
}

export interface Assignment {
  id: string;
  title: string;
  batchId: string;
  facilitator: string;
  deadline: string;
  description: string;
  status: AssignmentStatus;
  submissions: Submission[];
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

function seedSubmissions(batchId: string, pattern: Array<[SubmissionStatus, string, number | null, string]>): Submission[] {
  const members = INITIAL_BATCHES.find((b) => b.id === batchId)?.members ?? [];
  return members.map((traineeName, i) => {
    const [status, submittedOn, grade, feedback] = pattern[i] ?? ['Not Started', '-', null, ''];
    return { traineeName, status, submittedOn, grade, feedback };
  });
}

let idCounter = 100;
export function nextAssignmentId() {
  idCounter += 1;
  return `assign-${idCounter}`;
}

const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: 'assign-1',
    title: 'Requirements Analysis Report',
    batchId: 'ba-btech',
    facilitator: 'Srikar Kulkarni',
    deadline: '15 Jul 2026',
    description: 'Document the business requirements gathered from the mock stakeholder interviews.',
    status: 'Open',
    submissions: seedSubmissions('ba-btech', [
      ['Completed', '12 Jul 2026', 91, 'Thorough and well structured.'],
      ['Under Review', '14 Jul 2026', null, ''],
      ['Not Started', '-', null, ''],
      ['Completed', '13 Jul 2026', 88, 'Good use of stakeholder mapping.'],
      ['Not Started', '-', null, '']
    ])
  },
  {
    id: 'assign-2',
    title: 'Stakeholder Presentation Deck',
    batchId: 'ba-mba',
    facilitator: 'Srikar Kulkarni',
    deadline: '10 Jul 2026',
    description: 'Prepare a slide deck summarizing findings for the mock stakeholder review.',
    status: 'Open',
    submissions: seedSubmissions('ba-mba', [
      ['Completed', '9 Jul 2026', 95, 'Excellent storytelling and structure.'],
      ['Completed', '10 Jul 2026', 90, 'Clear and concise.'],
      ['Under Review', '10 Jul 2026', null, ''],
      ['Not Started', '-', null, ''],
      ['Not Started', '-', null, '']
    ])
  },
  {
    id: 'assign-3',
    title: 'ETL Pipeline Design',
    batchId: 'de-btech',
    facilitator: 'Dinesh Paraman',
    deadline: '12 Jul 2026',
    description: 'Design an ETL pipeline for the sample retail dataset.',
    status: 'Open',
    submissions: seedSubmissions('de-btech', [
      ['Completed', '11 Jul 2026', 94, 'Solid pipeline design, good error handling.'],
      ['Under Review', '12 Jul 2026', null, ''],
      ['Under Review', '12 Jul 2026', null, ''],
      ['Not Started', '-', null, ''],
      ['Late', '13 Jul 2026', null, '']
    ])
  },
  {
    id: 'assign-4',
    title: 'Data Warehouse Schema Project',
    batchId: 'de-mba',
    facilitator: 'Dinesh Paraman',
    deadline: '16 Jul 2026',
    description: 'Model a star schema for the sample sales data warehouse.',
    status: 'Open',
    submissions: seedSubmissions('de-mba', [
      ['Not Started', '-', null, ''],
      ['Not Started', '-', null, ''],
      ['Under Review', '15 Jul 2026', null, ''],
      ['Not Started', '-', null, ''],
      ['Not Started', '-', null, '']
    ])
  },
  {
    id: 'assign-5',
    title: 'Machine Learning Model Baseline',
    batchId: 'aiml-btech',
    facilitator: 'Junaid Mohammed',
    deadline: '14 Jul 2026',
    description: 'Train and evaluate a baseline classification model.',
    status: 'Open',
    submissions: seedSubmissions('aiml-btech', [
      ['Completed', '13 Jul 2026', 90, 'Great baseline, consider cross-validation next.'],
      ['Completed', '14 Jul 2026', 92, 'Clean notebook and clear metrics.'],
      ['Under Review', '2 hours ago', null, ''],
      ['Not Started', '-', null, ''],
      ['Not Started', '-', null, '']
    ])
  },
  {
    id: 'assign-6',
    title: 'Wireframe & Prototype Review',
    batchId: 'uiux-btech',
    facilitator: 'Kaashyap Reddy',
    deadline: '13 Jul 2026',
    description: 'Submit high-fidelity wireframes for the mock client project.',
    status: 'Open',
    submissions: seedSubmissions('uiux-btech', [
      ['Completed', '12 Jul 2026', 93, 'Strong visual hierarchy.'],
      ['Under Review', '13 Jul 2026', null, ''],
      ['Not Started', '-', null, ''],
      ['Not Started', '-', null, ''],
      ['Completed', '11 Jul 2026', 86, 'Good, but tighten up spacing consistency.']
    ])
  },
  {
    id: 'assign-7',
    title: 'React API Integration',
    batchId: 'aiml-btech',
    facilitator: 'Junaid Mohammed',
    deadline: 'Oct 15, 2026',
    description: 'Integrate the mock REST API into the React front end built in class.',
    status: 'Open',
    submissions: seedSubmissions('aiml-btech', [
      ['Under Review', 'Today, 2:00 PM', null, "I struggled a bit with the useEffect cleanup, please review."],
      ['Completed', 'Yesterday', 92, ''],
      ['Not Started', '-', null, ''],
      ['Not Started', '-', null, ''],
      ['Not Started', '-', null, '']
    ])
  }
];

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
  assignments: INITIAL_ASSIGNMENTS,
  createAssignment: (input) => {
    const members = INITIAL_BATCHES.find((b) => b.id === input.batchId)?.members ?? [];
    const assignment: Assignment = {
      id: nextAssignmentId(),
      title: input.title,
      batchId: input.batchId,
      facilitator: input.facilitator,
      deadline: input.deadline,
      description: input.description,
      status: input.status ?? 'Open',
      submissions: members.map((traineeName) => ({ traineeName, status: 'Not Started', submittedOn: '-', grade: null, feedback: '' }))
    };
    set((state) => ({ assignments: [assignment, ...state.assignments] }));
    return assignment;
  },
  updateSubmission: (assignmentId, traineeName, changes) => {
    set((state) => ({
      assignments: state.assignments.map((a) =>
        a.id === assignmentId
          ? { ...a, submissions: a.submissions.map((s) => (s.traineeName === traineeName ? { ...s, ...changes } : s)) }
          : a
      )
    }));
  },
  updateAssignment: (assignmentId, changes) => {
    set((state) => ({
      assignments: state.assignments.map((a) => (a.id === assignmentId ? { ...a, ...changes } : a))
    }));
  },
  duplicateAssignment: (assignmentId) => {
    const original = get().assignments.find((a) => a.id === assignmentId);
    if (!original) return null;
    const copy: Assignment = {
      ...original,
      id: nextAssignmentId(),
      title: `${original.title} (Copy)`,
      status: 'Draft',
      submissions: original.submissions.map((s) => ({ ...s, status: 'Not Started', submittedOn: '-', grade: null, feedback: '' }))
    };
    set((state) => ({ assignments: [copy, ...state.assignments] }));
    return copy;
  },
  bulkDelete: (ids) => {
    set((state) => ({ assignments: state.assignments.filter((a) => !ids.includes(a.id)) }));
  },
  bulkClose: (ids) => {
    set((state) => ({
      assignments: state.assignments.map((a) => (ids.includes(a.id) ? { ...a, status: 'Closed' } : a))
    }));
  },
  bulkExtendDeadline: (ids, newDeadline) => {
    set((state) => ({
      assignments: state.assignments.map((a) => (ids.includes(a.id) ? { ...a, deadline: newDeadline } : a))
    }));
  }
    }),
    { name: 'tp-assignments' }
  )
);

export function getAssignmentById(id: string): Assignment | undefined {
  return useAssignmentsStore.getState().assignments.find((a) => a.id === id);
}
