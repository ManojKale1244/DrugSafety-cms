import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { config } from '../config/index.js';
import { seedDatabase } from '../seeds/seed.js';
import { Case } from '../models/Case.js';
import { WorkflowTask } from '../models/WorkflowTask.js';
import { WorkflowHistory } from '../models/WorkflowHistory.js';
import { AuditEvent } from '../models/AuditEvent.js';

describe('Module 8: Configurable Workflow Engine Integration Tests', () => {
  let adminCookie;
  let reviewerCookie;
  let dataEntryCookie;
  let testCase;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }
    await seedDatabase();

    // Login accounts
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@drugsafety.local', password: 'Admin@123456' });
    adminCookie = adminRes.headers['set-cookie'];

    const revRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reviewer@drugsafety.local', password: 'Reviewer@123456' });
    reviewerCookie = revRes.headers['set-cookie'];

    const deRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'dataentry@drugsafety.local', password: 'DataEntry@123456' });
    dataEntryCookie = deRes.headers['set-cookie'];

    // Create a safety case at NEW stage
    testCase = await Case.create({
      caseNumber: 'DS-2026-96001',
      status: 'NEW',
      priority: 'high',
      product: 'CardioVas Synth 20mg',
      patient: { reference: 'PT-WF-01', age: 48, sex: 'Male' },
      reporter: { name: 'Dr. Robert King', qualification: 'Physician' },
      reactions: [
        {
          verbatim: 'Transient arrhythmia and palpitations',
          pt: 'Palpitations',
          soc: 'Cardiac disorders',
          meddraCode: 'PT-4022',
        },
      ],
      caseProducts: [{ productName: 'CardioVas Synth 20mg', role: 'Suspect' }],
      narrative: 'Patient developed palpitations 30 minutes following administration.',
      version: 1,
    });
  });

  afterAll(async () => {
    if (testCase) {
      await Case.deleteOne({ _id: testCase._id });
      await WorkflowTask.deleteMany({ caseId: testCase._id });
      await WorkflowHistory.deleteMany({ caseId: testCase._id });
      await AuditEvent.deleteMany({ 'details.caseNumber': testCase.caseNumber });
    }
    await mongoose.connection.close();
  });

  describe('GET /api/cases/:id/workflow', () => {
    it('returns current stage, allowed candidate transitions, check evaluations, and history', async () => {
      const res = await request(app)
        .get(`/api/cases/${testCase._id}/workflow`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.currentStage).toBe('NEW');
      expect(Array.isArray(res.body.stages)).toBe(true);
      expect(res.body.allowedTransitions.length).toBeGreaterThan(0);

      const toDataEntry = res.body.allowedTransitions.find((t) => t.to === 'DATA_ENTRY');
      expect(toDataEntry).toBeDefined();
      expect(toDataEntry.canRoute).toBe(true);
    });
  });

  describe('POST /api/cases/:id/route Validation Engine', () => {
    it('rejects illegal transitions (direct jump from NEW to CLOSED is blocked)', async () => {
      const res = await request(app)
        .post(`/api/cases/${testCase._id}/route`)
        .set('Cookie', adminCookie)
        .send({
          targetStage: 'CLOSED',
          reason: 'Attempting invalid shortcut',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Illegal transition');
    });

    it('rejects transitions if role is unauthorized', async () => {
      // First route case to DATA_ENTRY
      await request(app)
        .post(`/api/cases/${testCase._id}/route`)
        .set('Cookie', adminCookie)
        .send({ targetStage: 'DATA_ENTRY' });

      // Move to MEDICAL_CODING
      await request(app)
        .post(`/api/cases/${testCase._id}/route`)
        .set('Cookie', adminCookie)
        .send({ targetStage: 'MEDICAL_CODING' });

      // Now attempt transition to REGULATORY_REPORTING as data_entry role (not allowed)
      const res = await request(app)
        .post(`/api/cases/${testCase._id}/route`)
        .set('Cookie', dataEntryCookie)
        .send({ targetStage: 'REGULATORY_REPORTING' });

      expect(res.status).toBe(400); // either illegal or forbidden
    });

    it('rejects backward transitions if justification reason is missing', async () => {
      const res = await request(app)
        .post(`/api/cases/${testCase._id}/route`)
        .set('Cookie', adminCookie)
        .send({
          targetStage: 'DATA_ENTRY',
          reason: '', // Missing reason
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('reason is strictly required');
    });

    it('successfully executes valid transition, creates task, records history, and audits move', async () => {
      // Return from MEDICAL_CODING to DATA_ENTRY with reason
      const res = await request(app)
        .post(`/api/cases/${testCase._id}/route`)
        .set('Cookie', adminCookie)
        .send({
          targetStage: 'DATA_ENTRY',
          reason: 'Verbatim description requires transcription clarification from source hospital chart',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.to).toBe('DATA_ENTRY');
      expect(res.body.case.status).toBe('DATA_ENTRY');

      // Verify WorkflowTask was created for target stage
      const task = await WorkflowTask.findOne({ caseId: testCase._id, stage: 'DATA_ENTRY', status: 'pending' });
      expect(task).toBeDefined();

      // Verify WorkflowHistory was recorded
      const history = await WorkflowHistory.findOne({
        caseId: testCase._id,
        to: 'DATA_ENTRY',
      }).sort({ at: -1 });
      expect(history).toBeDefined();
      expect(history.reason).toContain('transcription clarification');

      // Verify 21 CFR Part 11 Audit
      const audit = await AuditEvent.findOne({
        action: 'CASE_WORKFLOW_ROUTED',
        entityId: String(testCase._id),
      }).sort({ timestamp: -1 });
      expect(audit).toBeDefined();
    });
  });

  describe('Worklist and Task Endpoints', () => {
    it('GET /api/tasks/my returns active tasks for the authenticated user', async () => {
      const res = await request(app)
        .get('/api/tasks/my')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.tasks)).toBe(true);
    });

    it('GET /api/tasks/team returns all team tasks and workload breakdown', async () => {
      const res = await request(app)
        .get('/api/tasks/team')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.workload)).toBe(true);
      expect(typeof res.body.totalActiveTasks).toBe('number');
    });

    it('POST /api/tasks/:id/reassign reassigns task and updates case assignee', async () => {
      const task = await WorkflowTask.findOne({ caseId: testCase._id, status: 'pending' });
      if (!task) return;

      // Find reviewer user id
      const reviewerUser = await mongoose.model('User').findOne({ email: 'reviewer@drugsafety.local' });

      const res = await request(app)
        .post(`/api/tasks/${task._id}/reassign`)
        .set('Cookie', adminCookie)
        .send({
          assignedTo: reviewerUser._id,
          reason: 'Load rebalancing across safety team',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.task.assignedToName).toBe(reviewerUser.name);

      // Verify case was also updated
      const updatedCase = await Case.findById(testCase._id);
      expect(updatedCase.assignedTo.toString()).toBe(reviewerUser._id.toString());
    });
  });
});

