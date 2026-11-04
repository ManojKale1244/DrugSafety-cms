import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { config } from '../config/index.js';
import { seedDatabase } from '../seeds/seed.js';
import { Case } from '../models/Case.js';
import { DuplicateReview } from '../models/DuplicateReview.js';
import { AuditEvent } from '../models/AuditEvent.js';
import {
  scoreCasePair,
  calculateLevenshteinDistance,
  calculateStringSimilarity,
} from '../services/duplicate.service.js';
import { referenceData } from '../config/referenceData.js';

describe('Module 5: Duplicate Detection Integration Tests', () => {
  let adminCookie;
  let reviewerCookie;
  let case1001;
  let case1013;
  let testReviewId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }
    await seedDatabase();

    case1001 = await Case.findOne({ caseNumber: 'CASE-1001' });
    case1013 = await Case.findOne({ caseNumber: 'CASE-1013' });

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

  describe('Levenshtein Algorithm & Fuzzy Matcher', () => {
    it('calculates accurate Levenshtein distance', () => {
      expect(calculateLevenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(calculateLevenshteinDistance('Medicine A', 'medicine a')).toBe(0);
      expect(calculateLevenshteinDistance('Tachycardia', 'Bradycardia')).toBe(4);
    });

    it('calculates normalized string similarity ratio', () => {
      expect(calculateStringSimilarity('CardioGuard', 'CardioGuard')).toBe(1.0);
      expect(calculateStringSimilarity('CardioGuard 20mg', 'CardioGuard')).toBeGreaterThanOrEqual(0.85);
      expect(calculateStringSimilarity('Headache', 'Severe Renal Failure')).toBeLessThan(0.3);
    });
  });

  describe('Scoring Service — Deterministic & Fuzzy Rules with referenceData', () => {
    it('applies weights from referenceData for deterministic matches', () => {
      const source = {
        product: 'Paracetamol',
        caseProducts: [{ productName: 'Paracetamol', role: 'Suspect' }],
        reactions: [{ pt: 'Rash', verbatim: 'Rash' }],
        receiptDate: new Date('2026-05-10'),
        patient: { age: 30, sex: 'Male' },
        reporter: { name: 'Dr. John Doe', contact: 'john@hospital.org' },
      };

      const identicalCandidate = {
        product: 'Paracetamol',
        caseProducts: [{ productName: 'Paracetamol', role: 'Suspect' }],
        reactions: [{ pt: 'Rash', verbatim: 'Rash' }],
        receiptDate: new Date('2026-05-10'),
        patient: { age: 30, sex: 'Male' },
        reporter: { name: 'Dr. John Doe', contact: 'john@hospital.org' },
      };

      const result = scoreCasePair(source, identicalCandidate);
      expect(result.score).toBe(100);
      expect(result.matchedFields).toContain('Suspected Product');
      expect(result.matchedFields).toContain('Adverse Reaction Term');
      expect(result.matchedFields).toContain('Event Date');
      expect(result.matchedFields).toContain('Patient Sex');
      expect(result.matchedFields).toContain('Patient Age');
      expect(result.matchedFields).toContain('Reporter Name');
    });

    it('scores near-duplicate cases with high weighted score', () => {
      expect(case1001).toBeTruthy();
      expect(case1013).toBeTruthy();

      const result = scoreCasePair(case1013, case1001);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.matchedFields.length).toBeGreaterThanOrEqual(3);
      expect(result.breakdown.product.score).toBe(referenceData.duplicateDetection.weights.productMatch);
    });
  });

  describe('GET /api/duplicates/queue', () => {
    it('returns ranked duplicate candidates sorted by score descending', async () => {
      const res = await request(app)
        .get('/api/duplicates/queue')
        .set('Cookie', reviewerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify descending order by score
      const scores = res.body.data.map((d) => d.score);
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
      }

      // Save a pending review ID for subsequent decision test
      const pendingItem = res.body.data.find((d) => d.decision === 'PENDING');
      expect(pendingItem).toBeTruthy();
      testReviewId = pendingItem._id;
    });

    it('allows filtering by decision state', async () => {
      const res = await request(app)
        .get('/api/duplicates/queue?decision=PENDING')
        .set('Cookie', reviewerCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.forEach((item) => {
        expect(item.decision).toBe('PENDING');
      });
    });
  });

  describe('POST /api/duplicates/check', () => {
    it('screens an existing case and returns scored candidates', async () => {
      const res = await request(app)
        .post('/api/duplicates/check')
        .set('Cookie', reviewerCookie)
        .send({ sourceCaseId: case1013._id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.candidates)).toBe(true);
      expect(res.body.candidates.length).toBeGreaterThan(0);
      expect(res.body.candidates[0].score).toBeGreaterThanOrEqual(35);
    });

    it('performs ad-hoc screening for new intake payload before creation', async () => {
      const res = await request(app)
        .post('/api/duplicates/check')
        .set('Cookie', reviewerCookie)
        .send({
          product: 'CardioGuard',
          reaction: 'Tachycardia and syncopal episode',
          patient: { age: 54, sex: 'Male' },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.candidates.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/duplicates/:id/decide — Human Decision & No Auto-Merge', () => {
    it('rejects decision without mandatory reason (audit compliance)', async () => {
      const res = await request(app)
        .post(`/api/duplicates/${testReviewId}/decide`)
        .set('Cookie', reviewerCookie)
        .send({
          decision: 'CONFIRMED_DUPLICATE',
          reason: '', // Empty reason
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/reason.*mandatory/i);
    });

    it('rejects invalid decision enum values', async () => {
      const res = await request(app)
        .post(`/api/duplicates/${testReviewId}/decide`)
        .set('Cookie', reviewerCookie)
        .send({
          decision: 'AUTO_MERGE_DISMISS',
          reason: 'Attempting invalid automated decision',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('requires authentication to decide duplicate', async () => {
      const res = await request(app)
        .post(`/api/duplicates/${testReviewId}/decide`)
        .send({
          decision: 'CONFIRMED_DUPLICATE',
          reason: 'Review notes',
        });

      expect(res.status).toBe(401);
    });

    it('records CONFIRMED_DUPLICATE decision, links cases, preserves both histories, and writes audit event', async () => {
      const reviewBefore = await DuplicateReview.findById(testReviewId);
      expect(reviewBefore).toBeTruthy();

      const reason = 'Confirmed clinical duplicate: identical patient demographics and overlapping event window';

      const res = await request(app)
        .post(`/api/duplicates/${testReviewId}/decide`)
        .set('Cookie', reviewerCookie)
        .send({
          decision: 'CONFIRMED_DUPLICATE',
          reason,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.decision).toBe('CONFIRMED_DUPLICATE');
      expect(res.body.data.reason).toBe(reason);

      // Verify reciprocal case links were created
      const updatedSource = await Case.findById(reviewBefore.sourceId);
      const updatedCandidate = await Case.findById(reviewBefore.candidateCaseId);

      expect(updatedSource).toBeTruthy();
      expect(updatedCandidate).toBeTruthy();

      // Complete histories are preserved — neither case was deleted
      expect(updatedSource.linkedCases.some((l) => l.caseNumber === updatedCandidate.caseNumber)).toBe(true);
      expect(updatedCandidate.linkedCases.some((l) => l.caseNumber === updatedSource.caseNumber)).toBe(true);

      // Verify immutable AuditEvent was created
      const auditLog = await AuditEvent.findOne({
        entityId: testReviewId.toString(),
        action: 'DUPLICATE_MERGE_CONFIRMED',
      });
      expect(auditLog).toBeTruthy();
      expect(auditLog.details.decision).toBe('CONFIRMED_DUPLICATE');
      expect(auditLog.details.reason).toBe(reason);
    });
  });
});
