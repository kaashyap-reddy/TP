import { logger } from '../../utils/logger';
import type { EmailProvider } from './types';

/**
 * Development-safe default: records that a send *would* happen without actually delivering
 * anything. Deliberately logs only `to`/`subject` — never `text`, which is where invite/reset
 * links and other sensitive one-time content live. This is the only provider wired up today.
 */
export const consoleEmailProvider: EmailProvider = {
  async send(message) {
    logger.info('email.would_send', { to: message.to, subject: message.subject });
  }
};
