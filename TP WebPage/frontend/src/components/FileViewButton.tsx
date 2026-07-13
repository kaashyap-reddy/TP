import { useState } from 'react';
import { apiDownload } from '../services/api/apiClient';
import { useToastStore } from '../store/toastStore';

interface FileViewButtonProps {
  /** Authorized API path to fetch the file from (e.g. `/assignments/:id/attachment`), or null/undefined when there's no file. */
  url: string | null | undefined;
  label?: string;
  disabledLabel?: string;
  fileName?: string;
  className?: string;
}

const DEFAULT_CLASSNAME = 'px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent';

// Mirrors the backend's inline-viewable set (backend/src/utils/fileDisposition.ts) — the browser
// can only render these types usefully in a new tab; everything else should download instead.
const INLINE_VIEWABLE_TYPES = new Set([
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

/**
 * Fetches an authorized file as a blob (so the request carries the Bearer token — a plain
 * `<a href>`/`window.open` to an API URL would not) and either opens it inline in a new tab
 * (PDFs/images — the browser decides based on the blob's MIME type, taken from the response's
 * Content-Type) or triggers a normal download for anything else.
 */
export default function FileViewButton({ url, label = 'View File', disabledLabel = 'No file uploaded', fileName, className }: FileViewButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const showToast = useToastStore((s) => s.showToast);

  if (!url) {
    return (
      <button type="button" disabled className={className ?? DEFAULT_CLASSNAME}>
        {disabledLabel}
      </button>
    );
  }

  async function handleClick() {
    if (isLoading) return; // guards against a double-click firing two fetches/downloads
    setIsLoading(true);
    try {
      const blob = await apiDownload(url as string);
      const objectUrl = URL.createObjectURL(blob);
      if (INLINE_VIEWABLE_TYPES.has(blob.type)) {
        const opened = window.open(objectUrl, '_blank');
        if (!opened) showToast('Your browser blocked the popup — allow popups for this site to view files.', 'error');
      } else {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = fileName ?? '';
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to open file.', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={isLoading} className={className ?? DEFAULT_CLASSNAME}>
      {isLoading ? 'Opening…' : label}
    </button>
  );
}
