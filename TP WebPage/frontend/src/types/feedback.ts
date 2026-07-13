export type FeedbackDirection = 'FacilitatorToTrainee' | 'TraineeToFacilitator';

export interface FeedbackEntry {
  id: string;
  trainee: string;
  traineeId?: string;
  facilitator: string;
  facilitatorId?: string;
  batchId: string;
  category: string;
  rating: number;
  comment: string;
  date: string;
  direction: FeedbackDirection;
}
