import { useEffect, useState } from 'react';
import { apiDownload } from '../services/api/apiClient';
import { useToastStore } from '../store/toastStore';
import FilePreviewContent from './FilePreviewContent';
import Modal from './Modal';

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
// can only render these types usefully inline; everything else should download instead.
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
 * `<a href>`/`window.open` to an API URL would not) and either previews it in an in-app modal
 * (PDFs/images/text — the browser decides based on the blob's MIME type, taken from the response's
 * Content-Type, rendered via the same FilePreviewContent used by InlineFilePreview) or triggers a
 * normal download for anything else.
 */
export default function FileViewButton({ url, label = 'View File', disabledLabel = 'No file uploaded', fileName, className }: FileViewButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<{ objectUrl: string; mimeType: string } | null>(null);
  const showToast = useToastStore((s) => s.showToast);

  // Revokes whenever the preview closes (object identity changes to null) or the component
  // unmounts with a preview still open -- covers both paths with one cleanup, unlike a manual
  // revoke call in closePreview() which would miss the unmount case.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview.objectUrl);
  }, [preview]);

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
        setPreview({ objectUrl, mimeType: blob.type });
      } else {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = fileName ?? '';
        a.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to open file.', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  function closePreview() {
    setPreview(null);
  }

  return (
    <>
      <button type="button" onClick={handleClick} disabled={isLoading} className={className ?? DEFAULT_CLASSNAME}>
        {isLoading ? 'Opening…' : label}
      </button>

      <Modal open={preview !== null} onClose={closePreview} title={fileName ?? 'File Preview'} maxWidth="lg">
        {preview && (
          <div className="space-y-3">
            <FilePreviewContent objectUrl={preview.objectUrl} mimeType={preview.mimeType} fileName={fileName} className="h-[70vh]" />
            <a href={preview.objectUrl} download={fileName} className="inline-block text-sm text-blue-600 font-bold hover:underline">
              Download {fileName ?? 'file'}
            </a>
          </div>
        )}
      </Modal>
    </>
  );
}
