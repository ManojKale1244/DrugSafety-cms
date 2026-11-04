import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import MedicalReviewWorkspace from '../components/case/MedicalReviewWorkspace';
import api from '../services/api';

vi.mock('../services/api');
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      _id: 'user-rev-01',
      name: 'Dr. John Doe',
      email: 'reviewer@drugsafety.local',
      role: { name: 'reviewer', displayName: 'Safety Reviewer', permissions: ['medical.review'] },
    },
    hasPermission: (perm) => perm === 'medical.review',
  }),
}));

describe('<MedicalReviewWorkspace />', () => {
  afterEach(() => {
    cleanup();
  });
  const mockAssessmentData = {
    success: true,
    case: {
      _id: 'case-99',
      caseNumber: 'DS-2026-97001',
      eventSummary: 'Severe hypotension and collapse',
      narrative: 'Patient developed lightheadedness and collapsed 1 hour after dose.',
      reporter: { name: 'Dr. Jane Smith', qualification: 'Physician', country: 'India' },
      patient: { reference: 'PT-REV-01', age: 58, sex: 'Male' },
      caseProducts: [{ productName: 'CardioVas Synth 20mg', role: 'Suspect', indication: 'Hypertension' }],
      reactions: [{ verbatim: 'Severe hypotension and collapse', pt: 'Hypotension', soc: 'Vascular disorders' }],
    },
    currentAssessment: {
      _id: 'assess-01',
      caseId: 'case-99',
      status: 'DRAFT',
      version: 1,
      seriousnessCriteria: ['hospitalization'],
      expectedness: 'unlisted',
      causality: [
        {
          productName: 'CardioVas Synth 20mg',
          reactionVerbatim: 'Severe hypotension and collapse',
          reactionPt: 'Hypotension',
          causality: 'Probable',
          notes: 'Consistent with vasodilatory mechanism',
        },
      ],
      medicalComment: 'Clinical review indicates plausible pharmacodynamic reaction.',
      requestsForInfo: [],
    },
    versions: [],
    totalVersions: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders persistent notice regarding reporter statements vs assessment', async () => {
    api.get.mockResolvedValueOnce({ data: mockAssessmentData });

    render(<MedicalReviewWorkspace caseId="case-99" />);

    await waitFor(() => {
      expect(
        screen.getByText(/Reporter statements ≠ assessment. Causality is a clinical judgment./i),
      ).toBeDefined();
    });
  });

  it('renders read-only evidence on the left and clinical assessment form on the right', async () => {
    api.get.mockResolvedValueOnce({ data: mockAssessmentData });

    render(<MedicalReviewWorkspace caseId="case-99" />);

    await waitFor(() => {
      // Left Pane Evidence
      expect(screen.getByText('Reporter Statements')).toBeDefined();
      expect(screen.getByText('Entered Clinical Facts')).toBeDefined();
      expect(screen.getByText('"Severe hypotension and collapse"')).toBeDefined();

      // Right Pane Assessment Form
      expect(screen.getByText('Medical Review & Causality Assessment')).toBeDefined();
      expect(screen.getByText('Seriousness Criteria (ICH E2A Standard)')).toBeDefined();
      expect(screen.getByText('Inpatient Hospitalization / Prolongation')).toBeDefined();
    });
  });

  it('renders the causality matrix with product × reaction pair and pill selectors', async () => {
    api.get.mockResolvedValueOnce({ data: mockAssessmentData });

    render(<MedicalReviewWorkspace caseId="case-99" />);

    await waitFor(() => {
      expect(screen.getByText('Causality Matrix (Products × Reactions)')).toBeDefined();
      expect(screen.getAllByText('CardioVas Synth 20mg').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Hypotension').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Certain').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Probable').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Possible').length).toBeGreaterThanOrEqual(1);
    });
  });
});
