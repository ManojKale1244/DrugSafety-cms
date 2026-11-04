import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AggregateReports from '../pages/AggregateReports';
import api from '../services/api';

vi.mock('../services/api');

describe('Module 15: Aggregate Reports Frontend Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockDefinitions = [
    {
      _id: 'def-1',
      name: 'Periodic Safety Update Report (EU / ICH E2C R2)',
      reportType: 'PSUR',
      description: 'Quarterly PSUR for signal detection.',
      period: { periodType: 'QUARTERLY' },
      filters: { seriousness: 'ALL', products: [], countries: [] },
      schedule: { isScheduled: false, frequency: 'NONE' },
      grouping: ['product', 'preferredTerm'],
    },
    {
      _id: 'def-2',
      name: 'Development Safety Update Report (DSUR)',
      reportType: 'DSUR',
      description: 'Annual clinical trial safety report.',
      period: { periodType: 'ANNUAL' },
      filters: { seriousness: 'Serious', products: [], countries: [] },
      schedule: { isScheduled: true, frequency: 'ANNUAL' },
      grouping: ['product', 'seriousness'],
    },
  ];

  const mockPreview = {
    period: {
      startDate: '2026-08-01T00:00:00.000Z',
      endDate: '2026-11-01T00:00:00.000Z',
    },
    totalCases: 5,
    totalReactions: 7,
    summaryTabulation: [
      {
        product: 'CardioMax 50mg',
        preferredTerm: 'Myocardial infarction',
        systemOrganClass: 'Cardiac disorders',
        country: 'Germany',
        seriousCount: 3,
        nonSeriousCount: 0,
        fatalCount: 1,
        totalCount: 3,
      },
    ],
    lineListing: [
      {
        caseId: 'case-01',
        caseNumber: 'PV-2026-0001',
        receiptDate: '2026-09-15T00:00:00.000Z',
        country: 'Germany',
        patientAge: '54 years',
        patientSex: 'Female',
        productName: 'CardioMax 50mg',
        productRole: 'Suspect',
        preferredTerm: 'Myocardial infarction',
        verbatimReaction: 'Severe myocardial infarction',
        seriousness: 'Serious',
        seriousnessCriteria: ['Death', 'Hospitalization'],
        causality: 'Probable',
        outcome: 'fatal',
      },
    ],
  };

  const mockRuns = [
    {
      _id: 'run-01',
      definitionId: 'def-1',
      definitionName: 'Periodic Safety Update Report (EU / ICH E2C R2)',
      reportType: 'PSUR',
      version: 1,
      period: {
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-11-01T00:00:00.000Z',
      },
      totalCases: 5,
      totalReactions: 7,
      runAt: '2026-11-02T10:00:00.000Z',
      runByName: 'Safety Specialist',
      approval: { status: 'PENDING_APPROVAL' },
      fileReference: {
        csvFileName: 'PSUR_Report_v1.csv',
        pdfFileName: 'PSUR_Report_v1.pdf',
      },
      summaryTabulation: mockPreview.summaryTabulation,
      lineListing: mockPreview.lineListing,
      history: [
        {
          fromStatus: 'QUEUED',
          toStatus: 'GENERATED',
          byName: 'Safety Specialist',
          at: '2026-11-02T10:00:00.000Z',
          note: 'Initial generation v1',
        },
      ],
    },
  ];

  const setupMocks = () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/aggregate-reports/definitions')) {
        return Promise.resolve({ data: { success: true, data: mockDefinitions } });
      }
      if (url.includes('/aggregate-reports/runs')) {
        return Promise.resolve({ data: { success: true, runs: mockRuns } });
      }
      return Promise.resolve({ data: { success: true } });
    });

    api.post.mockImplementation((url) => {
      if (url.includes('/aggregate-reports/preview')) {
        return Promise.resolve({ data: { success: true, data: mockPreview } });
      }
      if (url.includes('/run')) {
        return Promise.resolve({ data: { success: true, data: { ...mockRuns[0], version: 2 } } });
      }
      if (url.includes('/approve')) {
        return Promise.resolve({ data: { success: true, data: { ...mockRuns[0], approval: { status: 'APPROVED' } } } });
      }
      return Promise.resolve({ data: { success: true } });
    });
  };

  it('renders report builder with statutory distinction notice banner and preview counts', async () => {
    setupMocks();

    render(
      <MemoryRouter>
        <AggregateReports />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Periodic Aggregate Safety Reports/i)).toBeDefined();
    expect(screen.getByText(/Statutory Principle: Aggregate Safety Reporting ≠ Individual Case Safety Reporting/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('5 Cases')).toBeDefined();
      expect(screen.getByText('7 Reactions')).toBeDefined();
      expect(screen.getByText('CardioMax 50mg')).toBeDefined();
      expect(screen.getByText('Myocardial infarction')).toBeDefined();
    });
  });

  it('switches between Summary Tabulation and Line Listing preview tabs', async () => {
    setupMocks();

    render(
      <MemoryRouter>
        <AggregateReports />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Summary Tabulation/i })).toBeDefined();
    });

    // Switch to Line Listing sub-tab
    fireEvent.click(screen.getByRole('button', { name: /Line Listing/i }));

    await waitFor(() => {
      expect(screen.getByText('PV-2026-0001')).toBeDefined();
      expect(screen.getByText('54 years / Female')).toBeDefined();
      expect(screen.getByText('Probable')).toBeDefined();
    });
  });

  it('executes a new versioned report run from the builder', async () => {
    setupMocks();

    render(
      <MemoryRouter>
        <AggregateReports />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Versioned Run/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Generate Versioned Run/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        expect.stringContaining('/run'),
        expect.any(Object),
      );
    });
  });

  it('displays generated runs in history tab and allows approving pending runs', async () => {
    setupMocks();

    render(
      <MemoryRouter>
        <AggregateReports />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generated Runs & Approval History/i })).toBeDefined();
    });

    // Switch to Runs tab
    fireEvent.click(screen.getByRole('button', { name: /Generated Runs & Approval History/i }));

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeDefined();
      expect(screen.getByText('PENDING APPROVAL')).toBeDefined();
      expect(screen.getByRole('button', { name: /Approve Run/i })).toBeDefined();
    });

    // Approve the pending run
    fireEvent.click(screen.getByRole('button', { name: /Approve Run/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/aggregate-reports/runs/run-01/approve',
        expect.any(Object),
      );
    });
  });
});
