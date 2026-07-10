import type { AuditLogEntry, LogEventMeta } from '../types/auditLog';
import { INITIAL_LOG, placeholderIp } from './mockData/auditLog.mock';

let idCounter = 100;
function nextLogId() {
  idCounter += 1;
  return `log-${idCounter}`;
}

function formatNow() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatToday() {
  return new Date().toISOString().slice(0, 10);
}

// TODO: replace with a real API call (GET /api/audit-log) once a backend exists.
export function getAuditLog(): AuditLogEntry[] {
  return INITIAL_LOG;
}

// TODO: replace with a real API call (POST /api/audit-log) once a backend exists.
export function createLogEntry(type: string, message: string, meta?: LogEventMeta): AuditLogEntry {
  const id = nextLogId();
  return {
    id,
    time: formatNow(),
    date: formatToday(),
    type,
    message,
    user: meta?.user ?? 'Admin',
    module: meta?.module ?? type,
    previousValue: meta?.previousValue ?? '',
    newValue: meta?.newValue ?? '',
    ipAddress: placeholderIp(id)
  };
}
