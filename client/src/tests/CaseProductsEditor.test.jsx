import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import CaseProductsEditor from '../components/case/CaseProductsEditor';
import api from '../services/api';

vi.mock('../services/api');

describe('Module 13: CaseProductsEditor Component & Exposure Latency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockCaseProducts = [
    {
      _id: 'cp-01',
      productName: 'CardioMax 50mg',
      genericName: 'Metoprolol Succinate',
      role: 'Suspect',
      dose: '50mg',
      frequency: 'Once Daily',
      route: 'Oral',
      indication: 'Hypertension',
      actionTaken: 'DRUG_WITHDRAWN',
      startDate: '2026-03-01T00:00:00.000Z',
      stopDate: '2026-03-20T00:00:00.000Z',
      lotNumber: 'BATCH-2026-X1',
    },
  ];

  it('renders products and displays calculated time-to-onset latency timeline', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        products: mockCaseProducts,
        rxnOnset: '2026-03-05T00:00:00.000Z', // 4 days after start
        caseNumber: 'PV-2026-0099',
      },
    });

    render(
      <CaseProductsEditor
        caseId="case-99"
        caseNumber="PV-2026-0099"
        isClosed={false}
        onCaseUpdated={vi.fn()}
      />
    );

    // Header & anchor notice
    expect(screen.getByText(/Medicinal Products & Exposure Timeline/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('CardioMax 50mg')).toBeDefined();
      expect(screen.getByText(/Metoprolol Succinate/i)).toBeDefined();
      expect(screen.getByText('Suspect')).toBeDefined();
      expect(screen.getByText(/DRUG WITHDRAWN/i)).toBeDefined();
      // Verify visual latency tag
      expect(screen.getByText(/Onset occurred \+4d after start \(Within exposure window\)/i)).toBeDefined();
    });
  });

  it('validates stop date constraint: rejects if stop date is earlier than start date', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        products: mockCaseProducts,
        rxnOnset: '2026-03-05T00:00:00.000Z',
      },
    });

    const { container } = render(
      <CaseProductsEditor
        caseId="case-99"
        caseNumber="PV-2026-0099"
        isClosed={false}
        onCaseUpdated={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Add Product/i)).toBeDefined();
    });

    // Open Add Product modal
    fireEvent.click(screen.getByText(/Add Product/i));

    await waitFor(() => {
      expect(screen.getByText(/Add Product to Safety Case/i)).toBeDefined();
    });

    // Fill form with invalid date: start 2026-03-15, stop 2026-03-10
    const nameInput = screen.getByPlaceholderText(/e\.g\. CardioMax 50mg/i);
    fireEvent.change(nameInput, { target: { value: 'Aspirin 100mg' } });

    const startDateInput = container.querySelector('#exposureStartDate');
    const stopDateInput = container.querySelector('#exposureStopDate');

    fireEvent.change(startDateInput, { target: { value: '2026-03-15' } });
    fireEvent.change(stopDateInput, { target: { value: '2026-03-10' } });

    // Submit form (modal submit button)
    const submitBtns = screen.getAllByRole('button', { name: /Add Product/i });
    fireEvent.click(submitBtns[submitBtns.length - 1]);

    await waitFor(() => {
      expect(screen.getByText(/Stop date cannot be earlier than start date\./i)).toBeDefined();
    });

    // Ensure API was NOT called with invalid dates
    expect(api.post).not.toHaveBeenCalled();
  });
});
