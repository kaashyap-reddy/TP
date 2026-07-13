import { config } from '../../config';
import { localStorageProvider } from './local.provider';
import { s3StorageProvider } from './s3.provider';
import type { StorageProvider } from './types';

export type { StorageProvider, StoredFileInput } from './types';

const providers: Record<typeof config.storage.provider, StorageProvider> = {
  local: localStorageProvider,
  s3: s3StorageProvider
};

/**
 * Swap providers by setting STORAGE_PROVIDER=local|s3 (see .env.example). To add another
 * backend (e.g. Cloudinary), implement StorageProvider and register it here — nothing else
 * in the codebase needs to change.
 */
export function getStorageProvider(): StorageProvider {
  return providers[config.storage.provider];
}
