export interface Batch {
  id: string;
  code: string;
  name: string;
  program: 'BA' | 'Data Engineering' | 'AI ML' | 'UI/UX';
  track: 'BTech' | 'MBA';
  trainingPlanId: string | null;
  trainingPlanName: string | null;
  poc: string;
  pocId: string | null;
  traineeCount: number;
  startMonth: string;
  /** Raw ISO start date, preserved alongside `startMonth` (which discards the day) for displays that need a real calendar date rather than just a month name. */
  startDate: string | null;
  endDate: string | null;
  avgScore: number | null;
  completion: number | null;
  attendanceRate: number | null;
  submissionRate: number | null;
  feedbackRating: number | null;
  status: 'Active' | 'Upcoming';
  members: string[];
}
