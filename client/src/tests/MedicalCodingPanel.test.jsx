import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import MedicalCodingPanel from '../components/case/MedicalCodingPanel';
import api from '../services/api';

vi.mock('../services/api');

describe('<MedicalCodingPanel />', () => {
  afterEach(() => {
    cleanup();
  });
  const mockCodingData = {
    success: true,
    caseId: 'case-123',
    caseNumber: 'DS-2026-00001',
    caseStatus: 'data_entry',
    reactionsCount: 1,
    codedCount: 0,
    uncodedCount: 1,
    isAllCoded: false,
    items: [
      {
        reactionId: 'reaction-001',
        verbatimText: 'Patient experienced severe nausea and tremors',
        startDate: '2026-10-15',
        outcome: 'recovering',
        causality: 'Possible',
        pt: '',
        soc: '',
        meddraCode: '',
        isCoded: false,
        codingRecord: null,
        autoSuggestions: [
          {
            code: 'PT-4001',
            name: 'Nausea',
            level: 'PT',
            confidence: 'High',
            breadcrumb: 'SOC: Gastrointestinal disorders > HLT: Nausea and vomiting symptoms > PT: Nausea',
          },
          {
            code: 'PT-4018',
            name: 'Tremor',
            level: 'PT',
            confidence: 'Medium',
            breadcrumb: 'SOC: Nervous system disorders > HLT: Movement and involuntary tremors > PT: Tremor',
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: mockCodingData });
  });

  it('renders uncoded reaction counter badge and preserved verbatim text', async () => {
    api.get.mockResolvedValueOnce({ data: mockCodingData });

    render(<MedicalCodingPanel caseId="case-123" />);

    // Verify loading screen then content
    await waitFor(() => {
      expect(screen.getByText('MedDRA Medical Coding Panel')).toBeDefined();
    });

    // Check uncoded reaction counter badge
    expect(screen.getByText('1 Uncoded Reaction')).toBeDefined();

    // Check preserved verbatim text
    expect(
      screen.getByText('"Patient experienced severe nausea and tremors"'),
    ).toBeDefined();

    // Check auto-suggested matches
    expect(screen.getByText('Auto-Suggested Top Matches')).toBeDefined();
    expect(screen.getByText('Nausea')).toBeDefined();
    expect(screen.getByText('Tremor')).toBeDefined();
    expect(screen.getByText('High Match')).toBeDefined();
  });

  it('renders hierarchy breadcrumbs and search directory', async () => {
    api.get.mockResolvedValueOnce({ data: mockCodingData });

    render(<MedicalCodingPanel caseId="case-123" />);

    await waitFor(() => {
      expect(screen.getByText('Medical Terminology Directory (MedDRA / WHO-Drug)')).toBeDefined();
    });

    expect(
      screen.getByPlaceholderText(/Search by code, term, or condition/),
    ).toBeDefined();

    expect(screen.getByText('All Levels')).toBeDefined();
  });

  it('renders all reactions coded badge when uncodedCount is 0', async () => {
    const fullyCodedData = {
      ...mockCodingData,
      codedCount: 1,
      uncodedCount: 0,
      isAllCoded: true,
      items: [
        {
          ...mockCodingData.items[0],
          isCoded: true,
          pt: 'Nausea',
          soc: 'Gastrointestinal disorders',
          meddraCode: 'PT-4001',
        },
      ],
    };

    api.get.mockResolvedValue({ data: fullyCodedData });

    render(<MedicalCodingPanel caseId="case-123" />);

    await waitFor(() => {
      expect(screen.getByText('All Reactions Coded')).toBeDefined();
    });
  });
});

