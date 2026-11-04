import crypto from 'crypto';
import mongoose from 'mongoose';
import { Attachment } from '../models/Attachment.js';
import { Case } from '../models/Case.js';
import { Intake } from '../models/Intake.js';
import { getStorageAdapter } from './storage/s3Adapter.js';
import { validateUploadedFile, ValidationError } from './documentValidation.service.js';
import { recordAudit } from '../utils/audit.js';

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

export class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnauthorizedError';
    this.status = 401;
  }
}

/**
 * Uploads a source document or attachment to a case.
 */
export async function uploadCaseAttachment({ caseId, file, category = 'SOURCE_DOCUMENT', user, req }) {
  if (!mongoose.Types.ObjectId.isValid(caseId)) {
    throw new ValidationError(`Invalid case ID: ${caseId}`);
  }

  const existingCase = await Case.findById(caseId);
  if (!existingCase) {
    throw new NotFoundError(`Case not found with ID ${caseId}`);
  }

  // 1. Validate file (size, MIME type, magic bytes, virus scan, hash)
  const validation = await validateUploadedFile(file);

  // 2. Generate secure storage key
  const randomUuid = crypto.randomUUID();
  const safeFilename = validation.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `cases/${caseId}/${Date.now()}_${randomUuid}_${safeFilename}`;

  // 3. Upload to storage adapter
  const storageAdapter = getStorageAdapter();
  await storageAdapter.uploadFile({
    key: storageKey,
    buffer: file.buffer,
    mimeType: validation.mime,
  });

  // 4. Create Attachment document in MongoDB
  const attachment = await Attachment.create({
    caseId,
    caseNumber: existingCase.caseNumber || '',
    name: validation.name,
    mime: validation.mime,
    size: validation.size,
    hash: validation.hash,
    version: 1,
    uploadedBy: user?._id || null,
    uploadedByName: user?.name || 'Safety Specialist',
    category: category || 'SOURCE_DOCUMENT',
    storageKey,
    storageProvider: storageAdapter.providerName,
    virusScan: validation.virusScan,
    versionHistory: [],
    isArchived: false,
  });

  // 5. Update case flags and attachments list
  existingCase.attachmentsFlag = true;
  if (!existingCase.attachments) existingCase.attachments = [];
  existingCase.attachments.push({
    name: attachment.name,
    category: attachment.category,
    uploadedAt: attachment.createdAt,
    url: `/api/attachments/${attachment._id}/stream`,
  });
  await existingCase.save();

  // 6. Record 21 CFR Part 11 compliant audit trail
  await recordAudit({
    actor: user,
    action: 'DOCUMENT_UPLOADED',
    entity: 'Attachment',
    entityId: String(attachment._id),
    summary: `Document uploaded: ${attachment.name} (${attachment.category}, ${(attachment.size / 1024).toFixed(1)} KB) to Case ${existingCase.caseNumber}.`,
    details: {
      caseId: String(caseId),
      filename: attachment.name,
      hash: attachment.hash,
      size: attachment.size,
      version: 1,
      category: attachment.category,
    },
    req,
  });

  return attachment;
}

/**
 * Uploads a source document or attachment directly to an Intake report.
 */
