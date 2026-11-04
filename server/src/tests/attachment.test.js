import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/audit.js', () => ({
  recordAudit: vi.fn().mockResolvedValue(true),
  auditTrail: vi.fn().mockResolvedValue(true),
}));

import {
  validateUploadedFile,
  verifyMagicBytes,
  calculateSha256,
  scanFileForViruses,
  ValidationError,
  MAX_FILE_SIZE_BYTES,
} from '../services/documentValidation.service.js';
import {
  uploadCaseAttachment,
  uploadIntakeAttachment,
  getIntakeAttachments,
  transferIntakeAttachmentsToCase,
  uploadNewAttachmentVersion,
  getAttachmentStream,
  deleteAttachment,
  getAllAttachments,
  getAttachmentStats,
  UnauthorizedError,
  NotFoundError,
} from '../services/attachment.service.js';
import { localDiskAdapter } from '../services/storage/localDiskAdapter.js';
import { Attachment } from '../models/Attachment.js';
import { Case } from '../models/Case.js';
import { Intake } from '../models/Intake.js';

describe('Module 17: Document Management & Attachment Service Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('File Validation Pipeline (Magic Bytes, Size, Virus Scan, Hash)', () => {
    it('successfully validates authentic PDF with magic bytes %PDF', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 Mock clinical trial discharge summary content');
      const file = {
        buffer: pdfBuffer,
        originalname: 'Discharge_Summary.pdf',
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
      };

      const result = await validateUploadedFile(file);

      expect(result.name).toBe('Discharge_Summary.pdf');
      expect(result.mime).toBe('application/pdf');
      expect(result.hash.length).toBe(64); // SHA-256 is 64 hex characters
      expect(result.virusScan.status).toBe('CLEAN');
    });

    it('successfully validates PNG image with magic bytes 89 50 4E 47', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      const file = {
        buffer: pngBuffer,
        originalname: 'ECG_Scan.png',
        mimetype: 'image/png',
        size: pngBuffer.length,
      };

      const result = await validateUploadedFile(file);
      expect(result.mime).toBe('image/png');
      expect(result.hash).toBe(calculateSha256(pngBuffer));
    });

    it('rejects file when magic bytes do not match claimed MIME type (MIME spoofing)', async () => {
      // Plain text claiming to be a PDF
      const fakePdfBuffer = Buffer.from('Just plain text pretending to be a PDF file');
      const file = {
        buffer: fakePdfBuffer,
        originalname: 'Malicious_Document.pdf',
        mimetype: 'application/pdf',
        size: fakePdfBuffer.length,
      };

      await expect(validateUploadedFile(file)).rejects.toThrow(
        /magic byte check failed|Potential file extension spoofing/i,
      );
    });

    it('rejects oversized files exceeding 25MB statutory limit', async () => {
      const oversizedBuffer = Buffer.alloc(10); // Simulated buffer
      const file = {
        buffer: oversizedBuffer,
        originalname: 'Gigantic_Scan.pdf',
        mimetype: 'application/pdf',
        size: MAX_FILE_SIZE_BYTES + 1024, // > 25MB
      };

      await expect(validateUploadedFile(file)).rejects.toThrow(
        /exceeds the maximum statutory limit of 25MB/i,
      );
    });

    it('detects malware signatures via virus scan hook and aborts upload', async () => {
      const eicarBuffer = Buffer.from(
        'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
      );
      const file = {
        buffer: eicarBuffer,
        originalname: 'eicar_test_virus.txt',
        mimetype: 'text/plain',
        size: eicarBuffer.length,
      };

      await expect(validateUploadedFile(file)).rejects.toThrow(
        /Malware or security threat detected/i,
      );
    });
  });

  describe('Storage Adapter & Presigned Token Generation', () => {
    it('generates valid short-lived presigned token and verifies authenticity', () => {
      const attachmentId = '672000000000000000000099';
      const { token, expires } = localDiskAdapter.generatePresignedToken(attachmentId, 300);

      expect(token).toBeDefined();
      expect(expires).toBeGreaterThan(Date.now());

      const isValid = localDiskAdapter.verifyPresignedToken(attachmentId, token, expires);
      expect(isValid).toBe(true);
    });

    it('rejects expired presigned tokens', () => {
      const attachmentId = '672000000000000000000099';
      const expiredTimestamp = Date.now() - 5000; // 5 seconds ago
      const { token } = localDiskAdapter.generatePresignedToken(attachmentId, -5);

      const isValid = localDiskAdapter.verifyPresignedToken(attachmentId, token, expiredTimestamp);
      expect(isValid).toBe(false);
    });

    it('rejects tampered presigned tokens', () => {
      const attachmentId = '672000000000000000000099';
      const { token, expires } = localDiskAdapter.generatePresignedToken(attachmentId, 300);
      const tamperedToken = token.slice(0, -4) + '0000';

      const isValid = localDiskAdapter.verifyPresignedToken(attachmentId, tamperedToken, expires);
      expect(isValid).toBe(false);
    });
  });

  describe('Document Upload & Versioning Workflow', () => {
    it('uploads initial attachment version (v1) and flags case', async () => {
      const caseId = '672000000000000000000001';
      const mockCase = {
        _id: caseId,
        caseNumber: 'PV-2026-0001',
        attachmentsFlag: false,
        attachments: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Case, 'findById').mockResolvedValue(mockCase);

      const pdfBuffer = Buffer.from('%PDF-1.4 Clinical pathology test report');
      const file = {
        buffer: pdfBuffer,
        originalname: 'Lab_Pathology_Report.pdf',
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
      };

      vi.spyOn(localDiskAdapter, 'uploadFile').mockResolvedValue({
        storageKey: 'cases/test/key.pdf',
        storageProvider: 'LOCAL_DISK',
        size: pdfBuffer.length,
      });

      const mockCreatedAttachment = {
        _id: '672000000000000000000055',
        caseId,
        name: 'Lab_Pathology_Report.pdf',
        mime: 'application/pdf',
        size: pdfBuffer.length,
        version: 1,
        category: 'LAB_RESULT',
        hash: calculateSha256(pdfBuffer),
      };

      vi.spyOn(Attachment, 'create').mockResolvedValue(mockCreatedAttachment);

      const attachment = await uploadCaseAttachment({
        caseId,
        file,
        category: 'LAB_RESULT',
        user: { _id: 'u1', name: 'Dr. Pathologist' },
      });

      expect(attachment.version).toBe(1);
      expect(attachment.name).toBe('Lab_Pathology_Report.pdf');
      expect(mockCase.attachmentsFlag).toBe(true);
      expect(mockCase.save).toHaveBeenCalled();
    });

    it('increments version (v1 -> v2) when new version is uploaded and archives previous version', async () => {
      const attachmentId = '672000000000000000000055';
      const mockExistingAttachment = {
        _id: attachmentId,
        caseId: '672000000000000000000001',
        name: 'Lab_Pathology_Report.pdf',
        mime: 'application/pdf',
        size: 100,
        version: 1,
        hash: 'oldhash123',
        storageKey: 'cases/1/v1.pdf',
        versionHistory: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Attachment, 'findById').mockResolvedValue(mockExistingAttachment);

      const newPdfBuffer = Buffer.from('%PDF-1.4 Amended Lab Pathology Report with differential count');
      const replacementFile = {
        buffer: newPdfBuffer,
        originalname: 'Lab_Pathology_Report_Amended.pdf',
        mimetype: 'application/pdf',
        size: newPdfBuffer.length,
      };

      vi.spyOn(localDiskAdapter, 'uploadFile').mockResolvedValue({
        storageKey: 'cases/1/v2.pdf',
        storageProvider: 'LOCAL_DISK',
        size: newPdfBuffer.length,
      });

      const updated = await uploadNewAttachmentVersion(attachmentId, {
        file: replacementFile,
        reason: 'Added differential WBC count from secondary lab',
        user: { _id: 'u2', name: 'Dr. Lead' },
      });

      expect(updated.version).toBe(2);
      expect(updated.versionHistory.length).toBe(1);
      expect(updated.versionHistory[0].version).toBe(1);
      expect(updated.versionHistory[0].hash).toBe('oldhash123');
      expect(updated.versionHistory[0].reason).toContain('differential WBC');
    });
  });

  describe('Security & Access Control (Streaming & Presigned Access)', () => {
    it('rejects unauthenticated stream requests when no presigned token is present', async () => {
      const attachmentId = '672000000000000000000055';
      vi.spyOn(Attachment, 'findById').mockResolvedValue({
        _id: attachmentId,
        name: 'Secret.pdf',
        isArchived: false,
      });

      await expect(
        getAttachmentStream(attachmentId, { user: null, token: null }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('allows streaming with valid presigned token and audits the download', async () => {
      const attachmentId = '672000000000000000000055';
      const mockAttachment = {
        _id: attachmentId,
        caseId: 'c1',
        name: 'Lab_Report.pdf',
        mime: 'application/pdf',
        size: 500,
        version: 1,
        hash: 'h1',
        storageKey: 'key.pdf',
        isArchived: false,
      };

      vi.spyOn(Attachment, 'findById').mockResolvedValue(mockAttachment);
      vi.spyOn(localDiskAdapter, 'getFileStream').mockResolvedValue('mockStreamObject');

      const { token, expires } = localDiskAdapter.generatePresignedToken(attachmentId, 300);

      const result = await getAttachmentStream(attachmentId, {
        token,
        expires,
        user: null,
      });

      expect(result.name).toBe('Lab_Report.pdf');
      expect(result.mime).toBe('application/pdf');
      expect(result.stream).toBe('mockStreamObject');
    });
  });

  describe('Intake Attachments & Conversion Transfer Lifecycle', () => {
    it('uploads source document to an intake record and updates intake attachments array', async () => {
      const intakeId = '672000000000000000000010';
      const mockIntake = {
        _id: intakeId,
        intakeNumber: 'IN-2026-00001',
        attachments: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Intake, 'findById').mockResolvedValue(mockIntake);

      const pdfBuffer = Buffer.from('%PDF-1.4 Intake Physician Adverse Event Handwritten Scan');
      const file = {
        buffer: pdfBuffer,
        originalname: 'Adverse_Event_Scan.pdf',
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
      };

      vi.spyOn(localDiskAdapter, 'uploadFile').mockResolvedValue({
        storageKey: 'intakes/10/file.pdf',
        storageProvider: 'LOCAL_DISK',
        size: pdfBuffer.length,
      });

      vi.spyOn(Attachment, 'create').mockResolvedValue({
        _id: '672000000000000000000099',
        intakeId,
        intakeNumber: 'IN-2026-00001',
        name: 'Adverse_Event_Scan.pdf',
        mime: 'application/pdf',
        size: pdfBuffer.length,
        hash: 'hash99',
        version: 1,
        createdAt: new Date(),
      });

      const result = await uploadIntakeAttachment({
        intakeId,
        file,
        category: 'SOURCE_DOCUMENT',
        user: { _id: 'u1', name: 'Intake Agent' },
      });

      expect(result.name).toBe('Adverse_Event_Scan.pdf');
      expect(mockIntake.save).toHaveBeenCalled();
      expect(mockIntake.attachments.length).toBe(1);
    });

    it('transfers all intake attachments to case upon conversion', async () => {
      const intakeId = '672000000000000000000010';
      const caseId = '672000000000000000000020';
      const caseNumber = 'DS-2026-00005';

      const mockAttachments = [
        {
          _id: 'att1',
          name: 'Medical_Chart.pdf',
          category: 'SOURCE_DOCUMENT',
          createdAt: new Date(),
        },
      ];

      vi.spyOn(Attachment, 'find').mockResolvedValue(mockAttachments);
      vi.spyOn(Attachment, 'updateMany').mockResolvedValue({ modifiedCount: 1 });

      const mockCase = {
        _id: caseId,
        attachmentsFlag: false,
        attachments: [],
        save: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(Case, 'findById').mockResolvedValue(mockCase);

      await transferIntakeAttachmentsToCase(intakeId, caseId, caseNumber);

      expect(Attachment.updateMany).toHaveBeenCalledWith(
        { intakeId, isArchived: false },
        { $set: { caseId, caseNumber } },
      );
      expect(mockCase.attachmentsFlag).toBe(true);
      expect(mockCase.attachments.length).toBe(1);
      expect(mockCase.save).toHaveBeenCalled();
    });
  });

  describe('Document Vault Analytics & Aggregate Stats', () => {
    it('aggregates document count, storage size, and category breakdown', async () => {
      const mockDocs = [
        { size: 1024 * 1024, category: 'SOURCE_DOCUMENT', mime: 'application/pdf' },
        { size: 2 * 1024 * 1024, category: 'LAB_RESULT', mime: 'image/png' },
      ];

      vi.spyOn(Attachment, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockDocs),
      });

      const stats = await getAttachmentStats();

      expect(stats.totalDocuments).toBe(2);
      expect(stats.totalSizeBytes).toBe(3 * 1024 * 1024);
      expect(stats.totalSizeFormatted).toBe('3.00 MB');
      expect(stats.categoryCounts.SOURCE_DOCUMENT).toBe(1);
      expect(stats.categoryCounts.LAB_RESULT).toBe(1);
      expect(stats.mimeCounts.PDF).toBe(1);
      expect(stats.mimeCounts.IMAGE).toBe(1);
    });

    it('archives document and clears case attachmentsFlag when no active documents remain', async () => {
      const attachmentId = '672000000000000000000088';
      const mockAttachment = {
        _id: attachmentId,
        name: 'Report.pdf',
        caseId: 'c1',
        isArchived: false,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Attachment, 'findById').mockResolvedValue(mockAttachment);
      vi.spyOn(Attachment, 'countDocuments').mockResolvedValue(0); // 0 remaining
      vi.spyOn(Case, 'findByIdAndUpdate').mockResolvedValue(true);

      const result = await deleteAttachment(attachmentId, { _id: 'u1' });

      expect(result.success).toBe(true);
      expect(mockAttachment.isArchived).toBe(true);
      expect(mockAttachment.save).toHaveBeenCalled();
      expect(Case.findByIdAndUpdate).toHaveBeenCalledWith('c1', { attachmentsFlag: false });
    });
  });
});

