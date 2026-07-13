import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';
import path from 'path';
import { config } from '../../config';
import type { StorageProvider } from './types';

// Lazy: services/storage/index.ts imports this module unconditionally (alongside the local
// provider) regardless of which STORAGE_PROVIDER is actually selected, so constructing the
// client at module scope would run it — and validate AWS_REGION — even for STORAGE_PROVIDER=local.
let clientInstance: S3Client | null = null;
function client(): S3Client {
  if (!clientInstance) {
    clientInstance = new S3Client({
      region: config.storage.aws.region,
      ...(config.storage.aws.accessKeyId && config.storage.aws.secretAccessKey
        ? { credentials: { accessKeyId: config.storage.aws.accessKeyId, secretAccessKey: config.storage.aws.secretAccessKey } }
        : {}) // omitted: falls back to the default AWS credential chain (IAM role, env vars, etc.)
    });
  }
  return clientInstance;
}

const bucket = () => {
  if (!config.storage.aws.bucket) throw new Error('AWS_S3_BUCKET is not configured.');
  return config.storage.aws.bucket;
};

/** S3-backed storage. Requires multer memoryStorage (see middleware/upload.ts) so `file.buffer` is populated. */
export const s3StorageProvider: StorageProvider = {
  async save(file, subdir) {
    if (!file.buffer) throw new Error('S3 storage requires an in-memory file buffer.');

    const key = `${subdir}/${crypto.randomUUID()}${path.extname(file.originalname)}`;
    await client().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
      })
    );
    return key;
  },

  async sendFile(res, storageKey, downloadName, options) {
    const dispositionType = options?.inline ? 'inline' : 'attachment';
    const url = await getSignedUrl(
      client(),
      new GetObjectCommand({
        Bucket: bucket(),
        Key: storageKey,
        ResponseContentDisposition: `${dispositionType}; filename="${encodeURIComponent(downloadName)}"`
      }),
      { expiresIn: 300 }
    );
    res.redirect(url);
  },

  async remove(storageKey) {
    await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: storageKey })).catch(() => undefined);
  },

  async checkConnectivity() {
    await client().send(new HeadBucketCommand({ Bucket: bucket() }));
  }
};
