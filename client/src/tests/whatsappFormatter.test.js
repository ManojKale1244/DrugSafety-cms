import { describe, it, expect } from 'vitest';
import {
  formatCasesListWhatsApp,
  formatCaseDetailsWhatsApp,
  formatIntakeWhatsApp,
  formatDuplicateReviewWhatsApp,
} from '../utils/whatsappFormatter';

describe('WhatsApp Pharmacovigilance Message Formatter', () => {
  it('formats case list directory into clean professional WhatsApp cards with blockquotes', () => {
    const demoCases = [
      {
        caseNumber: 'CASE-1012',
        product: 'Dermacure',
        eventSummary: 'Mild Scalp Scaling and redness',
        seriousness: 'Non-Serious',
        priority: 'medium',
        patient: { age: 31, sex: 'Female' },
        receiptDate: new Date('2026-10-15'),
      },
      {
        caseNumber: 'CASE-1008',
        product: 'NeuroCalm',
        eventSummary: 'Severe Tremor and extrapyramidal symptoms',
        seriousness: 'Serious',
        priority: 'urgent',
        patient: { age: 51, sex: 'Female' },
        receiptDate: new Date('2026-10-14'),
      },
    ];

    const result = formatCasesListWhatsApp({
      cases: demoCases,
      totalCases: 15,
      activeQuickFilter: 'All Cases',
    });

    // Check title and header
    expect(result).toContain('DRUG SAFETY CMS — PV DISPATCH');
    expect(result).toContain('REGISTRY SNAPSHOT');
    expect(result).toContain('• *Active Filter:* All Cases');
    expect(result).toContain('• *Total in View:* 15 cases');

    // Check case card formatting
    expect(result).toContain('*1. CASE CASE-1012* • Dermacure');
    expect(result).toContain('> 🟢 *Non-Serious* | Priority: MEDIUM');
    expect(result).toContain('> ⚡ *Event:* Mild Scalp Scaling and redness');
    expect(result).toContain('> 👤 *Pt:* 31y, Female');

    expect(result).toContain('*2. CASE CASE-1008* • NeuroCalm');
    expect(result).toContain('> 🔴 *SERIOUS* | Priority: URGENT');

    // Check confidentiality and link
    expect(result).toContain('Platform Directory:');
    expect(result).toContain('21 CFR Part 11 / GVP guidelines');

    // Verify absence of ugly continuous box-drawing lines
    expect(result).not.toContain('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    expect(result).not.toContain('──────────────────────────────');
  });

  it('formats single case details with clinical structure', () => {
    const demoCase = {
      caseNumber: 'CASE-1002',
      product: 'CardioGuard',
      eventSummary: 'Transient Tachycardia and syncopal episode',
      seriousness: 'Serious',
      priority: 'high',
      status: 'medical_review',
      patient: { age: 54, sex: 'Male', reference: 'PT-1002-REF' },
      reporter: { name: 'Dr. Robert Reviewer', qualification: 'Physician', country: 'India' },
      receiptDate: new Date('2026-10-13'),
      regulatoryDueDate: new Date('2026-10-20'),
      narrative: 'Patient experienced syncopal event after initiation of beta-blocker therapy.',
    };

    const result = formatCaseDetailsWhatsApp(demoCase);

    expect(result).toContain('*SAFETY CASE REPORT: CASE-1002*');
    expect(result).toContain('> 💊 *Suspected Product:* CardioGuard');
    expect(result).toContain('> ⚡ *Reported Reaction:* Transient Tachycardia and syncopal episode');
    expect(result).toContain('> 🔴 *SERIOUS REPORT*');
    expect(result).toContain('> • *Age & Sex:* 54 yrs, Male');
    expect(result).toContain('> • *Reference ID:* PT-1002-REF');
    expect(result).toContain('> • ⏰ *Regulatory Due Date:*');
    expect(result).toContain('Open Case Workspace:');
  });

  it('formats intake record cleanly for triage sharing', () => {
    const demoIntake = {
      intakeNumber: 'INT-2026-00001',
      suspectedProduct: 'Medicine A',
      reportedReaction: 'Skin Rash with generalized urticaria',
      status: 'RECEIVED',
      validation: { hasMinimumCriteria: true },
      patient: { age: 38, sex: 'Female', reference: 'PT-0101' },
      reporter: { name: 'Dr. Claire Manager', qualification: 'Physician' },
      receiptDate: new Date('2026-10-16'),
    };

    const result = formatIntakeWhatsApp(demoIntake);

    expect(result).toContain('ADVERSE EVENT INTAKE: INT-2026-00001');
    expect(result).toContain('> 💊 *Suspected Drug:* Medicine A');
    expect(result).toContain('> ⚡ *Reported Reaction:* Skin Rash with generalized urticaria');
    expect(result).toContain('VALID (4/4 Met)');
  });

  it('formats duplicate review candidate pair with score and comparison', () => {
    const demoReview = {
      sourceCaseNumber: 'CASE-1013',
      candidateCaseNumber: 'CASE-1001',
      score: 73,
      decision: 'PENDING',
      matchedFields: ['Suspected Product', 'Patient Age/Sex', 'Event Date'],
      sourceId: { product: 'Medicine A', eventSummary: 'Urticaria & rash' },
      candidateCaseId: { product: 'Medicine A', eventSummary: 'Skin rash with urticaria' },
    };

    const result = formatDuplicateReviewWhatsApp(demoReview);

    expect(result).toContain('PV DUPLICATE ASSESSMENT: CASE-1013 vs CASE-1001');
    expect(result).toContain('*MATCH CONFIDENCE: 73%*');
    expect(result).toContain('• *Decision Status:* PENDING');
    expect(result).toContain('• *Matched Fields:* Suspected Product, Patient Age/Sex, Event Date');
  });
});
