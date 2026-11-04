import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/audit.js', () => ({
  recordAudit: vi.fn().mockResolvedValue(true),
  auditTrail: vi.fn().mockResolvedValue(true),
}));

import {
  getComplianceSummary,
  getRuleHistory,
  createOrUpdateRuleWithGovernance,
  approveRuleVersion,
  getOverdueReportsDrilldown,
  ValidationError,
  NotFoundError,
} from '../services/compliance.service.js';
import { ReportingRule } from '../models/ReportingRule.js';
import { RegulatoryReport } from '../models/RegulatoryReport.js';

describe('Module 14: Compliance Tracking Service Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rule Governance & Versioning', () => {
    it('creates initial version (v1) with change history and approval', async () => {
      const mockCreated = {
        _id: '672000000000000000000001',
        ruleCode: 'RR-TEST-7D',
        version: 1,
        jurisdiction: 'FDA',
        name: 'Test 7-Day Alert',
        reportType: '7-Day Expedited',
        deadlineDays: 7,
        active: true,
        changeHistory: [
          {
            version: 1,
            reason: 'Initial creation',
            diff: [],
          },
        ],
        approval: {
          status: 'APPROVED',
          approvedByName: 'Regulatory Lead',
        },
      };

      vi.spyOn(ReportingRule, 'findOne').mockReturnValue({
        sort: vi.fn().mockResolvedValue(null),
      });
      vi.spyOn(ReportingRule, 'create').mockResolvedValue(mockCreated);

      const rule = await createOrUpdateRuleWithGovernance(
        {
          ruleCode: 'RR-TEST-7D',
          jurisdiction: 'FDA',
          name: 'Test 7-Day Alert',
          reportType: '7-Day Expedited',
          deadlineDays: 7,
          reason: 'Initial creation',
        },
        { _id: '672000000000000000000011', name: 'Regulatory Lead' },
      );

      expect(rule.version).toBe(1);
      expect(rule.ruleCode).toBe('RR-TEST-7D');
      expect(rule.approval.status).toBe('APPROVED');
    });

    it('creates version 2 when rule is updated, preserving previous definition and recording diff', async () => {
      const existingV1 = {
        _id: '672000000000000000000001',
        ruleCode: 'RR-TEST-7D',
        version: 1,
        jurisdiction: 'FDA',
        name: 'Test 7-Day Alert',
        reportType: '7-Day Expedited',
        deadlineDays: 7,
        active: true,
        save: vi.fn().mockResolvedValue(true),
        changeHistory: [],
      };

      const mockV2 = {
        _id: '672000000000000000000002',
        ruleCode: 'RR-TEST-7D',
        version: 2,
        jurisdiction: 'FDA',
        name: 'Test 5-Day Fast Alert',
        reportType: '5-Day Expedited',
        deadlineDays: 5,
        active: true,
        approval: {
          status: 'APPROVED',
          approvedByName: 'Regulatory Director',
        },
        changeHistory: [
          {
            version: 2,
            reason: 'Statutory deadline compression',
            previousDefinition: {
              deadlineDays: 7,
              name: 'Test 7-Day Alert',
            },
            diff: [
              { field: 'name', label: 'Rule Title', oldValue: 'Test 7-Day Alert', newValue: 'Test 5-Day Fast Alert' },
              { field: 'deadlineDays', label: 'Deadline (Days)', oldValue: 7, newValue: 5 },
            ],
          },
        ],
      };

      vi.spyOn(ReportingRule, 'findOne').mockReturnValue({
        sort: vi.fn().mockResolvedValue(existingV1),
      });
      vi.spyOn(ReportingRule, 'create').mockResolvedValue(mockV2);

      const updatedRule = await createOrUpdateRuleWithGovernance(
        {
          ruleCode: 'RR-TEST-7D',
          jurisdiction: 'FDA',
          name: 'Test 5-Day Fast Alert',
          reportType: '5-Day Expedited',
          deadlineDays: 5,
          reason: 'Statutory deadline compression',
        },
        { _id: '672000000000000000000012', name: 'Regulatory Director' },
      );

      expect(existingV1.active).toBe(false);
      expect(updatedRule.version).toBe(2);
      expect(updatedRule.changeHistory[0].diff.length).toBeGreaterThan(0);
      expect(updatedRule.changeHistory[0].previousDefinition.deadlineDays).toBe(7);
    });

    it('supports approval workflow when requireApproval is true', async () => {
      const existingV1 = {
        _id: '672000000000000000000001',
        ruleCode: 'RR-EMA-15D',
        version: 1,
        jurisdiction: 'EMA',
        name: 'EMA 15-Day Alert',
        reportType: '15-Day Expedited',
        deadlineDays: 15,
        active: true,
        save: vi.fn().mockResolvedValue(true),
        changeHistory: [],
      };

      const pendingV2 = {
        _id: '672000000000000000000003',
        ruleCode: 'RR-EMA-15D',
        version: 2,
        active: false,
        approval: {
          status: 'PENDING_APPROVAL',
          requestedByName: 'Regulatory Specialist',
        },
      };

      vi.spyOn(ReportingRule, 'findOne').mockReturnValue({
        sort: vi.fn().mockResolvedValue(existingV1),
      });
      vi.spyOn(ReportingRule, 'create').mockResolvedValue(pendingV2);

      const rule = await createOrUpdateRuleWithGovernance(
        {
          ruleCode: 'RR-EMA-15D',
          jurisdiction: 'EMA',
          name: 'EMA 15-Day Revised',
          reportType: '15-Day Expedited',
          deadlineDays: 14,
          reason: 'Proposed harmonization',
          requireApproval: true,
        },
        { _id: '672000000000000000000013', name: 'Regulatory Specialist' },
      );

      expect(rule.active).toBe(false);
      expect(rule.approval.status).toBe('PENDING_APPROVAL');
    });

    it('approves and activates pending rule version while retiring old version', async () => {
      const mockPendingRule = {
        _id: '672000000000000000000003',
        ruleCode: 'RR-EMA-15D',
        version: 2,
        active: false,
        approval: {
          status: 'PENDING_APPROVAL',
        },
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(ReportingRule, 'findById').mockResolvedValue(mockPendingRule);
      vi.spyOn(ReportingRule, 'updateMany').mockResolvedValue({ modifiedCount: 1 });

      const approved = await approveRuleVersion(
        '672000000000000000000003',
        { reason: 'Approved by Committee' },
        { _id: '672000000000000000000014', name: 'VP Regulatory' },
      );

      expect(approved.active).toBe(true);
      expect(approved.approval.status).toBe('APPROVED');
      expect(approved.approval.approvedByName).toBe('VP Regulatory');
    });

    it('rejects invalid inputs when creating a rule', async () => {
      await expect(
        createOrUpdateRuleWithGovernance({ ruleCode: 'RR-TEST' }),
      ).rejects.toThrow(ValidationError);

      await expect(
        createOrUpdateRuleWithGovernance({
          ruleCode: 'RR-TEST',
          jurisdiction: 'FDA',
          name: 'Test',
          reportType: 'Type',
          deadlineDays: 0,
        }),
      ).rejects.toThrow('deadlineDays must be at least 1 day');
    });
  });

  describe('Compliance Metrics Aggregation', () => {
    it('accurately computes on-time rate, risk levels, and jurisdiction breakdowns', async () => {
      const now = new Date('2026-11-02T12:00:00Z');
      const pastDue = new Date('2026-10-25T12:00:00Z');
      const futureDue = new Date('2026-11-08T12:00:00Z');

      const mockReports = [
        // 1. FDA On-time
        {
          _id: 'r1',
          jurisdiction: 'FDA',
          ruleCode: 'RR-FDA-15D',
          ruleVersion: 1,
          status: 'SUBMITTED',
          dueDate: new Date('2026-10-30T12:00:00Z'),
          submittedAt: new Date('2026-10-28T12:00:00Z'),
        },
        // 2. FDA Late
        {
          _id: 'r2',
          jurisdiction: 'FDA',
          ruleCode: 'RR-FDA-15D',
          ruleVersion: 1,
          status: 'SUBMITTED',
          dueDate: new Date('2026-10-20T12:00:00Z'),
          submittedAt: new Date('2026-10-22T12:00:00Z'),
        },
        // 3. EMA Overdue
        {
          _id: 'r3',
          jurisdiction: 'EMA',
          ruleCode: 'RR-EMA-7D',
          ruleVersion: 1,
          status: 'OVERDUE',
          dueDate: pastDue,
        },
        // 4. CDSCO Pending (due in 6 days)
        {
          _id: 'r4',
          jurisdiction: 'CDSCO',
          ruleCode: 'RR-CDSCO-15D',
          ruleVersion: 1,
          status: 'DRAFT',
          dueDate: futureDue,
        },
      ];

      vi.spyOn(RegulatoryReport, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockReports),
      });

      vi.spyOn(ReportingRule, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { ruleCode: 'RR-FDA-15D', name: 'FDA 15D', jurisdiction: 'FDA', version: 1 },
          { ruleCode: 'RR-EMA-7D', name: 'EMA 7D', jurisdiction: 'EMA', version: 1 },
        ]),
      });

      const summary = await getComplianceSummary();

      // Total reports: 4
      expect(summary.overallMetrics.totalObligations).toBe(4);
      expect(summary.overallMetrics.onTimeCount).toBe(1);
      expect(summary.overallMetrics.lateCount).toBe(1);
      expect(summary.overallMetrics.overdueCount).toBe(1);
      expect(summary.overallMetrics.pendingCount).toBe(1);

      // Evaluated = onTime(1) + late(1) + overdue(1) = 3. On-time rate = 1/3 = 33.3%
      expect(summary.overallMetrics.onTimeRate).toBe(33.3);
      expect(summary.overallMetrics.riskLevel).toBe('CRITICAL');

      // Upcoming in 7 days
      expect(summary.upcomingDeadlines.within7Days).toBeGreaterThanOrEqual(1);

      // Verify jurisdiction breakdown
      const fdaStats = summary.jurisdictionBreakdown.find((j) => j.jurisdiction === 'FDA');
      expect(fdaStats).toBeDefined();
      expect(fdaStats.total).toBe(2);
      expect(fdaStats.onTimeCount).toBe(1);
      expect(fdaStats.lateCount).toBe(1);

      const emaStats = summary.jurisdictionBreakdown.find((j) => j.jurisdiction === 'EMA');
      expect(emaStats.overdueCount).toBe(1);
      expect(emaStats.riskLevel).toBe('CRITICAL');
    });

    it('calculates 100% HEALTHY when all submitted reports are on-time and no overdues exist', async () => {
      const mockReports = [
        {
          _id: 'r1',
          jurisdiction: 'FDA',
          ruleCode: 'RR-FDA-15D',
          ruleVersion: 1,
          status: 'SUBMITTED',
          dueDate: new Date('2026-11-20T12:00:00Z'),
          submittedAt: new Date('2026-11-15T12:00:00Z'),
        },
      ];

      vi.spyOn(RegulatoryReport, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockReports),
      });
      vi.spyOn(ReportingRule, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });

      const summary = await getComplianceSummary();
      expect(summary.overallMetrics.onTimeRate).toBe(100);
      expect(summary.overallMetrics.riskLevel).toBe('HEALTHY');
    });
  });

  describe('Overdue Drill-down', () => {
    it('computes days overdue accurately for delayed submissions', async () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      const mockOverdues = [
        {
          _id: 'rOverdue1',
          caseNumber: 'PV-2026-0099',
          jurisdiction: 'EMA',
          reportType: '7-Day Expedited',
          ruleCode: 'RR-EMA-7D',
          ruleVersion: 1,
          ruleName: 'EMA 7-Day Fatal/Life-Threatening ICSR',
          dueDate: fiveDaysAgo,
          status: 'OVERDUE',
          caseId: {
            _id: 'c1',
            caseNumber: 'PV-2026-0099',
            assignedTo: 'reviewer@pv.org',
          },
        },
      ];

      vi.spyOn(RegulatoryReport, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockOverdues),
          }),
        }),
      });

      const drilldown = await getOverdueReportsDrilldown();
      expect(drilldown.length).toBe(1);
      expect(drilldown[0].caseNumber).toBe('PV-2026-0099');
      expect(drilldown[0].daysOverdue).toBeGreaterThanOrEqual(5);
      expect(drilldown[0].ruleVersion).toBe(1);
    });
  });
});
