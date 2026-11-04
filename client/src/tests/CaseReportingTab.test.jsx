import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import CaseReportingTab from '../components/reporting/CaseReportingTab';
import api from '../services/api';

vi.mock('../services/api');

describe('CaseReportingTab Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockReports = [
    {
      _id: 'rep-01',
      caseId: 'case-123',
      caseNumber: 'PV-2026-REG01',
      ruleId: 'rule-fda-15',
      ruleCode: 'RR-FDA-15D',
      ruleVersion: 1,
      ruleName: 'FDA 15-Day Expedited Alert Report',
      jurisdiction: 'FDA',
      reportType: '15-Day Expedited ICSR',
      deadlineDays: 15,
      receiptDate: new Date('2026-10-20T00:00:00Z').toISOString(),
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days in future
      status: 'DRAFT',
      isValid: false,
      validationErrors: [],
      payloadSummary: {
        ichMessageHeader: { messageType: 'ichicsr', messageReceiverId: 'FDA' },
        safetyReport: { safetyReportId: 'PV-2026-REG01', seriousness: 'Serious' },
      },
      history: [],
    },
    {
      _id: 'rep-02',
      caseId: 'case-123',
      caseNumber: 'PV-2026-REG01',
      ruleId: 'rule-ema-15',
      ruleCode: 'RR-EMA-15D',
      ruleVersion: 1,
      ruleName: 'EMA 15-Day Serious Non-Fatal ICSR',
      jurisdiction: 'EMA',
      reportType: '15-Day Serious ICSR',
      deadlineDays: 15,
      receiptDate: new Date('2026-10-20T00:00:00Z').toISOString(),
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days in past
      status: 'OVERDUE',
      isValid: false,
      validationErrors: [],
      payloadSummary: {},
      history: [],
    },
  ];

  it('renders synthetic notice, obligations list, and countdown chips', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        count: mockReports.length,
        reports: mockReports,
      },
    });

    render(<CaseReportingTab caseId="case-123" caseNumber="PV-2026-REG01" />);

    expect(screen.getByText('Loading statutory regulatory obligations…')).toBeDefined();

    await waitFor(() => {
      expect(
        screen.getByText(/Synthetic Regulatory Reporting Engine \(Educational & Demonstration Mode\)/)
      ).toBeDefined();
    });

    // Obligations titles
    expect(screen.getByText('FDA 15-Day Expedited Alert Report')).toBeDefined();
    expect(screen.getByText('EMA 15-Day Serious Non-Fatal ICSR')).toBeDefined();

    // Check countdown chip (future vs overdue)
    expect(screen.getByText(/Due in 10d|Due in 11d/)).toBeDefined();
    expect(screen.getAllByText(/OVERDUE/).length).toBeGreaterThanOrEqual(1);

    // Stepper labels
    expect(screen.getByText('VALIDATED')).toBeDefined();
    expect(screen.getByText('APPROVED')).toBeDefined();
    expect(screen.getByText('SUBMITTED')).toBeDefined();
    expect(screen.getByText('ACKNOWLEDGED')).toBeDefined();
  });
});
