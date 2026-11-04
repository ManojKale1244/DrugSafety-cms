import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkflowHistoryTimeline from '../components/workflow/WorkflowHistoryTimeline';

describe('WorkflowHistoryTimeline Component', () => {
  it('renders empty state when no transitions exist', () => {
    render(<WorkflowHistoryTimeline history={[]} />);
    expect(screen.getByText('No Stage Transitions Recorded Yet')).toBeDefined();
  });

  it('renders transition entries with author and justification reasons', () => {
    const mockHistory = [
      {
        _id: 'wf1',
        from: 'DATA_ENTRY',
        to: 'MEDICAL_CODING',
        isBackward: false,
        reason: 'Demographics and initial products verified',
        by: { name: 'Alice Pharmacovigilance', email: 'alice@pharma.com' },
        at: new Date('2026-11-01T12:00:00Z').toISOString(),
      },
      {
        _id: 'wf2',
        from: 'MEDICAL_REVIEW',
        to: 'DATA_ENTRY',
        isBackward: true,
        reason: 'Concomitant medications verbatim missing formulation details',
        by: { name: 'Dr. Marcus Physician', email: 'marcus@pharma.com' },
        at: new Date('2026-11-02T10:00:00Z').toISOString(),
      },
    ];

    render(<WorkflowHistoryTimeline history={mockHistory} />);

    expect(screen.getByText('Workflow Routing & Stage Transition History')).toBeDefined();
    expect(screen.getByText('21 CFR Part 11 Audit Trail')).toBeDefined();
    expect(screen.getByText('Returned for Correction')).toBeDefined();
    expect(screen.getByText(/Alice Pharmacovigilance/)).toBeDefined();
    expect(screen.getByText(/Dr. Marcus Physician/)).toBeDefined();
    expect(
      screen.getByText('"Concomitant medications verbatim missing formulation details"')
    ).toBeDefined();
  });
});
