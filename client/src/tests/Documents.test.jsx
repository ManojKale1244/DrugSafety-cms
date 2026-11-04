import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Documents from '../pages/Documents';
import api from '../services/api';

vi.mock('../services/api');

describe('Module 17: Documents Page (Document Repository & Vault)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockStats = {
    totalDocuments: 3,
    totalSizeBytes: 2470176,
    totalSizeFormatted: '2.36 MB',
    categoryCounts: {
      SOURCE_DOCUMENT: 1,
      LAB_RESULT: 1,
      HOSPITAL_RECORD: 1,
    },
    mimeCounts: {
      PDF: 2,
      IMAGE: 1,
    },
    storageLocation: 'server/uploads/attachments',
  };

  const mockDocuments = [
    {
      _id: 'doc-1',
      name: 'Initial_Hospital_Chart.pdf',
      caseId: { _id: 'case-100', caseNumber: 'DS-2026-00001' },
      caseNumber: 'DS-2026-00001',
      category: 'HOSPITAL_RECORD',
      mime: 'application/pdf',
      size: 1048576,
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      version: 1,
      versionHistory: [],
      uploadedByName: 'Dr. John Doe',
      createdAt: '2026-10-10T08:00:00.000Z',
    },
    {
      _id: 'doc-2',
      name: 'Liver_Function_Test.pdf',
      caseId: { _id: 'case-100', caseNumber: 'DS-2026-00001' },
      caseNumber: 'DS-2026-00001',
      category: 'LAB_RESULT',
      mime: 'application/pdf',
      size: 524288,
      hash: 'ca978112ca1bbdcafac231b39a23dc4da7860819c196611e80e9b5a4e05b485a',
      version: 2,
      versionHistory: [
        {
          version: 1,
          hash: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
          size: 400000,
          uploadedAt: '2026-10-08T08:00:00.000Z',
          uploadedByName: 'Lab Tech Sarah',
          reason: 'Initial uncorrected enzyme values',
        },
      ],
      uploadedByName: 'Lab Tech Sarah',
      createdAt: '2026-10-12T09:30:00.000Z',
    },
    {
      _id: 'doc-3',
      name: 'Intake_Email_Photo.png',
      intakeId: { _id: 'intake-50', intakeNumber: 'IN-2026-00042' },
      intakeNumber: 'IN-2026-00042',
      category: 'SOURCE_DOCUMENT',
      mime: 'image/png',
      size: 897312,
      hash: '88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589',
      version: 1,
      versionHistory: [],
      uploadedByName: 'Intake Coordinator',
      createdAt: '2026-10-14T11:15:00.000Z',
    },
  ];

  it('renders Document Repository heading, metrics cards, and document table', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/attachments/stats') {
        return Promise.resolve({ data: { success: true, data: mockStats } });
      }
      if (url === '/attachments') {
        return Promise.resolve({
          data: {
            success: true,
            data: mockDocuments,
            pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
          },
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(
      <MemoryRouter>
        <Documents />
      </MemoryRouter>,
    );

    expect(screen.getByText('Document Repository & Vault')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Initial_Hospital_Chart.pdf')).toBeDefined();
      expect(screen.getByText('Liver_Function_Test.pdf')).toBeDefined();
      expect(screen.getByText('Intake_Email_Photo.png')).toBeDefined();
    });

    // Check Stats Cards
    expect(screen.getByText('2.36 MB')).toBeDefined();
    expect(screen.getByText('100% Validated')).toBeDefined();
  });

  it('filters documents when category tab is selected', async () => {
    api.get.mockImplementation((url, config) => {
      if (url === '/attachments/stats') {
        return Promise.resolve({ data: { success: true, data: mockStats } });
      }
      if (url === '/attachments') {
        if (config?.params?.category === 'LAB_RESULT') {
          return Promise.resolve({
            data: {
              success: true,
              data: [mockDocuments[1]],
              pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
            },
          });
        }
        return Promise.resolve({
          data: {
            success: true,
            data: mockDocuments,
            pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
          },
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(
      <MemoryRouter>
        <Documents />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Initial_Hospital_Chart.pdf')).toBeDefined();
    });

    // Click 'Lab Results' filter button
    const labFilterBtn = screen.getByRole('button', { name: /Lab Results/i });
    fireEvent.click(labFilterBtn);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/attachments', expect.objectContaining({
        params: expect.objectContaining({ category: 'LAB_RESULT' }),
      }));
    });
  });

  it('opens In-App Preview modal and triggers presigned streaming endpoint', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/attachments/stats') {
        return Promise.resolve({ data: { success: true, data: mockStats } });
      }
      if (url === '/attachments') {
        return Promise.resolve({
          data: {
            success: true,
            data: mockDocuments,
            pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
          },
        });
      }
      if (url === '/attachments/doc-1/presigned-url') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              presignedUrl: '/api/attachments/doc-1/stream?token=abc&expires=9999',
              expiresInSeconds: 300,
            },
          },
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(
      <MemoryRouter>
        <Documents />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Initial_Hospital_Chart.pdf')).toBeDefined();
    });

    // Click on document name to open preview
    fireEvent.click(screen.getByText('Initial_Hospital_Chart.pdf'));

    await waitFor(() => {
      expect(screen.getAllByTitle('Initial_Hospital_Chart.pdf').length).toBeGreaterThan(1);
      expect(screen.getByText(/Magic-byte Verified/i)).toBeDefined();
    });
  });

  it('opens Version History Drawer and displays revision history', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/attachments/stats') {
        return Promise.resolve({ data: { success: true, data: mockStats } });
      }
      if (url === '/attachments') {
        return Promise.resolve({
          data: {
            success: true,
            data: mockDocuments,
            pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
          },
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(
      <MemoryRouter>
        <Documents />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Liver_Function_Test.pdf')).toBeDefined();
    });

    // Find and click the version button for doc-2 (v2 +1)
    const v2Button = screen.getByRole('button', { name: /v2/i });
    fireEvent.click(v2Button);

    await waitFor(() => {
      expect(screen.getByText('Document Version History')).toBeDefined();
      expect(screen.getByText(/Current Version: v2/i)).toBeDefined();
      expect(screen.getByText(/Initial uncorrected enzyme values/i)).toBeDefined();
    });
  });
});
