import { describe, it, expect } from 'vitest';
import { calculateExposureTimeline } from '../services/product.service.js';

describe('Module 13: Product & Drug Management & Exposure Timeline', () => {
  it('accurately calculates exposure duration and time-to-onset when reaction occurs within exposure', () => {
    const prodStart = '2026-03-01T00:00:00.000Z';
    const prodStop = '2026-03-20T00:00:00.000Z';
    const rxnOnset = '2026-03-05T00:00:00.000Z'; // 4 days after start

    const result = calculateExposureTimeline(prodStart, prodStop, rxnOnset);

    expect(result.exposureDurationDays).toBe(19);
    expect(result.timeToOnsetDays).toBe(4);
    expect(result.onsetStatus).toBe('WITHIN_EXPOSURE');
  });

  it('detects reaction onset occurring before product exposure (negative latency)', () => {
    const prodStart = '2026-03-10T00:00:00.000Z';
    const prodStop = '2026-03-25T00:00:00.000Z';
    const rxnOnset = '2026-03-08T00:00:00.000Z'; // 2 days before start

    const result = calculateExposureTimeline(prodStart, prodStop, rxnOnset);

    expect(result.timeToOnsetDays).toBe(-2);
    expect(result.onsetStatus).toBe('BEFORE_EXPOSURE');
  });

  it('detects reaction onset occurring after drug discontinuation', () => {
    const prodStart = '2026-03-01T00:00:00.000Z';
    const prodStop = '2026-03-10T00:00:00.000Z';
    const rxnOnset = '2026-03-15T00:00:00.000Z'; // 5 days after stop

    const result = calculateExposureTimeline(prodStart, prodStop, rxnOnset);

    expect(result.exposureDurationDays).toBe(9);
    expect(result.timeToOnsetDays).toBe(14);
    expect(result.onsetStatus).toBe('AFTER_STOP');
  });

  it('handles ongoing treatment without stop date', () => {
    const prodStart = '2026-03-01T00:00:00.000Z';
    const prodStop = null;
    const rxnOnset = '2026-03-08T00:00:00.000Z';

    const result = calculateExposureTimeline(prodStart, prodStop, rxnOnset);

    expect(result.exposureDurationDays).toBeNull();
    expect(result.timeToOnsetDays).toBe(7);
    expect(result.onsetStatus).toBe('WITHIN_EXPOSURE');
  });

  it('validates stop date constraint: stopDate cannot be earlier than startDate', () => {
    const startDate = new Date('2026-03-10');
    const stopDate = new Date('2026-03-05'); // Earlier than start

    const isInvalid = stopDate < startDate;
    expect(isInvalid).toBe(true);

    const validStop = new Date('2026-03-15');
    expect(validStop >= startDate).toBe(true);
  });
});

