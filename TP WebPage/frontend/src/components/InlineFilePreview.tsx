import { useEffect, useRef, useState } from 'react';
import { apiDownload } from '../services/api/apiClient';
import FilePreviewContent from './FilePreviewContent';

interface InlineFilePreviewProps {
  /** Authorized API path to fetch the file from (e.g. `/submissions/:id/attachments/:attachmentId`), or null/undefined when there's no file. */
  url: string | null | undefined;
  fileName?: string;
  className?: string;
}

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

  return <FilePreviewContent objectUrl={objectUrl} mimeType={mimeType} fileName={fileName} className={className} />;
}
