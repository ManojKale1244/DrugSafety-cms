import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { config } from '../config/index.js';
import { seedDatabase } from '../seeds/seed.js';
import { Case } from '../models/Case.js';

describe('Module 4: Safety Case Management Integration Tests', () => {
  let adminCookie;
  let reviewerCookie;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }
    await seedDatabase();
    await Case.deleteMany({ caseNumber: /^DS-\d{4}-9/ });

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@drugsafety.local', password: 'Admin@123456' });
    adminCookie = adminRes.headers['set-cookie'];

    const reviewerRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reviewer@drugsafety.local', password: 'Reviewer@123456' });
    reviewerCookie = reviewerRes.headers['set-cookie'];
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/cases', () => {
    it('creates a new safety case with auto-generated case number and initial audit', async () => {
      const res = await request(app)
        .post('/api/cases')
        .set('Cookie', adminCookie)
        .send({
          priority: 'high',
          product: 'NeuroCalm 10mg',
          eventSummary: 'Severe tremors and transient dysphasia',
          patient: {
            reference: 'PT-TEST-001',
            age: 45,
            ageUnit: 'years',
            sex: 'Male',
          },
          caseProducts: [
            {
              productName: 'NeuroCalm 10mg',
              role: 'Suspect',
              dose: '10mg daily',
            },
          ],
          reactions: [
            {
              verbatim: 'Severe tremors and transient dysphasia',
              pt: 'Tremor',
              outcome: 'recovering',
            },
          ],
          narrative: 'Patient developed tremors within 48h of dose increase.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.case.caseNumber).toMatch(/^DS-\d{4}-\d{5}$/);
      expect(res.body.case.version).toBe(1);
      expect(res.body.case.priority).toBe('high');
    });
  });

  describe('GET /api/cases & GET /api/cases/export/csv', () => {
    it('returns paginated list and filtered results', async () => {
      const res = await request(app)
        .get('/api/cases?limit=5&sortBy=createdAt&sortOrder=desc')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.cases)).toBe(true);
      expect(res.body.pagination.total).toBeGreaterThan(0);
    });

    it('exports safety cases to CSV format', async () => {
      const res = await request(app)
        .get('/api/cases/export/csv')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Case Number,Status,Priority');
    });
  });

  describe('Optimistic Concurrency Control (Conflict Detection)', () => {
    it('detects concurrent edit and rejects with HTTP 409 when version mismatch occurs', async () => {
      // 1. Create a test case with version 1
      const testCase = await Case.create({
        caseNumber: 'DS-2026-90001',
        product: 'CardioSafe',
        eventSummary: 'Palpitations',
        version: 1,
        priority: 'medium',
        status: 'data_entry',
      });

      // 2. User B updates the case to version 2
      const updateRes1 = await request(app)
        .patch(`/api/cases/${testCase._id}`)
        .set('Cookie', adminCookie)
        .send({
          version: 1,
          priority: 'high',
          changeReason: 'Medical reviewer upgraded priority to High',
        });

      expect(updateRes1.status).toBe(200);
      expect(updateRes1.body.case.version).toBe(2);
      expect(updateRes1.body.case.priority).toBe('high');

      // 3. User A (who still has version 1 in their UI form) attempts to save edits
      const staleRes = await request(app)
        .patch(`/api/cases/${testCase._id}`)
        .set('Cookie', adminCookie)
        .send({
          version: 1, // Stale version!
          priority: 'urgent',
          changeReason: 'Conflicting change',
        });

      // Must be rejected with 409 Conflict
      expect(staleRes.status).toBe(409);
      expect(staleRes.body.success).toBe(false);
      expect(staleRes.body.isConflict).toBe(true);
      expect(staleRes.body.currentCase).toBeDefined();
      expect(staleRes.body.currentCase.version).toBe(2);
    });
  });

  describe('Closed Case Guard & Workflow Closure', () => {
    it('prevents closing case when required workflow steps are incomplete', async () => {
      const incompleteCase = await Case.create({
        caseNumber: 'DS-2026-90002',
        product: 'TestMed',
        eventSummary: 'Rash',
        version: 1,
        status: 'medical_review',
        // missing narrative and company causality assessment
      });

      const res = await request(app)
        .post(`/api/cases/${incompleteCase._id}/close`)
        .set('Cookie', adminCookie)
        .send({ closureReason: 'Routine close' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Outstanding workflow items');
    });

    it('closes case when all criteria are complete and enforces read-only for closed case', async () => {
      // 1. Create a fully populated case
      const readyCase = await Case.create({
        caseNumber: 'DS-2026-90003',
        product: 'TestMed',
        eventSummary: 'Skin rash',
        narrative: 'Complete clinical narrative for case closure testing.',
        patient: { reference: 'PT-9988', age: 34, sex: 'Female' },
        caseProducts: [{ productName: 'TestMed', role: 'Suspect' }],
        reactions: [{ verbatim: 'Skin rash', pt: 'Rash' }],
        assessment: {
          companyCausality: 'Related',
          listedness: 'Listed',
          medicalReviewerComments: 'Consistent with drug safety profile.',
        },
        version: 1,
        status: 'quality_review',
      });

      // 2. Close case with reason
      const closeRes = await request(app)
        .post(`/api/cases/${readyCase._id}/close`)
        .set('Cookie', adminCookie)
        .send({ closureReason: 'All PV reviews completed, submission verified' });

      expect(closeRes.status).toBe(200);
      expect(closeRes.body.case.status).toBe('closed');
      expect(closeRes.body.case.closedAt).toBeDefined();

      // 3. Attempting to edit closed case must be rejected as read-only (HTTP 403)
      const editRes = await request(app)
        .patch(`/api/cases/${readyCase._id}`)
        .set('Cookie', reviewerCookie)
        .send({
          version: closeRes.body.case.version,
          priority: 'urgent',
          changeReason: 'Unauthorized modification after closure',
        });

      expect(editRes.status).toBe(403);
      expect(editRes.body.error).toContain('Closed cases are archived and read-only');
    });
  });

  describe('GET /api/cases/:id/history', () => {
    it('returns every edit and field-level change in case history', async () => {
      const historyCase = await Case.create({
        caseNumber: 'DS-2026-90004',
        product: 'HistoryMed',
        eventSummary: 'Nausea',
        version: 1,
        priority: 'low',
      });

      // Perform an edit with changeReason
      await request(app)
        .patch(`/api/cases/${historyCase._id}`)
        .set('Cookie', adminCookie)
        .send({
          version: 1,
          priority: 'high',
          changeReason: 'Safety committee requested urgency escalation',
        });

      // Fetch history
      const historyRes = await request(app)
        .get(`/api/cases/${historyCase._id}/history`)
        .set('Cookie', adminCookie);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.success).toBe(true);
      expect(Array.isArray(historyRes.body.history)).toBe(true);

      const updateEvent = historyRes.body.history.find((e) => e.action === 'CASE_UPDATE');
      expect(updateEvent).toBeDefined();
      expect(updateEvent.meta.changeReason).toContain('Safety committee');
      expect(updateEvent.meta.diffs.some((d) => d.field === 'priority')).toBe(true);
    });
  });
});
