import { z } from 'zod';
import { paginationQuerySchema } from '../utils/pagination';

export const listNotificationsQuerySchema = paginationQuerySchema.pick({ page: true, pageSize: true }).extend({
  unreadOnly: z.coerce.boolean().optional().default(false)
});

export const notificationIdParamsSchema = z.object({ id: z.string().uuid() });
