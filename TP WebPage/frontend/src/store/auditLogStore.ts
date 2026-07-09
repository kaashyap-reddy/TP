import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuditLogEntry {
  id: string;
  time: string;
  date: string;
  type: string;
  message: string;
  user: string;
  module: string;
  previousValue: string;
  newValue: string;
  ipAddress: string;
}

function placeholderIp(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const a = 10;
  const b = hash % 256;
  const c = (hash >> 8) % 256;
  const d = (hash >> 16) % 256;
  return `${a}.${b}.${c}.${d}`;
}

const INITIAL_LOG: AuditLogEntry[] = [
  {
    id: 'log-1',
    time: '10:45:22 AM',
    date: new Date().toISOString().slice(0, 10),
    type: 'Email Sent',
    message: 'Automated Onboarding Engine generated and sent 28 secure invitation links for BA BTech batch.',
    user: 'Admin',
    module: 'Onboarding',
    previousValue: '',
    newValue: '',
    ipAddress: placeholderIp('log-1')
  },
  {
    id: 'log-2',
    time: '09:12:05 AM',
    date: new Date().toISOString().slice(0, 10),
    type: 'System Alert',
    message: 'Weekly Performance Alert triggered. Identified 3 trainees in Data Engineering BTech needing attention.',
    user: 'System',
    module: 'Analytics',
    previousValue: '',
    newValue: '',
    ipAddress: placeholderIp('log-2')
  }
];

function formatNow() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatToday() {
  return new Date().toISOString().slice(0, 10);
}

let idCounter = 100;
function nextLogId() {
  idCounter += 1;
  return `log-${idCounter}`;
}

export interface LogEventMeta {
  user?: string;
  module?: string;
  previousValue?: string;
  newValue?: string;
}

interface AuditLogState {
  entries: AuditLogEntry[];
  logEvent: (type: string, message: string, meta?: LogEventMeta) => void;
}

export const useAuditLogStore = create<AuditLogState>()(
  persist(
    (set) => ({
      entries: INITIAL_LOG,
      logEvent: (type, message, meta) => {
        const id = nextLogId();
        set((state) => ({
          entries: [
            {
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
            },
            ...state.entries
          ]
        }));
      }
    }),
    { name: 'tp-audit-log' }
  )
);
