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
