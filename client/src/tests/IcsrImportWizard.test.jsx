import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import IcsrImportWizard from '../components/icsr/IcsrImportWizard';
import api from '../services/api';

vi.mock('../services/api');

describe('Module 11: IcsrImportWizard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockPreviewResponse = {
    data: {
      success: true,
      format: 'XML',
      validation: {
        valid: true,
        errors: [],
      },
      mappedData: {
        source: 'regulator',
        reporter: {
          name: 'Dr. Rajesh Sharma',
          qualification: 'Physician',
          country: 'India',
        },
        patient: {
          reference: 'RS-901',
          age: 58,
          ageUnit: 'years',
          sex: 'Male',
        },
        suspectedProduct: 'Atorvastatin 40mg',
        reportedReaction: 'Rhabdomyolysis',
        narrative: 'Severe muscle weakness and myopathy.',
      },
      duplicateScreening: {
        hasDuplicateWarning: false,
        highestScore: 25,
        matches: [],
      },
    },
  };

  const mockImportResponse = {
    data: {
      success: true,
      intake: {
        intakeNumber: 'INT-20260310-0012',
        status: 'RECEIVED',
      },
      message: {
        messageId: 'MSG-IN-ABCD1234',
      },
      duplicateScreening: {
        hasDuplicateWarning: false,
        highestScore: 25,
      },
    },
  };

  it('renders Step 1 with regulatory compliance banner and sample loader', () => {
    render(
      <IcsrImportWizard
        isOpen={true}
        onClose={vi.fn()}
        onImportSuccess={vi.fn()}
      />
    );

    // Verify persistent regulatory disclaimer banner
    expect(screen.getByText(/Successful export ≠ regulatory compliance/i)).toBeDefined();

    // Verify Sample loader button
    const sampleBtn = screen.getByText(/Load Synthetic Sample ICSR/i);
    expect(sampleBtn).toBeDefined();

    fireEvent.click(sampleBtn);

    const textarea = screen.getByPlaceholderText(/Paste <\?xml version='1.0'/i);
    expect(textarea.value).toContain('<ichicsr>');
  });

  it('validates payload and advances to preview step displaying mapped entities', async () => {
    api.post.mockResolvedValueOnce(mockPreviewResponse);

    render(
      <IcsrImportWizard
        isOpen={true}
        onClose={vi.fn()}
        onImportSuccess={vi.fn()}
      />
    );

    // Load sample
    fireEvent.click(screen.getByText(/Load Synthetic Sample ICSR/i));

    // Click validate
    fireEvent.click(screen.getByText(/Validate & Preview/i));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/icsr/preview', expect.objectContaining({
        format: 'AUTO',
      }));
    });

    // Check step 2 mapped preview
    await waitFor(() => {
      expect(screen.getByText(/Schema Validation Passed/i)).toBeDefined();
      expect(screen.getByText(/Dr\. Rajesh Sharma/i)).toBeDefined();
      expect(screen.getByText(/Atorvastatin 40mg/i)).toBeDefined();
      expect(screen.getByText(/Rhabdomyolysis/i)).toBeDefined();
    });
  });

  it('confirms import and creates intake ticket on Step 3', async () => {
    api.post
      .mockResolvedValueOnce(mockPreviewResponse)
      .mockResolvedValueOnce(mockImportResponse);

    const handleSuccess = vi.fn();

    render(
      <IcsrImportWizard
        isOpen={true}
        onClose={vi.fn()}
        onImportSuccess={handleSuccess}
      />
    );

    fireEvent.click(screen.getByText(/Load Synthetic Sample ICSR/i));
    fireEvent.click(screen.getByText(/Validate & Preview/i));

    await waitFor(() => {
      expect(screen.getByText(/Confirm & Create Intake/i)).toBeDefined();
    });

    fireEvent.click(screen.getByText(/Confirm & Create Intake/i));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/icsr/import', expect.objectContaining({
        format: 'XML',
      }));
    });

    await waitFor(() => {
      expect(screen.getByText(/ICSR Inbound Message Ingested Successfully/i)).toBeDefined();
      expect(screen.getByText(/INT-20260310-0012/i)).toBeDefined();
      expect(handleSuccess).toHaveBeenCalledWith(mockImportResponse.data.intake);
    });
  });
});

