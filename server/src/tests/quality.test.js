import { describe, it, expect } from 'vitest';
import { runAutoChecks } from '../services/quality.service.js';

describe('Module 9: Quality Review Auto-Validators Unit Tests', () => {
  const validCaseDoc = {
    caseNumber: 'PV-2026-QA99',
    status: 'QUALITY_REVIEW',
    receiptDate: new Date('2026-10-15T10:00:00Z'),
    patient: {
      reference: 'PT-9988',
      age: 52,
      sex: 'Female',
    },
    reporter: {
      name: 'Dr. Emily Watson',
      qualification: 'Physician',
      country: 'India',
    },
    caseProducts: [
      {
        productName: 'CardioVas Synth 20mg',
        role: 'Suspect',
        dose: '20mg',
        route: 'Oral',
        indication: 'Hypertension',
        startDate: new Date('2026-09-01T00:00:00Z'),
      },
    ],
    reactions: [
      {
        verbatim: 'Severe acute urticaria with rash',
        pt: 'Urticaria',
        meddraCode: 'PT-1004',
        outcome: 'recovered',
        startDate: new Date('2026-10-01T00:00:00Z'),
        stopDate: new Date('2026-10-05T00:00:00Z'),
      },
    ],
    narrative: 'Patient developed acute urticaria on 2026-10-01 following CardioVas Synth intake.',
    attachmentsFlag: false,
    attachments: [],
  };

  const validAssessment = {
    status: 'SIGNED',
    version: 1,
    signedByName: 'Dr. Physician Reviewer',
  };

  it('passes all auto-checks for a complete, consistent, coded case with signed assessment', () => {
    const result = runAutoChecks(validCaseDoc, validAssessment);
    expect(result.passed).toBe(true);
    expect(result.criticalFailedCount).toBe(0);
    expect(result.allPassed).toBe(true);
  });

  it('fails REQ_FIELDS when patient demographics or narrative are missing', () => {
    const incompleteCase = {
      ...validCaseDoc,
      patient: { reference: '', age: null, sex: 'Unknown' },
      narrative: '',
    };
    const result = runAutoChecks(incompleteCase, validAssessment);
    expect(result.passed).toBe(false);
    const reqCheck = result.checks.find((c) => c.key === 'REQ_FIELDS');
    expect(reqCheck.passed).toBe(false);
    expect(reqCheck.severity).toBe('CRITICAL');
  });

  it('fails DATE_NO_FUTURE when an event onset date is recorded in the future', () => {
    const futureOnsetCase = {
      ...validCaseDoc,
      reactions: [
        {
          ...validCaseDoc.reactions[0],
          startDate: new Date('2030-01-01T00:00:00Z'),
        },
      ],
    };
    const result = runAutoChecks(futureOnsetCase, validAssessment);
    const futureCheck = result.checks.find((c) => c.key === 'DATE_NO_FUTURE');
    expect(futureCheck.passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('fails DATE_ONSET_LE_RECEIPT when onset is after receipt date', () => {
    const lateOnsetCase = {
      ...validCaseDoc,
      receiptDate: new Date('2026-10-01T00:00:00Z'),
      reactions: [
        {
          ...validCaseDoc.reactions[0],
          startDate: new Date('2026-10-20T00:00:00Z'),
        },
      ],
    };
    const result = runAutoChecks(lateOnsetCase, validAssessment);
    const onsetCheck = result.checks.find((c) => c.key === 'DATE_ONSET_LE_RECEIPT');
    expect(onsetCheck.passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('fails CODING_COMPLETE when any reaction is uncoded', () => {
    const uncodedCase = {
      ...validCaseDoc,
      reactions: [
        {
          verbatim: 'Sudden syncope',
          pt: '', // Uncoded
          meddraCode: '',
          outcome: 'recovered',
        },
      ],
    };
    const result = runAutoChecks(uncodedCase, validAssessment);
    const codingCheck = result.checks.find((c) => c.key === 'CODING_COMPLETE');
    expect(codingCheck.passed).toBe(false);
    expect(codingCheck.severity).toBe('CRITICAL');
    expect(result.passed).toBe(false);
  });

  it('fails ASSESSMENT_SIGNED when medical review is not signed', () => {
    const unsignedAssessment = {
      status: 'DRAFT',
      version: 1,
    };
    const result = runAutoChecks(validCaseDoc, unsignedAssessment);
    const assessmentCheck = result.checks.find((c) => c.key === 'ASSESSMENT_SIGNED');
    expect(assessmentCheck.passed).toBe(false);
    expect(assessmentCheck.severity).toBe('CRITICAL');
    expect(result.passed).toBe(false);
  });

  it('fails ATTACHMENTS_FLAGGED when attachments are flagged but none uploaded', () => {
    const flaggedCase = {
      ...validCaseDoc,
      attachmentsFlag: true,
      attachments: [],
    };
    const result = runAutoChecks(flaggedCase, validAssessment);
    const attachCheck = result.checks.find((c) => c.key === 'ATTACHMENTS_FLAGGED');
    expect(attachCheck.passed).toBe(false);
    expect(attachCheck.severity).toBe('MAJOR');
  });
});

