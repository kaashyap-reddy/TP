import { z } from 'zod';
import { paginationQuerySchema } from '../utils/pagination';

const statusEnum = z.enum(['Draft', 'Open', 'Closed']);

// Requests arrive as multipart/form-data (the attachment file is optional but when present
// forces multipart), so a "batchIds" field is always a string field, not a native JSON array —
// either one repeated form field (multer collects same-name fields into an array) or a single
// JSON-stringified array (what the frontend sends for a multi-select). Accept all three shapes.
const batchIdsField = z.preprocess((val) => {
  if (val === undefined) return val;
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Not valid JSON — fall through and treat it as a single id below.
      }
    }
    return [val];
  }
  return val;
}, z.array(z.string().uuid()).min(1, 'Select at least one batch.'));

export const listAssignmentsQuerySchema = paginationQuerySchema.extend({
  batchId: z.string().uuid().optional(),
  status: statusEnum.optional(),
  sortBy: z.enum(['deadline', 'createdAt', 'title']).default('deadline')
});

export const createAssignmentSchema = z.object({
  batchIds: batchIdsField,
  title: z.string().trim().min(1),
  // What the assignment is meant to achieve (e.g. "Requirement Gathering", "SQL Basics").
  agenda: z.string().trim().optional().default(''),
  description: z.string().trim().optional().default(''),
  deadline: z.coerce.date(),
  status: statusEnum.optional().default('Draft'),
  sessionId: z.string().uuid().optional()
});

export const updateAssignmentSchema = z.object({
  title: z.string().trim().min(1).optional(),
  agenda: z.string().trim().optional(),
  description: z.string().trim().optional(),
  deadline: z.coerce.date().optional(),
  status: statusEnum.optional(),
  batchIds: batchIdsField.optional(),
  sessionId: z.string().uuid().nullable().optional()
});

export const assignmentIdParamsSchema = z.object({ id: z.string().uuid() });
