import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { config } from '../config/index.js';
import { seedDatabase } from '../seeds/seed.js';
import { Case } from '../models/Case.js';
import { Term } from '../models/Term.js';
import { CodingRecord } from '../models/CodingRecord.js';
import { AuditEvent } from '../models/AuditEvent.js';

describe('Module 6: Medical Coding & Synthetic Terminology Integration Tests', () => {
  let adminCookie;
  let testCase;
  let testReaction;
  let nauseaPt;
  let rashPt;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }
    await seedDatabase();

    // Login as admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@drugsafety.local', password: 'Admin@123456' });
    adminCookie = loginRes.headers['set-cookie'];

    // Find test terms
    nauseaPt = await Term.findOne({ name: 'Nausea', level: 'PT' });
    rashPt = await Term.findOne({ name: 'Rash', level: 'PT' });

    // Create a test case with an uncoded reaction
    testCase = await Case.create({
      caseNumber: 'DS-2026-98001',
      status: 'data_entry',
      priority: 'high',
      product: 'NeuroCalm Synth 10mg',
      patient: {
        reference: 'PT-CODING-01',
        age: 38,
        sex: 'Female',
      },
      reactions: [
        {
          verbatim: 'Patient developed severe morning queasiness and nausea',
          pt: '',
          soc: '',
          meddraCode: '',
        },
      ],
      caseProducts: [
        {
          productName: 'NeuroCalm Synth 10mg',
          role: 'Suspect',
        },
      ],
      narrative: 'Patient experienced adverse reactions after starting trial medication.',
      assessment: {
        companyCausality: 'Probable',
      },
      version: 1,
    });

    testReaction = testCase.reactions[0];
  });

  afterAll(async () => {
    if (testCase) {
      await Case.deleteOne({ _id: testCase._id });
      await CodingRecord.deleteMany({ caseId: testCase._id });
      await AuditEvent.deleteMany({ 'details.caseId': String(testCase._id) });
    }
    await mongoose.connection.close();
  });

  describe('GET /api/coding/terms', () => {
    it('returns autocomplete search results with full hierarchy breadcrumbs', async () => {
      const res = await request(app)
        .get('/api/coding/terms?q=nausea')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.terms)).toBe(true);
      expect(res.body.terms.length).toBeGreaterThan(0);

      const match = res.body.terms.find((t) => t.name === 'Nausea');
      expect(match).toBeDefined();
      expect(match.level).toBe('PT');
      expect(match.breadcrumb).toContain('Gastrointestinal disorders');
      expect(match.hierarchy.length).toBeGreaterThanOrEqual(4);
    });

    it('filters terms by level when specified', async () => {
      const res = await request(app)
        .get('/api/coding/terms?q=rash&level=PT')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.terms.forEach((t) => {
        expect(t.level).toBe('PT');
      });
    });
  });

  describe('POST /api/coding/records', () => {
    let createdRecordId;

    it('creates a coding record, preserves verbatim, syncs case reaction, and audits action', async () => {
      const res = await request(app)
        .post('/api/coding/records')
        .set('Cookie', adminCookie)
        .send({
          caseId: testCase._id,
          reactionId: testReaction._id,
          codedTermId: nauseaPt._id,
          dictionaryVersion: 'SYN-MedDRA-27.0',
          reason: 'Initial verbatim coding by safety specialist',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.codingRecord).toBeDefined();
      expect(res.body.codingRecord.verbatimText).toBe(testReaction.verbatim);
      expect(res.body.codingRecord.codedTermId._id).toBe(String(nauseaPt._id));

      createdRecordId = res.body.codingRecord._id;

      // Verify case reaction synchronization
      const updatedCase = await Case.findById(testCase._id);
      expect(updatedCase.reactions[0].pt).toBe('Nausea');
      expect(updatedCase.reactions[0].meddraCode).toBe(nauseaPt.code);
      expect(updatedCase.reactions[0].soc).toBe('Gastrointestinal disorders');

      // Verify 21 CFR Part 11 audit trail event was recorded
      const audit = await AuditEvent.findOne({
        action: 'CODING_RECORD_CREATED',
        entityId: String(createdRecordId),
      });
      expect(audit).toBeDefined();
      expect(audit.summary).toContain('Nausea');
    });

    it('PATCH /api/coding/records/:id updates coding record with mandatory reason and preserves history', async () => {
      // Re-code from Nausea to Rash (for testing override)
      const res = await request(app)
        .patch(`/api/coding/records/${createdRecordId}`)
        .set('Cookie', adminCookie)
        .send({
          codedTermId: rashPt._id,
          reason: 'Medical review reclassification based on dermatologist consult',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.codingRecord.codedTermId._id).toBe(String(rashPt._id));
      expect(res.body.codingRecord.history.length).toBe(1);
      expect(res.body.codingRecord.history[0].reason).toBe(
        'Medical review reclassification based on dermatologist consult',
      );
      expect(res.body.codingRecord.history[0].codedTermSnapshot.name).toBe('Nausea');

      // Verify audit record for override
      const audit = await AuditEvent.findOne({
        action: 'CODING_RECORD_OVERRIDDEN',
        entityId: String(createdRecordId),
      });
      expect(audit).toBeDefined();
    });

    it('PATCH /api/coding/records/:id fails if reason is omitted (21 CFR Part 11 enforcement)', async () => {
      const res = await request(app)
        .patch(`/api/coding/records/${createdRecordId}`)
        .set('Cookie', adminCookie)
        .send({
          codedTermId: nauseaPt._id,
          reason: '', // Missing reason
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('reason is strictly required');
    });
  });

  describe('GET /api/cases/:id/coding', () => {
    it('returns complete coding status, uncoded counts, and top 5 suggestions', async () => {
      const res = await request(app)
        .get(`/api/cases/${testCase._id}/coding`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reactionsCount).toBe(1);
      expect(res.body.codedCount).toBe(1);
      expect(res.body.uncodedCount).toBe(0);
      expect(res.body.isAllCoded).toBe(true);
      expect(res.body.items[0].autoSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow Progression Acceptance Gate', () => {
    let unCodedCase;

    beforeAll(async () => {
      unCodedCase = await Case.create({
        caseNumber: 'DS-2026-98002',
        status: 'data_entry',
        priority: 'high',
        product: 'NeuroCalm Synth 10mg',
        patient: { reference: 'PT-02', age: 25, sex: 'Male' },
        reactions: [
          {
            verbatim: 'Severe palpitations and dizziness',
            pt: '',
            soc: '',
            meddraCode: '',
          },
        ],
        caseProducts: [{ productName: 'NeuroCalm Synth 10mg', role: 'Suspect' }],
        narrative: 'Narrative text',
        version: 1,
      });
    });

    afterAll(async () => {
      if (unCodedCase) {
        await Case.deleteOne({ _id: unCodedCase._id });
      }
    });

    it('blocks advancing workflow to medical_review when reactions are uncoded', async () => {
      const res = await request(app)
        .patch(`/api/cases/${unCodedCase._id}`)
        .set('Cookie', adminCookie)
        .send({
          status: 'medical_review',
          version: unCodedCase.version,
          changeReason: 'Advancing case to medical review',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot advance workflow to "medical_review"');
      expect(res.body.error).toContain('remain uncoded');
    });

    it('allows advancing workflow to medical_review once reactions are coded', async () => {
      // Code the reaction
      const codeRes = await request(app)
        .post('/api/coding/records')
        .set('Cookie', adminCookie)
        .send({
          caseId: unCodedCase._id,
          reactionId: unCodedCase.reactions[0]._id,
          codedTermId: nauseaPt._id,
          reason: 'Initial coding',
        });
      expect(codeRes.status).toBe(201);

      // Fetch fresh version
      const freshCase = await Case.findById(unCodedCase._id);

      // Now advancing should succeed
      const advanceRes = await request(app)
        .patch(`/api/cases/${unCodedCase._id}`)
        .set('Cookie', adminCookie)
        .send({
          status: 'medical_review',
          version: freshCase.version,
          changeReason: 'Advancing case to medical review after coding completed',
        });

      expect(advanceRes.status).toBe(200);
      expect(advanceRes.body.case.status).toBe('medical_review');
    });
  });
});

