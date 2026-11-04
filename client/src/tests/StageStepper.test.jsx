import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import StageStepper, { CANONICAL_STAGES, normalizeStageKey } from '../components/workflow/StageStepper';

describe('StageStepper Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('normalizes stage strings correctly', () => {
    expect(normalizeStageKey('new')).toBe('NEW');
    expect(normalizeStageKey('medical_review')).toBe('MEDICAL_REVIEW');
    expect(normalizeStageKey('ready_for_submission')).toBe('REGULATORY_REPORTING');
    expect(normalizeStageKey('closed')).toBe('CLOSED');
  });

  it('renders all canonical stages with active stage highlighted', () => {
    const onOpenRouteModal = vi.fn();
    render(
      <StageStepper
        currentStage="MEDICAL_CODING"
        onOpenRouteModal={onOpenRouteModal}
      />
    );

    expect(screen.getByText('Workflow Stage Stepper')).toBeDefined();
    expect(screen.getByText('(Step 3 of 8)')).toBeDefined();
    expect(screen.getAllByText('Medical Coding').length).toBeGreaterThanOrEqual(1);

    const routeBtn = screen.getByRole('button', { name: /route case/i });
    expect(routeBtn).toBeDefined();
    fireEvent.click(routeBtn);
    expect(onOpenRouteModal).toHaveBeenCalledTimes(1);
  });

  it('hides route button in read-only mode', () => {
    render(<StageStepper currentStage="CLOSED" readOnly={true} />);
    expect(screen.queryByRole('button', { name: /route case/i })).toBeNull();
  });
});