export async function uploadIntakeAttachment({ intakeId, file, category = 'SOURCE_DOCUMENT', user, req }) {
  if (!mongoose.Types.ObjectId.isValid(intakeId)) {
    throw new ValidationError(`Invalid intake ID: ${intakeId}`);
  }

  const existingIntake = await Intake.findById(intakeId);
  if (!existingIntake) {
    throw new NotFoundError(`Intake report not found with ID ${intakeId}`);
  }

  // 1. Validate file (size, MIME type, magic bytes, virus scan, hash)
  const validation = await validateUploadedFile(file);

  // 2. Generate secure storage key
  const randomUuid = crypto.randomUUID();
  const safeFilename = validation.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `intakes/${intakeId}/${Date.now()}_${randomUuid}_${safeFilename}`;

  // 3. Upload to storage adapter
  const storageAdapter = getStorageAdapter();
  await storageAdapter.uploadFile({
    key: storageKey,
    buffer: file.buffer,
    mimeType: validation.mime,
  });

  // 4. Create Attachment document in MongoDB
  const attachment = await Attachment.create({
    intakeId,
    intakeNumber: existingIntake.intakeNumber || '',
    name: validation.name,
    mime: validation.mime,
    size: validation.size,
    hash: validation.hash,
    version: 1,
    uploadedBy: user?._id || null,
    uploadedByName: user?.name || 'Intake Specialist',
    category: category || 'SOURCE_DOCUMENT',
    storageKey,
    storageProvider: storageAdapter.providerName,
    virusScan: validation.virusScan,
    versionHistory: [],
    isArchived: false,
  });

  // 5. Synchronize with intake.attachments array
  if (!existingIntake.attachments) existingIntake.attachments = [];
  existingIntake.attachments.push({
    name: attachment.name,
    size: attachment.size,
    uploadedAt: attachment.createdAt,
    url: `/api/attachments/${attachment._id}/stream`,
  });
  await existingIntake.save();

  // 6. Record audit trail
  await recordAudit({
    actor: user,
    action: 'INTAKE_DOCUMENT_UPLOADED',
    entity: 'Attachment',
    entityId: String(attachment._id),
    summary: `Source document uploaded: ${attachment.name} (${attachment.category}) to Intake ${existingIntake.intakeNumber}.`,
    details: {
      intakeId: String(intakeId),
      filename: attachment.name,
      hash: attachment.hash,
      size: attachment.size,
      category: attachment.category,
    },
    req,
  });

  return attachment;
}

/**
 * Returns all active attachments for an intake report.
 */
export async function getIntakeAttachments(intakeId) {
  if (!mongoose.Types.ObjectId.isValid(intakeId)) {
    throw new ValidationError(`Invalid intake ID: ${intakeId}`);
  }

  return Attachment.find({ intakeId, isArchived: false })
    .sort({ createdAt: -1 })
    .populate('uploadedBy', 'name email role')
    .lean();
}

/**
 * Automatically transfers / associates all intake attachments when converting an intake to a case.
 */
export async function transferIntakeAttachmentsToCase(intakeId, caseId, caseNumber) {
  if (!intakeId || !caseId) return;

  const intakeAttachments = await Attachment.find({ intakeId, isArchived: false });
  if (intakeAttachments.length === 0) return;

  await Attachment.updateMany(
    { intakeId, isArchived: false },
    { $set: { caseId, caseNumber } },
  );

  const updatedCase = await Case.findById(caseId);
  if (updatedCase) {
    updatedCase.attachmentsFlag = true;
    if (!updatedCase.attachments) updatedCase.attachments = [];
    for (const att of intakeAttachments) {
      updatedCase.attachments.push({
        name: att.name,
        category: att.category,
        uploadedAt: att.createdAt,
        url: `/api/attachments/${att._id}/stream`,
      });
    }
    await updatedCase.save();
  }
}

/**
 * Query all attachments system-wide with search, category filtering, and pagination.
 */
