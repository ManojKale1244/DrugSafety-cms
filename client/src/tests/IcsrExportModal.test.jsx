import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import IcsrExportModal from '../components/icsr/IcsrExportModal';
import api from '../services/api';

vi.mock('../services/api');

describe('Module 11: IcsrExportModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockExportResponse = {
    data: {
      success: true,
      messageId: 'MSG-OUT-TEST01',
      format: 'JSON',
      payload: JSON.stringify({
        ichicsr: {
          ichicsrmessageheader: { messagetype: 'ichicsr' },
          safetyreport: { safetyreportid: 'CASE-2026-001' },
        },
      }, null, 2),
      validation: {
        valid: true,
        errors: [],
      },
      disclaimer: 'Successful export ≠ regulatory compliance.',
    },
  };

  it('renders regulatory disclaimer banner and calls export endpoint on open', async () => {
    api.post.mockResolvedValueOnce(mockExportResponse);

    render(
      <IcsrExportModal
        isOpen={true}
        onClose={vi.fn()}
        caseId="case-123"
        caseNumber="CASE-2026-001"
      />
    );

    // Verify persistent regulatory disclaimer banner
    const banner = screen.getByText(/Successful export ≠ regulatory compliance/i);
    expect(banner).toBeDefined();

    // Verify header title
    expect(screen.getByText(/ICSR \/ E2B\(R3\) Message Export/i)).toBeDefined();

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/icsr/export/case-123', { format: 'JSON' });
    });

    // Verify valid schema badge
    await waitFor(() => {
      expect(screen.getByText(/Schema Valid \(Synthetic\)/i)).toBeDefined();
    });
  });

  it('allows switching to XML format and fetches XML export', async () => {
    api.post
      .mockResolvedValueOnce(mockExportResponse)
      .mockResolvedValueOnce({
        data: {
          success: true,
          messageId: 'MSG-OUT-TEST02',
          format: 'XML',
          payload: '<?xml version="1.0" encoding="UTF-8"?><ichicsr><safetyreportid>CASE-2026-001</safetyreportid></ichicsr>',
          validation: { valid: true, errors: [] },
        },
      });

    render(
      <IcsrExportModal
        isOpen={true}
        onClose={vi.fn()}
        caseId="case-123"
        caseNumber="CASE-2026-001"
      />
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(1);
    });

    const xmlButton = screen.getByText(/XML \(E2B\(R3\) Tagged\)/i);
    fireEvent.click(xmlButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/icsr/export/case-123', { format: 'XML' });
    });
  });
});

