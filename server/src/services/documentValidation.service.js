import crypto from 'crypto';

export class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.details = details;
  }
}

// 25 Megabytes statutory max size limit
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 26,214,400 bytes

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/xml',
  'text/xml',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const EICAR_TEST_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

/**
 * Checks magic bytes against claimed MIME type.
 */
export function verifyMagicBytes(buffer, claimedMime = '') {
  if (!buffer || buffer.length < 4) {
    return false;
  }

  const mime = claimedMime.toLowerCase();

  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (mime === 'application/pdf') {
    return (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    );
  }

  // PNG: 0x89 0x50 0x4E 0x47 (89 50 4E 47 0D 0A 1A 0A)
  if (mime === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }

  // JPEG: 0xFF 0xD8 0xFF
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // WebP: RIFF....WEBP
  if (mime === 'image/webp') {
    const isRiff = buffer.slice(0, 4).toString('ascii') === 'RIFF';
    const isWebp = buffer.length >= 12 && buffer.slice(8, 12).toString('ascii') === 'WEBP';
    return isRiff && isWebp;
  }

  // DOCX / XLSX / ZIP based: PK (0x50 0x4B 0x03 0x04)
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/msword'
  ) {
    // DOCX (ZIP) or legacy DOC (OLE: 0xD0 0xCF 0x11 0xE0)
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
    const isOle = buffer[0] === 0xd0 && buffer[1] === 0xcf;
    return isZip || isOle;
  }

  // Text, CSV, JSON, XML: Check that leading bytes are printable UTF-8/ASCII
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml'
  ) {
    // Ensure no null bytes in the first 256 bytes
    const checkLength = Math.min(buffer.length, 256);
    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] === 0x00) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Calculates SHA-256 hash of a buffer.
 */
export function calculateSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Virus scan hook placeholder.
 * Simulates heuristic scanning and validates against test malware signatures.
 */
export async function scanFileForViruses(buffer, filename = '') {
  const contentStr = buffer.toString('utf-8', 0, Math.min(buffer.length, 1024));

  if (
    contentStr.includes(EICAR_TEST_SIGNATURE) ||
    filename.toLowerCase().includes('eicar') ||
    filename.toLowerCase().includes('virus_test')
  ) {
    return {
      scanned: true,
      status: 'INFECTED',
      virusName: 'Synthetic.EICAR.TestSignature',
      scannedAt: new Date(),
    };
  }

  return {
    scanned: true,
    status: 'CLEAN',
    scanEngine: 'Synthetic Heuristic Antivirus Engine',
    scannedAt: new Date(),
  };
}

/**
 * Comprehensive document validation pipeline:
 * 1. File existence
 * 2. File size limit (25MB)
 * 3. MIME type allowlist
 * 4. Magic-byte verification
 * 5. Virus-scan hook
 * 6. SHA-256 checksum calculation
 */
export async function validateUploadedFile(file) {
  if (!file || !file.buffer) {
    throw new ValidationError('No file provided for upload.');
  }

  const { buffer, originalname, mimetype, size } = file;

  // 1. Size Validation
  const fileSize = size || buffer.length;
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(
      `File size (${(fileSize / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum statutory limit of 25MB.`,
    );
  }

  if (fileSize === 0) {
    throw new ValidationError('File cannot be empty (0 bytes).');
  }

  // 2. MIME Type Validation
  if (!ALLOWED_MIME_TYPES.has(mimetype.toLowerCase())) {
    throw new ValidationError(
      `Unsupported file type '${mimetype}'. Allowed formats: PDF, PNG, JPEG, WebP, TXT, CSV, XML, JSON, Word DOCX.`,
    );
  }

  // 3. Magic-Byte Check
  const magicBytesValid = verifyMagicBytes(buffer, mimetype);
  if (!magicBytesValid) {
    throw new ValidationError(
      `File content header does not match claimed MIME type '${mimetype}'. Potential file extension spoofing detected.`,
    );
  }

  // 4. Virus Scan
  const scanResult = await scanFileForViruses(buffer, originalname);
  if (scanResult.status === 'INFECTED') {
    throw new ValidationError(
      `Malware or security threat detected (${scanResult.virusName || 'Threat'}). File upload aborted.`,
    );
  }

  // 5. SHA-256 Checksum
  const hash = calculateSha256(buffer);

  return {
    name: originalname,
    mime: mimetype,
    size: fileSize,
    hash,
    virusScan: scanResult,
  };
}

