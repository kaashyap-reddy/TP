import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  // Several admin/facilitator list views (sessions, assignments, resources, feedback) intentionally
  // fetch everything in one page rather than paginate server-side — see frontend/src/services/api/
  // {session,assignment,resource,feedback}Service.ts's pageSize: 500. A full training-plan curriculum
  // is 42 sessions across every batch, so the cap needs real headroom above today's batch count.
  pageSize: z.coerce.number().int().positive().max(500).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().min(1).optional()
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function getPagination(query: Pick<PaginationQuery, 'page' | 'pageSize'>) {
  const page = query.page;
  const pageSize = query.pageSize;
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function buildPaginatedResponse<T>(items: T[], total: number, page: number, pageSize: number) {
  const meta: PaginationMeta = {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
  return { data: items, pagination: meta };
}
