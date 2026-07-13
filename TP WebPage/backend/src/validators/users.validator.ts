import { z } from 'zod';
import { paginationQuerySchema } from '../utils/pagination';

export const listUsersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(['admin', 'facilitator', 'trainee']).optional(),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'email', 'createdAt', 'lastLoginAt']).default('createdAt')
});

export const userIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const updateSelfSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().optional(),
  location: z.string().trim().optional()
});

export const updateUserByAdminSchema = updateSelfSchema.extend({
  role: z.enum(['admin', 'facilitator', 'trainee']).optional(),
  isActive: z.boolean().optional(),
  company: z.string().trim().optional(),
  department: z.string().trim().optional(),
  idNumber: z.string().trim().optional()
});
