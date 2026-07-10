export interface Batch {
  id: string;
  name: string;
  program: 'BA' | 'Data Engineering' | 'AI ML' | 'UI/UX';
  track: 'BTech' | 'MBA';
  poc: string;
  traineeCount: number;
  startMonth: string;
  avgScore: number | null;
  completion: number | null;
  attendanceRate: number | null;
  submissionRate: number | null;
  feedbackRating: number | null;
  status: 'Active' | 'Upcoming';
  members: string[];
}
