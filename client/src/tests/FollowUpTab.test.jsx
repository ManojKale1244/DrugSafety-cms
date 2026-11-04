import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import FollowUpTab from '../components/followup/FollowUpTab';
import api from '../services/api';

vi.mock('../services/api');

describe('Module 12: FollowUpTab Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockCaseData = {
    _id: 'case-fu-01',
    caseNumber: 'PV-2026-0045',
    version: 1,
    narrative: 'Patient developed rash after taking medicine.',
    patient: { weight: 65, history: 'None' },
    reactions: [{ verbatim: 'Rash', outcome: 'not_recovered', causality: 'Possible' }],
    reporter: { name: 'Dr. Jane Smith', qualification: 'Physician', contact: 'jsmith@clinic.org' },
  };

  const mockFollowUps = [
    {
      _id: 'fu-101',
      followUpNumber: 'FU-20260310-0001',
      caseId: 'case-fu-01',
      caseNumber: 'PV-2026-0045',
      status: 'OPEN',
      attemptsCount: 2,
      dueDate: '2026-03-25T00:00:00.000Z',
      recipient: {
        name: 'Dr. Jane Smith',
        role: 'Physician',
        contact: 'jsmith@clinic.org',
        method: 'EMAIL',
      },
      question: 'Please provide patient discharge summary and confirmation of rash resolution.',
      correspondence: [
        {
          attemptNumber: 1,
          date: '2026-03-10T10:00:00.000Z',
          channel: 'EMAIL',
          sentByName: 'Safety Officer',
          notes: 'Initial inquiry dispatched via email',
        },
        {
          attemptNumber: 2,
          date: '2026-03-15T14:30:00.000Z',
          channel: 'PHONE',
          sentByName: 'Safety Officer',
          notes: 'Spoke with clinic nurse; awaiting doctor signature',
        },
      ],
      createdAt: '2026-03-10T10:00:00.000Z',
    },
  ];

  const mockAmendments = [
    {
      _id: 'amend-01',
      caseId: 'case-fu-01',
      version: 2,
      previousVersion: 1,
      followUpNumber: 'FU-20260310-0001',
      reason: 'Follow-up received: rash resolved, patient discharged',
      appliedByName: 'Safety Reviewer',
      appliedAt: '2026-03-16T11:00:00.000Z',
      snapshot: { version: 1, narrative: 'Original narrative text' },
      diff: [
        {
          field: 'reactions[0].outcome',
          label: 'Reaction Outcome',
          oldValue: 'not_recovered',
          newValue: 'recovered',
        },
      ],
    },
  ];

  it('renders KPI stats and correspondence threads with attempts count', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/amendments')) {
        return Promise.resolve({ data: { success: true, amendments: mockAmendments } });
      }
      return Promise.resolve({
        data: {
          success: true,
          followUps: mockFollowUps,
          stats: { total: 1, openCount: 1, receivedCount: 0, overdueCount: 0, totalAttempts: 2 },
        },
      });
    });

    render(
      <FollowUpTab
        caseId="case-fu-01"
        caseNumber="PV-2026-0045"
        caseData={mockCaseData}
        onCaseUpdated={vi.fn()}
      />
    );

    // Header & stats
    expect(screen.getByText(/Follow-Up & Query Management/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/FU-20260310-0001/i)).toBeDefined();
      expect(screen.getByText(/2 Attempts/i)).toBeDefined();
      expect(screen.getByText(/Please provide patient discharge summary/i)).toBeDefined();
      expect(screen.getByText(/Attempt #1/i)).toBeDefined();
      expect(screen.getByText(/Attempt #2/i)).toBeDefined();
    });
  });

  it('allows logging received response which creates new case version and updates status', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/amendments')) {
        return Promise.resolve({ data: { success: true, amendments: mockAmendments } });
      }
      return Promise.resolve({
        data: {
          success: true,
          followUps: mockFollowUps,
          stats: { total: 1, openCount: 1, receivedCount: 0, overdueCount: 0, totalAttempts: 2 },
        },
      });
    });

    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        case: { version: 2 },
      },
    });

    const handleUpdate = vi.fn();

    render(
      <FollowUpTab
        caseId="case-fu-01"
        caseNumber="PV-2026-0045"
        caseData={mockCaseData}
        onCaseUpdated={handleUpdate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Log Response/i)).toBeDefined();
    });

    // Open Log Response modal
    fireEvent.click(screen.getByText(/Log Response/i));

    await waitFor(() => {
      expect(screen.getByText(/Log Received Response/i)).toBeDefined();
      expect(screen.getByText(/Version Control Notice:/i)).toBeDefined();
    });

    // Fill raw response
    const rawTextarea = screen.getByPlaceholderText(/Paste or transcribe the verbatim response/i);
    fireEvent.change(rawTextarea, {
      target: { value: 'Physician confirmed complete resolution of rash after 4 days.' },
    });

    // Click commit response
    const commitBtn = screen.getByText(/Commit Response & Advance Version/i);
    fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/follow-ups/fu-101/receive',
        expect.objectContaining({
          rawResponse: 'Physician confirmed complete resolution of rash after 4 days.',
          reopenReview: true,
        })
      );
    });
  });

  it('switches to amendments view and displays field-level diff with preserved original snapshot', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('/amendments')) {
        return Promise.resolve({ data: { success: true, amendments: mockAmendments } });
      }
      return Promise.resolve({
        data: {
          success: true,
          followUps: mockFollowUps,
          stats: { total: 1, openCount: 1, receivedCount: 0, overdueCount: 0, totalAttempts: 2 },
        },
      });
    });

    render(
      <FollowUpTab
        caseId="case-fu-01"
        caseNumber="PV-2026-0045"
        caseData={mockCaseData}
        onCaseUpdated={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Case Version Amendments & Diffs/i)).toBeDefined();
    });

    // Click amendments tab
    fireEvent.click(screen.getByText(/Case Version Amendments & Diffs/i));

    await waitFor(() => {
      expect(screen.getByText(/v1 ➔ v2/i)).toBeDefined();
      expect(screen.getByText(/Reaction Outcome/i)).toBeDefined();
      expect(screen.getByText('not_recovered')).toBeDefined();
      expect(screen.getByText('recovered')).toBeDefined();
      expect(screen.getByText(/View Preserved v1 Snapshot/i)).toBeDefined();
    });

    // Click view preserved snapshot
    fireEvent.click(screen.getByText(/View Preserved v1 Snapshot/i));

    await waitFor(() => {
      expect(screen.getByText(/Preserved Case Snapshot \(v1\)/i)).toBeDefined();
      expect(screen.getByText(/Original narrative text/i)).toBeDefined();
    });
  });
});
