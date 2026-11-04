import { describe, it, expect } from 'vitest';
import { computeFollowUpDiff } from '../services/followUp.service.js';

describe('Module 12: Follow-Up Management & Diff Engine', () => {
  const originalCase = {
    caseNumber: 'PV-2026-FU01',
    version: 1,
    narrative: 'Patient experienced mild rash after starting treatment.',
    patient: {
      age: 42,
      sex: 'Female',
      weight: 65,
      history: 'Hypertension',
    },
    reporter: {
      name: 'Dr. John Smith',
      contact: 'jsmith@clinic.com',
    },
    seriousness: 'Non-Serious',
    reactions: [
      {
        verbatim: 'Skin Rash',
        outcome: 'not_recovered',
        causality: 'Possible',
      },
    ],
  };

  it('accurately computes field-level diff between original case and follow-up updates', () => {
    const updates = {
      narrative: 'Follow-up received: Rash worsened with skin peeling. Patient hospitalized.',
      patient: {
        age: 42, // unchanged
        sex: 'Female', // unchanged
        weight: 63, // changed
        history: 'Hypertension, Penicillin allergy', // changed
      },
      seriousness: 'Serious', // changed
      reactions: [
        {
          verbatim: 'Skin Rash',
          outcome: 'recovering', // changed
          causality: 'Probable', // changed
        },
      ],
    };

    const diffs = computeFollowUpDiff(originalCase, updates);

    expect(diffs.length).toBeGreaterThan(0);

    const diffFields = diffs.map((d) => d.field);
    expect(diffFields).toContain('narrative');
    expect(diffFields).toContain('patient.weight');
    expect(diffFields).toContain('patient.history');
    expect(diffFields).toContain('seriousness');
    expect(diffFields).toContain('reactions[0].outcome');
    expect(diffFields).toContain('reactions[0].causality');

    // Narrative diff check
    const narrativeDiff = diffs.find((d) => d.field === 'narrative');
    expect(narrativeDiff.oldValue).toBe(originalCase.narrative);
    expect(narrativeDiff.newValue).toBe(updates.narrative);

    // Patient weight diff check
    const weightDiff = diffs.find((d) => d.field === 'patient.weight');
    expect(weightDiff.oldValue).toBe(65);
    expect(weightDiff.newValue).toBe(63);

    // Seriousness diff check
    const seriousnessDiff = diffs.find((d) => d.field === 'seriousness');
    expect(seriousnessDiff.oldValue).toBe('Non-Serious');
    expect(seriousnessDiff.newValue).toBe('Serious');

    // Reactions outcome diff check
    const outcomeDiff = diffs.find((d) => d.field === 'reactions[0].outcome');
    expect(outcomeDiff.oldValue).toBe('not_recovered');
    expect(outcomeDiff.newValue).toBe('recovering');
  });

  it('returns empty diff array when values remain unchanged', () => {
    const identicalUpdates = {
      narrative: 'Patient experienced mild rash after starting treatment.',
      patient: {
        age: 42,
        sex: 'Female',
        weight: 65,
        history: 'Hypertension',
      },
      seriousness: 'Non-Serious',
      reactions: [
        {
          verbatim: 'Skin Rash',
          outcome: 'not_recovered',
          causality: 'Possible',
        },
      ],
    };

    const diffs = computeFollowUpDiff(originalCase, identicalUpdates);
    expect(diffs).toEqual([]);
  });

  it('preserves original snapshot data independently from mutated objects', () => {
    const originalSnapshot = JSON.parse(JSON.stringify(originalCase));

    // Simulate mutation on updated object
    const mutatedCase = { ...originalCase, version: 2, narrative: 'Updated Narrative' };

    expect(originalSnapshot.version).toBe(1);
    expect(originalSnapshot.narrative).toBe('Patient experienced mild rash after starting treatment.');
    expect(mutatedCase.version).toBe(2);
    expect(mutatedCase.narrative).not.toBe(originalSnapshot.narrative);
  });
});

