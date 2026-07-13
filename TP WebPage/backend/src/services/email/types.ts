export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Provider-neutral email interface — swap providers by implementing this and registering it in email/index.ts. */
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
