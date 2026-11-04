import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import QualityReviewWorkspace from '../components/quality/QualityReviewWorkspace';
import api from '../services/api';

vi.mock('../services/api');

describe('QualityReviewWorkspace Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockQualityData = {
    success: true,
    caseId: 'case-qa-123',
    caseNumber: 'PV-2026-QA01',
    status: 'QUALITY_REVIEW',
    isReadyForApproval: true,
    template: {
      name: 'Standard ICSR Quality Review Checklist',
      version: 1,
      items: [
        {
          itemId: 'CH-DEMO-01',
          category: 'Demographics & Administrative',
          title: 'Patient Identification & Demographics Completeness',
          description: 'Verify identifiable patient criteria',
          severity: 'CRITICAL',
          targetField: 'patient',
          isRequired: true,
        },
        {
          itemId: 'CH-CODE-01',
          category: 'Medical Coding',
          title: 'MedDRA Preferred Term Precision',
          description: 'Ensure 100% reactions coded',
          severity: 'CRITICAL',
          targetField: 'coding',
          isRequired: true,
        },
      ],
    },
    autoChecks: {
      passed: true,
      allPassed: true,
      criticalFailedCount: 0,
      majorFailedCount: 0,
      checks: [
        {
          key: 'REQ_FIELDS',
          title: 'ICH E2D Core Minimum Fields & Narrative',
          severity: 'CRITICAL',
          passed: true,
          message: 'All mandatory ICH E2D safety fields present.',
          targetField: 'patient',
        },
        {
          key: 'CODING_COMPLETE',
          title: 'MedDRA Medical Coding 100% Complete',
          severity: 'CRITICAL',
          passed: true,
          message: 'All reactions mapped to MedDRA PT.',
          targetField: 'coding',
        },
      ],
    },
    previousReviews: [],
  };

  it('renders progress ring, auto-check results, and checklist items', async () => {
    api.get.mockResolvedValueOnce({ data: mockQualityData });

    render(
      <QualityReviewWorkspace
        caseId="case-qa-123"
        caseNumber="PV-2026-QA01"
        caseDoc={{ status: 'QUALITY_REVIEW' }}
      />
    );

    expect(screen.getByText('Running automated regulatory quality checks…')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Quality Review & Compliance Audit Workspace')).toBeDefined();
    });

    expect(screen.getByText('Automated Regulatory Quality Validators')).toBeDefined();
    expect(screen.getByText('ICH E2D Core Minimum Fields & Narrative')).toBeDefined();
    expect(screen.getByText('Patient Identification & Demographics Completeness')).toBeDefined();

    // Check action buttons exist
    expect(screen.getByRole('button', { name: /approve quality review/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /return for correction/i })).toBeDefined();
  });

  it('blocks approval when critical auto-checks fail', async () => {
    const failingData = {
      ...mockQualityData,
      isReadyForApproval: false,
      autoChecks: {
        passed: false,
        allPassed: false,
        criticalFailedCount: 1,
        checks: [
          {
            key: 'CODING_COMPLETE',
            title: 'MedDRA Medical Coding 100% Complete',
            severity: 'CRITICAL',
            passed: false,
            message: '1 adverse reaction remains uncoded.',
            targetField: 'coding',
          },
        ],
      },
    };

    api.get.mockResolvedValueOnce({ data: failingData });

    render(
      <QualityReviewWorkspace
        caseId="case-qa-123"
        caseNumber="PV-2026-QA01"
        caseDoc={{ status: 'QUALITY_REVIEW' }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Quality Review & Compliance Audit Workspace')).toBeDefined();
    });

    // Approval button should be disabled
    const approveBtn = screen.getByRole('button', { name: /approve quality review/i });
    expect(approveBtn.disabled).toBe(true);
    expect(screen.getAllByText(/Critical Check\(s\) Failed|Critical Violations Detected/).length).toBeGreaterThanOrEqual(1);
  });
});

