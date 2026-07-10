import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuditLogEntry, LogEventMeta } from '../types/auditLog';
import * as auditLogService from '../services/auditLog.service';

export type { AuditLogEntry, LogEventMeta } from '../types/auditLog';

interface AuditLogState {
  entries: AuditLogEntry[];
  logEvent: (type: string, message: string, meta?: LogEventMeta) => void;
}

export const useAuditLogStore = create<AuditLogState>()(
  persist(
    (set) => ({
      entries: auditLogService.getAuditLog(),
      logEvent: (type, message, meta) => {
        const entry = auditLogService.createLogEntry(type, message, meta);
        set((state) => ({ entries: [entry, ...state.entries] }));
      }
    }),
    { name: 'tp-audit-log' }
  )
);
