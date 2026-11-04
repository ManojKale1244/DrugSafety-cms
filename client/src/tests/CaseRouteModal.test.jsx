import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import CaseRouteModal from '../components/workflow/CaseRouteModal';
import api from '../services/api';

vi.mock('../services/api');

describe('CaseRouteModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders modal with transition options and pre-checks', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        caseNumber: 'PV-2026-9001',
        currentStage: 'DATA_ENTRY',
        allowedTransitions: [
          {
            to: 'MEDICAL_CODING',
            label: 'Advance to Medical Coding',
            allowedRoles: ['admin', 'processor'],
            requiresReason: false,
            isBackward: false,
            canRoute: true,
            checks: [
              { key: 'MINIMUM_CRITERIA', passed: true, description: 'ICH E2D 4-minimum criteria met' },
              { key: 'HAS_PRODUCT', passed: true, description: 'Suspect product recorded' },
            ],
            unmetChecks: [],
          },
          {
            to: 'NEW',
            label: 'Return to New for Re-triage',
            allowedRoles: ['admin'],
            requiresReason: true,
            isBackward: true,
            canRoute: true,
            checks: [],
            unmetChecks: [],
          },
        ],
      },
    });

    render(
      <CaseRouteModal
        isOpen={true}
        onClose={vi.fn()}
        caseId="case123"
        caseNumber="PV-2026-9001"
      />
    );

    expect(screen.getByText('Evaluating regulatory transition checks…')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Route Case to Next Stage')).toBeDefined();
    });

    expect(screen.getByText('Advance to Medical Coding')).toBeDefined();
    expect(screen.getByText('ICH E2D 4-minimum criteria met')).toBeDefined();
  });

  it('enforces mandatory reason for backward transitions', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        caseNumber: 'PV-2026-9001',
        currentStage: 'QUALITY_REVIEW',
        allowedTransitions: [
          {
            to: 'MEDICAL_REVIEW',
            label: 'Return to Medical Review for Query',
            allowedRoles: ['admin', 'qa_specialist'],
            requiresReason: true,
            isBackward: true,
            canRoute: true,
            checks: [],
            unmetChecks: [],
          },
        ],
      },
    });

    render(
      <CaseRouteModal
        isOpen={true}
        onClose={vi.fn()}
        caseId="case123"
        caseNumber="PV-2026-9001"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Return to Medical Review for Query')).toBeDefined();
    });

    const routeBtn = screen.getByRole('button', { name: /confirm return for correction/i });
    expect(routeBtn.disabled).toBe(true);

    const reasonInput = screen.getByPlaceholderText(/state specific correction requested/i);
    fireEvent.change(reasonInput, { target: { value: 'Seriousness criteria require clarification' } });

    expect(routeBtn.disabled).toBe(false);
  });
});
