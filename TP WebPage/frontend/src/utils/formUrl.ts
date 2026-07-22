import type { FeedbackFormProvider } from '../types/feedbackForm';

// Domains that are genuinely Microsoft Forms -- not a single hardcoded URL, a set of known
// hostnames (and their regional/short-link variants) so any real Forms link is recognized.
const MICROSOFT_FORMS_HOSTS = ['forms.office.com', 'forms.microsoft.com', 'forms.office365.com'];

export interface FormUrlCheck {
  valid: boolean;
  /** Present only when valid -- callers should treat provider as unknown until a URL passes validation. */
  provider?: FeedbackFormProvider;
  /** Present only when invalid -- a short, user-facing reason. */
  reason?: string;
}

/**
 * Validates an external feedback-form URL for safe, correct use in the portal. Deliberately
 * simple: checks protocol + shape, and labels known Microsoft Forms hosts -- it does not fetch,
 * embed, or authenticate against the URL (Demo Mode never talks to Microsoft's real API).
 */
export function checkFormUrl(rawUrl: string): FormUrlCheck {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { valid: false, reason: 'A form URL is required.' };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Enter a complete URL, including https://' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, reason: 'Only http:// or https:// links are allowed.' };
  }
  if (parsed.protocol === 'http:') {
    // Not a hard rejection (some internal/demo tools are still http in the wild), but Microsoft
    // Forms itself is always https -- so http: can never be labeled as Microsoft Forms.
    return { valid: true, provider: 'External Form' };
  }

  const host = parsed.hostname.toLowerCase();
  const isMicrosoftForms = MICROSOFT_FORMS_HOSTS.some((known) => host === known || host.endsWith(`.${known}`));
  return { valid: true, provider: isMicrosoftForms ? 'Microsoft Forms' : 'External Form' };
}

/** Trims and removes a trailing slash so the same form pasted twice compares as identical. */
export function normalizeFormUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  return trimmed.endsWith('/') && trimmed.length > 1 ? trimmed.slice(0, -1) : trimmed;
}

/**
 * Opens a validated form URL in a new tab -- the one place this happens, so every "Open Form"
 * button across Admin/Facilitator/Trainee behaves identically and safely. Returns false (instead
 * of throwing) when the URL fails validation, so callers can show a toast.
 */
export function openFeedbackForm(url: string | null | undefined): boolean {
  if (!url) return false;
  const check = checkFormUrl(url);
  if (!check.valid) return false;
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  return win !== null;
}
