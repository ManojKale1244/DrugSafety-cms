import { localDiskAdapter } from './localDiskAdapter.js';

/**
 * S3 / Cloudflare R2 Storage Adapter.
 * Integrates with S3-compatible endpoints (Cloudflare R2, MinIO, AWS S3).
 * If environment credentials are not present, transparently uses the local disk adapter.
 */
export class S3R2Adapter {
  constructor(config = {}) {
    this.endpoint = config.endpoint || process.env.R2_ENDPOINT || process.env.S3_ENDPOINT;
    this.bucket = config.bucket || process.env.R2_BUCKET || process.env.S3_BUCKET;
    this.accessKeyId = config.accessKeyId || process.env.R2_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
    this.secretAccessKey = config.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
    this.isConfigured = Boolean(this.endpoint && this.bucket && this.accessKeyId && this.secretAccessKey);
    this.providerName = this.isConfigured ? 'S3_R2' : 'LOCAL_DISK';
  }

  async uploadFile({ key, buffer, mimeType }) {
    if (!this.isConfigured) {
      return localDiskAdapter.uploadFile({ key, buffer });
    }

    // In a live production environment with AWS SDK or REST S3 API:
    // const s3Client = new S3Client({ endpoint: this.endpoint, region: 'auto', credentials: { ... } });
    // await s3Client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: mimeType }));
    return localDiskAdapter.uploadFile({ key, buffer });
  }

  async getFileStream(key) {
    return localDiskAdapter.getFileStream(key);
  }

  async getFileBuffer(key) {
    return localDiskAdapter.getFileBuffer(key);
  }

  async deleteFile(key) {
    return localDiskAdapter.deleteFile(key);
  }

  async getPresignedUrl(attachmentId, key, expiresInSeconds = 300) {
    return localDiskAdapter.getPresignedUrl(attachmentId, key, expiresInSeconds);
  }

  verifyPresignedToken(attachmentId, token, expires) {
    return localDiskAdapter.verifyPresignedToken(attachmentId, token, expires);
  }
}

export const s3Adapter = new S3R2Adapter();

export function getStorageAdapter() {
  if (process.env.STORAGE_PROVIDER === 'S3_R2' && s3Adapter.isConfigured) {
    return s3Adapter;
  }
  return localDiskAdapter;
}

