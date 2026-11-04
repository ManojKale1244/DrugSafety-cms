import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/audit.js', () => ({
  recordAudit: vi.fn().mockResolvedValue(true),
  auditTrail: vi.fn().mockResolvedValue(true),
}));

import {
  calculatePeriodDates,
  generateAggregateData,
  createReportDefinition,
  executeReportRun,
  submitReportRunForApproval,
  approveReportRun,
  generateCsvExport,
  generatePdfExport,
  SYNTHETIC_REPORT_DEFINITIONS_SEED,
} from '../services/aggregateReport.service.js';
import { ReportDefinition } from '../models/ReportDefinition.js';
import { ReportRun } from '../models/ReportRun.js';
import { Case } from '../models/Case.js';

describe('Module 15: Aggregate Safety Reports Service Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Period Date Calculations', () => {
    it('calculates 30 days for LAST_30_DAYS', () => {
      const { startDate, endDate } = calculatePeriodDates({ periodType: 'LAST_30_DAYS' });
      const diffDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);
    });

    it('calculates 90 days for QUARTERLY and 365 days for ANNUAL', () => {
      const q = calculatePeriodDates({ periodType: 'QUARTERLY' });
      expect(Math.round((q.endDate - q.startDate) / (1000 * 60 * 60 * 24))).toBe(90);

      const a = calculatePeriodDates({ periodType: 'ANNUAL' });
      expect(Math.round((a.endDate - a.startDate) / (1000 * 60 * 60 * 24))).toBe(365);
    });

    it('preserves custom date range when provided', () => {
      const start = '2026-01-01T00:00:00.000Z';
      const end = '2026-06-30T23:59:59.000Z';
      const { startDate, endDate } = calculatePeriodDates({
        periodType: 'CUSTOM',
        startDate: start,
        endDate: end,
      });

      expect(startDate.toISOString()).toBe(start);
      expect(endDate.toISOString()).toBe(end);
    });
  });

  describe('Aggregate Data Generation (Tabulation & Line Listings)', () => {
    it('groups adverse events into summary tabulation and detailed line listing', async () => {
      const mockCases = [
        {
          _id: 'c1',
          caseNumber: 'PV-2026-0001',
          receiptDate: new Date('2026-09-15T00:00:00Z'),
          country: 'Germany',
          patient: { age: 54, ageUnit: 'years', sex: 'Female' },
          seriousness: 'Serious',
          seriousnessFlags: { death: true, hospitalization: true },
          caseProducts: [
            { productName: 'CardioMax 50mg', role: 'Suspect' },
          ],
          reactions: [
            {
              verbatim: 'Severe myocardial infarction',
              pt: 'Myocardial infarction',
              soc: 'Cardiac disorders',
              outcome: 'fatal',
              causality: 'Probable',
            },
          ],
        },
        {
          _id: 'c2',
          caseNumber: 'PV-2026-0002',
          receiptDate: new Date('2026-09-20T00:00:00Z'),
          country: 'Germany',
          patient: { age: 48, ageUnit: 'years', sex: 'Male' },
          seriousness: 'Non-Serious',
          seriousnessFlags: {},
          caseProducts: [
            { productName: 'CardioMax 50mg', role: 'Suspect' },
          ],
          reactions: [
            {
              verbatim: 'Heart attack',
              pt: 'Myocardial infarction',
              soc: 'Cardiac disorders',
              outcome: 'recovered',
              causality: 'Possible',
            },
          ],
        },
      ];

      vi.spyOn(Case, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockCases),
        }),
      });

      const result = await generateAggregateData({}, { periodType: 'QUARTERLY' });

      expect(result.totalCases).toBe(2);
      expect(result.totalReactions).toBe(2);

      // Verify Summary Tabulation
      expect(result.summaryTabulation.length).toBe(1);
      const tab = result.summaryTabulation[0];
      expect(tab.product).toBe('CardioMax 50mg');
      expect(tab.preferredTerm).toBe('Myocardial infarction');
      expect(tab.country).toBe('Germany');
      expect(tab.seriousCount).toBe(1);
      expect(tab.nonSeriousCount).toBe(1);
      expect(tab.fatalCount).toBe(1);
      expect(tab.totalCount).toBe(2);

      // Verify Line Listing
      expect(result.lineListing.length).toBe(2);
      expect(result.lineListing[0].caseNumber).toBe('PV-2026-0001');
      expect(result.lineListing[0].patientAge).toBe('54 years');
      expect(result.lineListing[0].seriousnessCriteria).toContain('Death');
      expect(result.lineListing[0].causality).toBe('Probable');
    });
  });

  describe('Report Execution & Versioning', () => {
    it('executes a report run, assigning incremented version (v1 -> v2)', async () => {
      const mockDef = {
        _id: '672000000000000000000001',
        name: 'Periodic Safety Update Report',
        reportType: 'PSUR',
        period: { periodType: 'QUARTERLY' },
        filters: {},
      };

      vi.spyOn(ReportDefinition, 'findById').mockResolvedValue(mockDef);

      // Mock existing run v1
      vi.spyOn(ReportRun, 'findOne').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ version: 1 }),
        }),
      });

      vi.spyOn(Case, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      });

      const mockCreatedRun = {
        _id: '672000000000000000000002',
        definitionId: mockDef._id,
        definitionName: mockDef.name,
        reportType: 'PSUR',
        version: 2,
        status: 'GENERATED',
        summaryTabulation: [],
        lineListing: [],
        totalCases: 0,
        totalReactions: 0,
        fileReference: {
          csvFileName: 'PSUR_Periodic_Safety_Update_Report_v2.csv',
          pdfFileName: 'PSUR_Periodic_Safety_Update_Report_v2.pdf',
        },
        approval: { status: 'DRAFT' },
      };

      vi.spyOn(ReportRun, 'create').mockResolvedValue(mockCreatedRun);

      const run = await executeReportRun(
        mockDef._id,
        {},
        { _id: '672000000000000000000010', name: 'Dr. Safety' },
      );

      expect(run.version).toBe(2);
      expect(run.reportType).toBe('PSUR');
      expect(run.status).toBe('GENERATED');
      expect(run.fileReference.csvFileName).toContain('v2.csv');
    });

    it('handles approval workflow from DRAFT to PENDING_APPROVAL and APPROVED', async () => {
      const mockRun = {
        _id: '672000000000000000000003',
        definitionName: 'ICH PBRER',
        version: 1,
        status: 'GENERATED',
        approval: { status: 'DRAFT' },
        history: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(ReportRun, 'findById').mockResolvedValue(mockRun);

      // 1. Submit for approval
      const submitted = await submitReportRunForApproval(
        mockRun._id,
        { comments: 'Ready for QPPV sign-off' },
        { _id: '672000000000000000000011', name: 'Regulatory Officer' },
      );

      expect(submitted.status).toBe('PENDING_APPROVAL');
      expect(submitted.approval.status).toBe('PENDING_APPROVAL');

      // 2. Approve
      const approved = await approveReportRun(
        mockRun._id,
        { comments: 'Reviewed benefit-risk. Approved.' },
        { _id: '672000000000000000000012', name: 'QPPV Lead' },
      );

      expect(approved.status).toBe('APPROVED');
      expect(approved.approval.status).toBe('APPROVED');
      expect(approved.approval.approvedByName).toBe('QPPV Lead');
    });
  });

  describe('CSV and PDF Exports', () => {
    const sampleRun = {
      definitionName: 'Periodic Benefit-Risk Evaluation Report',
      reportType: 'PBRER',
      version: 1,
      status: 'APPROVED',
      runByName: 'Safety Specialist',
      runAt: new Date('2026-10-01T00:00:00Z'),
      period: {
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-06-30T00:00:00Z'),
      },
      totalCases: 1,
      totalReactions: 1,
      summaryTabulation: [
        {
          product: 'NeuroCalm 10mg',
          preferredTerm: 'Somnolence',
          systemOrganClass: 'Nervous system disorders',
          country: 'United States',
          seriousCount: 0,
          nonSeriousCount: 1,
          fatalCount: 0,
          totalCount: 1,
        },
      ],
      lineListing: [
        {
          caseNumber: 'PV-2026-0099',
          receiptDate: new Date('2026-03-10T00:00:00Z'),
          country: 'United States',
          patientAge: '32 years',
          patientSex: 'Male',
          productName: 'NeuroCalm 10mg',
          productRole: 'Suspect',
          preferredTerm: 'Somnolence',
          verbatimReaction: 'Excessive daytime sleepiness',
          seriousness: 'Non-Serious',
          seriousnessCriteria: [],
          causality: 'Certain',
          outcome: 'recovered',
        },
      ],
    };

    it('generates well-formatted CSV with statutory notice, summary tabulation, and line listing', () => {
      const csv = generateCsvExport(sampleRun);

      expect(csv).toContain('Periodic Benefit-Risk Evaluation Report');
      expect(csv).toContain('PBRER');
      expect(csv).toContain('Aggregate safety reporting evaluates cumulative population benefit-risk profiles');
      expect(csv).toContain('NeuroCalm 10mg');
      expect(csv).toContain('Somnolence');
      expect(csv).toContain('PV-2026-0099');
    });

    it('generates valid PDF buffer starting with %PDF-', async () => {
      const pdfBuffer = await generatePdfExport(sampleRun);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(500);
      const headerStr = pdfBuffer.slice(0, 5).toString('ascii');
      expect(headerStr).toBe('%PDF-');
    });
  });
});

