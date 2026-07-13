import crypto from 'crypto';
import fs from 'fs';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request } from 'express';
import { config } from '../config';

// Files are never executed server-side and are always served with Content-Disposition: attachment
// (see services/storage), so the risk isn't RCE — it's hosting/distributing malware disguised as
// coursework. Denylist executable/script extensions rather than a narrow allowlist, since
// submissions legitimately include arbitrary code, archives, docs, and media.
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bat', '.cmd', '.com', '.cpl', '.msi', '.msp',
  '.scr', '.jar', '.app', '.sh', '.bash', '.ps1', '.psm1', '.vbs', '.vbe', '.wsf',
  '.wsh', '.apk', '.ipa', '.reg', '.lnk', '.iso', '.img'
]);

export function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `File type "${ext}" is not allowed.`));
    return;
  }
  cb(null, true);
}

export function createUploader(subdir: string) {
  // Cloud providers (S3 etc.) need the raw bytes in memory to upload them; only the local
  // provider benefits from multer writing straight to disk. See services/storage/.
  if (config.storage.provider !== 'local') {
    return multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: config.upload.maxSizeBytes },
      fileFilter
    });
  }

  const dir = path.resolve(process.cwd(), config.upload.dir, subdir);
  fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      // Randomly generated — never derived from user input, so there's nothing here for a
      // crafted originalname (path separators, null bytes, "../..") to traverse or collide with.
      const ext = path.extname(file.originalname);
      cb(null, `${crypto.randomUUID()}${ext}`);
    }
  });

  return multer({
    storage,
    limits: { fileSize: config.upload.maxSizeBytes },
    fileFilter
  });
}
