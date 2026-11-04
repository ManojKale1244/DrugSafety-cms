import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ComplianceDashboard from '../pages/ComplianceDashboard';
import api from '../services/api';

vi.mock('../services/api');

describe('Module 14: Compliance Tracking & Governance Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockSummary = {
    overallMetrics: {
      totalObligations: 12,
      onTimeCount: 11,
      lateCount: 0,
      overdueCount: 1,
      pendingCount: 2,
      onTimeRate: 91.7,
      riskLevel: 'WARNING',
    },
    jurisdictionBreakdown: [
      {
        jurisdiction: 'FDA',
        total: 5,
        onTimeCount: 5,
        lateCount: 0,
        overdueCount: 0,
        pendingCount: 0,
        onTimeRate: 100,
        riskLevel: 'HEALTHY',
      },
      {
        jurisdiction: 'EMA',
        total: 4,
        onTimeCount: 3,
        lateCount: 0,
        overdueCount: 1,
        pendingCount: 0,
        onTimeRate: 75,
        riskLevel: 'CRITICAL',
      },
    ],
    upcomingDeadlines: {
      within7Days: 2,
      within15Days: 4,
    },
    recentDecisions: [
      {
        id: 'dec-1',
        caseId: 'case-101',
        caseNumber: 'PV-2026-0001',
        ruleCode: 'RR-FDA-15D',
        ruleVersion: 1,
        jurisdiction: 'FDA',
        submittedAt: '2026-10-25T10:00:00Z',
        dueDate: '2026-10-30T10:00:00Z',
        wasOnTime: true,
      },
    ],
  };

  const mockOverdue = [
    {
      _id: 'rep-overdue-1',
      caseId: 'case-102',
      caseNumber: 'PV-2026-0088',
      jurisdiction: 'EMA',
      reportType: '7-Day Fatal/Life-Threatening ICSR',
      ruleCode: 'RR-EMA-7D',
      ruleVersion: 1,
      ruleName: 'EMA 7-Day Fatal ICSR',
      dueDate: '2026-10-20T00:00:00Z',
      daysOverdue: 13,
      status: 'OVERDUE',
    },
  ];

  const mockRules = [
    {
      _id: 'rule-fda',
      ruleCode: 'RR-FDA-15D',
      jurisdiction: 'FDA',
      name: 'FDA 15-Day Expedited Alert Report',
      reportType: '15-Day Expedited ICSR',
      deadlineDays: 15,
      version: 1,
      approval: { status: 'APPROVED' },
    },
    {
      _id: 'rule-ema',
      ruleCode: 'RR-EMA-7D',
      jurisdiction: 'EMA',
      name: 'EMA 7-Day Expedited Alert',
      reportType: '7-Day Expedited ICSR',
      deadlineDays: 7,
      version: 2,
      approval: { status: 'PENDING_APPROVAL' },
    },
  ];

  const mockRuleHistory = {
    ruleCode: 'RR-FDA-15D',
    currentVersion: 2,
    versions: [
      {
        _id: 'v2',
        ruleCode: 'RR-FDA-15D',
        version: 2,
        name: 'FDA 15-Day Expedited Alert Report (Revised)',
        deadlineDays: 15,
        active: true,
        effectiveFrom: '2026-10-01T00:00:00Z',
        approval: { status: 'APPROVED' },
      },
      {
        _id: 'v1',
        ruleCode: 'RR-FDA-15D',
        version: 1,
        name: 'FDA 15-Day Expedited Alert Report',
        deadlineDays: 15,
        active: false,
        effectiveFrom: '2026-01-01T00:00:00Z',
        effectiveTo: '2026-10-01T00:00:00Z',
        approval: { status: 'APPROVED' },
      },
    ],
    changeHistory: [
      {
        version: 2,
        changedByName: 'Regulatory Director',
        changedAt: '2026-10-01T10:00:00Z',
        reason: 'Periodic statutory harmonization with FDA guidance',
        diff: [
          {
            field: 'name',
            label: 'Rule Title',
            oldValue: 'FDA 15-Day Expedited Alert Report',
            newValue: 'FDA 15-Day Expedited Alert Report (Revised)',
          },
        ],
      },
    ],
  };

  const setupMocks = () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/compliance/summary')) {
        return Promise.resolve({ data: { success: true, data: mockSummary } });
      }
      if (url.includes('/compliance/overdue')) {
        return Promise.resolve({ data: { success: true, data: mockOverdue } });
      }
      if (url.includes('/reports/rules')) {
        return Promise.resolve({ data: { success: true, rules: mockRules } });
      }
      if (url.includes('/compliance/rules/') && url.includes('/history')) {
        return Promise.resolve({ data: { success: true, data: mockRuleHistory } });
      }
      return Promise.resolve({ data: { success: true } });
    });
  };

  it('renders compliance rate gauge ring, KPI metrics, and traceability notice banner', async () => {
    setupMocks();

    render(
      <MemoryRouter>
        <ComplianceDashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Compliance Tracking & Governance/i)).toBeDefined();
    expect(screen.getByText(/Immutable Regulatory Version Lineage Policy/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('91.7%')).toBeDefined();
      expect(screen.getByText('WARNING (85-94%)')).toBeDefined();
      expect(screen.getByText('12')).toBeDefined(); // Total obligations
      expect(screen.getByText('11')).toBeDefined(); // On-time count
    });
  });

  it('renders jurisdiction heat table with status bars and risk badges', async () => {
    setupMocks();

    render(
      <MemoryRouter>
        <ComplianceDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Health Authority Jurisdiction Heat Table')).toBeDefined();
      expect(screen.getByText('FDA')).toBeDefined();
      expect(screen.getByText('EMA')).toBeDefined();
      expect(screen.getByText('HEALTHY')).toBeDefined();
      expect(screen.getByText('CRITICAL')).toBeDefined();
    });
  });

  it('drills down into overdue obligations and displays delay countdowns with rule versions', async () => {
    setupMocks();

    render(
      <MemoryRouter>
        <ComplianceDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Overdue Drill-Down/i)).toBeDefined();
    });

    // Click Overdue Drill-Down tab
    fireEvent.click(screen.getByRole('button', { name: /Overdue Drill-Down/i }));

    await waitFor(() => {
      expect(screen.getByText('PV-2026-0088')).toBeDefined();
      expect(screen.getByText('+13 days overdue')).toBeDefined();
      expect(screen.getByText('RR-EMA-7D')).toBeDefined();
      expect(screen.getByText('v1')).toBeDefined(); // Rule version referenced
    });
  });

  it('inspects rule governance, version diffs, and "who changed what" timeline in drawer', async () => {
    setupMocks();

    render(
      <MemoryRouter>
        <ComplianceDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Rule Governance & Diffs/i)).toBeDefined();
    });

    // Switch to Governance tab
    fireEvent.click(screen.getByRole('button', { name: /Rule Governance & Diffs/i }));

    await waitFor(() => {
      expect(screen.getByText('RR-FDA-15D')).toBeDefined();
      expect(screen.getByText('RR-EMA-7D')).toBeDefined();
      expect(screen.getByText('PENDING APPROVAL')).toBeDefined();
    });

    // Open View Diffs for RR-FDA-15D
    const diffButtons = screen.getAllByRole('button', { name: /View Diffs/i });
    fireEvent.click(diffButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Rule Lineage: RR-FDA-15D/i)).toBeDefined();
      expect(screen.getByText('Regulatory Director')).toBeDefined();
      expect(screen.getByText(/Periodic statutory harmonization with FDA guidance/i)).toBeDefined();
      expect(screen.getByText(/Rule Title/i)).toBeDefined();
    });
  });

  it('opens propose rule version modal and submits new version', async () => {
    setupMocks();
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: { ruleCode: 'RR-FDA-15D', version: 2 },
      },
    });

    render(
      <MemoryRouter>
        <ComplianceDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Propose Rule Version/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Propose Rule Version/i }));

    expect(screen.getByText('Propose Rule Revision')).toBeDefined();
    expect(screen.getByLabelText(/Statutory Reason for Revision/i)).toBeDefined();

    fireEvent.change(screen.getByLabelText(/Statutory Reason for Revision/i), {
      target: { value: 'FDA expedited guidance update' },
    });
    fireEvent.change(screen.getByLabelText(/Rule Name/i), {
      target: { value: 'FDA 15-Day Expedited Updated' },
    });
    fireEvent.change(screen.getByLabelText(/Report Type/i), {
      target: { value: '15-Day Expedited ICSR' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Submit Version/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/compliance/rules',
        expect.objectContaining({
          ruleCode: 'RR-FDA-15D',
          reason: 'FDA expedited guidance update',
        }),
      );
    });
  });
});

