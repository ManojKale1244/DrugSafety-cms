import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScoreRing from '../components/duplicate/ScoreRing';

describe('ScoreRing Component', () => {
  it('renders score percentage and High Probability badge for score >= 80', () => {
    render(<ScoreRing score={92} size={96} />);
    expect(screen.getByText('92')).toBeDefined();
    expect(screen.getByText('%')).toBeDefined();
    expect(screen.getByText('High Probability')).toBeDefined();
  });

  it('renders Possible Duplicate badge for score between 60 and 79', () => {
    render(<ScoreRing score={68} size={96} />);
    expect(screen.getByText('68')).toBeDefined();
    expect(screen.getByText('Possible Duplicate')).toBeDefined();
  });

  it('renders Low Match badge for score below 60', () => {
    render(<ScoreRing score={45} size={96} />);
    expect(screen.getByText('45')).toBeDefined();
    expect(screen.getByText('Low Match')).toBeDefined();
  });
});
