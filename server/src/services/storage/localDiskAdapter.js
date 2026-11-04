import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base directory for uploads
const DEFAULT_UPLOADS_DIR = path.resolve(__dirname, '../../../uploads/attachments');
const SECRET_KEY = process.env.ATTACHMENT_SECRET || 'drug-safety-cms-storage-secret-key-2026';

export class LocalDiskAdapter {
  constructor(baseDir = DEFAULT_UPLOADS_DIR) {
    this.baseDir = baseDir;
    this.providerName = 'LOCAL_DISK';
    this.ensureBaseDir();
  }

  ensureBaseDir() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  getFilePath(storageKey) {
    // Sanitize key to prevent path traversal
    const safeKey = storageKey.replace(/^(\.\.[\/\\])+/, '').replace(/[\/\\]+/g, path.sep);
    return path.join(this.baseDir, safeKey);
  }

  async uploadFile({ key, buffer }) {
    const targetPath = this.getFilePath(key);
    const targetDir = path.dirname(targetPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    await fs.promises.writeFile(targetPath, buffer);
    return {
      storageKey: key,
      storageProvider: this.providerName,
      size: buffer.length,
    };
  }

  async getFileStream(key) {
    const targetPath = this.getFilePath(key);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`File not found at storage key: ${key}`);
    }
    return fs.createReadStream(targetPath);
  }

  async getFileBuffer(key) {
    const targetPath = this.getFilePath(key);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`File not found at storage key: ${key}`);
    }
    return fs.promises.readFile(targetPath);
  }

  async deleteFile(key) {
    const targetPath = this.getFilePath(key);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
    return true;
  }

  generatePresignedToken(attachmentId, expiresInSeconds = 300) {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const dataToSign = `${attachmentId}:${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(dataToSign)
      .digest('hex');

    return {
      token: signature,
      expires: expiresAt,
    };
  }

  verifyPresignedToken(attachmentId, token, expires) {
    if (!token || !expires) return false;
    const expiresNum = Number(expires);
    if (isNaN(expiresNum) || Date.now() > expiresNum) {
      return false; // Token expired
    }

    const expectedData = `${attachmentId}:${expiresNum}`;
    const expectedSignature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(expectedData)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(token, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );
    } catch {
      return false;
    }
  }

  async getPresignedUrl(attachmentId, key, expiresInSeconds = 300) {
    const { token, expires } = this.generatePresignedToken(attachmentId, expiresInSeconds);
    return `/api/attachments/${attachmentId}/stream?token=${token}&expires=${expires}`;
  }
}

export const localDiskAdapter = new LocalDiskAdapter();

