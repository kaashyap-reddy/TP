interface FilePreviewContentProps {
  objectUrl: string;
  mimeType: string;
  fileName?: string;
  className?: string;
}

// Same allow-list as FileViewButton.tsx -- an <iframe>/<img> can only usefully render these;
// everything else gets a plain "can't preview" fallback with a download link instead.
const IFRAME_TYPES = new Set(['application/pdf', 'text/plain']);
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp']);

/**
 * Pure presentational renderer for an already-fetched file blob (as an object URL + its MIME
 * type) -- iframe for PDF/text, img for images, a download-link fallback for anything else. No
 * fetching of its own: `InlineFilePreview` (fetch-on-mount) and `FileViewButton` (fetch-on-click,
 * shown in a modal) both delegate to this so the render logic exists in exactly one place.
 */
export default function FilePreviewContent({ objectUrl, mimeType, fileName, className }: FilePreviewContentProps) {
  if (IFRAME_TYPES.has(mimeType)) {
    return <iframe title={fileName ?? 'File preview'} src={objectUrl} className={`w-full border border-gray-200 rounded-lg bg-white ${className ?? 'h-64'}`} />;
  }

  if (IMAGE_TYPES.has(mimeType)) {
    return (
      <div className={`overflow-auto border border-gray-200 rounded-lg bg-white flex items-center justify-center ${className ?? 'h-64'}`}>
        <img src={objectUrl} alt={fileName ?? 'File preview'} className="max-w-full max-h-full object-contain" />
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