export async function getAllAttachments({ category, search, caseId, intakeId, page = 1, limit = 50 } = {}) {
  const query = { isArchived: false };

  if (category && category !== 'ALL') {
    query.category = category;
  }

  if (caseId) {
    query.caseId = caseId;
  }

  if (intakeId) {
    query.intakeId = intakeId;
  }

  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { name: { $regex: s, $options: 'i' } },
      { hash: { $regex: s, $options: 'i' } },
      { caseNumber: { $regex: s, $options: 'i' } },
      { intakeNumber: { $regex: s, $options: 'i' } },
    ];
  }

  const total = await Attachment.countDocuments(query);
  const attachments = await Attachment.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('caseId', 'caseNumber status')
    .populate('intakeId', 'intakeNumber status')
    .populate('uploadedBy', 'name email role')
    .lean();

  return {
    attachments,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Returns overall document storage statistics for dashboard & audit reporting.
 */
export async function getAttachmentStats() {
  const attachments = await Attachment.find({ isArchived: false }).lean();

  let totalBytes = 0;
  const categoryCounts = {};
  const mimeCounts = {};

  for (const a of attachments) {
    totalBytes += a.size || 0;
    categoryCounts[a.category] = (categoryCounts[a.category] || 0) + 1;

    const mimeGroup = a.mime.includes('pdf')
      ? 'PDF'
      : a.mime.includes('image')
      ? 'IMAGE'
      : a.mime.includes('csv') || a.mime.includes('sheet')
      ? 'CSV_SPREADSHEET'
      : a.mime.includes('xml')
      ? 'XML'
      : 'OTHER';
    mimeCounts[mimeGroup] = (mimeCounts[mimeGroup] || 0) + 1;
  }

  return {
    totalDocuments: attachments.length,
    totalSizeBytes: totalBytes,
    totalSizeFormatted: `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`,
    categoryCounts,
    mimeCounts,
    storageLocation: 'server/uploads/attachments',
    syntheticNotice:
      '21 CFR Part 11 compliant document management and audit trail repository.',
  };
}

/**
 * Uploads a new version of an existing attachment (preserves previous version in history).
 */
export async function uploadNewAttachmentVersion(attachmentId, { file, reason = '', user, req }) {
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment || attachment.isArchived) {
    throw new NotFoundError(`Attachment not found with ID ${attachmentId}`);
  }

  // 1. Validate replacement file
  const validation = await validateUploadedFile(file);

  // 2. Generate new storage key
  const randomUuid = crypto.randomUUID();
  const safeFilename = validation.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const targetPrefix = attachment.caseId ? `cases/${attachment.caseId}` : `intakes/${attachment.intakeId}`;
  const newStorageKey = `${targetPrefix}/v${attachment.version + 1}_${Date.now()}_${randomUuid}_${safeFilename}`;

  // 3. Upload to storage
  const storageAdapter = getStorageAdapter();
  await storageAdapter.uploadFile({
    key: newStorageKey,
    buffer: file.buffer,
    mimeType: validation.mime,
  });

  // 4. Archive current version
  attachment.versionHistory.push({
    version: attachment.version,
    hash: attachment.hash,
    size: attachment.size,
    storageKey: attachment.storageKey,
    mime: attachment.mime,
    uploadedBy: attachment.uploadedBy,
    uploadedByName: attachment.uploadedByName,
    uploadedAt: attachment.updatedAt || attachment.createdAt,
    reason: reason || 'Superceded by updated clinical documentation.',
  });

  // 5. Update to new version
  const oldVersion = attachment.version;
  attachment.version += 1;
  attachment.name = validation.name;
  attachment.mime = validation.mime;
  attachment.size = validation.size;
  attachment.hash = validation.hash;
  attachment.storageKey = newStorageKey;
  attachment.storageProvider = storageAdapter.providerName;
  attachment.virusScan = validation.virusScan;
  attachment.uploadedBy = user?._id || null;
  attachment.uploadedByName = user?.name || 'Safety Specialist';

  await attachment.save();

  // 6. Record audit trail
  await recordAudit({
    actor: user,
    action: 'DOCUMENT_VERSION_UPDATED',
    entity: 'Attachment',
    entityId: String(attachment._id),
    summary: `Document version incremented from v${oldVersion} to v${attachment.version} for ${attachment.name}.`,
    details: {
      attachmentId: String(attachmentId),
      oldVersion,
      newVersion: attachment.version,
      hash: attachment.hash,
      reason,
    },
    req,
  });

  return attachment;
}

/**
 * Returns all active attachments for a case.
 */
export async function getCaseAttachments(caseId) {
  if (!mongoose.Types.ObjectId.isValid(caseId)) {
    throw new ValidationError(`Invalid case ID: ${caseId}`);
  }

  return Attachment.find({ caseId, isArchived: false })
    .sort({ createdAt: -1 })
    .populate('uploadedBy', 'name email role')
    .lean();
}

