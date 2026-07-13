import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
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
