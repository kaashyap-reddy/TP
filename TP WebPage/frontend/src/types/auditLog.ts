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

export interface LogEventMeta {
  user?: string;
  module?: string;
  previousValue?: string;
  newValue?: string;
}
