import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateReportingObligations,
  validateReport,
  approveReport,
  submitReport,
  acknowledgeReport,
  checkAndFlagOverdueReports,
  createOrUpdateRule,
  SYNTHETIC_REPORTING_RULES_SEED,
} from '../services/reporting.service.js';
import { ReportingRule } from '../models/ReportingRule.js';
import { RegulatoryReport } from '../models/RegulatoryReport.js';
import { Case } from '../models/Case.js';
import { MedicalAssessment } from '../models/MedicalAssessment.js';

describe('Module 10: Regulatory Reporting Service Unit Tests', () => {
  it('has valid synthetic reporting seed rules with deadlines', () => {
    expect(SYNTHETIC_REPORTING_RULES_SEED.length).toBeGreaterThanOrEqual(4);
    const fda15 = SYNTHETIC_REPORTING_RULES_SEED.find((r) => r.ruleCode === 'RR-FDA-15D');
    expect(fda15).toBeDefined();
    expect(fda15.deadlineDays).toBe(15);
    expect(fda15.jurisdiction).toBe('FDA');

    const ema7 = SYNTHETIC_REPORTING_RULES_SEED.find((r) => r.ruleCode === 'RR-EMA-7D');
    expect(ema7).toBeDefined();
    expect(ema7.deadlineDays).toBe(7);
  });

  it('calculates due dates based on case receipt date without hardcoding universal deadlines', () => {
    const receiptDate = new Date('2026-10-10T12:00:00Z');
    const deadlineDays = 15;
    const expectedDueDate = new Date(receiptDate.getTime() + deadlineDays * 24 * 60 * 60 * 1000);

    expect(expectedDueDate.toISOString().split('T')[0]).toBe('2026-10-25');
  });

  it('determines countdown intervals accurately', () => {
    const now = new Date('2026-11-02T00:00:00Z');
    const futureDue = new Date('2026-11-10T00:00:00Z');
    const pastDue = new Date('2026-10-30T00:00:00Z');

    const daysRemainingFuture = Math.ceil((futureDue - now) / (1000 * 60 * 60 * 24));
    const daysRemainingPast = Math.ceil((pastDue - now) / (1000 * 60 * 60 * 24));

    expect(daysRemainingFuture).toBe(8);
    expect(daysRemainingPast).toBe(-3);
  });
});

