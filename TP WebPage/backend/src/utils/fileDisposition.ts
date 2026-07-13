// MIME types common browsers render natively (in a new tab) rather than prompting to save.
// Anything not in this set falls back to a normal download — safe default for arbitrary
// coursework/office/archive formats a browser can't display inline.
const INLINE_VIEWABLE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'text/plain'
]);

export function isInlineViewable(mimeType: string | null | undefined): boolean {
  return !!mimeType && INLINE_VIEWABLE_MIME_TYPES.has(mimeType.toLowerCase());
}
