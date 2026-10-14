import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MinimumCriteriaChecklist from '../components/intake/MinimumCriteriaChecklist';

describe('<MinimumCriteriaChecklist />', () => {
  it('renders 0 of 4 complete when empty form data is provided', () => {
    render(<MinimumCriteriaChecklist formData={{}} />);

    expect(screen.getByText('0 of 4 Complete')).toBeDefined();
    expect(
      screen.getByText(/Per global pharmacovigilance regulations, cases cannot be provisioned/),
    ).toBeDefined();
  });

  it('renders 2 of 4 complete when only product and reaction are filled', () => {
    const partialData = {
      suspectedProduct: 'CardioSafe 50mg',
      reportedReaction: 'Acute hypotension and dizziness',
    };

    render(<MinimumCriteriaChecklist formData={partialData} />);

    expect(screen.getByText('2 of 4 Complete')).toBeDefined();
    expect(screen.getByText('CardioSafe 50mg')).toBeDefined();
    expect(screen.getByText('Acute hypotension and dizziness')).toBeDefined();
  });

  it('renders 4 of 4 complete when all minimum criteria are met', () => {
    const completeData = {
      reporter: {
        name: 'Dr. Jane Smith, MD',
        qualification: 'Physician',
        country: 'India',
      },
      patient: {
        reference: 'PT-99881',
        age: 54,
        ageUnit: 'Years',
        sex: 'Female',
      },
      suspectedProduct: 'NeuroCalm 10mg',
      reportedReaction: 'Severe tremors and agitation',
    };

    render(<MinimumCriteriaChecklist formData={completeData} />);

    expect(screen.getByText('4 of 4 Complete')).toBeDefined();
    expect(
      screen.getByText(/All four criteria satisfied. This intake can be formally converted into an active case/),
    ).toBeDefined();
    expect(screen.getByText('Dr. Jane Smith, MD')).toBeDefined();
    expect(screen.getByText('PT-99881')).toBeDefined();
    expect(screen.getByText('NeuroCalm 10mg')).toBeDefined();
    expect(screen.getByText('Severe tremors and agitation')).toBeDefined();
  });
});
