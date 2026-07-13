import { prisma } from '../prisma/client';
import { logger } from '../utils/logger';

interface AuditEntryInput {
  eventType: string;
  message: string;
  actorId?: string | null;
  module: string;
  previousValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
}

/**
 * Records an entry in the audit_log table (also what /api/notifications reads from).
 * Best-effort: a logging failure must never break the request that triggered it.
 */
export async function recordAuditEvent(input: AuditEntryInput): Promise<void> {
  try {
    await prisma.auditLog.create({ data: input });
  } catch (err) {
    logger.error('audit.write_failed', { message: err instanceof Error ? err.message : String(err) });
  }
}
