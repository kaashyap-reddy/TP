import { useEffect, useRef, useState } from 'react';
import { apiDownload } from '../services/api/apiClient';

interface InlineFilePreviewProps {
  /** Authorized API path to fetch the file from (e.g. `/submissions/:id/attachments/:attachmentId`), or null/undefined when there's no file. */
  url: string | null | undefined;
  fileName?: string;
  className?: string;
}

// Same allow-list as FileViewButton.tsx -- an <iframe>/<img> can only usefully render these;
// everything else gets a plain "can't preview" fallback with a download link instead.
const IFRAME_TYPES = new Set(['application/pdf', 'text/plain']);
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp']);

/**
 * Fetches an authorized file as a blob (same auth-carrying approach as FileViewButton.tsx) and
 * renders it inline (iframe for PDF/text, img for images) instead of opening a new tab -- lets a
 * facilitator see the submitted file alongside the grading form instead of losing that context.
 * Falls back to a plain download link for anything the browser can't usefully render inline.
 */
export default function InlineFilePreview({ url, fileName, className }: InlineFilePreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const revokeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!url) {
      setObjectUrl(null);
      setMimeType(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiDownload(url)
      .then((blob) => {
        if (cancelled) return;
        const created = URL.createObjectURL(blob);
        revokeRef.current = created;
        setObjectUrl(created);
        setMimeType(blob.type);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load file.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (revokeRef.current) {
        URL.revokeObjectURL(revokeRef.current);
        revokeRef.current = null;
      }
    };
  }, [url]);

  if (!url) return null;

  if (loading) {
    return <div className={`flex items-center justify-center text-sm text-gray-400 border border-gray-200 rounded-lg ${className ?? 'h-64'}`}>Loading preview…</div>;
  }

  if (error) {
    return <div className={`flex items-center justify-center text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg ${className ?? 'h-64'}`}>{error}</div>;
  }

  if (!objectUrl || !mimeType) return null;

  if (IFRAME_TYPES.has(mimeType)) {
    return <iframe title={fileName ?? 'Submission preview'} src={objectUrl} className={`w-full border border-gray-200 rounded-lg bg-white ${className ?? 'h-64'}`} />;
  }

  if (IMAGE_TYPES.has(mimeType)) {
    return (
      <div className={`overflow-auto border border-gray-200 rounded-lg bg-white flex items-center justify-center ${className ?? 'h-64'}`}>
        <img src={objectUrl} alt={fileName ?? 'Submission preview'} className="max-w-full max-h-full object-contain" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-sm text-gray-500 border border-gray-200 rounded-lg ${className ?? 'h-64'}`}>
      <span>Preview isn't available for this file type.</span>
      <a href={objectUrl} download={fileName} className="text-blue-600 font-bold hover:underline">
        Download {fileName ?? 'file'}
      </a>
    </div>
  );
}
