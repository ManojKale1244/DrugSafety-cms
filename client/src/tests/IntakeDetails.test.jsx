import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import IntakeDetails from '../pages/IntakeDetails';
import api from '../services/api';

vi.mock('../services/api');
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-1', email: 'admin@drugsafety.local', role: 'admin' },
    hasPermission: () => true,
    hasRole: () => true,
  }),
}));

const mockIntake = {
  id: 'int-1',
  intakeNumber: 'INT-2026-00007',
  sourceType: 'Spontaneous',
  receiptDate: '2026-11-03',
  reporter: { name: 'Dr. Smith', qualification: 'Physician', country: 'US' },
  patient: { identifier: 'PT187', age: 45, ageUnit: 'Years', gender: 'Male' },
  product: { name: 'NeuroCalm', dose: '10mg' },
  reaction: { description: 'Skin spots', term: 'Skin spots', onsetDate: '2026-11-01', seriousness: 'Non-Serious' },
  status: 'Pending Review',
  attachments: [],
  auditTrail: [],
};

describe('<IntakeDetails />', () => {
  it('renders intake details and the MinimumCriteriaChecklist without reference error', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        intake: mockIntake,
      },
    });

    render(
      <MemoryRouter initialEntries={['/intakes/int-1']}>
        <Routes>
          <Route path="/intakes/:id" element={<IntakeDetails />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('INT-2026-00007')).toBeInTheDocument();
    });

    // Verify MinimumCriteriaChecklist rendered
    expect(screen.getAllByText(/Identifiable Reporter/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Identifiable Patient/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Suspected Medicinal Product/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Reported Adverse Reaction/i).length).toBeGreaterThan(0);
  });
});
