import { consoleEmailProvider } from './console.provider';
import type { EmailProvider } from './types';

export type { EmailMessage, EmailProvider } from './types';

/**
 * No real provider is connected yet (see backend/README.md "Known limitations" and
 * DEPLOYMENT.md). To add one (SES, Postmark, Resend, etc.):
 *   1. Implement EmailProvider in a new file here (e.g. ses.provider.ts).
 *   2. Add its config (API key, from-address) to config/env.ts, following the STORAGE_PROVIDER pattern.
 *   3. Branch on an EMAIL_PROVIDER env var here, the same way services/storage/index.ts does.
 * Nothing outside this file needs to change — callers only ever see the EmailProvider interface.
 */
export function getEmailProvider(): EmailProvider {
  return consoleEmailProvider;
}
