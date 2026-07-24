import { useEffect, useState } from 'react';
import { apiDownload } from '../services/api/apiClient';

/**
 * Resolves the current user's own avatar to a renderable object URL. Fetches the image as a
 * blob via apiDownload (the same authenticated-blob mechanism FileViewButton.tsx already uses —
 * a plain <img src="/api/..."> would not carry the Bearer token) rather than storing the image
 * data itself, so it works the same way in Demo Mode and against the real backend.
 */
export function useAvatarUrl(avatarStorageKey: string | null, avatarUpdatedAt: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarStorageKey) {
      setUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    apiDownload('/users/me/avatar')
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [avatarStorageKey, avatarUpdatedAt]);

  return url;
}
