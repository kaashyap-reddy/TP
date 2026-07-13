import type { Response } from 'express';

export interface StoredFileInput {
  /** Present when multer used memoryStorage (required by cloud providers). */
  buffer?: Buffer;
  /** Present when multer used diskStorage (local provider only). */
  path?: string;
  originalname: string;
  mimetype: string;
  size: number;
}

/**
 * Byte-storage backend for uploaded files (resources, submission attachments).
 * Implementations must not leak provider-specific details into callers — a `storageKey` is an
 * opaque string that only the provider that created it can resolve back to bytes.
 */
export interface StorageProvider {
  /** Persists a file under `subdir` and returns the storageKey used to retrieve it later. */
  save(file: StoredFileInput, subdir: string): Promise<string>;
  /**
   * Sends the stored file as a response (streamed locally, or redirected to a signed URL).
   * `inline: true` asks the browser to render the file (PDFs/images opening in a new tab)
   * instead of triggering a save dialog — callers should only pass this for MIME types browsers
   * can actually render; everything else should omit it and fall back to a normal download.
   */
  sendFile(res: Response, storageKey: string, downloadName: string, options?: { inline?: boolean }): Promise<void>;
  /** Best-effort delete; callers should not fail the request if this fails. */
  remove(storageKey: string): Promise<void>;
  /** Throws if the backend isn't reachable/writable. Used by the readiness health check. */
  checkConnectivity(): Promise<void>;
}
