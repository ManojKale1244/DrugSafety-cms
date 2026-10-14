import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DataOriginBadge from '../components/case/DataOriginBadge';

describe('<DataOriginBadge />', () => {
  it('renders Reported origin with correct label', () => {
    render(<DataOriginBadge origin="reported" />);
    expect(screen.getByText('Reported')).toBeDefined();
  });

  it('renders Entered origin with correct label', () => {
    render(<DataOriginBadge origin="entered" />);
    expect(screen.getByText('Entered')).toBeDefined();
  });

  it('renders Assessed origin with correct label', () => {
    render(<DataOriginBadge origin="assessed" />);
    expect(screen.getByText('Assessed')).toBeDefined();
  });
});
