import { z } from 'zod';

const statusEnum = z.enum(['Present', 'Absent', 'Late', 'Excused']);

export const bulkMarkAttendanceSchema = z.object({
  records: z
    .array(
      z.object({
        traineeId: z.string().uuid(),
        status: statusEnum
      })
    )
    .min(1)
});

export const updateAttendanceSchema = z.object({
  status: statusEnum
});

export const attendanceIdParamsSchema = z.object({ id: z.string().uuid() });
