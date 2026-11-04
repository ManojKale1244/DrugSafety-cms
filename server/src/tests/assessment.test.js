import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { config } from '../config/index.js';
import { seedDatabase } from '../seeds/seed.js';
import { Case } from '../models/Case.js';
import { MedicalAssessment } from '../models/MedicalAssessment.js';
import { ActionItem } from '../models/ActionItem.js';
import { AuditEvent } from '../models/AuditEvent.js';

describe('Module 7: Medical Review and Assessment Integration Tests', () => {
  let reviewerCookie;
  let dataEntryCookie;
  let testCase;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }
    await seedDatabase();

    // Login as reviewer (has medical.review permission)
    const revRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reviewer@drugsafety.local', password: 'Reviewer@123456' });
    reviewerCookie = revRes.headers['set-cookie'];

    // Login as data_entry (processor role without medical.review permission)
    const deRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dataentry@drugsafety.local', password: 'DataEntry@123456' });
    dataEntryCookie = deRes.headers['set-cookie'];

    // Create a safety case ready for medical review
    testCase = await Case.create({
      caseNumber: 'DS-2026-97001',
      status: 'data_entry',
      priority: 'high',
      product: 'CardioVas Synth 20mg',
      caseProducts: [
        {
          productName: 'CardioVas Synth 20mg',
          role: 'Suspect',
          indication: 'Hypertension',
        },
      ],
      reactions: [
        {
          verbatim: 'Acute hypotension and syncopal blackout',
          pt: 'Hypotension',
          soc: 'Vascular disorders',
          meddraCode: 'PT-4027',
          causality: 'Possible',
        },
      ],
      patient: {
        reference: 'PT-REV-01',
        age: 62,
        sex: 'Female',
      },
      narrative: 'Patient experienced marked drop in blood pressure 2 hours after initial dose.',
      version: 1,
    });
  });

  afterAll(async () => {
    if (testCase) {
      await Case.deleteOne({ _id: testCase._id });
      await MedicalAssessment.deleteMany({ caseId: testCase._id });
      await ActionItem.deleteMany({ caseId: testCase._id });
      await AuditEvent.deleteMany({ 'details.caseId': String(testCase._id) });
    }
    await mongoose.connection.close();
  });

  describe('GET /api/cases/:id/assessments', () => {
    it('returns baseline assessment template with precomputed causality pairs and case summary', async () => {
      const res = await request(app)
        .get(`/api/cases/${testCase._id}/assessments`)
        .set('Cookie', reviewerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.currentAssessment).toBeDefined();
      expect(res.body.currentAssessment.causality.length).toBeGreaterThan(0);
      expect(res.body.currentAssessment.causality[0].productName).toBe('CardioVas Synth 20mg');
      expect(res.body.currentAssessment.causality[0].reactionVerbatim).toContain('Acute hypotension');
    });
  });

  describe('Permissions Enforcement (Processor cannot write assessment)', () => {
    it('rejects assessment creation by data_entry role (missing medical.review permission)', async () => {
      const res = await request(app)
        .post(`/api/cases/${testCase._id}/assessments`)
        .set('Cookie', dataEntryCookie)
        .send({
          expectedness: 'unlisted',
          medicalComment: 'Unauthorized assessment attempt',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('medical.review');
    });
  });

  describe('Drafting & Updating Assessments', () => {
    let assessmentId;

    it('creates draft assessment with causality matrix and seriousness criteria', async () => {
      const res = await request(app)
        .post(`/api/cases/${testCase._id}/assessments`)
        .set('Cookie', reviewerCookie)
        .send({
          seriousnessCriteria: ['hospitalization', 'medically important'],
          expectedness: 'unlisted',
          causality: [
            {
              productName: 'CardioVas Synth 20mg',
              reactionVerbatim: 'Acute hypotension and syncopal blackout',
              reactionPt: 'Hypotension',
              causality: 'Probable',
              notes: 'Strong temporal relationship within 2 hours of administration.',
            },
          ],
          medicalComment: 'Clinical review indicates plausible pharmacodynamic reaction. No other etiology identified.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.assessment.status).toBe('DRAFT');
      expect(res.body.assessment.version).toBe(1);
      expect(res.body.assessment.seriousnessCriteria).toContain('hospitalization');
      expect(res.body.assessment.expectedness).toBe('unlisted');

      assessmentId = res.body.assessment._id;
    });

    it('patches draft assessment without changing version', async () => {
      const res = await request(app)
        .patch(`/api/assessments/${assessmentId}`)
        .set('Cookie', reviewerCookie)
        .send({
          seriousnessCriteria: ['hospitalization', 'life-threatening'],
          medicalComment: 'Updated evaluation: patient required immediate recumbency and IV fluid support.',
        });

      expect(res.status).toBe(200);
      expect(res.body.assessment.status).toBe('DRAFT');
      expect(res.body.assessment.version).toBe(1);
      expect(res.body.assessment.seriousnessCriteria).toContain('life-threatening');
    });

    it('POST /api/assessments/:id/sign electronically signs assessment, locks it, and syncs case', async () => {
      const signRes = await request(app)
        .post(`/api/assessments/${assessmentId}/sign`)
        .set('Cookie', reviewerCookie)
        .send({
          signatureStatement: 'I confirm this causality assessment represents my clinical judgment.',
        });

      expect(signRes.status).toBe(200);
      expect(signRes.body.success).toBe(true);
      expect(signRes.body.assessment.status).toBe('SIGNED');
      expect(signRes.body.assessment.signedAt).toBeDefined();
      expect(signRes.body.assessment.signedByName).toBeDefined();

      // Verify Case sync
      const updatedCase = await Case.findById(testCase._id);
      expect(updatedCase.assessment.companyCausality).toBe('Related');
      expect(updatedCase.assessment.listedness).toBe('Unlisted');
      expect(updatedCase.workflow.medicalReviewCompleted).toBe(true);
      expect(updatedCase.seriousness).toBe('Serious');

      // Verify Audit record
      const audit = await AuditEvent.findOne({
        action: 'MEDICAL_ASSESSMENT_SIGNED',
        entityId: String(assessmentId),
      });
      expect(audit).toBeDefined();
    });

    it('rejects direct edits to a SIGNED assessment if supersedeReason is missing (Immutability)', async () => {
      const res = await request(app)
        .patch(`/api/assessments/${assessmentId}`)
        .set('Cookie', reviewerCookie)
        .send({
          medicalComment: 'Attempt to tamper signed assessment without justification',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('immutable under 21 CFR Part 11');
      expect(res.body.error).toContain('supersedeReason is strictly required');
    });

    it('supersedes SIGNED assessment to create Version 2 when supersedeReason is provided', async () => {
      const res = await request(app)
        .patch(`/api/assessments/${assessmentId}`)
        .set('Cookie', reviewerCookie)
        .send({
          supersedeReason: 'Cardiology specialist consultation report received with updated causality opinion',
          medicalComment: 'Amended clinical review following cardiologist consultation: confirmed Certain causality.',
          causality: [
            {
              productName: 'CardioVas Synth 20mg',
              reactionVerbatim: 'Acute hypotension and syncopal blackout',
              reactionPt: 'Hypotension',
              causality: 'Certain',
              notes: 'Dechallenge and rechallenge both documented positive in hospital notes.',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.assessment.version).toBe(2);
      expect(res.body.assessment.status).toBe('DRAFT');
      expect(res.body.assessment.history.length).toBe(1);
      expect(res.body.assessment.history[0].version).toBe(1);
      expect(res.body.assessment.history[0].status).toBe('SIGNED');
      expect(res.body.assessment.history[0].supersedeReason).toContain('Cardiology specialist');
    });
  });

  describe('POST /api/assessments/:id/request-info', () => {
    it('creates Request for Information and automatically provisions an ActionItem task', async () => {
      const latestAssessment = await MedicalAssessment.findOne({ caseId: testCase._id, isLatest: true });

      const res = await request(app)
        .post(`/api/assessments/${latestAssessment._id}/request-info`)
        .set('Cookie', reviewerCookie)
        .send({
          query: 'Please request hospital discharge summary and baseline electrocardiogram (ECG) from the treating clinic.',
          priority: 'Urgent',
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.rfi).toBeDefined();
      expect(res.body.rfi.priority).toBe('Urgent');
      expect(res.body.actionItem).toBeDefined();

      // Check ActionItem in database
      const actionItem = await ActionItem.findById(res.body.actionItem._id);
      expect(actionItem).toBeDefined();
      expect(actionItem.caseId.toString()).toBe(testCase._id.toString());
      expect(actionItem.title).toContain('Medical RFI');
    });
  });
});

