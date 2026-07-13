import crypto from 'crypto';

/** Deterministic, non-secret hash used to look up opaque tokens (refresh/invite) by their DB-stored digest. */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
