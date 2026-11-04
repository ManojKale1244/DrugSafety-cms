import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import QualityMetricsCard from '../components/quality/QualityMetricsCard';
import api from '../services/api';

vi.mock('../services/api');

describe('QualityMetricsCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockMetricsData = {
    success: true,
    totalReviews: 25,
    approvedCount: 22,
    returnedCount: 3,
    firstPassTotal: 20,
    firstPassApproved: 18,
    globalFirstPassYield: 90,
    processorMetrics: [
      {
        processorId: 'user-01',
        name: 'John DataEntry',
        role: 'Data Entry Specialist',
        totalFirstPassCases: 10,
        approvedFirstPass: 9,
        returnedFirstPass: 1,
        fpyPercentage: 90,
      },
      {
        processorId: 'user-02',
        name: 'Sarah Reviewer',
        role: 'Safety Reviewer',
        totalFirstPassCases: 10,
        approvedFirstPass: 9,
        returnedFirstPass: 1,
        fpyPercentage: 90,
      },
    ],
  };

  it('renders First-Pass Yield statistics and processor breakdown', async () => {
    api.get.mockResolvedValueOnce({ data: mockMetricsData });

    render(<QualityMetricsCard />);

    expect(screen.getByText('Calculating First-Pass Yield & quality metrics…')).toBeDefined();

    await waitFor(() => {
      expect(
        screen.getByText('Quality Assurance Metrics: First-Pass Yield (FPY)')
      ).toBeDefined();
    });

    expect(screen.getAllByText('90%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('John DataEntry')).toBeDefined();
    expect(screen.getByText('Sarah Reviewer')).toBeDefined();
    expect(screen.getByText('zero defects on submission')).toBeDefined();
  });
});

