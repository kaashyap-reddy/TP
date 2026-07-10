import type { Batch } from '../types/batch';
import { INITIAL_BATCHES } from './mockData/batches.mock';

let idCounter = 100;
function nextBatchId() {
  idCounter += 1;
  return `batch-${idCounter}`;
}

// TODO: replace with a real API call (GET /api/batches) once a backend exists.
export function getBatches(): Batch[] {
  return INITIAL_BATCHES;
}

// TODO: replace with a real API call (POST /api/batches) once a backend exists.
export function createBatch(input: {
  name: string;
  program: Batch['program'];
  track: Batch['track'];
  poc: string;
  traineeCount: number;
  startMonth: string;
  members?: string[];
}): Batch {
  return {
    id: nextBatchId(),
    name: input.name,
    program: input.program,
    track: input.track,
    poc: input.poc,
    traineeCount: input.traineeCount,
    startMonth: input.startMonth,
    avgScore: null,
    completion: null,
    attendanceRate: null,
    submissionRate: null,
    feedbackRating: null,
    status: 'Active',
    members: input.members ?? []
  };
}

// TODO: replace with a real API call (PATCH /api/batches/:id) once a backend exists.
export function updateBatch(batches: Batch[], id: string, changes: Partial<Batch>): Batch[] {
  return batches.map((b) => (b.id === id ? { ...b, ...changes } : b));
}

// TODO: replace with a real API call (DELETE /api/batches/:id) once a backend exists.
export function deleteBatch(batches: Batch[], id: string): Batch[] {
  return batches.filter((b) => b.id !== id);
}
