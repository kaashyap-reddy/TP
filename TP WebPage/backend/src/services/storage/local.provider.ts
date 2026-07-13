import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../../config';
import { ApiError } from '../../utils/ApiError';
import type { StorageProvider } from './types';

const root = () => path.resolve(process.cwd(), config.upload.dir);

// storageKey always originates server-side (randomUUID at upload time, read back from the DB —
// never taken from a request param), so this can't normally be reached with a traversal
// sequence. Kept as defense-in-depth in case that invariant is ever violated upstream.
function absolutePath(storageKey: string): string {
  const resolved = path.resolve(root(), storageKey);
  if (!resolved.startsWith(root() + path.sep)) {
    throw new Error('Refusing to resolve a storage key outside the upload directory.');
  }
  return resolved;
}

/** Disk storage under UPLOAD_DIR. Fine for single-instance/dev use; the disk is ephemeral on most PaaS deploys. */
export const localStorageProvider: StorageProvider = {
  async save(file, subdir) {
    // multer.diskStorage already wrote the file (see middleware/upload.ts) — just record its key.
    if (file.path) {
      return path.relative(root(), file.path).replace(/\\/g, '/');
    }
    if (file.buffer) {
      const dir = path.join(root(), subdir);
      fs.mkdirSync(dir, { recursive: true });
      const key = path.join(subdir, `${crypto.randomUUID()}${path.extname(file.originalname)}`);
      fs.writeFileSync(absolutePath(key), file.buffer);
      return key.replace(/\\/g, '/');
    }
    throw new Error('No file content to store.');
  },

  async sendFile(res, storageKey, downloadName, options) {
    const filePath = absolutePath(storageKey);

    const onError = (err: NodeJS.ErrnoException, reject: (reason: unknown) => void) => {
      // The DB row referenced a file that's missing from disk (deleted out-of-band, or lost on
      // an ephemeral filesystem) — a 404 is the correct response, not a raw 500.
      reject(err.code === 'ENOENT' ? ApiError.notFound('File not found in storage.') : err);
    };

    if (options?.inline) {
      await new Promise<void>((resolve, reject) => {
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloadName)}"`);
        res.sendFile(filePath, (err) => (err ? onError(err as NodeJS.ErrnoException, reject) : resolve()));
      });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      res.download(filePath, downloadName, (err) => (err ? onError(err as NodeJS.ErrnoException, reject) : resolve()));
    });
  },

  async remove(storageKey) {
    await fs.promises.unlink(absolutePath(storageKey)).catch(() => undefined);
  },

  async checkConnectivity() {
    fs.mkdirSync(root(), { recursive: true });
    await fs.promises.access(root(), fs.constants.W_OK);
  }
};
