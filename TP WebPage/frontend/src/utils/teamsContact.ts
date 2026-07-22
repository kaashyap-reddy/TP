// Reusable Microsoft Teams 1:1-chat deep-link generation -- the one place this logic lives, so
// every "Contact" button (facilitator contacts, session trainer, co-trainer) behaves identically.
// This only builds a URL; it never talks to a real Teams/Graph API (there isn't one here).

export interface TeamsContactable {
  name: string;
  email?: string | null;
  teamsUserId?: string | null;
  teamsChatUrl?: string | null;
  /** Explicit false disables contact even if an email/id is present (e.g. account deactivated). */
  teamsEnabled?: boolean;
}

export interface TeamsContactLink {
  available: boolean;
  url?: string;
  /** Present only when available === false -- shown as a tooltip/disabled explanation. */
  disabledReason?: string;
}

/**
 * Resolution order (see Phase 10):
 *  1. An explicitly configured Teams chat URL, used as-is.
 *  2. A generated one-to-one chat deep link from the person's Teams user id or email.
 *  3. Disabled, with a clear reason -- never falls back to Outlook or mailto:.
 *
 * `context` is optional, safe, non-identifying text (e.g. a session/batch title) prefilled as the
 * opening message -- never trainee grades, progress, or private notes (see Phase 15).
 */
export function getTeamsContactLink(person: TeamsContactable, context?: { message?: string }): TeamsContactLink {
  if (person.teamsEnabled === false) {
    return { available: false, disabledReason: `Teams contact is not available for ${person.name}.` };
  }

  if (person.teamsChatUrl) {
    return { available: true, url: person.teamsChatUrl };
  }

  const identifier = person.teamsUserId || person.email;
  if (!identifier) {
    return { available: false, disabledReason: `No Teams-compatible contact info on file for ${person.name}.` };
  }

  const params = new URLSearchParams({ users: identifier });
  if (context?.message) params.set('message', context.message);
  return { available: true, url: `https://teams.microsoft.com/l/chat/0/0?${params.toString()}` };
}

/** Opens a Teams contact link in a new tab; returns false if unavailable or blocked by the
 * browser's popup blocker, so callers can show a toast instead of failing silently. */
export function openTeamsContact(link: TeamsContactLink): boolean {
  if (!link.available || !link.url) return false;
  const win = window.open(link.url, '_blank', 'noopener,noreferrer');
  return win !== null;
}
