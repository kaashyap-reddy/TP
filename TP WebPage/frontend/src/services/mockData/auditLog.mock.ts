import type { AuditLogEntry } from '../../types/auditLog';

export function placeholderIp(id: string): string {
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

export const INITIAL_LOG: AuditLogEntry[] = [
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
