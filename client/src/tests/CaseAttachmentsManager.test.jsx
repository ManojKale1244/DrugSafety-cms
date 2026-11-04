import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import CaseAttachmentsManager from '../components/case/CaseAttachmentsManager';
import api from '../services/api';

vi.mock('../services/api');

describe('Module 17: Case Attachments & Document Management Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockAttachments = [
    {
      _id: 'att-01',
      caseId: 'case-01',
      name: 'Discharge_Summary_Cardiology.pdf',
      mime: 'application/pdf',
      size: 1548576, // ~1.5 MB
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      version: 1,
      category: 'HOSPITAL_RECORD',
      uploadedByName: 'Dr. House',
      createdAt: '2026-10-15T10:00:00.000Z',
      versionHistory: [],
    },
    {
      _id: 'att-02',
      caseId: 'case-01',
      name: 'Pathology_Blood_Count.pdf',
      mime: 'application/pdf',
      size: 409600, // ~400 KB
      hash: 'ca978112ca1bbdcafac231b39a23dc4da7860819c196611e80e9b5a4e05b485a',
      version: 2,
      category: 'LAB_RESULT',
      uploadedByName: 'Lab Tech Sarah',
      createdAt: '2026-10-20T12:00:00.000Z',
      versionHistory: [
        {
          version: 1,
          hash: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
          size: 350000,
          uploadedAt: '2026-10-18T10:00:00.000Z',
          uploadedByName: 'Lab Tech Sarah',
          reason: 'Initial unverified preliminary report',
        },
      ],
    },
    {
      _id: 'att-03',
      caseId: 'case-01',
      name: 'ECG_Telemetry_Trace.png',
      mime: 'image/png',
      size: 512000,
      hash: '88d4266fd4e6338d13b845fcf289579d209c897823b9217da3e161936f031589',
      version: 1,
      category: 'SOURCE_DOCUMENT',
      uploadedByName: 'Nurse Jackie',
      createdAt: '2026-10-22T14:00:00.000Z',
      versionHistory: [],
    },
  ];

  const setupMocks = () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/attachments') && !url.includes('/stream') && !url.includes('/presigned-url')) {
        return Promise.resolve({ data: { success: true, data: mockAttachments } });
      }
      if (url.includes('/presigned-url')) {
        return Promise.resolve({
          data: {
            success: true,
            data: { presignedUrl: '/api/attachments/att-01/stream?token=mockToken&expires=9999999999' },
          },
        });
      }
      return Promise.resolve({ data: { success: true } });
    });

    api.post.mockImplementation((url) => {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            _id: 'att-new',
            name: 'New_Record.pdf',
            version: 1,
            size: 1024,
            mime: 'application/pdf',
          },
        },
      });
    });
  };

  it('renders dropzone, 21 CFR Part 11 policy notice, and file cards with type icons', async () => {
    setupMocks();

    render(<CaseAttachmentsManager caseId="case-01" />);

    expect(screen.getByText(/Drag and drop clinical source documents here/i)).toBeDefined();
    expect(screen.getByText(/21 CFR Part 11 Controlled Document Storage & Audit Policy/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Discharge_Summary_Cardiology.pdf')).toBeDefined();
      expect(screen.getByText('Pathology_Blood_Count.pdf')).toBeDefined();
      expect(screen.getByText('ECG_Telemetry_Trace.png')).toBeDefined();
      expect(screen.getByText(/1.5 MB/i)).toBeDefined();
      expect(screen.getByText('v2')).toBeDefined();
    });
  });

  it('filters file list when clicking category filter tags', async () => {
    setupMocks();

    render(<CaseAttachmentsManager caseId="case-01" />);

    await waitFor(() => {
      expect(screen.getByText('Discharge_Summary_Cardiology.pdf')).toBeDefined();
    });

    // Click "Lab Results" filter
    const labFilter = screen.getByRole('button', { name: /Lab Results/i });
    fireEvent.click(labFilter);

    await waitFor(() => {
      expect(screen.getByText('Pathology_Blood_Count.pdf')).toBeDefined();
      expect(screen.queryByText('Discharge_Summary_Cardiology.pdf')).toBeNull();
      expect(screen.queryByText('ECG_Telemetry_Trace.png')).toBeNull();
    });
  });

  it('opens In-App Preview modal when clicking preview button on a file card', async () => {
    setupMocks();

    render(<CaseAttachmentsManager caseId="case-01" />);

    await waitFor(() => {
      expect(screen.getAllByTitle(/Preview Document/i).length).toBe(3);
    });

    fireEvent.click(screen.getAllByTitle(/Preview Document/i)[0]);

    await waitFor(() => {
      expect(screen.getByText(/SHA-256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855/i)).toBeDefined();
    });
  });

  it('opens Version History Drawer and displays historical revisions with reasons', async () => {
    setupMocks();

    render(<CaseAttachmentsManager caseId="case-01" />);

    await waitFor(() => {
      expect(screen.getAllByTitle(/Version History/i).length).toBe(3);
    });

    // Click version history on Pathology_Blood_Count (index 1)
    fireEvent.click(screen.getAllByTitle(/Version History/i)[1]);

    await waitFor(() => {
      expect(screen.getByText(/Version Lineage: Pathology_Blood_Count.pdf/i)).toBeDefined();
      expect(screen.getByText(/Version 2 \(Active\)/i)).toBeDefined();
      expect(screen.getByText(/Version 1 \(Archived\)/i)).toBeDefined();
      expect(screen.getByText(/Initial unverified preliminary report/i)).toBeDefined();
    });
  });

  it('uploads a file with category selection and progress feedback', async () => {
    setupMocks();
    const onAttachmentChange = vi.fn();

    render(<CaseAttachmentsManager caseId="case-01" onAttachmentChange={onAttachmentChange} />);

    await waitFor(() => {
      expect(screen.getByText(/Browse Files/i)).toBeDefined();
    });

    const file = new File(['%PDF-1.4 Mock lab report content'], 'Lab_Result_Test.pdf', {
      type: 'application/pdf',
    });

    const fileInput = document.getElementById('fileInput');
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/cases/case-01/attachments',
        expect.any(FormData),
        expect.any(Object),
      );
    });
  });
});