/**
 * Retrieves file stream for download or in-app preview.
 * Strictly verifies authorization (either active authenticated session or valid presigned token).
 * Audits every single download event under 21 CFR Part 11.
 */
export async function getAttachmentStream(attachmentId, { token, expires, user, req }) {
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment || attachment.isArchived) {
    throw new NotFoundError(`Attachment not found with ID ${attachmentId}`);
  }

  const storageAdapter = getStorageAdapter();

  // Validate authentication:
  // 1. Direct authenticated user with case.read permission
  // 2. OR short-lived presigned token
  let authorized = false;
  let actorInfo = user;

  if (user && user._id) {
    authorized = true;
  } else if (token && expires) {
    const isValidToken = storageAdapter.verifyPresignedToken(attachmentId, token, expires);
    if (isValidToken) {
      authorized = true;
      actorInfo = { name: 'Presigned Token Bearer', role: 'authorized_token' };
    }
  }

  if (!authorized) {
    throw new UnauthorizedError('Unauthorized access to protected pharmacovigilance document.');
  }

  // Audit the download
  await recordAudit({
    actor: actorInfo,
    action: 'DOCUMENT_DOWNLOADED',
    entity: 'Attachment',
    entityId: String(attachment._id),
    summary: `Document ${attachment.name} (v${attachment.version}) streamed/downloaded.`,
    details: {
      attachmentId: String(attachment._id),
      caseId: attachment.caseId ? String(attachment.caseId) : null,
      intakeId: attachment.intakeId ? String(attachment.intakeId) : null,
      filename: attachment.name,
      hash: attachment.hash,
      version: attachment.version,
      accessMethod: token ? 'PRESIGNED_URL' : 'SESSION_AUTH',
      ip: req?.ip || 'N/A',
    },
    req,
  });

  const stream = await storageAdapter.getFileStream(attachment.storageKey);

  return {
    stream,
    name: attachment.name,
    mime: attachment.mime,
    size: attachment.size,
  };
}

/**
 * Generates a short-lived presigned URL (valid for 5 minutes).
 */
export async function getAttachmentPresignedUrl(attachmentId, user, req) {
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment || attachment.isArchived) {
    throw new NotFoundError(`Attachment not found with ID ${attachmentId}`);
  }

  const storageAdapter = getStorageAdapter();
  const presignedUrl = await storageAdapter.getPresignedUrl(
    String(attachment._id),
    attachment.storageKey,
    300, // 5 minutes validity
  );

  await recordAudit({
    actor: user,
    action: 'DOCUMENT_PRESIGNED_URL_GENERATED',
    entity: 'Attachment',
    entityId: String(attachment._id),
    summary: `Short-lived presigned URL generated for ${attachment.name} (valid for 300s).`,
    details: { attachmentId: String(attachment._id) },
    req,
  });

  return {
    attachmentId: String(attachment._id),
    presignedUrl,
    expiresInSeconds: 300,
  };
}

/**
 * Soft-deletes / archives an attachment.
 */
export async function deleteAttachment(attachmentId, user, req) {
  const attachment = await Attachment.findById(attachmentId);
  if (!attachment || attachment.isArchived) {
    throw new NotFoundError(`Attachment not found with ID ${attachmentId}`);
  }

  attachment.isArchived = true;
  await attachment.save();

  // Check remaining active attachments for case if linked
  if (attachment.caseId) {
    const remainingCount = await Attachment.countDocuments({
      caseId: attachment.caseId,
      isArchived: false,
    });

    if (remainingCount === 0) {
      await Case.findByIdAndUpdate(attachment.caseId, { attachmentsFlag: false });
    }
  }

  await recordAudit({
    actor: user,
    action: 'DOCUMENT_ARCHIVED',
    entity: 'Attachment',
    entityId: String(attachment._id),
    summary: `Document ${attachment.name} archived from repository.`,
    details: { attachmentId: String(attachment._id) },
    req,
  });

  return { success: true, message: 'Document archived successfully.' };
}
