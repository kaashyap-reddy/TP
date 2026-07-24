import { z } from 'zod';
import { prisma } from '../prisma/client';
import { AuthenticatedUser } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { assertOwnerOrAdmin } from './sessions.service';
import { bulkMarkAttendanceSchema, updateAttendanceSchema } from '../validators/attendance.validator';

async function getSessionOrThrow(sessionId: string) {
  const session = await prisma.session.findFirst({ where: { id: sessionId, deletedAt: null } });
  if (!session) throw ApiError.notFound('Session not found.');
  return session;
}

export async function listForSession(actor: AuthenticatedUser, sessionId: string) {
  const session = await getSessionOrThrow(sessionId);
  await assertOwnerOrAdmin(actor, session.facilitatorId, session.batchId);

  return prisma.attendance.findMany({
    where: { sessionId },
    include: { trainee: { select: { id: true, name: true, email: true } } },
    orderBy: { markedAt: 'desc' }
  });
}

export async function bulkMark(actor: AuthenticatedUser, sessionId: string, input: z.infer<typeof bulkMarkAttendanceSchema>) {
  const session = await getSessionOrThrow(sessionId);
  await assertOwnerOrAdmin(actor, session.facilitatorId, session.batchId);

  await prisma.$transaction(
    input.records.map((record) =>
      prisma.attendance.upsert({
        where: { sessionId_traineeId: { sessionId, traineeId: record.traineeId } },
        create: { sessionId, traineeId: record.traineeId, status: record.status, markedBy: actor.id },
        update: { status: record.status, markedBy: actor.id, markedAt: new Date() }
      })
    )
  );

  return listForSession(actor, sessionId);
}

export async function updateOne(actor: AuthenticatedUser, id: string, input: z.infer<typeof updateAttendanceSchema>) {
  const attendance = await prisma.attendance.findUnique({ where: { id }, include: { session: true } });
  if (!attendance) throw ApiError.notFound('Attendance record not found.');
  await assertOwnerOrAdmin(actor, attendance.session.facilitatorId, attendance.session.batchId);

  return prisma.attendance.update({
    where: { id },
    data: { status: input.status, markedBy: actor.id, markedAt: new Date() }
  });
}
