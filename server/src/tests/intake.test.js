import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { config } from '../config/index.js';
import { seedDatabase } from '../seeds/seed.js';
import { Intake } from '../models/Intake.js';
import { generateIntakeNumber } from '../services/intake.service.js';

describe('Module 3: Case Intake Integration Tests', () => {
  let adminCookie;
  let dataEntryCookie;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }
    await seedDatabase();
    // Clean up any test-generated intakes to prevent sequence bleeding
    await Intake.deleteMany({
      intakeNumber: {
        $nin: ['INT-2026-00001', 'INT-2026-00002', 'INT-2026-00003', 'INT-2026-00004'],
      },
    });

    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@drugsafety.local', password: 'Admin@123456' });
    adminCookie = adminRes.headers['set-cookie'];

    const deRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dataentry@drugsafety.local', password: 'DataEntry@123456' });
    dataEntryCookie = deRes.headers['set-cookie'];
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/intakes', () => {
    it('creates intake and runs minimum criteria evaluation + duplicate screening', async () => {
      const res = await request(app)
        .post('/api/intakes')
        .set('Cookie', dataEntryCookie)
        .send({
          source: 'physician',
          receiptDate: new Date().toISOString(),
          reporter: {
            name: 'Dr. Anita Roy',
            qualification: 'Physician',
            contact: 'anita.roy@clinic.in',
            country: 'India',
          },
          patient: {
            reference: 'PT-9941',
            age: 52,
            ageUnit: 'years',
            sex: 'Female',
          },
          suspectedProduct: 'Medicine A',
          reportedReaction: 'Acute Generalized Exanthematous Pustulosis',
          narrative: 'Patient experienced pustular eruption within 3 days of starting therapy.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.intake).toBeDefined();
      expect(res.body.intake.intakeNumber).toMatch(/^INT-\d{4}-\d{5}$/);
      expect(res.body.intake.status).toBe('RECEIVED');
      expect(res.body.intake.validation.hasMinimumCriteria).toBe(true);
      expect(Array.isArray(res.body.intake.validation.duplicateCandidates)).toBe(true);
    });

    it('rejects creation when receiptDate is in the future', async () => {
      const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post('/api/intakes')
        .set('Cookie', dataEntryCookie)
        .send({
          source: 'physician',
          receiptDate: futureDate,
          suspectedProduct: 'Medicine A',
          reportedReaction: 'Skin Rash',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.issues?.some((i) => i.message.includes('future'))).toBe(true);
    });
  });

  describe('POST /api/intakes/:id/create-case (Conversion)', () => {
    it('blocks conversion when an incomplete intake lacks minimum criteria', async () => {
      // Find incomplete intake
      const incompleteIntake = await Intake.findOne({ intakeNumber: 'INT-2026-00002' });
      expect(incompleteIntake).toBeDefined();

      const res = await request(app)
        .post(`/api/intakes/${incompleteIntake._id}/create-case`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/missing required criteria/i);
      expect(res.body.missingFields).toContain('Identifiable Patient (Reference ID, Age, or Sex)');
    });

    it('successfully converts valid intake into a Case with DS-YYYY-NNNNN number', async () => {
      // Find complete intake INT-2026-00001
      const readyIntake = await Intake.findOne({ intakeNumber: 'INT-2026-00001' });
      expect(readyIntake).toBeDefined();

      const res = await request(app)
        .post(`/api/intakes/${readyIntake._id}/create-case`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.case).toBeDefined();

      // Verified DS-YYYY-NNNNN format
      expect(res.body.case.caseNumber).toMatch(/^DS-\d{4}-\d{5}$/);
      expect(res.body.case.product).toBe(readyIntake.suspectedProduct);
      expect(res.body.case.eventSummary).toBe(readyIntake.reportedReaction);

      // Verify intake updated
      const updatedIntake = await Intake.findById(readyIntake._id);
      expect(updatedIntake.status).toBe('CONVERTED');
      expect(updatedIntake.convertedCaseNumber).toBe(res.body.case.caseNumber);
    });
  });

  describe('POST /api/intakes/:id/reject', () => {
    it('requires a rejection reason and updates status to REJECTED', async () => {
      // Create a dummy intake to reject
      const num = await generateIntakeNumber();
      const intake = await Intake.create({
        intakeNumber: num,
        source: 'other',
        receiptDate: new Date(),
        suspectedProduct: 'Spam Product',
        reportedReaction: 'None',
        status: 'RECEIVED',
      });

      // Attempt rejection without reason -> 400
      const failRes = await request(app)
        .post(`/api/intakes/${intake._id}/reject`)
        .set('Cookie', adminCookie)
        .send({ reason: '' });

      expect(failRes.status).toBe(400);

      // Successful rejection
      const successRes = await request(app)
        .post(`/api/intakes/${intake._id}/reject`)
        .set('Cookie', adminCookie)
        .send({ reason: 'Duplicate duplicate test submission with zero clinical validity' });

      expect(successRes.status).toBe(200);
      expect(successRes.body.intake.status).toBe('REJECTED');
      expect(successRes.body.intake.rejectionReason).toContain('clinical validity');
    });
  });
});
